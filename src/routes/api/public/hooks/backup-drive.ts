import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest } from "@/lib/cron-auth.server";

/**
 * Nightly full backup to Google Drive. Called by pg_cron at 00:00 Asia/Jakarta.
 * Auth: `x-cron-secret` header must equal the server-only CRON_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/backup-drive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runDriveBackup } = await import("@/lib/drive-backup.server");
          const result = await runDriveBackup("cron");
          return Response.json(result);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("backup-drive failed:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
