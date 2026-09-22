import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NotebookPen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pasien/logbook")({
  component: PasienLogbook,
  head: () => ({
    meta: [
      { title: "Logbook Pasien | IMO MANTAP" },
      {
        name: "description",
        content:
          "Catatan logbook pemantauan kesehatan yang diisi apoteker untuk pasien hipertensi, gula darah, dan asam urat.",
      },
      { property: "og:title", content: "Logbook Pasien | IMO MANTAP" },
      {
        property: "og:description",
        content: "Lihat catatan dan rekomendasi apoteker pada logbook pemantauan kesehatan Anda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Entry = {
  id: string;
  entry_date: string;
  title: string;
  content: string | null;
  recommendation: string | null;
  status: string;
  updated_at: string;
};

function PasienLogbook() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return setLoading(false);
      const { data } = await supabase
        .from("patient_logbook")
        .select("id, entry_date, title, content, recommendation, status, updated_at")
        .eq("user_id", u.user.id)
        .order("entry_date", { ascending: false });
      setRows((data ?? []) as Entry[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Logbook</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Catatan pemantauan yang diisi oleh apoteker. Anda dapat membacanya, perubahan hanya dapat
        dilakukan apoteker.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Belum ada catatan logbook.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{r.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.entry_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs capitalize">
                  {r.status}
                </span>
              </div>
              {r.content && <p className="text-sm whitespace-pre-wrap">{r.content}</p>}
              {r.recommendation && (
                <div className="rounded-lg bg-primary/10 p-3 text-sm">
                  <p className="font-medium text-primary">Rekomendasi Apoteker</p>
                  <p className="whitespace-pre-wrap">{r.recommendation}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
