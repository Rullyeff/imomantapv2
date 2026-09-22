import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import JSZip from "jszip";
import {
  Download,
  Database,
  Package,
  FileSpreadsheet,
  Loader2,
  Upload,
  RotateCcw,
  AlertTriangle,
  CloudUpload,
  HardDriveDownload,
  RefreshCw,
  CalendarClock,
  Activity,
  CircleSlash,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportAllData } from "@/lib/backup.functions";
import { restoreAllData } from "@/lib/restore.functions";
import {
  backupToDrive,
  listDriveBackupFiles,
  fetchDriveBackup,
  getAutoBackupSettings,
  setAutoBackupMode,
} from "@/lib/drive.functions";

export const Route = createFileRoute("/_authenticated/admin/backup")({
  component: BackupPage,
  head: () => ({
    meta: [
      { title: "Backup Data — IMO MANTAP Admin" },
      {
        name: "description",
        content:
          "Unduh cadangan seluruh data pasien, pengukuran, obat, dan riwayat aktivitas aplikasi IMO MANTAP.",
      },
      { property: "og:title", content: "Backup Data — IMO MANTAP Admin" },
      {
        property: "og:description",
        content: "Cadangkan seluruh data dan isi project IMO MANTAP dalam satu berkas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Backup = {
  generated_at: string;
  tables: Record<string, any[]>;
  accounts: { id: string; email: string | null; created_at: string }[];
  counts: Record<string, number>;
};

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n");
}

function toSql(backup: Backup): string {
  const lines: string[] = [
    `-- Backup IMO MANTAP — ${backup.generated_at}`,
    "BEGIN;",
    "SET session_replication_role = replica;",
  ];
  const lit = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `'${s.replace(/'/g, "''")}'`;
  };
  for (const [table, rows] of Object.entries(backup.tables)) {
    const list = rows as any[];
    if (!list.length) continue;
    const cols = Array.from(new Set(list.flatMap((r) => Object.keys(r))));
    lines.push(`\n-- ${table} (${list.length} baris)`);
    for (const r of list) {
      lines.push(
        `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols
          .map((c) => lit(r[c]))
          .join(", ")}) ON CONFLICT DO NOTHING;`,
      );
    }
  }
  lines.push("SET session_replication_role = origin;", "COMMIT;");
  return lines.join("\n");
}

function BackupPage() {
  const run = useServerFn(exportAllData);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<Backup | null>(null);

  async function load(includeAccounts: boolean) {
    const res = (await run({ data: { includeAccounts } })) as Backup;
    setLast(res);
    return res;
  }

  async function backupJson() {
    setBusy("json");
    try {
      const b = await load(false);
      download(
        new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
        `imomantap-data-${stamp()}.json`,
      );
      toast.success("Backup data berhasil diunduh");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat backup");
    } finally {
      setBusy(null);
    }
  }

  async function backupCsvZip() {
    setBusy("csv");
    try {
      const b = await load(false);
      const zip = new JSZip();
      for (const [t, rows] of Object.entries(b.tables)) {
        zip.file(`${t}.csv`, toCsv(rows as any[]));
      }
      download(await zip.generateAsync({ type: "blob" }), `imomantap-csv-${stamp()}.zip`);
      toast.success("Backup CSV berhasil diunduh");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat backup");
    } finally {
      setBusy(null);
    }
  }

  async function backupProject() {
    setBusy("project");
    try {
      const b = await load(true);
      const zip = new JSZip();
      zip.file("data/backup.json", JSON.stringify(b, null, 2));
      zip.file("data/restore.sql", toSql(b));
      const data = zip.folder("data/csv")!;
      for (const [t, rows] of Object.entries(b.tables)) {
        data.file(`${t}.csv`, toCsv(rows as any[]));
      }
      zip.file("data/akun.csv", toCsv(b.accounts as any[]));
      zip.file(
        "README.txt",
        [
          "BACKUP LENGKAP IMO MANTAP",
          `Dibuat: ${b.generated_at}`,
          "",
          "Isi berkas:",
          "- data/backup.json : seluruh isi database dalam satu berkas",
          "- data/restore.sql : perintah untuk memasukkan kembali data ke database",
          "- data/csv/*.csv   : tiap tabel dalam format spreadsheet",
          "- data/akun.csv    : daftar akun pengguna (email, telepon, tanggal dibuat)",
          "",
          "Jumlah baris per tabel:",
          ...Object.entries(b.counts).map(([k, v]) => `- ${k}: ${v}`),
          "",
          `Jumlah akun: ${b.accounts.length}`,
          "",
          "Catatan: kata sandi tidak ikut dicadangkan demi keamanan. Saat dipulihkan lewat halaman",
          "Backup, akun yang hilang dibuat ulang dengan kata sandi sementara yang Anda tentukan.",
        ].join("\n"),
      );
      download(await zip.generateAsync({ type: "blob" }), `imomantap-backup-lengkap-${stamp()}.zip`);
      toast.success("Backup project lengkap berhasil diunduh");
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membuat backup");
    } finally {
      setBusy(null);
    }
  }

  const items = [
    {
      key: "json",
      icon: Database,
      title: "Backup Seluruh Data (JSON)",
      desc: "Satu berkas berisi semua tabel: pasien, pengukuran, skrining, obat, kepatuhan, dan riwayat.",
      action: backupJson,
    },
    {
      key: "csv",
      icon: FileSpreadsheet,
      title: "Backup Data (CSV / Excel)",
      desc: "Setiap tabel menjadi satu berkas spreadsheet, dibungkus dalam satu ZIP.",
      action: backupCsvZip,
    },
    {
      key: "project",
      icon: Package,
      title: "Backup Project Lengkap",
      desc: "Semua data (JSON + CSV), daftar akun pengguna, dan berkas pemulihan database dalam satu ZIP.",
      action: backupProject,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold">Backup Data</h1>
      <p className="text-sm text-muted-foreground">
        Unduh salinan cadangan dan simpan di tempat aman. Hanya admin yang dapat mengaksesnya.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.key} className="rounded-lg border bg-card p-4 flex flex-col">
            <it.icon className="h-6 w-6 text-primary" />
            <h2 className="mt-3 font-semibold">{it.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{it.desc}</p>
            <Button className="mt-4" onClick={it.action} disabled={busy !== null}>
              {busy === it.key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Unduh
            </Button>
          </div>
        ))}
      </div>

      <DriveBackupCard />

      <AutoBackupCard />


      {last && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Ringkasan cadangan terakhir</h2>
          <p className="text-xs text-muted-foreground">
            {new Date(last.generated_at).toLocaleString("id-ID")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(last.counts).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold">{v as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RestoreCard />
    </>
  );
}

type Parsed = {
  tables: Record<string, any[]>;
  counts: Record<string, number>;
  accounts: any[];
  name: string;
};

type DriveFile = {
  id: string;
  name: string;
  size: number | null;
  modifiedTime: string | null;
  link: string | null;
};

function DriveBackupCard() {
  const run = useServerFn(backupToDrive);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any | null>(null);

  async function backup() {
    setBusy(true);
    try {
      const res = await run({ data: undefined as never });
      setLast(res);
      toast.success(`Cadangan tersimpan di Google Drive: ${res.file_name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan cadangan ke Google Drive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <CloudUpload className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Backup ke Google Drive</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Simpan seluruh data dan daftar akun langsung ke Google Drive, tertata dalam folder "IMO
        MANTAP Backup" per tahun dan bulan. Berkas ini bisa dipilih kembali saat memulihkan data.
      </p>
      <Button className="mt-4" onClick={backup} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
        Backup sekarang ke Google Drive
      </Button>
      {last && (
        <p className="mt-3 text-sm text-muted-foreground">
          Terakhir: <span className="font-medium text-foreground">{last.file_name}</span> di folder{" "}
          {last.folder}
          {last.link ? (
            <>
              {" — "}
              <a className="text-primary underline" href={last.link} target="_blank" rel="noreferrer">
                buka di Google Drive
              </a>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}

type AutoMode = "off" | "daily" | "activity";

const AUTO_OPTIONS: { mode: AutoMode; icon: typeof CalendarClock; title: string; desc: string }[] = [
  {
    mode: "daily",
    icon: CalendarClock,
    title: "Setiap hari jam 12 malam",
    desc: "Cadangan otomatis tersimpan ke Google Drive tiap pukul 00.00 WIB.",
  },
  {
    mode: "activity",
    icon: Activity,
    title: "Setiap ada kegiatan",
    desc: "Sistem memeriksa tiap jam; cadangan dibuat hanya bila ada data baru atau perubahan.",
  },
  {
    mode: "off",
    icon: CircleSlash,
    title: "Nonaktif",
    desc: "Tidak ada cadangan otomatis. Anda tetap bisa backup manual kapan saja.",
  },
];

function AutoBackupCard() {
  const load = useServerFn(getAutoBackupSettings);
  const save = useServerFn(setAutoBackupMode);
  const [settings, setSettings] = useState<{
    mode: AutoMode;
    last_run_at: string | null;
    last_file: string | null;
  } | null>(null);
  const [saving, setSaving] = useState<AutoMode | null>(null);

  useEffect(() => {
    load({ data: undefined as never })
      .then((s: any) => setSettings(s))
      .catch(() => setSettings({ mode: "off", last_run_at: null, last_file: null }));
  }, [load]);

  async function pick(mode: AutoMode) {
    setSaving(mode);
    try {
      const res: any = await save({ data: { mode } });
      setSettings(res);
      toast.success(
        mode === "off" ? "Backup otomatis dimatikan" : "Backup otomatis diaktifkan",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menyimpan pengaturan");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Backup Otomatis</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Pilih kapan sistem menyimpan cadangan ke Google Drive tanpa perlu ditekan manual.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {AUTO_OPTIONS.map((o) => {
          const active = settings?.mode === o.mode;
          return (
            <div
              key={o.mode}
              className={`rounded-lg border p-3 flex flex-col ${active ? "border-primary bg-primary/5" : ""}`}
            >
              <o.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-2 text-sm font-semibold">{o.title}</h3>
              <p className="mt-1 flex-1 text-xs text-muted-foreground">{o.desc}</p>
              <Button
                className="mt-3"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={saving !== null || settings === null}
                onClick={() => pick(o.mode)}
              >
                {saving === o.mode ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : active ? (
                  "Aktif"
                ) : (
                  "Pilih"
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {settings?.last_run_at && (
        <p className="mt-3 text-xs text-muted-foreground">
          Cadangan otomatis terakhir: {new Date(settings.last_run_at).toLocaleString("id-ID")}
          {settings.last_file ? ` — ${settings.last_file}` : ""}
        </p>
      )}
    </div>
  );
}

function RestoreCard() {
  const run = useServerFn(restoreAllData);
  const listDrive = useServerFn(listDriveBackupFiles);
  const getDrive = useServerFn(fetchDriveBackup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [withAccounts, setWithAccounts] = useState(true);
  const [password, setPassword] = useState("mantapIMO12345!");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveLoadingId, setDriveLoadingId] = useState<string | null>(null);

  async function loadDriveList() {
    setDriveBusy(true);
    try {
      const res = await listDrive({ data: undefined as never });
      setDriveFiles(res.files as DriveFile[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal membaca daftar cadangan di Google Drive");
    } finally {
      setDriveBusy(false);
    }
  }

  async function pickFromDrive(fileId: string, name: string) {
    setResult(null);
    setDriveLoadingId(fileId);
    try {
      const json = await getDrive({ data: { fileId } });
      const tables = (json.tables ?? {}) as Record<string, any[]>;
      const counts: Record<string, number> = {};
      for (const [k, v] of Object.entries(tables)) {
        if (Array.isArray(v) && v.length) counts[k] = v.length;
      }
      const accounts = (json.accounts ?? []).filter(
        (a: any) => a && typeof a.id === "string",
      ) as any[];
      if (!Object.keys(counts).length && !accounts.length)
        throw new Error("Berkas ini tidak berisi data");
      setParsed({ tables, counts, accounts, name });
      toast.success(`Berkas ${name} siap dipulihkan`);
    } catch (e: any) {
      toast.error(e?.message ?? "Berkas cadangan tidak bisa dibaca");
    } finally {
      setDriveLoadingId(null);
    }
  }


  async function pick(file: File | null | undefined) {
    setResult(null);
    setParsed(null);
    if (!file) return;
    try {
      let text: string;
      if (file.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);
        const entry =
          zip.file("data/backup.json") ??
          zip.file(/backup\.json$/)[0] ??
          zip.file(/\.json$/)[0];
        if (!entry) throw new Error("ZIP tidak berisi berkas backup.json");
        text = await entry.async("string");
      } else {
        text = await file.text();
      }
      const json = JSON.parse(text);
      const tables = (json?.tables ?? json) as Record<string, any[]>;
      const counts: Record<string, number> = {};
      for (const [k, v] of Object.entries(tables)) {
        if (Array.isArray(v) && v.length) counts[k] = v.length;
      }
      const accounts = Array.isArray(json?.accounts)
        ? (json.accounts as any[]).filter((a) => a && typeof a.id === "string")
        : [];
      if (!Object.keys(counts).length && !accounts.length)
        throw new Error("Berkas ini tidak berisi data");
      setParsed({ tables, counts, accounts, name: file.name });
    } catch (e: any) {
      toast.error(e?.message ?? "Berkas cadangan tidak bisa dibaca");
    }
  }

  async function restore() {
    if (!parsed) return;
    if (
      mode === "replace" &&
      !window.confirm(
        "Mode ganti akan menghapus seluruh data yang ada sekarang lalu menggantinya dengan isi berkas cadangan. Lanjutkan?",
      )
    )
      return;
    setBusy(true);
    try {
      const useAccounts = withAccounts && parsed.accounts.length > 0;
      const res = await run({
        data: {
          tables: parsed.tables,
          mode,
          ...(useAccounts ? { accounts: parsed.accounts, password } : {}),
        },
      });
      setResult(res);
      toast.success(
        `Pemulihan selesai: ${res.total_inserted} baris masuk` +
          (res.accounts?.created ? `, ${res.accounts.created} akun dibuat ulang` : ""),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal memulihkan data");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Pulihkan Data (Restore)</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Pilih berkas cadangan (JSON atau ZIP hasil backup) untuk memasukkan datanya kembali ke
        aplikasi. Berkas "Backup Project Lengkap" juga memuat daftar akun, sehingga akun yang hilang
        bisa dibuat ulang dengan kata sandi sementara di bawah.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4" />
          Pilih berkas dari komputer
        </Button>
        <Button variant="outline" onClick={loadDriveList} disabled={busy || driveBusy}>
          {driveBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <HardDriveDownload className="h-4 w-4" />
          )}
          Ambil dari Google Drive
        </Button>
        {parsed && <span className="text-sm text-muted-foreground">{parsed.name}</span>}
      </div>

      {driveFiles !== null && (
        <div className="mt-4 rounded-md border">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-sm font-medium">
              Cadangan di Google Drive ({driveFiles.length})
            </p>
            <Button variant="ghost" size="sm" onClick={loadDriveList} disabled={driveBusy}>
              <RefreshCw className="h-4 w-4" />
              Muat ulang
            </Button>
          </div>
          {driveFiles.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Belum ada berkas cadangan di Google Drive. Buat backup ke Google Drive dulu.
            </p>
          ) : (
            <div className="max-h-72 divide-y overflow-y-auto">
              {driveFiles.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.modifiedTime ? new Date(f.modifiedTime).toLocaleString("id-ID") : "-"}
                      {f.size ? ` · ${(f.size / 1024).toFixed(0)} KB` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={parsed?.name === f.name ? "default" : "outline"}
                    onClick={() => pickFromDrive(f.id, f.name)}
                    disabled={busy || driveBusy}
                  >
                    {driveLoadingId === f.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Pilih"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {parsed && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(parsed.counts).map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-md border p-3">
            {parsed.accounts.length ? (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={withAccounts}
                    onChange={(e) => setWithAccounts(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Pulihkan akun juga</span> — berkas ini memuat{" "}
                    {parsed.accounts.length} akun. Akun yang belum ada akan dibuat ulang; akun yang
                    masih ada dibiarkan apa adanya.
                  </span>
                </label>
                {withAccounts && (
                  <div className="mt-3 max-w-sm">
                    <label className="text-sm font-medium" htmlFor="restore-password">
                      Kata sandi sementara untuk akun baru
                    </label>
                    <input
                      id="restore-password"
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Minimal 8 karakter"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Kata sandi asli tidak ikut dicadangkan. Bagikan kata sandi ini dan minta
                      pengguna menggantinya setelah masuk.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Berkas ini tidak memuat daftar akun, jadi hanya datanya yang dipulihkan. Gunakan
                "Backup Project Lengkap" bila ingin akun ikut dipulihkan.
              </p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />
              <span>
                <span className="font-medium">Gabungkan</span> — data yang sudah ada diperbarui, data
                baru ditambahkan.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              <span>
                <span className="font-medium">Ganti seluruhnya</span> — hapus data yang ada lalu isi
                dari berkas cadangan.
              </span>
            </label>
          </div>

          {mode === "replace" && (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Data yang ada sekarang akan dihapus. Pastikan Anda sudah mengunduh cadangan terbaru.
            </p>
          )}

          <Button className="mt-4" onClick={restore} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Pulihkan sekarang
          </Button>
        </>
      )}

      {result && (
        <div className="mt-4 rounded-md border p-3">
          <p className="text-sm font-medium">
            {result.total_inserted} baris dipulihkan, {result.total_skipped} dilewati
          </p>
          {result.accounts && (
            <p className="mt-1 text-sm text-muted-foreground">
              Akun: {result.accounts.created} dibuat ulang, {result.accounts.existing} sudah ada
              {result.accounts.failed ? `, ${result.accounts.failed} gagal` : ""}
              {result.accounts.error ? ` — ${result.accounts.error}` : ""}
            </p>
          )}
          <div className="mt-2 space-y-1 text-sm">
            {result.results.map((r: any) => (
              <div key={r.table} className="flex flex-wrap justify-between gap-2">
                <span className="text-muted-foreground">{r.table}</span>
                <span>
                  {r.inserted} masuk{r.skipped ? `, ${r.skipped} gagal` : ""}
                  {r.error ? ` — ${r.error}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

