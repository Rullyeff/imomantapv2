import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Schedule browser notifications for today's medication times.
 * Re-runs daily; uses setTimeout for upcoming doses.
 */
export function useMedicationReminders(userId: string | null) {
  useEffect(() => {
    if (!userId || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    let timers: ReturnType<typeof setTimeout>[] = [];

    (async () => {
      const { data } = await supabase
        .from("medications")
        .select("name, dosage, schedule_time, is_active, is_approved")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("is_approved", true);

      const now = new Date();
      (data ?? []).forEach((m: any) => {
        (m.schedule_time ?? []).forEach((hhmm: string) => {
          const [h, mi] = hhmm.split(":").map(Number);
          if (Number.isNaN(h) || Number.isNaN(mi)) return;
          const target = new Date(now);
          target.setHours(h, mi, 0, 0);
          const delay = target.getTime() - now.getTime();
          if (delay > 0 && delay < 24 * 3600 * 1000) {
            timers.push(
              setTimeout(() => {
                if (Notification.permission === "granted") {
                  new Notification("Waktunya minum obat", {
                    body: `${m.name} — ${m.dosage}`,
                    icon: "/favicon.ico",
                  });
                }
              }, delay),
            );
          }
        });
      });
    })();

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [userId]);
}
