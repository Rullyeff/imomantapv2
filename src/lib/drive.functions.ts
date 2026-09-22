import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  } as never);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

/** Backup seluruh data lalu simpan sebagai berkas JSON di Google Drive. */
export const backupToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { runDriveBackup } = await import("./drive-backup.server");
    return await runDriveBackup(`admin:${context.userId}`);
  });

/** Daftar berkas cadangan yang tersimpan di Google Drive. */
export const listDriveBackupFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { listDriveBackups } = await import("./drive-backup.server");
    return { files: await listDriveBackups(50) };
  });

/** Ambil isi satu berkas cadangan dari Google Drive untuk dipulihkan. */
export const fetchDriveBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string }) => {
    const fileId = typeof d?.fileId === "string" ? d.fileId.trim() : "";
    if (!fileId) throw new Error("Berkas cadangan belum dipilih");
    return { fileId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { readDriveBackup } = await import("./drive-backup.server");
    const json = await readDriveBackup(data.fileId);
    const tables = (json?.tables ?? {}) as Record<string, any[]>;
    const accounts = Array.isArray(json?.accounts) ? json.accounts : [];
    return { generated_at: json?.generated_at ?? null, tables, accounts };
  });

/** Baca pengaturan backup otomatis. */
export const getAutoBackupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { readAutoBackupSettings } = await import("./auto-backup.server");
    return await readAutoBackupSettings();
  });

/** Ubah mode backup otomatis: off | daily | activity. */
export const setAutoBackupMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: "off" | "daily" | "activity" }) => {
    const mode = d?.mode;
    if (mode !== "off" && mode !== "daily" && mode !== "activity") {
      throw new Error("Mode tidak dikenal");
    }
    return { mode };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { writeAutoBackupSettings } = await import("./auto-backup.server");
    return await writeAutoBackupSettings({ mode: data.mode }, context.userId);
  });
