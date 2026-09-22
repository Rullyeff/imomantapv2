import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Pill,
  Plus,
  Check,
  X,
  Clock,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Pencil,
  Trash2,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  FileDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getMyAdherenceSummary,
  getMyAdherenceDaily,
  getMyAdherenceHistory,
  type AdherenceSummary,
  type DailySeries,
} from "@/lib/adherence.functions";
import { savePushSubscription, deletePushSubscription, sendTestPush } from "@/lib/push.functions";
import { getMyAdherenceRange } from "@/lib/adherence-range.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/push-config";
import { exportAdherencePdf } from "@/lib/pdf-export";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pasien/obat")({
  component: ObatPage,
});

type Med = {
  id: string;
  name: string;
  disease_type: string;
  dosage: string | null;
  schedule_time: string[];
  is_active: boolean;
  is_approved: boolean;
};

type Log = {
  medication_id: string;
  scheduled_time: string;
  is_taken: boolean;
  taken_at: string | null;
};

type Slot = {
  med: Med;
  time: string;
  taken: boolean;
  takenAt: string | null;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ObatPage() {
  const [meds, setMeds] = useState<Med[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Med | null>(null);
  const [reload, setReload] = useState(0);
  const [sum7, setSum7] = useState<AdherenceSummary | null>(null);
  const [sum30, setSum30] = useState<AdherenceSummary | null>(null);
  const [daily, setDaily] = useState<DailySeries[]>([]);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      scheduled_date: string;
      scheduled_time: string | null;
      status: string | null;
      medications: { name: string } | null;
    }>
  >([]);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied",
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const today = todayISO();
  const sevenDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [pdfFrom, setPdfFrom] = useState<string>(sevenDaysAgo);
  const [pdfTo, setPdfTo] = useState<string>(today);
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  // key = `${medId}-${HH:mm}` -> snoozed-until timestamp (ms)
  const snoozeRef = useRef<Map<string, number>>(new Map());
  const notifiedRef = useRef<Set<string>>(new Set());

  const fSum = useServerFn(getMyAdherenceSummary);
  const fDaily = useServerFn(getMyAdherenceDaily);
  const fHist = useServerFn(getMyAdherenceHistory);
  const fSavePush = useServerFn(savePushSubscription);
  const fDeletePush = useServerFn(deletePushSubscription);
  const fTestPush = useServerFn(sendTestPush);
  const fRange = useServerFn(getMyAdherenceRange);

  // Detect existing push subscription
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enablePush() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return toast.error("Browser tidak mendukung Web Push. Coba Chrome/Edge/Firefox terbaru.");
    }
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm !== "granted") {
        toast.error("Izin notifikasi ditolak");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        });
      }
      const j = sub.toJSON();
      const p256dh = j.keys?.p256dh;
      const auth = j.keys?.auth;
      if (!j.endpoint || !p256dh || !auth) throw new Error("Subscription tidak lengkap");
      await fSavePush({
        data: { endpoint: j.endpoint, p256dh, auth, userAgent: navigator.userAgent },
      });
      setPushSubscribed(true);
      const r = await fTestPush();
      toast.success(r.sent > 0 ? "✓ Pengingat aktif (tes terkirim)" : "✓ Pengingat aktif");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengaktifkan pengingat");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (typeof window === "undefined") return;
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fDeletePush({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      toast.success("Pengingat dinonaktifkan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menonaktifkan");
    } finally {
      setPushBusy(false);
    }
  }

  async function downloadPdf() {
    if (!pdfFrom || !pdfTo) return toast.error("Pilih rentang tanggal");
    setPdfBusy(true);
    try {
      const result = await fRange({ data: { from: pdfFrom, to: pdfTo } });
      exportAdherencePdf(result);
      setPdfOpen(false);
      toast.success("PDF berhasil dibuat");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("medications" as never)
        .select("id, name, disease_type, dosage, schedule_time, is_active, is_approved")
        .eq("user_id", u.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setMeds((data as Med[] | null) ?? []);

      const { data: lg } = await supabase
        .from("adherence_logs" as never)
        .select("medication_id, scheduled_time, is_taken, taken_at")
        .eq("user_id", u.user.id)
        .eq("scheduled_date", todayISO());
      setLogs((lg as Log[] | null) ?? []);

      try {
        const [s7, s30, ds, hist] = await Promise.all([
          fSum({ data: { days: 7 } }),
          fSum({ data: { days: 30 } }),
          fDaily({ data: { days: 14 } }),
          fHist({ data: { days: 7 } }),
        ]);
        setSum7(s7);
        setSum30(s30);
        setDaily(ds);
        setHistory(hist);
      } catch {
        // ignore — show zeros
      }
    })();
  }, [reload, fSum, fDaily, fHist]);

  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    for (const m of meds) {
      for (const t of m.schedule_time ?? []) {
        const log = logs.find(
          (l) => l.medication_id === m.id && l.scheduled_time?.slice(0, 5) === t.slice(0, 5),
        );
        out.push({
          med: m,
          time: t.slice(0, 5),
          taken: !!log?.is_taken,
          takenAt: log?.taken_at ?? null,
        });
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }, [meds, logs]);

  const takenCount = slots.filter((s) => s.taken).length;
  const pct = slots.length ? Math.round((takenCount / slots.length) * 100) : 0;

  async function markTaken(s: Slot, forced?: "on_time" | "late") {
    if (s.taken) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const now = new Date();
    let status: "on_time" | "late" = forced ?? "on_time";
    if (!forced) {
      const [h, mi] = s.time.split(":").map(Number);
      const scheduled = new Date();
      scheduled.setHours(h, mi, 0, 0);
      const diffMin = Math.abs(now.getTime() - scheduled.getTime()) / 60000;
      status = diffMin <= 30 ? "on_time" : "late";
    }
    const { error } = await supabase.from("adherence_logs" as never).insert({
      user_id: u.user.id,
      medication_id: s.med.id,
      scheduled_date: todayISO(),
      scheduled_time: `${s.time}:00`,
      taken_at: now.toISOString(),
      is_taken: true,
      is_late: status === "late",
      status,
      reported_by: u.user.id,
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success(
        `✓ ${s.med.name} (${s.time}) dicatat${status === "late" ? " (terlambat)" : ""}`,
      );
      setReload((n) => n + 1);
    }
  }

  async function deleteMed(m: Med) {
    if (!confirm(`Hapus jadwal ${m.name}? Riwayat kepatuhan tetap tersimpan.`)) return;
    // Soft delete: set is_active=false agar adherence_logs lama tetap utuh & konsisten
    const { error } = await supabase
      .from("medications" as never)
      .update({ is_active: false } as never)
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Jadwal dihapus");
    setReload((n) => n + 1);
  }

  function snooze(s: Slot, minutes: number) {
    const key = `${s.med.id}-${s.time}`;
    snoozeRef.current.set(key, Date.now() + minutes * 60_000);
    // hapus penanda notif supaya bisa berbunyi lagi setelah snooze habis
    notifiedRef.current.delete(`${todayISO()}-${key}`);
    toast.message(`⏰ Diingatkan lagi ${minutes} menit lagi`);
  }

  async function requestNotifPermission() {
    if (!("Notification" in window)) return toast.error("Browser tidak mendukung notifikasi");
    const p = await Notification.requestPermission();
    setNotifPerm(p);
    if (p === "granted") toast.success("Pengingat aktif");
  }

  // Pengingat otomatis: cek tiap 20 detik
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      for (const s of slots) {
        if (s.taken) continue;
        const key = `${s.med.id}-${s.time}`;
        const dayKey = `${todayISO()}-${key}`;
        const snoozedUntil = snoozeRef.current.get(key) ?? 0;
        if (Date.now() < snoozedUntil) continue;
        // Cocok jam atau snooze sudah lewat
        const isTimeNow = s.time === hhmm;
        const snoozeJustExpired = snoozedUntil > 0 && Date.now() >= snoozedUntil;
        if (!isTimeNow && !snoozeJustExpired) continue;
        if (notifiedRef.current.has(dayKey)) continue;
        notifiedRef.current.add(dayKey);
        if (snoozeJustExpired) snoozeRef.current.delete(key);

        // Browser notification
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("Waktunya minum obat", {
              body: `${s.med.name} · ${s.time}${s.med.dosage ? ` · ${s.med.dosage}` : ""}`,
              tag: dayKey,
            });
          } catch {
            /* ignore */
          }
        }
        // In-app toast dengan aksi snooze & minum
        toast(`💊 ${s.med.name} · ${s.time}`, {
          description: s.med.dosage || "Saatnya minum obat",
          duration: 60_000,
          action: { label: "Sudah minum", onClick: () => markTaken(s, "on_time") },
          cancel: { label: "Snooze 10m", onClick: () => snooze(s, 10) },
        });
      }
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Jadwal Obat</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={pushSubscribed ? disablePush : enablePush}
            disabled={pushBusy}
            aria-label={pushSubscribed ? "Matikan pengingat push" : "Aktifkan pengingat push"}
            title={pushSubscribed ? "Pengingat aktif — klik untuk mematikan" : "Aktifkan pengingat"}
          >
            {pushSubscribed ? (
              <Bell className="h-4 w-4 text-emerald-600" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPdfOpen(true)}
            aria-label="Export PDF riwayat"
            title="Export PDF riwayat"
          >
            <FileDown className="h-4 w-4" />
          </Button>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditing(null)}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Obat" : "Tambah Obat"}</DialogTitle>
              </DialogHeader>
              <AddMedForm
                initial={editing}
                onDone={() => {
                  setOpen(false);
                  setEditing(null);
                  setReload((n) => n + 1);
                }}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export PDF Riwayat</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Pilih rentang tanggal. PDF akan berisi data pasien, ringkasan kepatuhan, dan
                  rincian tiap dosis — siap dibawa ke dokter.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="pdf-from">Dari</Label>
                    <Input
                      id="pdf-from"
                      type="date"
                      value={pdfFrom}
                      max={pdfTo}
                      onChange={(e) => setPdfFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pdf-to">Sampai</Label>
                    <Input
                      id="pdf-to"
                      type="date"
                      value={pdfTo}
                      min={pdfFrom}
                      max={today}
                      onChange={(e) => setPdfTo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "7 hari", days: 6 },
                    { label: "30 hari", days: 29 },
                    { label: "90 hari", days: 89 },
                  ].map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - p.days);
                        setPdfFrom(
                          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                        );
                        setPdfTo(today);
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <Button onClick={downloadPdf} disabled={pdfBusy} className="w-full">
                  <FileDown className="mr-2 h-4 w-4" />
                  {pdfBusy ? "Membuat PDF…" : "Download PDF"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Ringkasan hari ini */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-primary" />
          Hari Ini ·{" "}
          {new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold">
              {takenCount}/{slots.length}
            </p>
            <p className="text-xs text-muted-foreground">dosis diminum</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{pct}%</p>
            <p className="text-xs text-muted-foreground">kepatuhan</p>
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Jadwal hari ini */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">JADWAL HARI INI</h2>
        {slots.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Belum ada jadwal aktif. Tambahkan obat dari tombol di atas.
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map((s, i) => (
              <div
                key={`${s.med.id}-${s.time}-${i}`}
                className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                  s.taken ? "bg-emerald-50 border-emerald-200" : "bg-card"
                }`}
              >
                <div
                  className={`flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-lg ${
                    s.taken ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span className="text-sm font-bold">{s.time}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.med.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.med.disease_type} · {s.med.dosage || "-"}
                  </p>
                </div>
                {s.taken ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    <Check className="h-3 w-3" /> Sudah
                  </span>
                ) : (
                  (() => {
                    const [hh, mm] = s.time.split(":").map(Number);
                    const scheduled = new Date(now);
                    scheduled.setHours(hh, mm, 0, 0);
                    const reached = now.getTime() >= scheduled.getTime();
                    if (!reached) {
                      return (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Belum waktunya
                        </span>
                      );
                    }
                    return (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => markTaken(s, "on_time")}>
                          <Check className="mr-1 h-3 w-3" /> Minum
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => markTaken(s, "late")}
                        >
                          <AlertCircle className="mr-1 h-3 w-3" /> Telat
                        </Button>
                      </div>
                    );
                  })()
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rekap kepatuhan */}
      <AdherenceRecap sum7={sum7} sum30={sum30} daily={daily} history={history} />

      {/* Daftar obat */}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">DAFTAR OBAT</h2>
        {meds.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Belum ada obat.
          </div>
        ) : (
          <div className="space-y-2">
            {meds.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Pill className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.disease_type} ·{" "}
                    {(m.schedule_time ?? []).map((t) => t.slice(0, 5)).join(", ") || "-"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(m);
                      setOpen(true);
                    }}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteMed(m)}
                    aria-label="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MED_FALLBACK: Record<"hipertensi" | "gula_darah" | "asam_urat", string[]> = {
  hipertensi: [
    "Amlodipine",
    "Captopril",
    "Lisinopril",
    "Losartan",
    "Valsartan",
    "Bisoprolol",
    "Hydrochlorothiazide (HCT)",
    "Furosemide",
    "Nifedipine",
    "Ramipril",
  ],
  gula_darah: [
    "Metformin",
    "Glimepiride",
    "Gliclazide",
    "Glibenclamide",
    "Acarbose",
    "Pioglitazone",
    "Sitagliptin",
    "Insulin (Novorapid)",
    "Insulin (Lantus)",
    "Empagliflozin",
  ],
  asam_urat: [
    "Allopurinol",
    "Febuxostat",
    "Colchicine",
    "Probenecid",
    "Natrium Diklofenak",
    "Meloxicam",
    "Piroxicam",
    "Ibuprofen",
  ],
};

