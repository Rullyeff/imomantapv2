import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/apoteker/konsultasi")({
  component: KonsultasiApoteker,
});

type Req = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  patient_id: string;
  created_at: string;
};
type Msg = { id: string; sender_id: string; message: string; created_at: string };

function KonsultasiApoteker() {
  const [list, setList] = useState<Req[]>([]);
  const [active, setActive] = useState<Req | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string>("");
  const [names, setNames] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadList() {
    const { data } = await supabase
      .from("consultation_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Req[];
    setList(rows);
    const ids = Array.from(new Set(rows.map((r) => r.patient_id)));
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (p ?? []).forEach((x: any) => {
        map[x.user_id] = x.full_name || "Pasien";
      });
      setNames(map);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id ?? "");
      loadList();
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const { data } = await supabase
        .from("consultation_messages")
        .select("*")
        .eq("consultation_id", active.id)
        .order("created_at");
      setMsgs((data ?? []) as Msg[]);
    })();
    const ch = supabase
      .channel(`c-${active.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "consultation_messages",
          filter: `consultation_id=eq.${active.id}`,
        },
        (p) => setMsgs((m) => [...m, p.new as Msg]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !active) return;
    const { error } = await supabase
      .from("consultation_messages")
      .insert({ consultation_id: active.id, sender_id: me, message: text.trim() });
    if (error) toast.error(error.message);
    else setText("");
    if (active.status === "pending") {
      await supabase
        .from("consultation_requests")
        .update({
          status: "in_progress",
          pharmacist_id: me,
          responded_by: me,
          responded_at: new Date().toISOString(),
        })
        .eq("id", active.id);
      loadList();
    }
  }

  async function close() {
    if (!active) return;
    await supabase.from("consultation_requests").update({ status: "resolved" }).eq("id", active.id);
    toast.success("Konsultasi ditutup");
    loadList();
    setActive(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr] h-[70vh]">
      <aside className="rounded-xl border bg-card overflow-y-auto">
        <div className="p-3 border-b font-semibold">Permintaan</div>
        {list.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Belum ada.</p>
        ) : (
          list.map((r) => (
            <button
              key={r.id}
              onClick={() => setActive(r)}
              className={`w-full text-left p-3 border-b hover:bg-secondary/50 ${active?.id === r.id ? "bg-secondary" : ""}`}
            >
              <div className="flex justify-between items-center">
                <p className="font-medium text-sm truncate">{r.title}</p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {names[r.patient_id] || "Pasien"} · {r.priority}
              </p>
            </button>
          ))
        )}
      </aside>
      <section className="rounded-xl border bg-card flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Pilih konsultasi.
          </div>
        ) : (
          <>
            <header className="p-3 border-b flex items-center justify-between">
              <div>
                <p className="font-semibold">{active.title}</p>
                <p className="text-xs text-muted-foreground">
                  {names[active.patient_id] || "Pasien"}
                </p>
              </div>
              {active.status !== "resolved" && (
                <Button size="sm" variant="outline" onClick={close}>
                  Tutup
                </Button>
              )}
            </header>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-secondary/20">
              {active.description && (
                <div className="text-xs text-muted-foreground italic">
                  Awal: {active.description}
                </div>
              )}
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.sender_id === me ? "ml-auto bg-primary text-primary-foreground" : "bg-card border"}`}
                >
                  <p>{m.message}</p>
                  <p className="text-[10px] opacity-70 mt-1">
                    {new Date(m.created_at).toLocaleTimeString("id-ID")}
                  </p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={send} className="p-3 border-t flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ketik balasan..."
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
