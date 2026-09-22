import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pill, Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/apoteker/obat")({
  component: ObatKatalogPage,
});

type Disease = "hipertensi" | "gula_darah" | "asam_urat";

type CatalogItem = {
  id: string;
  name: string;
  disease_type: Disease;
  dosage: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

const DISEASE_LABEL: Record<Disease, string> = {
  hipertensi: "Hipertensi",
  gula_darah: "Gula Darah",
  asam_urat: "Asam Urat",
};

function ObatKatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Disease | "all">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("medication_catalog" as never)
        .select("*")
        .order("disease_type", { ascending: true })
        .order("name", { ascending: true });
      if (error) toast.error(error.message);
      setItems((data as CatalogItem[] | null) ?? []);
      setLoading(false);
    })();
  }, [reload]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.disease_type !== filter) return false;
      if (qq && !it.name.toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [items, q, filter]);

  async function toggleActive(it: CatalogItem) {
    const { error } = await supabase
      .from("medication_catalog" as never)
      .update({ is_active: !it.is_active } as never)
      .eq("id", it.id);
    if (error) return toast.error(error.message);
    toast.success(it.is_active ? "Dinonaktifkan" : "Diaktifkan");
    setReload((n) => n + 1);
  }

  async function remove(it: CatalogItem) {
    if (!confirm(`Hapus obat ${it.name} dari katalog?`)) return;
    const { error } = await supabase
      .from("medication_catalog" as never)
      .delete()
      .eq("id", it.id);
    if (error) return toast.error(error.message);
    toast.success("Obat dihapus");
    setReload((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Katalog Obat</h1>
          <p className="text-sm text-muted-foreground">
            Daftar obat yang muncul di pilihan pasien saat menambah jadwal.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-1 h-4 w-4" /> Tambah Obat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Obat" : "Tambah Obat Baru"}</DialogTitle>
            </DialogHeader>
            <CatalogForm
              initial={editing}
              onDone={() => {
                setOpen(false);
                setEditing(null);
                setReload((n) => n + 1);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama obat…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as never)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua penyakit</SelectItem>
            <SelectItem value="hipertensi">Hipertensi</SelectItem>
            <SelectItem value="gula_darah">Gula Darah</SelectItem>
            <SelectItem value="asam_urat">Asam Urat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Memuat…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Belum ada obat. Klik <b>Tambah Obat</b> untuk menambah.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Pill className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{it.name}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {DISEASE_LABEL[it.disease_type]}
                    </span>
                    {!it.is_active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  {(it.dosage || it.notes) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {it.dosage}
                      {it.dosage && it.notes ? " · " : ""}
                      {it.notes}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActive(it)}
                  title={it.is_active ? "Nonaktifkan" : "Aktifkan"}
                >
                  {it.is_active ? "Aktif" : "Nonaktif"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditing(it);
                    setOpen(true);
                  }}
                  aria-label={`Edit ${it.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(it)}
                  aria-label={`Hapus ${it.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CatalogForm({ initial, onDone }: { initial?: CatalogItem | null; onDone: () => void }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [disease, setDisease] = useState<Disease | "">(initial?.disease_type ?? "");
  const [dosage, setDosage] = useState(initial?.dosage ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nama obat wajib diisi");
    if (!disease) return toast.error("Pilih jenis penyakit");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      name: name.trim(),
      disease_type: disease,
      dosage: dosage.trim() || null,
      notes: notes.trim() || null,
    };
    const { error } = isEdit
      ? await supabase
          .from("medication_catalog" as never)
          .update(payload as never)
          .eq("id", initial!.id)
      : await supabase
          .from("medication_catalog" as never)
          .insert({ ...payload, created_by: u.user?.id ?? null } as never);
    setSaving(false);
    if (error) {
      if (error.code === "23505")
        return toast.error("Obat dengan nama ini sudah ada untuk penyakit tsb");
      return toast.error(error.message);
    }
    toast.success(isEdit ? "Obat diperbarui" : "Obat ditambahkan");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="cn">Nama Obat</Label>
        <Input
          id="cn"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="cth: Amlodipine 5mg"
        />
      </div>
      <div>
        <Label>Jenis Penyakit</Label>
        <Select value={disease} onValueChange={(v) => setDisease(v as Disease)}>
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
        <Label htmlFor="cd">Dosis Default (opsional)</Label>
        <Input
          id="cd"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="cth: 1 tablet"
        />
      </div>
      <div>
        <Label htmlFor="cnote">Catatan (opsional)</Label>
        <Textarea
          id="cnote"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="cth: Diminum setelah makan"
          rows={2}
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Menyimpan…" : isEdit ? "Perbarui" : "Simpan"}
      </Button>
    </form>
  );
}
