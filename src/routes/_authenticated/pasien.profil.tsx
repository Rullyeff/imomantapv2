import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pasien/profil")({
  component: ProfilPage,
});

type ProfileForm = {
  full_name: string;
  age: string;
  gender: "male" | "female" | "";
  weight: string;
  height: string;
  phone_number: string;
  address: string;
  emergency_contact: string;
  target_sistolik: string;
  target_diastolik: string;
  target_gula_puasa: string;
  target_gula_pp: string;
  target_asam_urat: string;
};

const empty: ProfileForm = {
  full_name: "",
  age: "",
  gender: "",
  weight: "",
  height: "",
  phone_number: "",
  address: "",
  emergency_contact: "",
  target_sistolik: "130",
  target_diastolik: "80",
  target_gula_puasa: "100",
  target_gula_pp: "140",
  target_asam_urat: "6.0",
};

function ProfilPage() {
  const [form, setForm] = useState<ProfileForm>(empty);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data } = await supabase
        .from("profiles" as never)
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data) {
        const p = data as Record<string, unknown>;
        setForm({
          full_name: String(p.full_name ?? ""),
          age: p.age != null ? String(p.age) : "",
          gender: (p.gender as ProfileForm["gender"]) ?? "",
          weight: p.weight != null ? String(p.weight) : "",
          height: p.height != null ? String(p.height) : "",
          phone_number: String(p.phone_number ?? ""),
          address: String(p.address ?? ""),
          emergency_contact: String(p.emergency_contact ?? ""),
          target_sistolik: String(p.target_sistolik ?? "130"),
          target_diastolik: String(p.target_diastolik ?? "80"),
          target_gula_puasa: String(p.target_gula_puasa ?? "100"),
          target_gula_pp: String(p.target_gula_pp ?? "140"),
          target_asam_urat: String(p.target_asam_urat ?? "6.0"),
        });
      }
    })();
  }, []);

  function set<K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      user_id: u.user.id,
      full_name: form.full_name,
      age: form.age ? parseInt(form.age) : null,
      gender: form.gender || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      phone_number: form.phone_number,
      address: form.address,
      emergency_contact: form.emergency_contact,
      target_sistolik: parseInt(form.target_sistolik),
      target_diastolik: parseInt(form.target_diastolik),
      target_gula_puasa: parseInt(form.target_gula_puasa),
      target_gula_pp: parseInt(form.target_gula_pp),
      target_asam_urat: parseFloat(form.target_asam_urat),
    };
    const { error } = await supabase
      .from("profiles" as never)
      .upsert(payload as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profil disimpan");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profil Saya</h1>
      <p className="text-sm text-muted-foreground">{email}</p>

      <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <Label>Nama Lengkap</Label>
          <Input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Usia</Label>
            <Input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} />
          </div>
          <div>
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v as never)}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Laki-laki</SelectItem>
                <SelectItem value="female">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Berat (kg)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.weight}
              onChange={(e) => set("weight", e.target.value)}
            />
          </div>
          <div>
            <Label>Tinggi (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.height}
              onChange={(e) => set("height", e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>No. HP</Label>
          <Input value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)} />
        </div>
        <div>
          <Label>Alamat</Label>
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div>
          <Label>Kontak Darurat</Label>
          <Input
            value={form.emergency_contact}
            onChange={(e) => set("emergency_contact", e.target.value)}
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold">Target Angka Kesehatan</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label>Sistolik</Label>
              <Input
                type="number"
                value={form.target_sistolik}
                onChange={(e) => set("target_sistolik", e.target.value)}
              />
            </div>
            <div>
              <Label>Diastolik</Label>
              <Input
                type="number"
                value={form.target_diastolik}
                onChange={(e) => set("target_diastolik", e.target.value)}
              />
            </div>
            <div>
              <Label>Gula Puasa</Label>
              <Input
                type="number"
                value={form.target_gula_puasa}
                onChange={(e) => set("target_gula_puasa", e.target.value)}
              />
            </div>
            <div>
              <Label>Gula PP</Label>
              <Input
                type="number"
                value={form.target_gula_pp}
                onChange={(e) => set("target_gula_pp", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Asam Urat</Label>
              <Input
                type="number"
                step="0.1"
                value={form.target_asam_urat}
                onChange={(e) => set("target_asam_urat", e.target.value)}
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Profil"}
        </Button>
      </form>
    </div>
  );
}
