import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Activity, AlertTriangle, Pill } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

type Pending = { id: string; user_id: string; full_name: string | null; created_at: string };

function AdminDashboard() {
  const [s, setS] = useState({ users: 0, measurements: 0, abnormal: 0, meds: 0 });
  const [pending, setPending] = useState<Pending[]>([]);

  async function load() {
    const [a, b, c, d, p] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("measurements").select("*", { count: "exact", head: true }),
      supabase
        .from("measurements")
        .select("*", { count: "exact", head: true })
        .eq("is_abnormal", true),
      supabase
        .from("medications")
        .select("*", { count: "exact", head: true })
        .eq("is_approved", false),
      supabase
        .from("profiles")
        .select("id, user_id, full_name, created_at")
        .eq("is_verified", false)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setS({
      users: a.count ?? 0,
      measurements: b.count ?? 0,
      abnormal: c.count ?? 0,
      meds: d.count ?? 0,
    });
    setPending((p.data ?? []) as Pending[]);
  }
  useEffect(() => {
    load();
  }, []);

  const cards = [
    { label: "Total User", value: s.users, icon: Users, to: "/admin/users" },
    { label: "Total Pengukuran", value: s.measurements, icon: Activity, to: "/admin/users" },
    { label: "Pengukuran Abnormal", value: s.abnormal, icon: AlertTriangle, to: "/admin/users" },
    { label: "Obat Belum Disetujui", value: s.meds, icon: Pill, to: "/admin/obat" },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to as never}
            className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-2 text-3xl font-bold">{c.value}</p>
          </Link>
        ))}
      </div>

      <section>
        <div className="rounded-xl border bg-card">
          <div className="border-b p-4 font-semibold">
            Pasien Menunggu Verifikasi (oleh Apoteker)
          </div>
          {pending.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Tidak ada akun menunggu.</p>
          ) : (
            <div className="divide-y">
              {pending.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{p.full_name || "(tanpa nama)"}</p>
                    <p className="text-xs text-muted-foreground">
                      Daftar: {new Date(p.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Menunggu apoteker</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
