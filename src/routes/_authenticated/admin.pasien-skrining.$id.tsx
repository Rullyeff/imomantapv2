import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getUserEmails, resetUserPassword } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/pasien-skrining/$id")({
  head: () => ({
    meta: [
      { title: "Riwayat Skrining Pasien — Admin IMO MANTAP" },
      {
        name: "description",
        content:
          "Detail hasil skrining pasien: tekanan darah, gula darah, asam urat, kolesterol, dan umur.",
      },
      { property: "og:title", content: "Riwayat Skrining Pasien — Admin IMO MANTAP" },
      {
        property: "og:description",
        content: "Detail hasil skrining pasien dan pengelolaan akun.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DetailSkrining,
});

type Screening = {
  id: string;
  respondent_code: string;
  full_name: string;
  gender: string;
  age: number | null;
  sistolik: number | null;
  diastolik: number | null;
  asam_urat: number | null;
  kolesterol: number | null;
  gula_darah: number | null;
  created_at: string;
  user_id: string | null;
};

type Measurement = {
  id: string;
  disease_type: string;
  sistolik: number | null;
  diastolik: number | null;
  gula_puasa: number | null;
  gula_pp: number | null;
  asam_urat: number | null;
  measurement_time: string | null;
};

function DetailSkrining() {
  const { id } = useParams({ from: "/_authenticated/admin/pasien-skrining/$id" });
  const [row, setRow] = useState<Screening | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [history, setHistory] = useState<Measurement[]>([]);
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    age: "",
    sistolik: "",
    diastolik: "",
    gula_darah: "",
    asam_urat: "",
    kolesterol: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("health_screenings")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const r = (data ?? null) as Screening | null;
      setRow(r);
      setForm({
        full_name: r?.full_name ?? "",
        age: r?.age != null ? String(r.age) : "",
        sistolik: r?.sistolik != null ? String(r.sistolik) : "",
        diastolik: r?.diastolik != null ? String(r.diastolik) : "",
        gula_darah: r?.gula_darah != null ? String(r.gula_darah) : "",
        asam_urat: r?.asam_urat != null ? String(r.asam_urat) : "",
        kolesterol: r?.kolesterol != null ? String(r.kolesterol) : "",
      });
      setLoading(false);
      if (r?.user_id) {
        const [{ data: m }, emails] = await Promise.all([
          supabase
            .from("measurements")
            .select(
              "id, disease_type, sistolik, diastolik, gula_puasa, gula_pp, asam_urat, measurement_time",
            )
            .eq("user_id", r.user_id)
            .order("measurement_time", { ascending: false })
            .limit(50),
          getUserEmails({ data: { userIds: [r.user_id] } }).catch(() => ({}) as Record<string, string>),
        ]);
        setHistory((m ?? []) as Measurement[]);
        setEmail(emails[r.user_id] ?? null);
      }
    })();
  }, [id]);

  async function doSave(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    setSaving(true);
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const payload = {
      full_name: form.full_name.trim() || row.full_name,
      age: num(form.age),
      sistolik: num(form.sistolik),
      diastolik: num(form.diastolik),
      gula_darah: num(form.gula_darah),
      asam_urat: num(form.asam_urat),
      kolesterol: num(form.kolesterol),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("health_screenings").update(payload).eq("id", row.id);
    if (error) {
      toast.error("Gagal menyimpan perubahan");
    } else {
      setRow({ ...row, ...payload });
      setEditing(false);
      toast.success("Data skrining diperbarui");
    }
    setSaving(false);
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    if (!row?.user_id) return;
    setSaving(true);
    try {
      await resetUserPassword({ data: { userId: row.user_id, newPassword: pw } });
      toast.success("Password berhasil diganti");
      setPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengganti password");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Memuat...</p>;
  if (!row) return <p className="text-muted-foreground">Data tidak ditemukan.</p>;

  const stats = [
    { label: "Umur", value: row.age != null ? `${row.age} th` : "—" },
    {
      label: "Tekanan Darah",
      value: row.sistolik && row.diastolik ? `${row.sistolik}/${row.diastolik} mmHg` : "—",
    },
    { label: "Gula Darah", value: row.gula_darah != null ? `${row.gula_darah} mg/dL` : "—" },
    { label: "Asam Urat", value: row.asam_urat != null ? `${row.asam_urat} mg/dL` : "—" },
    { label: "Kolesterol", value: row.kolesterol != null ? `${row.kolesterol} mg/dL` : "—" },
    { label: "Jenis Kelamin", value: row.gender === "male" ? "Laki-laki" : "Perempuan" },
  ];

  return (
    <>
      <Link
        to="/admin/skrining"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{row.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {row.respondent_code}
            {email ? ` · ${email}` : " · belum punya akun"}
          </p>
        </div>
        <Button variant={editing ? "ghost" : "outline"} onClick={() => setEditing((v) => !v)}>
          {editing ? (
            <>
              <X className="mr-1 h-4 w-4" /> Batal
            </>
          ) : (
            <>
              <Pencil className="mr-1 h-4 w-4" /> Edit Data
            </>
          )}
        </Button>
      </div>

      {editing && (
        <form onSubmit={doSave} className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Edit Data Skrining</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                { key: "full_name", label: "Nama Lengkap", type: "text" },
                { key: "age", label: "Umur (tahun)", type: "number" },
                { key: "sistolik", label: "Sistolik (mmHg)", type: "number" },
                { key: "diastolik", label: "Diastolik (mmHg)", type: "number" },
                { key: "gula_darah", label: "Gula Darah (mg/dL)", type: "number" },
                { key: "asam_urat", label: "Asam Urat (mg/dL)", type: "number" },
                { key: "kolesterol", label: "Kolesterol (mg/dL)", type: "number" },
              ] as const
            ).map((f) => (
              <div key={f.key}>
                <Label htmlFor={`e-${f.key}`}>{f.label}</Label>
                <Input
                  id={`e-${f.key}`}
                  type={f.type}
                  step="any"
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-lg font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Riwayat Pengukuran Akun</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada pengukuran.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Tanggal</th>
                  <th className="py-2 font-medium">Jenis</th>
                  <th className="py-2 font-medium">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2">
                      {m.measurement_time
                        ? new Date(m.measurement_time).toLocaleDateString("id-ID")
                        : "—"}
                    </td>
                    <td className="py-2 capitalize">{m.disease_type.replace("_", " ")}</td>
                    <td className="py-2">
                      {m.disease_type === "hipertensi"
                        ? `${m.sistolik ?? "—"}/${m.diastolik ?? "—"} mmHg`
                        : m.disease_type === "gula_darah"
                          ? `${m.gula_puasa ?? m.gula_pp ?? "—"} mg/dL`
                          : `${m.asam_urat ?? "—"} mg/dL`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> Reset Password Akun
        </h2>
        {row.user_id ? (
          <form onSubmit={doReset} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <Label htmlFor="np">Password baru (min. 6 karakter)</Label>
              <Input
                id="np"
                type="text"
                minLength={6}
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Ganti Password"}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Responden ini belum tertaut ke akun pengguna.
          </p>
        )}
      </div>
    </>
  );
}
