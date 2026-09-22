import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/apoteker/pasien")({
  component: PasienList,
});

type Row = {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  is_verified: boolean | null;
  age: number | null;
};

function PasienList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const ids =
        (await supabase.from("user_roles").select("user_id").eq("role", "pasien")).data?.map(
          (r) => r.user_id,
        ) ?? [];
      if (!ids.length) return setRows([]);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone_number, is_verified, age")
        .in("user_id", ids);
      setRows((data ?? []) as Row[]);
    })();
  }, []);

  const filtered = rows.filter(
    (r) => !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daftar Pasien</h1>
      </div>
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
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Belum ada pasien.</p>
        ) : (
          filtered.map((r) => (
            <Link
              key={r.user_id}
              to="/apoteker/pasien/$id"
              params={{ id: r.user_id }}
              className="flex items-center justify-between p-4 hover:bg-secondary/50"
            >
              <div>
                <p className="font-medium">{r.full_name || "Tanpa nama"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.phone_number || "—"} {r.age ? `· ${r.age} thn` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.is_verified ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <Clock className="h-3 w-3" />
                    Pending
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