type CatalogRow = {
  name: string;
  disease_type: "hipertensi" | "gula_darah" | "asam_urat";
  dosage: string | null;
};

function useMedCatalog() {
  const [options, setOptions] = useState<
    Record<"hipertensi" | "gula_darah" | "asam_urat", { name: string; dosage: string | null }[]>
  >({
    hipertensi: [],
    gula_darah: [],
    asam_urat: [],
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("medication_catalog" as never)
        .select("name, disease_type, dosage")
        .eq("is_active", true)
        .order("name", { ascending: true });
      const rows = (data as CatalogRow[] | null) ?? [];
      const grouped: typeof options = {
        hipertensi: [],
        gula_darah: [],
        asam_urat: [],
      };
      for (const r of rows) {
        if (grouped[r.disease_type]) {
          grouped[r.disease_type].push({ name: r.name, dosage: r.dosage });
        }
      }
      // Fallback ke daftar bawaan kalau katalog kosong untuk suatu penyakit
      (Object.keys(grouped) as (keyof typeof grouped)[]).forEach((k) => {
        if (grouped[k].length === 0) {
          grouped[k] = MED_FALLBACK[k].map((n) => ({ name: n, dosage: null }));
        }
      });
      setOptions(grouped);
    })();
  }, []);

  return options;
}

