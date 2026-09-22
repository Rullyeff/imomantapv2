import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => {
    if (!d?.endpoint || !d?.p256dh || !d?.auth) throw new Error("Invalid subscription");
    return {
      endpoint: String(d.endpoint).slice(0, 2000),
      p256dh: String(d.p256dh).slice(0, 500),
      auth: String(d.auth).slice(0, 500),
      userAgent: d.userAgent ? String(d.userAgent).slice(0, 500) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions" as never).upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth_key: data.auth,
        user_agent: data.userAgent,
        last_used_at: new Date().toISOString(),
      } as never,
      { onConflict: "endpoint" } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => ({
    endpoint: String(d?.endpoint || "").slice(0, 2000),
  }))
  .handler(async ({ data, context }) => {
    if (!data.endpoint) return { ok: true };
    const { error } = await context.supabase
      .from("push_subscriptions" as never)
      .delete()
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (!subs || subs.length === 0) return { sent: 0 };

    const webpushMod: typeof import("web-push") = await import("web-push");
    const webpush =
      (webpushMod as unknown as { default?: typeof webpushMod }).default ?? webpushMod;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@sehatpantau.id",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          JSON.stringify({
            title: "✓ Pengingat aktif",
            body: "Notifikasi obat akan dikirim sesuai jadwal.",
            tag: "test",
            url: "/pasien/obat",
          }),
        );
        sent++;
      } catch {
        // ignore single failures
      }
    }
    return { sent };
  });
