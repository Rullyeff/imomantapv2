import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";

/**
 * Cron endpoint: dipanggil tiap menit oleh pg_cron.
 * Cari semua jadwal obat aktif yang waktunya = jam saat ini (WIB / UTC+7),
 * lalu kirim Web Push ke semua subscription milik pasien terkait.
 *
 * Auth: `/api/public/*` bypasses platform auth on published sites — handler
 * verifies caller via the server-only CRON_SECRET (`x-cron-secret` header).
 */
export const Route = createFileRoute("/api/public/hooks/medication-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Current time in WIB (UTC+7)
        const now = new Date();
        const wibMins = (now.getUTCHours() * 60 + now.getUTCMinutes() + 7 * 60) % (24 * 60);
        const hh = String(Math.floor(wibMins / 60)).padStart(2, "0");
        const mm = String(wibMins % 60).padStart(2, "0");
        const timeStrFull = `${hh}:${mm}:00`;
        const timeStrShort = `${hh}:${mm}`;

        // Tarik semua jadwal aktif (jumlah baris kecil — filter di JS supaya bisa cocokkan dengan/tanpa detik)
        const { data: meds, error: medsErr } = await supabaseAdmin
          .from("medications")
          .select("id, user_id, name, dosage, schedule_time")
          .eq("is_active", true)
          .eq("is_approved", true);
        if (medsErr) return new Response(medsErr.message, { status: 500 });

        type Match = { user_id: string; name: string; dosage: string | null; time: string };
        const matches: Match[] = [];
        for (const m of meds ?? []) {
          const times: string[] = (m.schedule_time as string[] | null) ?? [];
          for (const t of times) {
            const norm = t.length >= 8 ? t.slice(0, 8) : `${t.slice(0, 5)}:00`;
            if (norm === timeStrFull || norm.slice(0, 5) === timeStrShort) {
              matches.push({
                user_id: m.user_id as string,
                name: m.name as string,
                dosage: (m.dosage as string | null) ?? null,
                time: timeStrShort,
              });
              break;
            }
          }
        }

        if (matches.length === 0) {
          return Response.json({ ok: true, time: timeStrShort, matched: 0, sent: 0 });
        }

        const userIds = Array.from(new Set(matches.map((m) => m.user_id)));
        const { data: subs, error: subsErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth_key")
          .in("user_id", userIds);
        if (subsErr) return new Response(subsErr.message, { status: 500 });

        if (!subs || subs.length === 0) {
          return Response.json({ ok: true, time: timeStrShort, matched: matches.length, sent: 0 });
        }

        const webpushMod: typeof import("web-push") = await import("web-push");
        const webpush =
          (webpushMod as unknown as { default?: typeof webpushMod }).default ?? webpushMod;
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:admin@sehatpantau.id",
          process.env.VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!,
        );

        // Group medications per user
        const perUser = new Map<string, Match[]>();
        for (const m of matches) {
          const arr = perUser.get(m.user_id) ?? [];
          arr.push(m);
          perUser.set(m.user_id, arr);
        }

        let sent = 0;
        const expired: string[] = [];
        for (const s of subs) {
          const ms = perUser.get(s.user_id as string) ?? [];
          if (ms.length === 0) continue;
          const title =
            ms.length === 1
              ? `💊 ${ms[0].name} · ${ms[0].time}`
              : `💊 ${ms.length} obat · ${ms[0].time}`;
          const body =
            ms.length === 1
              ? ms[0].dosage || "Saatnya minum obat"
              : ms.map((m) => `• ${m.name}${m.dosage ? ` (${m.dosage})` : ""}`).join("\n");

          try {
            await webpush.sendNotification(
              {
                endpoint: s.endpoint as string,
                keys: { p256dh: s.p256dh as string, auth: s.auth_key as string },
              },
              JSON.stringify({
                title,
                body,
                tag: `med-${timeStrShort}`,
                url: "/pasien/obat",
              }),
            );
            sent++;
          } catch (err: unknown) {
            const e = err as { statusCode?: number };
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              expired.push(s.endpoint as string);
            }
          }
        }

        if (expired.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
        }

        return Response.json({
          ok: true,
          time: timeStrShort,
          matched: matches.length,
          sent,
          expiredRemoved: expired.length,
        });
      },
    },
  },
});
