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

export const getUserEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userIds: string[] }) => ({
    userIds: (Array.isArray(d.userIds) ? d.userIds : []).slice(0, 200).map(String),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userIds.length === 0) return {} as Record<string, string>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const map: Record<string, string> = {};
    for (const id of data.userIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      if (u?.user?.email) map[id] = u.user.email;
    }
    return map;
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; newPassword: string }) => {
    const userId = String(d.userId ?? "");
    const newPassword = String(d.newPassword ?? "");
    if (!userId) throw new Error("userId wajib diisi");
    if (newPassword.length < 6) throw new Error("Password minimal 6 karakter");
    if (newPassword.length > 72) throw new Error("Password terlalu panjang");
    return { userId, newPassword };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    await context.supabase.from("system_audit_logs").insert({
      user_id: context.userId,
      action: "reset_password",
      table_name: "auth.users",
      record_id: data.userId,
    } as never);
    return { ok: true };
  });
