/**
 * Auto-backup helpers: reads the admin's chosen mode from public.app_settings
 * and decides whether a scheduled run should actually produce a Drive backup.
 */
import { BACKUP_TABLES } from "./backup-tables";

export type AutoBackupMode = "off" | "daily" | "activity";

export type AutoBackupSettings = {
  mode: AutoBackupMode;
  last_run_at: string | null;
  last_file: string | null;
};

const KEY = "auto_backup";

function normalize(value: any): AutoBackupSettings {
  const mode: AutoBackupMode =
    value?.mode === "daily" || value?.mode === "activity" ? value.mode : "off";
  return {
    mode,
    last_run_at: typeof value?.last_run_at === "string" ? value.last_run_at : null,
    last_file: typeof value?.last_file === "string" ? value.last_file : null,
  };
}

export async function readAutoBackupSettings(): Promise<AutoBackupSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return normalize((data as any)?.value);
}

export async function writeAutoBackupSettings(
  patch: Partial<AutoBackupSettings>,
  updatedBy?: string,
): Promise<AutoBackupSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const current = await readAutoBackupSettings();
  const next = normalize({ ...current, ...patch });
  await supabaseAdmin.from("app_settings").upsert(
    {
      key: KEY,
      value: next as never,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    } as never,
    { onConflict: "key" } as never,
  );
  return next;
}

/** True kalau ada baris baru / berubah di salah satu tabel sejak waktu tertentu. */
export async function hasActivitySince(since: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const table of BACKUP_TABLES) {
    for (const col of ["updated_at", "created_at"]) {
      const { data, error } = await supabaseAdmin
        .from(table as never)
        .select("*", { count: "exact", head: true })
        .gt(col, since);
      if (error) continue;
      void data;
      const { count } = await supabaseAdmin
        .from(table as never)
        .select("*", { count: "exact", head: true })
        .gt(col, since);
      if ((count ?? 0) > 0) return true;
    }
  }
  return false;
}

/** Jalankan backup terjadwal sesuai mode yang dipilih admin. */
export async function runScheduledBackup(trigger: "daily" | "activity") {
  const settings = await readAutoBackupSettings();
  if (settings.mode !== trigger) {
    return { ok: true as const, skipped: "mode" as const, mode: settings.mode };
  }

  if (trigger === "activity") {
    const since = settings.last_run_at ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    if (!(await hasActivitySince(since))) {
      return { ok: true as const, skipped: "no_activity" as const, mode: settings.mode };
    }
  }

  const { runDriveBackup } = await import("./drive-backup.server");
  const result = await runDriveBackup(`auto:${trigger}`);
  await writeAutoBackupSettings({
    last_run_at: result.generated_at,
    last_file: result.file_name,
  });
  return { ok: true as const, skipped: null, mode: settings.mode, file_name: result.file_name };
}
