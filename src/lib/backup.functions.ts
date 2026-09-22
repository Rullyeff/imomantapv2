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

export const BACKUP_TABLES = [
  "profiles",
  "user_roles",
  "measurements",
  "health_screenings",
  "medications",
  "medication_catalog",
  "adherence_logs",
  "appointments",
  "consultation_requests",
  "consultation_messages",
  "educational_content",
  "patient_logbook",
  "notification_logs",
  "system_audit_logs",
] as const;

export const exportAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { includeAccounts?: boolean }) => ({
    includeAccounts: Boolean(d?.includeAccounts),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tables: Record<string, any[]> = {};
    for (const t of BACKUP_TABLES) {
      const rows: any[] = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        const { data: chunk, error } = await supabaseAdmin
          .from(t as never)
          .select("*")
          .range(from, from + size - 1);
        if (error) throw new Error(`${t}: ${error.message}`);
        rows.push(...(chunk ?? []));
        if (!chunk || chunk.length < size) break;
      }
      tables[t] = rows;
    }

    const accounts: {
      id: string;
      email: string | null;
      phone: string | null;
      created_at: string;
      email_confirmed: boolean;
      user_metadata: Record<string, any>;
    }[] = [];
    if (data.includeAccounts) {
      for (let page = 1; page <= 20; page++) {
        const { data: u, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        accounts.push(
          ...(u?.users ?? []).map((x) => ({
            id: x.id,
            email: x.email ?? null,
            phone: x.phone ?? null,
            created_at: x.created_at,
            email_confirmed: Boolean(x.email_confirmed_at),
            user_metadata: (x.user_metadata ?? {}) as Record<string, any>,
          })),
        );
        if (!u || u.users.length < 200) break;
      }
    }


    await context.supabase.from("system_audit_logs").insert({
      user_id: context.userId,
      action: "backup_export",
      table_name: "all",
    } as never);

    return {
      generated_at: new Date().toISOString(),
      tables,
      accounts,
      counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    };
  });