function AddMedForm({ initial, onDone }: { initial?: Med | null; onDone: () => void }) {
  const isEdit = !!initial;
  const catalog = useMedCatalog();
  const knownDisease =
    initial &&
    (["hipertensi", "gula_darah", "asam_urat"] as const).includes(initial.disease_type as never)
      ? (initial.disease_type as "hipertensi" | "gula_darah" | "asam_urat")
      : "";
  const initialNameInList =
    !!knownDisease && catalog[knownDisease].some((o) => o.name === initial!.name);
  const [disease, setDisease] = useState<"hipertensi" | "asam_urat" | "gula_darah" | "">(
    knownDisease,
  );
  const [name, setName] = useState<string>(
    initial ? (initialNameInList ? initial.name : "__other__") : "",
  );
  const [customName, setCustomName] = useState<string>(
    initial && !initialNameInList ? initial.name : "",
  );
  const [dosage, setDosage] = useState<string>(initial?.dosage ?? "");
  const [times, setTimes] = useState<string[]>(
    initial?.schedule_time?.length ? initial.schedule_time.map((t) => t.slice(0, 5)) : ["08:00"],
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!disease) return toast.error("Pilih penyakit dulu");
    const finalName = name === "__other__" ? customName.trim() : name;
    if (!finalName) return toast.error("Pilih atau isi nama obat");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
    const schedule = times.map((s) => s.trim()).filter(Boolean);
    if (schedule.length === 0) {
      setSaving(false);
      return toast.error("Tambahkan minimal satu jadwal");
    }
    const payload = {
      name: finalName,
      disease_type: disease,
      dosage,
      schedule_time: schedule,
      is_active: true,
      is_approved: true,
    };
    const { error } = isEdit
      ? await supabase
          .from("medications" as never)
          .update(payload as never)
          .eq("id", initial!.id)
      : await supabase
          .from("medications" as never)
          .insert({ ...payload, user_id: u.user.id } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Jadwal diperbarui" : "Obat ditambahkan");
    // Otomatis aktifkan pengingat browser setelah jadwal disimpan (butuh user gesture — submit ini)
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        const p = await Notification.requestPermission();
        if (p === "granted") toast.success("🔔 Pengingat otomatis aktif");
      } catch {
        /* ignore */
      }
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Penyakit</Label>
        <Select
          value={disease}
          onValueChange={(v) => {
            setDisease(v as never);
            setName("");
            setCustomName("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih penyakit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hipertensi">Hipertensi</SelectItem>
            <SelectItem value="gula_darah">Gula Darah</SelectItem>
            <SelectItem value="asam_urat">Asam Urat</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Nama Obat</Label>
        <Select value={name} onValueChange={setName} disabled={!disease}>
          <SelectTrigger>
            <SelectValue placeholder={disease ? "Pilih nama obat" : "Pilih penyakit dulu"} />
          </SelectTrigger>
          <SelectContent>
            {disease &&
              catalog[disease].map((o) => (
                <SelectItem key={o.name} value={o.name}>
                  {o.name}
                </SelectItem>
              ))}
            <SelectItem value="__other__">Lainnya…</SelectItem>
          </SelectContent>
        </Select>
        {name === "__other__" && (
          <Input
            className="mt-2"
            placeholder="Tulis nama obat"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            required
          />
        )}
      </div>
      <div>
        <Label>Dosis</Label>
        <Input
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="cth: 1 tablet"
        />
      </div>
      <div>
        <Label>Jadwal Minum</Label>
        <div className="space-y-2">
          {times.map((t, i) => {
            const [hh = "08", mm = "00"] = (t || "08:00").split(":");
            const updateAt = (idx: number, val: string) =>
              setTimes((arr) => arr.map((x, j) => (j === idx ? val : x)));
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  value={hh}
                  onChange={(e) => updateAt(i, `${e.target.value}:${mm}`)}
                >
                  {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span>:</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  value={mm}
                  onChange={(e) => updateAt(i, `${hh}:${e.target.value}`)}
                >
                  {Array.from({ length: 60 }, (_, m) => String(m).padStart(2, "0")).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                {times.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setTimes((arr) => arr.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setTimes((arr) => [...arr, "08:00"])}
          >
            <Plus className="mr-1 h-3 w-3" /> Tambah jadwal
          </Button>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Menyimpan..." : isEdit ? "Perbarui" : "Simpan"}
      </Button>
    </form>
  );
}

function statusBadge(s: string | null) {
  if (s === "on_time") return { label: "Tepat waktu", cls: "bg-emerald-100 text-emerald-700" };
  if (s === "late") return { label: "Terlambat", cls: "bg-amber-100 text-amber-700" };
  if (s === "missed") return { label: "Terlewat", cls: "bg-red-100 text-red-700" };
  return { label: "—", cls: "bg-secondary text-muted-foreground" };
}

function AdherenceRecap({
  sum7,
  sum30,
  daily,
  history,
}: {
  sum7: AdherenceSummary | null;
  sum30: AdherenceSummary | null;
  daily: DailySeries[];
  history: Array<{
    id: string;
    scheduled_date: string;
    scheduled_time: string | null;
    status: string | null;
    medications: { name: string } | null;
  }>;
}) {
  // Selalu tampilkan rekap (mulai dari 0%) supaya pasien tahu fitur ini ada

  const trend = sum7 && sum30 && sum30.pct > 0 ? Number(sum7.pct) - Number(sum30.pct) : 0;

  const STORAGE_KEY = "pasien.obat.historyOpenDays";

  const grouped = useMemo(() => {
    const acc: Record<string, typeof history> = {};
    for (const h of history) {
      const day = h.scheduled_date;
      if (!acc[day]) acc[day] = [];
      acc[day].push(h);
    }
    return Object.entries(acc).sort(([a], [b]) => b.localeCompare(a));
  }, [history]);

  const allDays = useMemo(() => grouped.map(([d]) => d), [grouped]);

  const [openDays, setOpenDays] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate dari localStorage saat mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setOpenDays(parsed.filter((v) => typeof v === "string"));
          setHydrated(true);
          return;
        }
      }
    } catch {
      // ignore
    }
    // Default: semua terbuka
    setOpenDays(allDays);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist perubahan
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openDays));
    } catch {
      // ignore
    }
  }, [openDays, hydrated]);

  const expandAll = () => setOpenDays(allDays);
  const collapseAll = () => setOpenDays([]);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground">REKAP KEPATUHAN</h2>

      <div className="grid grid-cols-2 gap-3">
        <RecapCard title="7 hari terakhir" sum={sum7} />
        <RecapCard title="30 hari terakhir" sum={sum30} trend={trend} />
      </div>

      {/* Grafik 14 hari */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" /> Tren 14 Hari
        </div>
        <div className="flex items-end gap-1 h-32">
          {daily.map((d) => {
            const h = Math.max(4, Math.round((Number(d.pct) / 100) * 100));
            const color =
              d.total === 0
                ? "bg-secondary"
                : Number(d.pct) >= 80
                  ? "bg-emerald-500"
                  : Number(d.pct) >= 50
                    ? "bg-amber-500"
                    : "bg-red-500";
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t ${color} transition-all`}
                  style={{ height: `${h}%` }}
                  title={`${d.day}: ${d.taken}/${d.total} (${d.pct}%)`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{daily[0]?.day.slice(5)}</span>
          <span>{daily[daily.length - 1]?.day.slice(5)}</span>
        </div>
      </div>

      {/* Riwayat 7 hari */}
      {history.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">RIWAYAT DOSIS (7 HARI)</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Buka semua hari di Riwayat Dosis"
              >
                Buka semua
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Tutup semua hari di Riwayat Dosis"
              >
                Tutup semua
              </button>
            </div>
          </div>
          <div className="rounded-xl border bg-card max-h-72 overflow-y-auto">
            <Accordion
              type="multiple"
              value={openDays}
              onValueChange={setOpenDays}
              className="w-full"
            >
              {grouped.map(([day, items]) => {
                const dateLabel = new Date(day).toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                });
                const taken = items.filter(
                  (h) => h.status === "on_time" || h.status === "late",
                ).length;
                const isOpen = openDays.includes(day);
                return (
                  <AccordionItem key={day} value={day} className="border-b last:border-b-0">
                    <AccordionTrigger
                      className="px-3 py-3 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                      aria-label={`${isOpen ? "Tutup" : "Buka"} rincian ${dateLabel}, ${taken} dari ${items.length} dosis`}
                    >
                      <div className="flex flex-1 items-center justify-between pr-2">
                        <p className="text-sm font-semibold">{dateLabel}</p>
                        <span className="text-xs text-muted-foreground">
                          {taken}/{items.length} dosis
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 pt-0">
                      <div className="space-y-2">
                        {items
                          .sort((a, b) =>
                            (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""),
                          )
                          .map((h) => {
                            const b = statusBadge(h.status);
                            return (
                              <div key={h.id} className="flex items-center justify-between text-sm">
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    {(h.scheduled_time ?? "").slice(0, 5) || "—"}
                                  </span>
                                  <p className="font-medium truncate">
                                    {h.medications?.name ?? "Obat"}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}
                                >
                                  {b.label}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </div>
      )}
    </div>
  );
}

function RecapCard({
  title,
  sum,
  trend,
}: {
  title: string;
  sum: AdherenceSummary | null;
  trend?: number;
}) {
  const pct = Number(sum?.pct ?? 0);
  const color = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className={`text-2xl font-bold ${color}`}>{pct}%</p>
        {typeof trend === "number" && trend !== 0 && (
          <span className={`text-xs ${trend > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
        <span>
          <b className="text-emerald-600">{sum?.on_time ?? 0}</b> tepat
        </span>
        <span>
          <b className="text-amber-600">{sum?.late ?? 0}</b> telat
        </span>
        <span>
          <b className="text-red-600">{sum?.missed ?? 0}</b> lewat
        </span>
      </div>
    </div>
  );
}
