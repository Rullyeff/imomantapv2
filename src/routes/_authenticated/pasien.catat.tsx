import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
import { hipertensiStatus, gulaDarahStatus, asamUratStatus } from "@/lib/health-utils";

export const Route = createFileRoute("/_authenticated/pasien/catat")({
  component: CatatPage,
});

type DiseaseType = "hipertensi" | "gula_darah" | "asam_urat";

function CatatPage() {
  const nav = useNavigate();
  const [type, setType] = useState<DiseaseType>("hipertensi");
  const [sistolik, setSistolik] = useState("");
  const [diastolik, setDiastolik] = useState("");
  const [gulaPuasa, setGulaPuasa] = useState("");
  const [gulaPp, setGulaPp] = useState("");
  const [asamUrat, setAsamUrat] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    let payload: Record<string, unknown> = {
      user_id: u.user.id,
      disease_type: type,
      notes,
      measurement_time: new Date().toISOString(),
    };
    let abnormal = false;
    if (type === "hipertensi") {
      const s = parseInt(sistolik);
      const d = parseInt(diastolik);
      payload = { ...payload, sistolik: s, diastolik: d };
      abnormal = hipertensiStatus(s, d).level !== "normal";
    } else if (type === "gula_darah") {
      const gp = gulaPuasa ? parseInt(gulaPuasa) : null;
      const gpp = gulaPp ? parseInt(gulaPp) : null;
      payload = { ...payload, gula_puasa: gp, gula_pp: gpp };
      abnormal = gulaDarahStatus(gp, gpp).level !== "normal";
    } else {
      const a = parseFloat(asamUrat);
      payload = { ...payload, asam_urat: a };
      // gender unknown here, use generic
      abnormal = asamUratStatus(a).level !== "normal";
    }
    payload.is_abnormal = abnormal;

    const { error } = await supabase.from("measurements" as never).insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(
      abnormal ? "Tercatat. Hasil di luar normal — konsultasikan ke dokter." : "Tercatat.",
    );
    nav({ to: "/pasien" });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Catat Pengukuran</h1>

      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <Label>Jenis Pengukuran</Label>
          <Select value={type} onValueChange={(v) => setType(v as DiseaseType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hipertensi">Tekanan Darah</SelectItem>
              <SelectItem value="gula_darah">Gula Darah</SelectItem>
              <SelectItem value="asam_urat">Asam Urat</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {type === "hipertensi" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sistolik (mmHg)</Label>
              <Input
                type="number"
                required
                value={sistolik}
                onChange={(e) => setSistolik(e.target.value)}
              />
            </div>
            <div>
              <Label>Diastolik (mmHg)</Label>
              <Input
                type="number"
                required
                value={diastolik}
                onChange={(e) => setDiastolik(e.target.value)}
              />
            </div>
          </div>
        )}

        {type === "gula_darah" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Puasa (mg/dL)</Label>
              <Input
                type="number"
                value={gulaPuasa}
                onChange={(e) => setGulaPuasa(e.target.value)}
              />
            </div>
            <div>
              <Label>2 Jam PP (mg/dL)</Label>
              <Input type="number" value={gulaPp} onChange={(e) => setGulaPp(e.target.value)} />
            </div>
          </div>
        )}

        {type === "asam_urat" && (
          <div>
            <Label>Asam Urat (mg/dL)</Label>
            <Input
              type="number"
              step="0.1"
              required
              value={asamUrat}
              onChange={(e) => setAsamUrat(e.target.value)}
            />
          </div>
        )}

        <div>
          <Label>Catatan (opsional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </form>
    </div>
  );
}
