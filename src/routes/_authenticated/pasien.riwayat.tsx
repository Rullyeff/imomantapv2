import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Share2 } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pasien/riwayat")({
  component: RiwayatPage,
});

type Row = {
  measurement_time: string;
  sistolik: number | null;
  diastolik: number | null;
  gula_puasa: number | null;
  gula_pp: number | null;
  asam_urat: number | null;
  disease_type: string;
};

function statusHipertensi(s: number | null, d: number | null) {
  if (!s || !d)
    return { label: "-", color: "text-muted-foreground", bg: "bg-muted", border: "border-muted" };
  if (s < 120 && d < 80)
    return {
      label: "Normal",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    };
  if (s < 130 && d < 80)
    return {
      label: "Elevated",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  if (s < 140 || d < 90)
    return {
      label: "Waspada",
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
    };
  return { label: "Bahaya", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
}

function statusGula(puasa: number | null, pp: number | null) {
  if (!puasa || !pp)
    return { label: "-", color: "text-muted-foreground", bg: "bg-muted", border: "border-muted" };
  const normal = puasa < 100 && pp < 140;
  const waspada = puasa < 126 && pp < 200;
  if (normal)
    return {
      label: "Normal",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    };
  if (waspada)
    return {
      label: "Waspada",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  return { label: "Bahaya", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
}

function statusAsamUrat(v: number | null) {
  if (!v)
    return { label: "-", color: "text-muted-foreground", bg: "bg-muted", border: "border-muted" };
  if (v < 7)
    return {
      label: "Normal",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    };
  if (v < 8)
    return {
      label: "Waspada",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  return { label: "Bahaya", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
}

function SinglePointCard({
  type,
  row,
}: {
  type: "hipertensi" | "gula_darah" | "asam_urat";
  row: Row;
}) {
  const t = new Date(row.measurement_time).toLocaleString("id-ID");
  if (type === "hipertensi") {
    const st = statusHipertensi(row.sistolik, row.diastolik);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-muted-foreground">{t}</div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-chart-4">{row.sistolik}</div>
            <div className="text-xs text-muted-foreground">Sistolik (mmHg)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-chart-1">{row.diastolik}</div>
            <div className="text-xs text-muted-foreground">Diastolik (mmHg)</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium border ${st.bg} ${st.color} ${st.border}`}
        >
          {st.label === "Normal" && <CheckCircle2 className="h-4 w-4" />}
          {st.label === "Bahaya" && <AlertCircle className="h-4 w-4" />}
          {st.label !== "Normal" && st.label !== "Bahaya" && <Activity className="h-4 w-4" />}
          {st.label}
        </span>
        <div className="text-xs text-muted-foreground">
          Tambahkan lebih banyak pengukuran untuk melihat tren grafik.
        </div>
      </div>
    );
  }
  if (type === "gula_darah") {
    const st = statusGula(row.gula_puasa, row.gula_pp);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="text-sm text-muted-foreground">{t}</div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-chart-1">{row.gula_puasa}</div>
            <div className="text-xs text-muted-foreground">Puasa (mg/dL)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-chart-4">{row.gula_pp}</div>
            <div className="text-xs text-muted-foreground">2 jam PP (mg/dL)</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium border ${st.bg} ${st.color} ${st.border}`}
        >
          {st.label === "Normal" && <CheckCircle2 className="h-4 w-4" />}
          {st.label === "Bahaya" && <AlertCircle className="h-4 w-4" />}
          {st.label !== "Normal" && st.label !== "Bahaya" && <Activity className="h-4 w-4" />}
          {st.label}
        </span>
        <div className="text-xs text-muted-foreground">
          Tambahkan lebih banyak pengukuran untuk melihat tren grafik.
        </div>
      </div>
    );
  }
  const st = statusAsamUrat(row.asam_urat);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="text-sm text-muted-foreground">{t}</div>
      <div className="text-center">
        <div className="text-4xl font-bold text-chart-4">{row.asam_urat}</div>
        <div className="text-xs text-muted-foreground mt-1">mg/dL</div>
      </div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium border ${st.bg} ${st.color} ${st.border}`}
      >
        {st.label === "Normal" && <CheckCircle2 className="h-4 w-4" />}
        {st.label === "Bahaya" && <AlertCircle className="h-4 w-4" />}
        {st.label !== "Normal" && st.label !== "Bahaya" && <Activity className="h-4 w-4" />}
        {st.label}
      </span>
      <div className="text-xs text-muted-foreground">
        Tambahkan lebih banyak pengukuran untuk melihat tren grafik.
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-sm text-sm">
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function RiwayatPage() {
  const [type, setType] = useState<"hipertensi" | "gula_darah" | "asam_urat">("hipertensi");
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: rows } = await supabase
        .from("measurements" as never)
        .select(
          "measurement_time, sistolik, diastolik, gula_puasa, gula_pp, asam_urat, disease_type",
        )
        .eq("user_id", u.user.id)
        .eq("disease_type", type)
        .order("measurement_time", { ascending: true })
        .limit(30);
      setData((rows as Row[] | null) ?? []);
    })();
  }, [type]);

  const chartData = data.map((r) => {
    const t = new Date(r.measurement_time).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
    if (type === "hipertensi") return { t, sistolik: r.sistolik, diastolik: r.diastolik };
    if (type === "gula_darah") return { t, puasa: r.gula_puasa, pp: r.gula_pp };
    return { t, urat: r.asam_urat };
  });

  function exportPDF() {
    const doc = new jsPDF();
    const title = { hipertensi: "Tekanan Darah", gula_darah: "Gula Darah", asam_urat: "Asam Urat" }[
      type
    ];
    doc.setFontSize(16);
    doc.text(`Riwayat ${title}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 28);
    let y = 40;
    doc.setFontSize(11);
    doc.text("Waktu", 14, y);
    doc.text("Nilai", 120, y);
    y += 6;
    doc.setDrawColor(200);
    doc.line(14, y - 2, 196, y - 2);
    [...data].reverse().forEach((r) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const v =
        type === "hipertensi"
          ? `${r.sistolik}/${r.diastolik} mmHg`
          : type === "gula_darah"
            ? `P:${r.gula_puasa ?? "-"} PP:${r.gula_pp ?? "-"} mg/dL`
            : `${r.asam_urat} mg/dL`;
      doc.text(new Date(r.measurement_time).toLocaleString("id-ID"), 14, y);
      doc.text(v, 120, y);
      y += 6;
    });
    doc.save(`riwayat-${type}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF diunduh");
  }

  async function shareWA() {
    const summary =
      `Riwayat ${type} (10 terakhir):\n` +
      [...data]
        .slice(-10)
        .reverse()
        .map((r) => {
          const v =
            type === "hipertensi"
              ? `${r.sistolik}/${r.diastolik}`
              : type === "gula_darah"
                ? `P:${r.gula_puasa ?? "-"} PP:${r.gula_pp ?? "-"}`
                : `${r.asam_urat}`;
          return `• ${new Date(r.measurement_time).toLocaleDateString("id-ID")}: ${v}`;
        })
        .join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Riwayat</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportPDF} disabled={!data.length}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={shareWA} disabled={!data.length}>
            <Share2 className="h-4 w-4 mr-1" />
            WA
          </Button>
        </div>
      </div>
      <Select value={type} onValueChange={(v) => setType(v as never)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hipertensi">Tekanan Darah</SelectItem>
          <SelectItem value="gula_darah">Gula Darah</SelectItem>
          <SelectItem value="asam_urat">Asam Urat</SelectItem>
        </SelectContent>
      </Select>

      <div className="h-72 rounded-xl border bg-card p-4 shadow-sm">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Belum ada data
          </div>
        ) : chartData.length === 1 ? (
          <SinglePointCard type={type} row={data[0]} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="t" fontSize={11} tickMargin={6} />
              <YAxis fontSize={11} width={40} />
              <Tooltip content={<CustomTooltip type={type} />} />
              {type === "hipertensi" && (
                <>
                  <ReferenceLine
                    y={120}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: "Normal <120",
                      fill: "#10b981",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  <ReferenceLine
                    y={140}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: "Bahaya >140",
                      fill: "#ef4444",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sistolik"
                    stroke="var(--chart-4)"
                    fill="url(#grad4)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="diastolik"
                    stroke="var(--chart-1)"
                    fill="url(#grad1)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </>
              )}
              {type === "gula_darah" && (
                <>
                  <ReferenceLine
                    y={100}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: "Puasa normal <100",
                      fill: "#10b981",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  <ReferenceLine
                    y={126}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: "Puasa bahaya >126",
                      fill: "#ef4444",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="puasa"
                    stroke="var(--chart-1)"
                    fill="url(#grad1)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pp"
                    stroke="var(--chart-4)"
                    fill="url(#grad4)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </>
              )}
              {type === "asam_urat" && (
                <>
                  <ReferenceLine
                    y={7}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: "Normal <7",
                      fill: "#10b981",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="urat"
                    stroke="var(--chart-4)"
                    fill="url(#grad4)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b p-3 font-semibold">Catatan Pengukuran</div>
        <div className="divide-y">
          {data.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Belum ada catatan.</div>
          )}
          {[...data].reverse().map((r, i) => {
            const st =
              type === "hipertensi"
                ? statusHipertensi(r.sistolik, r.diastolik)
                : type === "gula_darah"
                  ? statusGula(r.gula_puasa, r.gula_pp)
                  : statusAsamUrat(r.asam_urat);
            return (
              <div key={i} className="flex items-center justify-between p-3 text-sm gap-3">
                <span className="text-muted-foreground">
                  {new Date(r.measurement_time).toLocaleString("id-ID")}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {type === "hipertensi" && `${r.sistolik}/${r.diastolik}`}
                    {type === "gula_darah" && `P:${r.gula_puasa ?? "-"} PP:${r.gula_pp ?? "-"}`}
                    {type === "asam_urat" && `${r.asam_urat}`}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${st.bg} ${st.color} ${st.border}`}
                  >
                    {st.label === "Normal" && <CheckCircle2 className="h-3 w-3" />}
                    {st.label === "Bahaya" && <AlertCircle className="h-3 w-3" />}
                    {st.label !== "Normal" && st.label !== "Bahaya" && (
                      <Activity className="h-3 w-3" />
                    )}
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
