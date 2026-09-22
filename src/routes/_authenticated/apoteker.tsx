import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  LogOut,
  Users,
  MessageSquare,
  BookOpen,
  LayoutDashboard,
  ShieldCheck,
  Pill,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/Disclaimer";

export const Route = createFileRoute("/_authenticated/apoteker")({
  component: ApotekerLayout,
});

type Tab = { to: string; icon: typeof Users; label: string; exact?: boolean };
const tabs: Tab[] = [
  { to: "/apoteker", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/apoteker/pasien", icon: Users, label: "Pasien" },
  { to: "/apoteker/obat", icon: Pill, label: "Obat" },
  { to: "/apoteker/kepatuhan", icon: ShieldCheck, label: "Kepatuhan" },
  { to: "/apoteker/konsultasi", icon: MessageSquare, label: "Konsultasi" },
  { to: "/apoteker/edukasi", icon: BookOpen, label: "Edukasi" },
];

function ApotekerLayout() {
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const role = await fetchUserRole(data.user.id);
      setAllowed(role === "apoteker" || role === "admin");
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Memuat...
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Akses ditolak</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Akun Anda belum memiliki role apoteker.
          </p>
          <Button className="mt-4" onClick={logout}>
            Keluar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold">IMO MANTAP — Apoteker</span>
          </div>
          <nav className="hidden md:flex gap-1">
            {tabs.map((t) => {
              const active = t.exact ? path === t.to : path.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to as never}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <nav className="md:hidden flex border-t overflow-x-auto">
          {tabs.map((t) => {
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to as never}
                className={`flex-1 min-w-[5rem] flex flex-col items-center gap-1 py-2 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <Outlet />
        <Disclaimer />
      </main>
    </div>
  );
}
