import { createFileRoute } from "@tanstack/react-router";

/**
 * One-off admin provisioning endpoint for the three demo accounts.
 * Auth: `x-provision-secret` header must equal the server-only PROVISION_SECRET.
 * Safe to delete once the accounts exist.
 */
const ACCOUNTS = [
  {
    email: "admin@imomantap.com",
    password: "mantapIMO12345!",
    role: "admin" as const,
    full_name: "Administrator IMO MANTAP",
  },
  {
    email: "apoteker@imomantap.com",
    password: "mantapIMO12345!",
    role: "apoteker" as const,
    full_name: "Apoteker IMO MANTAP",
  },
];

function authorized(request: Request): boolean {
  const secret = process.env.PROVISION_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-provision-secret") ?? "";
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(secret);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export const Route = createFileRoute("/api/public/provision-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Record<string, string> = {};

        const { data: list } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        for (const acc of ACCOUNTS) {
          let userId = list?.users.find((u) => u.email === acc.email)?.id;

          if (userId) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: acc.password,
              email_confirm: true,
            });
            results[acc.email] = "updated";
          } else {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
              email: acc.email,
              password: acc.password,
              email_confirm: true,
              user_metadata: { full_name: acc.full_name },
            });
            if (error || !data.user) {
              results[acc.email] = `error: ${error?.message ?? "unknown"}`;
              continue;
            }
            userId = data.user.id;
            results[acc.email] = "created";
          }

          await supabaseAdmin
            .from("profiles")
            .upsert(
              { user_id: userId, full_name: acc.full_name, is_verified: true },
              { onConflict: "user_id" },
            );
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: acc.role });
          if (roleErr) results[acc.email] += ` (role error: ${roleErr.message})`;
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});