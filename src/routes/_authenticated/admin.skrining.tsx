import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/skrining")({
  component: SkriningAdmin,
});

type Row = {
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
};

function SkriningAdmin() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("health_screenings")
      .select(
        "id, respondent_code, full_name, gender, age, sistolik, diastolik, asam_urat, kolesterol, gula_darah",
      )
      .order("respondent_code")
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  const [gender, setGender] = useState<"all" | "male" | "female">("all");

  const filtered = rows.filter(
    (r) =>
      (gender === "all" || r.gender === gender) &&
      (!q ||
        r.full_name.toLowerCase().includes(q.toLowerCase()) ||
        r.respondent_code.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Data Cek Kesehatan</h1>
        <span className="text-sm text-muted-foreground">{rows.length} responden</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari nama atau kode..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className="h-9 rounded-md border bg-card px-3 text-sm"
          aria-label="Filter jenis kelamin"
        >
          <option value="all">Semua jenis kelamin</option>
          <option value="male">Laki-laki</option>
          <option value="female">Perempuan</option>
        </select>
        <span className="text-sm text-muted-foreground">
          Menampilkan {filtered.length} dari {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              <th className="p-3 font-medium">Kode</th>
              <th className="p-3 font-medium">Nama</th>
              <th className="p-3 font-medium">JK</th>
              <th className="p-3 font-medium">Umur</th>
              <th className="p-3 font-medium">Tensi</th>
              <th className="p-3 font-medium">Asam Urat</th>
              <th className="p-3 font-medium">Kolesterol</th>
              <th className="p-3 font-medium">Gula Darah</th>
              <th className="w-10 p-3 font-medium sr-only">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => (
              <tr
                key={r.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate({ to: "/admin/pasien-skrining/$id", params: { id: r.id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({ to: "/admin/pasien-skrining/$id", params: { id: r.id } });
                  }
                }}
                className="cursor-pointer hover:bg-secondary/50"
              >
                <td className="p-3 text-muted-foreground">{r.respondent_code}</td>
                <td className="p-3 font-medium">{r.full_name}</td>
                <td className="p-3">{r.gender === "male" ? "L" : "P"}</td>
                <td className="p-3">{r.age ?? "—"}</td>
                <td className="p-3">
                  {r.sistolik && r.diastolik ? `${r.sistolik}/${r.diastolik}` : "—"}
                </td>
                <td className="p-3">{r.asam_urat ?? "—"}</td>
                <td className="p-3">{r.kolesterol ?? "—"}</td>
                <td className="p-3">{r.gula_darah ?? "—"}</td>
                <td className="p-3">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
