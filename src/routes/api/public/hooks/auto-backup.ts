import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";

/**
 * Scheduled backup endpoint.
 * body: { trigger: "daily" | "activity" }
 * Hanya menjalankan backup bila admin memilih mode yang sama di halaman Backup.
 * Auth: header `x-cron-secret` harus sama dengan CRON_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/auto-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const body = (await request.json().catch(() => ({}))) as { trigger?: string };
          const trigger = body.trigger === "activity" ? "activity" : "daily";
          const { runScheduledBackup } = await import("@/lib/auto-backup.server");
          return Response.json(await runScheduledBackup(trigger));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("auto-backup failed:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
