import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPatientsAdherence, type PatientAdherenceRow } from "@/lib/adherence.functions";
import { ChevronRight, AlertTriangle, ShieldCheck, Pill } from "lucide-react";

export const Route = createFileRoute("/_authenticated/apoteker/kepatuhan")({
  component: KepatuhanPage,
});

function pctColor(p: number, has: boolean) {
  if (!has) return "text-muted-foreground";
  if (p >= 80) return "text-emerald-600";
  if (p >= 50) return "text-amber-600";
  return "text-red-600";
}
function pctBg(p: number, has: boolean) {
  if (!has) return "bg-secondary";
  if (p >= 80) return "bg-emerald-500";
  if (p >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function KepatuhanPage() {
  const fetchRows = useServerFn(getPatientsAdherence);
  const [rows, setRows] = useState<PatientAdherenceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchRows()
      .then((r) => setRows(r))
      .catch((e: Error) => setErr(e.message));
  }, [fetchRows]);

  if (err) return <div className="rounded-xl border bg-card p-6 text-sm text-red-600">{err}</div>;
  if (rows === null) return <div className="py-8 text-center text-muted-foreground">Memuat...</div>;

  const summary = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.pct7 >= 80) acc.good += 1;
      else if (r.pct7 >= 50) acc.mid += 1;
      else if (r.active_meds > 0) acc.low += 1;
      acc.missed += r.missed7;
      return acc;
    },
    { total: 0, good: 0, mid: 0, low: 0, missed: 0 },
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Kepatuhan Pasien</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan kepatuhan minum obat 7 & 30 hari terakhir.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Pasien" value={summary.total} icon={Pill} />
        <Stat label="Patuh (≥80%)" value={summary.good} icon={ShieldCheck} tone="emerald" />
        <Stat label="Perlu Perhatian" value={summary.low} icon={AlertTriangle} tone="red" />
        <Stat
          label="Dosis Terlewat 7 hari"
          value={summary.missed}
          icon={AlertTriangle}
          tone="amber"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b text-xs font-semibold text-muted-foreground bg-secondary/50">
          <div className="col-span-4">Nama</div>
          <div className="col-span-2 text-center">Obat Aktif</div>
          <div className="col-span-2 text-center">7 hari</div>
          <div className="col-span-2 text-center">30 hari</div>
          <div className="col-span-1 text-center">Missed</div>
          <div className="col-span-1" />
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Belum ada pasien.</p>
        ) : (
          rows.map((r) => {
            const has = r.active_meds > 0;
            return (
              <Link
                key={r.user_id}
                to="/apoteker/pasien/$id"
                params={{ id: r.user_id }}
                className="grid grid-cols-12 gap-2 px-4 py-3 border-b last:border-0 hover:bg-secondary/50 items-center"
              >
                <div className="col-span-4 font-medium truncate">{r.full_name || "Tanpa nama"}</div>
                <div className="col-span-2 text-center text-sm">{r.active_meds}</div>
                <div className="col-span-2 text-center">
                  <div className={`text-sm font-semibold ${pctColor(r.pct7, has)}`}>
                    {has ? `${r.pct7}%` : "—"}
                  </div>
                  {has && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full ${pctBg(r.pct7, has)}`}
                        style={{ width: `${r.pct7}%` }}
                      />
                    </div>
                  )}
                </div>
                <div
                  className={`col-span-2 text-center text-sm font-semibold ${pctColor(r.pct30, has)}`}
                >
                  {has ? `${r.pct30}%` : "—"}
                </div>
                <div className="col-span-1 text-center text-sm">
                  {r.missed7 > 0 ? (
                    <span className="text-red-600 font-semibold">{r.missed7}</span>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="col-span-1 flex justify-end">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number;
  icon: typeof Pill;
  tone?: "primary" | "emerald" | "red" | "amber";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
  }[tone];
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneCls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
