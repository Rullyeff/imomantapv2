import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";

/**
 * Auto-mark missed doses. Called by pg_cron every 30 min.
 * Auth: `x-cron-secret` header (or `Authorization: Bearer ...`) must equal the
 * server-only CRON_SECRET.
 *
 * Logic: for every active+approved medication, iterate today's scheduled times.
 * Any slot whose time is more than 2 hours in the past (Asia/Jakarta) and has
 * no log → insert a `missed` log.
 */
export const Route = createFileRoute("/api/public/hooks/mark-missed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Today in Asia/Jakarta (UTC+7)
        const nowUtc = new Date();
        const jakartaMs = nowUtc.getTime() + 7 * 3600 * 1000;
        const j = new Date(jakartaMs);
        const yyyy = j.getUTCFullYear();
        const mm = String(j.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(j.getUTCDate()).padStart(2, "0");
        const today = `${yyyy}-${mm}-${dd}`;
        const nowMinutes = j.getUTCHours() * 60 + j.getUTCMinutes();
        const cutoff = nowMinutes - 120; // 2 hours grace

        const { data: meds, error: medsErr } = await supabaseAdmin
          .from("medications")
          .select("id, user_id, schedule_time")
          .eq("is_active", true)
          .eq("is_approved", true);
        if (medsErr) return Response.json({ error: medsErr.message }, { status: 500 });

        const { data: existing, error: exErr } = await supabaseAdmin
          .from("adherence_logs")
          .select("medication_id, scheduled_time")
          .eq("scheduled_date", today);
        if (exErr) return Response.json({ error: exErr.message }, { status: 500 });

        const have = new Set(
          (existing ?? []).map((l) => `${l.medication_id}|${(l.scheduled_time ?? "").slice(0, 5)}`),
        );

        const toInsert: Array<{
          user_id: string;
          medication_id: string;
          scheduled_date: string;
          scheduled_time: string;
          is_taken: boolean;
          status: string;
        }> = [];

        for (const m of meds ?? []) {
          const times = (m.schedule_time as string[] | null) ?? [];
          for (const t of times) {
            const hhmm = String(t).slice(0, 5);
            const [h, mi] = hhmm.split(":").map(Number);
            if (Number.isNaN(h) || Number.isNaN(mi)) continue;
            const slotMin = h * 60 + mi;
            if (slotMin > cutoff) continue; // not yet 2h past
            if (have.has(`${m.id}|${hhmm}`)) continue;
            toInsert.push({
              user_id: m.user_id,
              medication_id: m.id,
              scheduled_date: today,
              scheduled_time: `${hhmm}:00`,
              is_taken: false,
              status: "missed",
            });
          }
        }

        if (toInsert.length === 0) {
          return Response.json({ ok: true, inserted: 0, date: today });
        }

        const { error: insErr } = await supabaseAdmin
          .from("adherence_logs")
          .insert(toInsert as never);
        if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

        return Response.json({ ok: true, inserted: toInsert.length, date: today });
      },
    },
  },
});
