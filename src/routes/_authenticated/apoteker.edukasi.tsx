import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/apoteker/edukasi")({
  component: EdukasiAdmin,
});

type Article = {
  id: string;
  title: string;
  content: string;
  disease_type: string;
  tags: string[] | null;
  read_time: number | null;
  is_published: boolean;
  view_count: number;
};

function EdukasiAdmin() {
  const [list, setList] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);

  async function load() {
    const { data } = await supabase
      .from("educational_content")
      .select("*")
      .order("created_at", { ascending: false });
    setList((data ?? []) as Article[]);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      title: editing.title,
      content: editing.content,
      disease_type: editing.disease_type || "hipertensi",
      tags:
        typeof editing.tags === "string"
          ? (editing.tags as any)
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : editing.tags,
      read_time: editing.read_time ?? 5,
      is_published: editing.is_published ?? false,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await supabase
        .from("educational_content")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error: err } = await supabase
        .from("educational_content")
        .insert({
          ...payload,
          author: u.user?.id,
          published_by: payload.is_published ? u.user?.id : null,
        }));
    }
    if (err) toast.error(err.message);
    else {
      toast.success("Tersimpan");
      setEditing(null);
      load();
    }
  }

  async function togglePublish(a: Article) {
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("educational_content")
      .update({ is_published: !a.is_published, published_by: !a.is_published ? u.user?.id : null })
      .eq("id", a.id);
    load();
  }
  async function del(id: string) {
    if (!confirm("Hapus artikel?")) return;
    await supabase.from("educational_content").delete().eq("id", id);
    toast.success("Dihapus");
    load();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edukasi</h1>
        <Button
          onClick={() =>
            setEditing({
              title: "",
              content: "",
              disease_type: "hipertensi",
              is_published: false,
              read_time: 5,
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Artikel Baru
        </Button>
      </div>

      {editing && (
        <form onSubmit={save} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Judul</Label>
              <Input
                required
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Jenis</Label>
              <Select
                value={editing.disease_type as string}
                onValueChange={(v) => setEditing({ ...editing, disease_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hipertensi">Hipertensi</SelectItem>
                  <SelectItem value="gula_darah">Gula Darah</SelectItem>
                  <SelectItem value="asam_urat">Asam Urat</SelectItem>
                  <SelectItem value="umum">Umum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Waktu Baca (menit)</Label>
              <Input
                type="number"
                value={editing.read_time ?? 5}
                onChange={(e) => setEditing({ ...editing, read_time: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Tag (pisah koma)</Label>
              <Input
                value={
                  Array.isArray(editing.tags)
                    ? editing.tags.join(", ")
                    : ((editing.tags as any) ?? "")
                }
                onChange={(e) => setEditing({ ...editing, tags: e.target.value as any })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Konten</Label>
              <Textarea
                rows={10}
                required
                value={editing.content ?? ""}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.is_published ?? false}
                onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
              />
              Publikasikan
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Simpan</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Batal
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-xl border bg-card divide-y">
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Belum ada artikel.</p>
        ) : (
          list.map((a) => (
            <div key={a.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.disease_type} · {a.read_time} mnt · {a.view_count} view ·{" "}
                  {a.is_published ? "Published" : "Draft"}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => togglePublish(a)}>
                  {a.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => del(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
