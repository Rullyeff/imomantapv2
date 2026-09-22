import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resetUserPassword } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

type Row = {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  is_verified: boolean | null;
  role: string;
};

function UsersAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [resetting, setResetting] = useState<string | null>(null);
  const resetPassword = useServerFn(resetUserPassword);

  async function handleReset(r: Row) {
    const pw = window.prompt(
      `Password baru untuk ${r.full_name || "user ini"} (min. 6 karakter):`,
    );
    if (pw === null) return;
    setResetting(r.user_id);
    try {
      await resetPassword({ data: { userId: r.user_id, newPassword: pw } });
      toast.success("Password berhasil direset");
    } catch (e: any) {
      toast.error(e?.message || "Gagal mereset password");
    } finally {
      setResetting(null);
    }
  }

  async function load() {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, phone_number, is_verified"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap: Record<string, string> = {};
    (roles ?? []).forEach((r: any) => {
      roleMap[r.user_id] = r.role;
    });
    setRows(((profs ?? []) as any[]).map((p) => ({ ...p, role: roleMap[p.user_id] || "pasien" })));
  }
  useEffect(() => {
    load();
  }, []);

  async function changeRole(user_id: string, newRole: string) {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("user_roles").delete().eq("user_id", user_id);
    const { error } = await supabase.from("user_roles").insert({ user_id, role: newRole as any });
    if (error) return toast.error(error.message);
    await supabase
      .from("system_audit_logs")
      .insert({
        user_id: u.user?.id,
        action: "change_role",
        table_name: "user_roles",
        record_id: user_id,
        new_data: { role: newRole } as any,
      });
    toast.success("Role diperbarui");
    load();
  }

  const filtered = rows.filter(
    (r) => !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <h1 className="text-2xl font-bold">Manajemen Users</h1>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Cari nama..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {filtered.map((r) => (
          <div key={r.user_id} className="p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{r.full_name || "(tanpa nama)"}</p>
              <p className="text-xs text-muted-foreground">
                {r.phone_number || "—"} · {r.is_verified ? "Verified" : "Belum verifikasi"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={resetting === r.user_id}
                onClick={() => handleReset(r)}
              >
                <KeyRound className="h-4 w-4 mr-1" />
                Reset Password
              </Button>
              <Select value={r.role} onValueChange={(v) => changeRole(r.user_id, v)}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pasien">Pasien</SelectItem>
                  <SelectItem value="apoteker">Apoteker</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Tidak ada user.</p>
        )}
      </div>
    </>
  );
}
