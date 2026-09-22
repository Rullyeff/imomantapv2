import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/obat")({
  component: ObatAdmin,
});

type Med = {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  disease_type: string;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
};

function ObatAdmin() {
  const [list, setList] = useState<Med[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    const q = supabase.from("medications").select("*").order("created_at", { ascending: false });
    if (filter === "pending") q.eq("is_approved", false);
    const { data } = await q;
    const rows = (data ?? []) as Med[];
    setList(rows);
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const m: Record<string, string> = {};
      (p ?? []).forEach((x: any) => {
        m[x.user_id] = x.full_name || "—";
      });
      setNames(m);
    }
  }
  useEffect(() => {
    load();
  }, [filter]);

  async function approve(id: string, ok: boolean) {
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("medications")
      .update({ is_approved: ok, approved_by: u.user?.id })
      .eq("id", id);
    await supabase
      .from("system_audit_logs")
      .insert({
        user_id: u.user?.id,
        action: ok ? "approve_med" : "reject_med",
        table_name: "medications",
        record_id: id,
      });
    toast.success(ok ? "Disetujui" : "Ditolak");
    load();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Approval Obat</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            Semua
          </Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Tidak ada obat.</p>
        ) : (
          list.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {m.name} · <span className="text-xs text-muted-foreground">{m.dosage}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {names[m.user_id] || "—"} · {m.disease_type} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("id-ID")}
                </p>
              </div>
              <div className="flex gap-2">
                {m.is_approved ? (
                  <span className="text-xs text-emerald-600">Disetujui</span>
                ) : (
                  <Button size="sm" onClick={() => approve(m.id, true)}>
                    Setujui
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
