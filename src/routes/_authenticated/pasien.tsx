import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ClipboardList, History, Pill, User, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRole } from "@/hooks/use-auth";
import { useMedicationReminders } from "@/hooks/use-medication-reminders";
import { useDueDoses } from "@/hooks/use-due-doses";
import { Disclaimer } from "@/components/Disclaimer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pasien")({
  component: PasienLayout,
});

const tabs = [
  { to: "/pasien", icon: Activity, label: "Dashboard" },
  { to: "/pasien/catat", icon: ClipboardList, label: "Catat" },
  { to: "/pasien/riwayat", icon: History, label: "Riwayat" },
  { to: "/pasien/obat", icon: Pill, label: "Obat" },
  { to: "/pasien/profil", icon: User, label: "Profil" },
] as const;

function PasienLayout() {
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  useMedicationReminders(userId);
  const { pendingToday } = useDueDoses(userId);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        nav({ to: "/auth", replace: true });
        return;
      }
      const role = await fetchUserRole(data.user.id);
      if (role === "apoteker") nav({ to: "/apoteker", replace: true });
      else if (role === "admin") nav({ to: "/admin", replace: true });
      else {
        setUserId(data.user.id);
        setChecking(false);
      }
    });
  }, [nav]);

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Memuat...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold">IMO MANTAP</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <Outlet />
        <Disclaimer />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {tabs.map((t) => {
            const active = t.to === "/pasien" ? path === "/pasien" : path.startsWith(t.to);
            const showBadge = t.to === "/pasien/obat" && pendingToday > 0;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`relative flex flex-col items-center gap-1 py-3 text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <t.icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white text-center">
                      {pendingToday}
                    </span>
                  )}
                </div>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
