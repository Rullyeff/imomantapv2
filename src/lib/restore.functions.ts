import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BACKUP_TABLES } from "@/lib/backup-tables";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  } as never);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// Urutan penting: tabel induk lebih dulu agar relasi tidak gagal.
const RESTORE_ORDER = [
  "profiles",
  "user_roles",
  "medication_catalog",
  "medications",
  "measurements",
  "health_screenings",
  "adherence_logs",
  "appointments",
  "educational_content",
  "patient_logbook",
  "consultation_requests",
  "consultation_messages",
  "notification_logs",
  "system_audit_logs",
] as const;

export type RestoreResult = {
  table: string;
  inserted: number;
  skipped: number;
  error: string | null;
};

export type RestoreAccount = {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, any> | null;
};

async function restoreAccounts(accounts: RestoreAccount[], password: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  let created = 0;
  let existing = 0;
  let failed = 0;
  let firstError: string | null = null;

  if (!url || !key) {
    return { created, existing, failed: accounts.length, error: "Konfigurasi server tidak lengkap" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (const acc of accounts) {
    if (!acc?.id) {
      failed++;
      continue;
    }
    const { data: found } = await supabaseAdmin.auth.admin.getUserById(acc.id);
    if (found?.user) {
      existing++;
      continue;
    }
    if (!acc.email) {
      failed++;
      firstError = firstError ?? "Akun tanpa email tidak bisa dibuat ulang";
      continue;
    }
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: acc.id,
        email: acc.email,
        phone: acc.phone || undefined,
        password,
        email_confirm: true,
        user_metadata: acc.user_metadata ?? {},
      }),
    });
    if (res.ok) {
      created++;
    } else {
      failed++;
      const body = await res.text();
      firstError = firstError ?? `${res.status}: ${body.slice(0, 200)}`;
    }
  }

  return { created, existing, failed, error: firstError };
}

export const restoreAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      tables: Record<string, any[]>;
      accounts?: RestoreAccount[];
      password?: string;
      mode?: "merge" | "replace";
    }) => {
      if (!d || typeof d.tables !== "object" || d.tables === null) {
        throw new Error("Berkas cadangan tidak berisi data tabel");
      }
      const tables: Record<string, any[]> = {};
      for (const [k, v] of Object.entries(d.tables)) {
        if (!(BACKUP_TABLES as readonly string[]).includes(k)) continue;
        if (!Array.isArray(v)) continue;
        tables[k] = v.filter((r) => r && typeof r === "object");
      }
      const accounts = Array.isArray(d.accounts)
        ? d.accounts.filter((a) => a && typeof a === "object" && typeof a.id === "string")
        : [];
      if (!Object.keys(tables).length && !accounts.length) {
        throw new Error("Tidak ada data yang dikenali di berkas ini");
      }
      const password = typeof d.password === "string" && d.password.length >= 8 ? d.password : "";
      if (accounts.length && !password) {
        throw new Error("Kata sandi sementara minimal 8 karakter untuk memulihkan akun");
      }
      return { tables, accounts, password, mode: d.mode === "replace" ? "replace" : "merge" };
    },
  )

  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: RestoreResult[] = [];

    // Akun dibuat ulang lebih dulu agar baris data yang merujuk ke akun tidak gagal.
    const accountResult = data.accounts.length
      ? await restoreAccounts(data.accounts, data.password)
      : { created: 0, existing: 0, failed: 0, error: null as string | null };

    for (const table of RESTORE_ORDER) {
      const rows = data.tables[table];
      if (!rows || !rows.length) continue;

      let inserted = 0;
      let skipped = 0;
      let failure: string | null = null;

      if (data.mode === "replace") {
        const { error } = await supabaseAdmin
          .from(table as never)
          .delete()
          .not("id", "is", null);
        if (error) failure = `Gagal mengosongkan tabel: ${error.message}`;
      }

      if (!failure) {
        const size = 200;
        for (let i = 0; i < rows.length; i += size) {
          const chunk = rows.slice(i, i + size);
          const { error } = await supabaseAdmin
            .from(table as never)
            .upsert(chunk as never, { onConflict: "id", ignoreDuplicates: false });
          if (error) {
            // Coba satu per satu agar baris yang valid tetap masuk.
            for (const row of chunk) {
              const { error: rowError } = await supabaseAdmin
                .from(table as never)
                .upsert(row as never, { onConflict: "id", ignoreDuplicates: false });
              if (rowError) {
                skipped++;
                failure = failure ?? rowError.message;
              } else {
                inserted++;
              }
            }
          } else {
            inserted += chunk.length;
          }
        }
      } else {
        skipped = rows.length;
      }

      results.push({ table, inserted, skipped, error: failure });
    }

    await context.supabase.from("system_audit_logs").insert({
      user_id: context.userId,
      action: "backup_restore",
      table_name: "all",
      new_data: {
        mode: data.mode,
        results: results.map((r) => ({ table: r.table, inserted: r.inserted, skipped: r.skipped })),
      },
    } as never);

    return {
      restored_at: new Date().toISOString(),
      mode: data.mode,
      accounts: accountResult,
      results,
      total_inserted: results.reduce((a, r) => a + r.inserted, 0),
      total_skipped: results.reduce((a, r) => a + r.skipped, 0),
    };
  });
