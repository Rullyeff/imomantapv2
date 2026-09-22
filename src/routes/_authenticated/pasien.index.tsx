import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Heart,
  Droplet,
  FlaskConical,
  MessageSquare,
  BookOpen,
  Bell,
  NotebookPen,
} from "lucide-react";
import { useDueDoses } from "@/hooks/use-due-doses";

import { supabase } from "@/integrations/supabase/client";
import {
  hipertensiStatus,
  gulaDarahStatus,
  asamUratStatus,
  adherenceCategory,
  type StatusInfo,
} from "@/lib/health-utils";

export const Route = createFileRoute("/_authenticated/pasien/")({
  component: PasienDashboard,
});

type Profile = { gender?: "male" | "female" | null; full_name?: string | null };
type Measurement = {
  disease_type: "hipertensi" | "asam_urat" | "gula_darah";
  sistolik: number | null;
  diastolik: number | null;
  gula_puasa: number | null;
  gula_pp: number | null;
  asam_urat: number | null;
  measurement_time: string;
};

function PasienDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [latest, setLatest] = useState<Record<string, Measurement | undefined>>({});
  const [adherence, setAdherence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { dueNow, pendingToday } = useDueDoses(userId);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);

      const { data: p } = await supabase
        .from("profiles" as never)
        .select("full_name, gender")
        .eq("user_id", u.user.id)
        .maybeSingle();
      setProfile(p as Profile | null);

      const { data: m } = await supabase
        .from("measurements" as never)
        .select(
          "disease_type, sistolik, diastolik, gula_puasa, gula_pp, asam_urat, measurement_time",
        )
        .eq("user_id", u.user.id)
        .order("measurement_time", { ascending: false })
        .limit(50);
      const byType: Record<string, Measurement | undefined> = {};
      (m as Measurement[] | null)?.forEach((row) => {
        if (!byType[row.disease_type]) byType[row.disease_type] = row;
      });
      setLatest(byType);

      // adherence: 7 last days
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: logs } = await supabase
        .from("adherence_logs" as never)
        .select("is_taken")
        .eq("user_id", u.user.id)
        .gte("created_at", since);
      const arr = (logs as { is_taken: boolean }[] | null) ?? [];
      if (arr.length > 0) {
        const pct = Math.round((arr.filter((l) => l.is_taken).length / arr.length) * 100);
        setAdherence(pct);
      }
      setLoading(false);
    })();
  }, []);

  const tensi = latest.hipertensi;
  const gula = latest.gula_darah;
  const urat = latest.asam_urat;

  const tensiStat = hipertensiStatus(tensi?.sistolik, tensi?.diastolik);
  const gulaStat = gulaDarahStatus(gula?.gula_puasa, gula?.gula_pp);
  const uratStat = asamUratStatus(urat?.asam_urat, profile?.gender);
  const adhStat = adherenceCategory(adherence);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Halo, {profile?.full_name || "Pasien"} 👋</h1>
        <p className="text-sm text-muted-foreground">Berikut ringkasan kesehatan Anda hari ini.</p>
      </div>

      {(dueNow.length > 0 || pendingToday > 0) && (
        <Link
          to="/pasien/obat"
          className="block rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm hover:bg-primary/10 transition"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/15 p-2">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {dueNow.length > 0 ? (
                <>
                  <p className="font-semibold text-primary">Saatnya minum obat</p>
                  <p className="text-sm text-foreground/80 truncate">
                    {dueNow.map((d) => `${d.medName} (${d.time})`).join(", ")}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-primary">Ada dosis hari ini</p>
                  <p className="text-sm text-foreground/80">
                    {pendingToday} dosis menunggu untuk dicatat.
                  </p>
                </>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
              {dueNow.length || pendingToday}
            </span>
          </div>
        </Link>
      )}

      <StatusCard
        icon={Heart}
        title="Hipertensi"
        value={tensi ? `${tensi.sistolik}/${tensi.diastolik} mmHg` : "Belum ada data"}
        status={tensiStat}
      />
      <StatusCard
        icon={Droplet}
        title="Gula Darah"
        value={
          gula
            ? `Puasa ${gula.gula_puasa ?? "-"} · PP ${gula.gula_pp ?? "-"} mg/dL`
            : "Belum ada data"
        }
        status={gulaStat}
      />
      <StatusCard
        icon={FlaskConical}
        title="Asam Urat"
        value={urat ? `${urat.asam_urat} mg/dL` : "Belum ada data"}
        status={uratStat}
      />

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Kepatuhan Obat (7 hari)</p>
            <p className="text-2xl font-bold">{adherence}%</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${adhStat.bgClass} ${adhStat.colorClass}`}
          >
            {adhStat.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/pasien/konsultasi"
          className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="font-medium">Konsultasi</span>
        </Link>
        <Link
          to="/pasien/edukasi"
          className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition flex items-center gap-3"
        >
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-medium">Edukasi</span>
        </Link>
        <Link
          to="/pasien/logbook"
          className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition flex items-center gap-3 sm:col-span-2"
        >
          <NotebookPen className="h-5 w-5 text-primary" />
          <span className="font-medium">Logbook</span>
        </Link>
      </div>

    </div>
  );
}

function StatusCard({
  icon: Icon,
  title,
  value,
  status,
}: {
  icon: typeof Heart;
  title: string;
  value: string;
  status: StatusInfo;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="font-semibold">{value}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${status.bgClass} ${status.colorClass}`}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
