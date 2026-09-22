import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditLog,
});

type Log = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  created_at: string;
  new_data: any;
};

function AuditLog() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data ?? []) as Log[]);
    })();
  }, []);

  return (
    <>
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/50">
            <tr>
              <th className="p-2 text-left">Waktu</th>
              <th className="p-2 text-left">Aksi</th>
              <th className="p-2 text-left">Tabel</th>
              <th className="p-2 text-left">Record</th>
              <th className="p-2 text-left">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="p-2 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString("id-ID")}
                </td>
                <td className="p-2">
                  <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-xs">
                    {l.action}
                  </span>
                </td>
                <td className="p-2">{l.table_name || "—"}</td>
                <td className="p-2 font-mono text-xs">{l.record_id?.slice(0, 8) || "—"}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {l.new_data ? JSON.stringify(l.new_data) : "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Belum ada log.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
