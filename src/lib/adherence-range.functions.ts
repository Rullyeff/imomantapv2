import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdherenceRangeRow = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string | null;
  taken_at: string | null;
  medications: { name: string; dosage: string | null; disease_type: string | null } | null;
};

export type AdherenceRangeResult = {
  patient: { full_name: string | null; gender: string | null; age: number | null } | null;
  from: string;
  to: string;
  summary: { total: number; on_time: number; late: number; missed: number; pct: number };
  rows: AdherenceRangeRow[];
};

function isoDate(s: string): string {
  // accept YYYY-MM-DD only
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Tanggal harus YYYY-MM-DD");
  return s;
}

export const getMyAdherenceRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) => ({
    from: isoDate(d.from),
    to: isoDate(d.to),
  }))
  .handler(async ({ data, context }): Promise<AdherenceRangeResult> => {
    const from = data.from <= data.to ? data.from : data.to;
    const to = data.from <= data.to ? data.to : data.from;

    const [{ data: profile }, { data: rows, error }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("full_name, gender, age")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("adherence_logs")
        .select(
          "id, scheduled_date, scheduled_time, status, taken_at, medications(name, dosage, disease_type)",
        )
        .eq("user_id", context.userId)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true })
        .limit(2000),
    ]);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as AdherenceRangeRow[];
    const total = list.length;
    const on_time = list.filter((r) => r.status === "on_time").length;
    const late = list.filter((r) => r.status === "late").length;
    const missed = list.filter((r) => r.status === "missed").length;
    const taken = on_time + late;
    const pct = total ? Math.round((taken / total) * 1000) / 10 : 0;

    return {
      patient:
        (profile as {
          full_name: string | null;
          gender: string | null;
          age: number | null;
        } | null) ?? null,
      from,
      to,
      summary: { total, on_time, late, missed, pct },
      rows: list,
    };
  });
