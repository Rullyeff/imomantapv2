import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdherenceSummary = {
  total: number;
  taken: number;
  on_time: number;
  late: number;
  missed: number;
  pct: number;
};

export type DailySeries = { day: string; total: number; taken: number; pct: number };

export const getMyAdherenceSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days: number }) => ({
    days: Math.max(1, Math.min(365, Number(d.days) || 7)),
  }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "get_adherence_summary" as never,
      {
        _user_id: context.userId,
        _days: data.days,
      } as never,
    );

    if (error) throw new Error(error.message);
    const r = (Array.isArray(rows) ? rows[0] : rows) as AdherenceSummary | null;
    return r ?? { total: 0, taken: 0, on_time: 0, late: 0, missed: 0, pct: 0 };
  });

export const getMyAdherenceDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days: number }) => ({
    days: Math.max(1, Math.min(90, Number(d.days) || 14)),
  }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "get_adherence_daily" as never,
      {
        _user_id: context.userId,
        _days: data.days,
      } as never,
    );

    if (error) throw new Error(error.message);
    return (rows as DailySeries[] | null) ?? [];
  });

export const getMyAdherenceHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days: number }) => ({
    days: Math.max(1, Math.min(60, Number(d.days) || 7)),
  }))
  .handler(async ({ data, context }) => {
    const since = new Date();
    since.setDate(since.getDate() - (data.days - 1));
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("adherence_logs")
      .select(
        "id, medication_id, scheduled_date, scheduled_time, status, taken_at, medications(name)",
      )
      .eq("user_id", context.userId)
      .gte("scheduled_date", sinceStr)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      medication_id: string;
      scheduled_date: string;
      scheduled_time: string | null;
      status: string | null;
      taken_at: string | null;
      medications: { name: string } | null;
    }>;
  });

export type PatientAdherenceRow = {
  user_id: string;
  full_name: string | null;
  active_meds: number;
  pct7: number;
  pct30: number;
  missed7: number;
};

export const getPatientsAdherence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PatientAdherenceRow[]> => {
    // verify caller is apoteker or admin
    const { data: isApo } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "apoteker",
    });
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isApo && !isAdmin) throw new Error("Forbidden");

    // Use admin client to list all pasien (user_roles RLS limits visibility)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "pasien");
    if (rolesErr) throw new Error(rolesErr.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);

    const { data: meds } = await supabaseAdmin
      .from("medications")
      .select("user_id")
      .in("user_id", ids)
      .eq("is_active", true)
      .eq("is_approved", true);
    const medCount = new Map<string, number>();
    (meds ?? []).forEach((m) => medCount.set(m.user_id, (medCount.get(m.user_id) ?? 0) + 1));

    const today = new Date();
    const d7 = new Date(today);
    d7.setDate(today.getDate() - 6);
    const d30 = new Date(today);
    d30.setDate(today.getDate() - 29);
    const s7 = d7.toISOString().slice(0, 10);
    const s30 = d30.toISOString().slice(0, 10);

    const { data: logs30 } = await supabaseAdmin
      .from("adherence_logs")
      .select("user_id, scheduled_date, status")
      .in("user_id", ids)
      .gte("scheduled_date", s30)
      .not("status", "is", null);

    type Agg = { t7: number; k7: number; m7: number; t30: number; k30: number };
    const agg = new Map<string, Agg>();
    (logs30 ?? []).forEach((l) => {
      const a = agg.get(l.user_id) ?? { t7: 0, k7: 0, m7: 0, t30: 0, k30: 0 };
      a.t30++;
      if (l.status === "on_time" || l.status === "late") a.k30++;
      if (l.scheduled_date && l.scheduled_date >= s7) {
        a.t7++;
        if (l.status === "on_time" || l.status === "late") a.k7++;
        if (l.status === "missed") a.m7++;
      }
      agg.set(l.user_id, a);
    });

    const rows: PatientAdherenceRow[] = ids.map((uid) => {
      const a = agg.get(uid) ?? { t7: 0, k7: 0, m7: 0, t30: 0, k30: 0 };
      const profile = (profiles ?? []).find((p) => p.user_id === uid);
      return {
        user_id: uid,
        full_name: profile?.full_name ?? null,
        active_meds: medCount.get(uid) ?? 0,
        pct7: a.t7 ? Math.round((a.k7 / a.t7) * 100) : 0,
        pct30: a.t30 ? Math.round((a.k30 / a.t30) * 100) : 0,
        missed7: a.m7,
      };
    });

    rows.sort((a, b) => a.pct7 - b.pct7);
    return rows;
  });
