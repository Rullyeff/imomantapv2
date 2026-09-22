import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight } from "lucide-react";
import heroClean from "@/assets/hero-clean.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IMO MANTAP — Manajemen Kepatuhan Kesehatan" },
      {
        name: "description",
        content:
          "Aplikasi pencatatan dan pengingat kesehatan digital untuk pasien, apoteker, dan admin.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  // Sesi login tersimpan permanen di perangkat: jika pengguna masih login
  // (belum menekan Keluar), buka aplikasi langsung menuju halaman perannya.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        const role = await fetchUserRole(data.session.user.id);
        if (!active) return;
        nav({
          to: role === "apoteker" ? "/apoteker" : role === "admin" ? "/admin" : "/pasien",
          replace: true,
        });
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      active = false;
    };
  }, [nav]);

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Memuat...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="relative flex w-full max-w-[390px] min-h-screen flex-col overflow-hidden bg-card px-6 py-8 shadow-2xl shadow-primary/5 md:min-h-[624px] md:rounded-[2rem]">
        {/* Background accents */}
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-accent/40 blur-3xl" />

        {/* Header / Logo */}
        <div className="z-10 mb-10 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 shadow-sm backdrop-blur-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Activity className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-extrabold tracking-tight text-foreground">
              IMO <span className="text-primary">Mantap</span>
            </span>
          </div>
        </div>

        {/* Hero image */}
        <div className="relative z-10 mb-10 flex flex-1 items-center justify-center px-4">
          <div className="absolute inset-0 scale-110 rounded-full bg-gradient-to-b from-primary/10 to-transparent opacity-50" />
          <div className="relative z-10 overflow-hidden rounded-[2.5rem] border border-primary/10 shadow-xl shadow-primary/10">
            <img
              src={heroClean}
              alt="Dokter kartun ramah memegang ponsel"
              className="max-h-[260px] w-auto object-contain"
              width={1024}
              height={1024}
            />
          </div>
        </div>

        {/* Copy */}
        <div className="z-10 text-center">
          <h1 className="mb-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-foreground">
            Kelola Kesehatanmu <br />
            <span className="text-primary">dengan Mudah</span>
          </h1>
          <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted-foreground">
            Solusi cerdas monitoring kesehatan harian yang praktis dan modern untuk keluarga
            Indonesia.
          </p>
        </div>

        {/* CTA */}
        <div className="z-10 mb-6 mt-auto pt-8">
          <Link to="/auth" className="group block w-full">
            <Button
              size="lg"
              className="w-full rounded-2xl py-6 text-base font-bold shadow-xl shadow-primary/20"
            >
              Mulai Sekarang
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <div className="z-10 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            IMO MANTAP Versi 2
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Created By Universitas Borneo Lestari
          </p>
        </div>
      </div>
    </div>
  );
}
