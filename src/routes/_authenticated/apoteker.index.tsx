import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, AlertTriangle, MessageSquare, Pill } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/apoteker/")({
  component: Dashboard,
});

type MRow = {
  measurement_time: string;
  disease_type: "hipertensi" | "gula_darah" | "asam_urat";
  is_abnormal: boolean | null;
};

type CRow = { status: string };

const DAYS = 14;
const DISEASE_LABEL: Record<MRow["disease_type"], string> = {
  hipertensi: "Hipertensi",
  gula_darah: "Gula Darah",
  asam_urat: "Asam Urat",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "Diproses",
  responded: "Direspons",
  closed: "Selesai",
};
const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "#16a34a",
  "#f59e0b",
  "#6366f1",
];

function Dashboard() {
  const [s, setS] = useState({ pasien: 0, abnormal: 0, konsul: 0, obat: 0 });
  const [measurements, setMeasurements] = useState<MRow[]>([]);
  const [consultations, setConsultations] = useState<CRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sinceISO = new Date(Date.now() - (DAYS - 1) * 86400000).toISOString();

      const [a, b, c, d, mAll, cAll] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("measurements")
          .select("*", { count: "exact", head: true })
          .eq("is_abnormal", true),
        supabase
          .from("consultation_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("medications")
          .select("*", { count: "exact", head: true })
          .eq("is_approved", false),
        supabase
          .from("measurements")
          .select("measurement_time, disease_type, is_abnormal")
          .gte("measurement_time", sinceISO)
          .order("measurement_time", { ascending: true }),
        supabase.from("consultation_requests").select("status"),
      ]);

      setS({
        pasien: a.count ?? 0,
        abnormal: b.count ?? 0,
        konsul: c.count ?? 0,
        obat: d.count ?? 0,
      });
      setMeasurements((mAll.data ?? []) as MRow[]);
      setConsultations((cAll.data ?? []) as CRow[]);
      setLoading(false);
    })();
  }, []);

  // Daily series for last DAYS
  const dailySeries = useMemo(() => {
    const buckets: Record<string, { date: string; total: number; abnormal: number }> = {};
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = {
        date: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        total: 0,
        abnormal: 0,
      };
    }
    for (const m of measurements) {
      const key = new Date(m.measurement_time).toISOString().slice(0, 10);
      const b = buckets[key];
      if (!b) continue;
      b.total += 1;
      if (m.is_abnormal) b.abnormal += 1;
    }
    return Object.values(buckets);
  }, [measurements]);

  // Distribution by disease type
  const diseaseDist = useMemo(() => {
    const map: Record<string, { name: string; total: number; abnormal: number }> = {};
    for (const k of Object.keys(DISEASE_LABEL) as MRow["disease_type"][]) {
      map[k] = { name: DISEASE_LABEL[k], total: 0, abnormal: 0 };
    }
    for (const m of measurements) {
      const row = map[m.disease_type];
      if (!row) continue;
      row.total += 1;
      if (m.is_abnormal) row.abnormal += 1;
    }
    return Object.values(map);
  }, [measurements]);

  // Consultation status distribution
  const consultDist = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of consultations) {
      const key = c.status || "lainnya";
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).map(([k, v]) => ({
      name: STATUS_LABEL[k] ?? k,
      value: v,
    }));
  }, [consultations]);

  const cards = [
    {
      label: "Total Pasien",
      value: s.pasien,
      icon: Users,
      to: "/apoteker/pasien",
      color: "text-primary",
    },
    {
      label: "Pengukuran Abnormal",
      value: s.abnormal,
      icon: AlertTriangle,
      to: "/apoteker/pasien",
      color: "text-destructive",
    },
    {
      label: "Konsultasi Pending",
      value: s.konsul,
      icon: MessageSquare,
      to: "/apoteker/konsultasi",
      color: "text-amber-600",
    },
    {
      label: "Obat Belum Disetujui",
      value: s.obat,
      icon: Pill,
      to: "/apoteker/pasien",
      color: "text-blue-600",
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Dashboard Apoteker</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to as never}
            className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tren Pengukuran 14 Hari"
          subtitle="Total vs abnormal per hari"
          loading={loading}
          empty={dailySeries.every((d) => d.total === 0)}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailySeries} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} tickMargin={4} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="abnormal"
                name="Abnormal"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Distribusi Jenis Penyakit"
          subtitle="14 hari terakhir"
          loading={loading}
          empty={diseaseDist.every((d) => d.total === 0)}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={diseaseDist} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="abnormal"
                name="Abnormal"
                fill="hsl(var(--destructive))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Status Konsultasi"
          subtitle="Seluruh permintaan konsultasi"
          loading={loading}
          empty={consultDist.length === 0}
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Pie
                data={consultDist}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                label={(e) => `${e.name}: ${e.value}`}
              >
                {consultDist.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${className ?? ""}`}>
      <div className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {loading ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          Memuat...
        </div>
      ) : empty ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          Belum ada data.
        </div>
      ) : (
        children
      )}
    </div>
  );
}
