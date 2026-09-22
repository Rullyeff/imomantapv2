import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DueInfo = {
  pendingToday: number; // slots scheduled today not yet logged
  dueNow: Array<{ medName: string; time: string; medicationId: string }>; // within ±30 min, not logged
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useDueDoses(userId: string | null, tick = 0): DueInfo {
  const [info, setInfo] = useState<DueInfo>({ pendingToday: 0, dueNow: [] });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: meds } = await supabase
        .from("medications")
        .select("id, name, schedule_time, is_active, is_approved")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("is_approved", true);
      const { data: logs } = await supabase
        .from("adherence_logs")
        .select("medication_id, scheduled_time")
        .eq("user_id", userId)
        .eq("scheduled_date", todayISO());
      if (cancelled) return;

      const have = new Set(
        (logs ?? []).map(
          (l) => `${l.medication_id}|${(l.scheduled_time ?? "").toString().slice(0, 5)}`,
        ),
      );
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      let pending = 0;
      const due: DueInfo["dueNow"] = [];
      for (const m of meds ?? []) {
        const times = ((m.schedule_time as string[] | null) ?? []).map((t) =>
          String(t).slice(0, 5),
        );
        for (const t of times) {
          if (have.has(`${m.id}|${t}`)) continue;
          const [h, mi] = t.split(":").map(Number);
          const slot = h * 60 + mi;
          if (slot <= nowMin + 30) pending += 1; // due or overdue (not yet missed)
          if (Math.abs(slot - nowMin) <= 30) {
            due.push({
              medName: (m.name as string) ?? "Obat",
              time: t,
              medicationId: m.id as string,
            });
          }
        }
      }
      setInfo({ pendingToday: pending, dueNow: due });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, tick]);

  return info;
}
