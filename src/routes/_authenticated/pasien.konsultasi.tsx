import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { Plus, Send, ArrowLeft, Bot, User as UserIcon, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { askAi } from "@/lib/ai-chat.functions";

export const Route = createFileRoute("/_authenticated/pasien/konsultasi")({
  component: PasienKonsultasi,
});

type Tab = "apoteker" | "ai";
type AiMsg = { role: "user" | "assistant"; content: string };

type Req = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
};
type Msg = { id: string; sender_id: string; message: string; created_at: string };

function PasienKonsultasi() {
  const [list, setList] = useState<Req[]>([]);
  const [active, setActive] = useState<Req | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal" });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMe(u.user.id);
    const { data } = await supabase
      .from("consultation_requests")
      .select("*")
      .eq("patient_id", u.user.id)
      .order("created_at", { ascending: false });
    setList((data ?? []) as Req[]);
  }
  useEffect(() => {
    load();
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
      .channel(`pc-${active.id}`)
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error, data } = await supabase
      .from("consultation_requests")
      .insert({
        patient_id: u.user!.id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: "pending",
      })
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      toast.success("Permintaan dikirim");
      setCreating(false);
      setForm({ title: "", description: "", priority: "normal" });
      load();
      setActive(data as Req);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !active) return;
    const { error } = await supabase
      .from("consultation_messages")
      .insert({ consultation_id: active.id, sender_id: me, message: text.trim() });
    if (error) toast.error(error.message);
    else setText("");
  }

  if (active) {
    return (
      <div className="flex flex-col h-[calc(100vh-9rem)]">
        <button
          onClick={() => setActive(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>
        <div className="rounded-t-xl border border-b-0 bg-card p-3">
          <p className="font-semibold">{active.title}</p>
          <p className="text-xs text-muted-foreground">Status: {active.status}</p>
        </div>
        <div className="flex-1 overflow-y-auto border-x bg-secondary/20 p-3 space-y-2">
          {active.description && (
            <div className="text-xs text-muted-foreground italic">{active.description}</div>
          )}
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender_id === me ? "ml-auto bg-primary text-primary-foreground" : "bg-card border"}`}
            >
              <p>{m.message}</p>
              <p className="text-[10px] opacity-70 mt-1">
                {new Date(m.created_at).toLocaleTimeString("id-ID")}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="rounded-b-xl border bg-card p-3 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis pesan..."
            disabled={active.status === "resolved"}
          />
          <Button type="submit" size="icon" disabled={active.status === "resolved"}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Konsultasi</h1>
      <Tabs />
    </div>
  );
}

function Tabs() {
  const [tab, setTab] = useState<Tab>("apoteker");
  return (
    <>
      <div className="grid grid-cols-2 rounded-xl border bg-card p-1 text-sm">
        <button
          onClick={() => setTab("apoteker")}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 ${tab === "apoteker" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          <Stethoscope className="h-4 w-4" /> Apoteker
        </button>
        <button
          onClick={() => setTab("ai")}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 ${tab === "ai" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          <Bot className="h-4 w-4" /> Asisten AI IMO MANTAP
        </button>
      </div>
      {tab === "apoteker" ? <ApotekerList /> : <AiChat />}
    </>
  );
}

function ApotekerList() {
  // re-render existing list/create logic by reusing parent state via a small inline component
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Baru
        </Button>
      </div>
      <ApotekerInner creating={creating} setCreating={setCreating} />
    </div>
  );
}

function ApotekerInner({
  creating,
  setCreating,
}: {
  creating: boolean;
  setCreating: (v: boolean) => void;
}) {
  const [list, setList] = useState<Req[]>([]);
  const [active, setActive] = useState<Req | null>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "normal" });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setMe(u.user.id);
    const { data } = await supabase
      .from("consultation_requests")
      .select("*")
      .eq("patient_id", u.user.id)
      .order("created_at", { ascending: false });
    setList((data ?? []) as Req[]);
  }
  useEffect(() => {
    load();
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
      .channel(`pc-${active.id}`)
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error, data } = await supabase
      .from("consultation_requests")
      .insert({
        patient_id: u.user!.id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: "pending",
      })
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      toast.success("Permintaan dikirim");
      setCreating(false);
      setForm({ title: "", description: "", priority: "normal" });
      load();
      setActive(data as Req);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !active) return;
    const { error } = await supabase
      .from("consultation_messages")
      .insert({ consultation_id: active.id, sender_id: me, message: text.trim() });
    if (error) toast.error(error.message);
    else setText("");
  }

  if (active) {
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <button
          onClick={() => setActive(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>
        <div className="rounded-t-xl border border-b-0 bg-card p-3">
          <p className="font-semibold">{active.title}</p>
          <p className="text-xs text-muted-foreground">Status: {active.status}</p>
        </div>
        <div className="flex-1 overflow-y-auto border-x bg-secondary/20 p-3 space-y-2">
          {active.description && (
            <div className="text-xs text-muted-foreground italic">{active.description}</div>
          )}
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.sender_id === me ? "ml-auto bg-primary text-primary-foreground" : "bg-card border"}`}
            >
              <p>{m.message}</p>
              <p className="text-[10px] opacity-70 mt-1">
                {new Date(m.created_at).toLocaleTimeString("id-ID")}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="rounded-b-xl border bg-card p-3 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis pesan..."
            disabled={active.status === "resolved"}
          />
          <Button type="submit" size="icon" disabled={active.status === "resolved"}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {creating && (
        <form onSubmit={create} className="rounded-xl border bg-card p-4 space-y-3">
          <div>
            <Label>Judul</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Pertanyaan</Label>
            <Textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <Label>Prioritas</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Rendah</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Mendesak</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Kirim</Button>
        </form>
      )}
      <div className="rounded-xl border bg-card divide-y">
        {list.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Belum ada konsultasi.</p>
        ) : (
          list.map((r) => (
            <button
              key={r.id}
              onClick={() => setActive(r)}
              className="w-full text-left p-3 hover:bg-secondary/50"
            >
              <div className="flex justify-between">
                <p className="font-medium text-sm">{r.title}</p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${r.status === "pending" ? "bg-amber-100 text-amber-700" : r.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}
                >
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("id-ID")}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function AiChat() {
  const ask = useServerFn(askAi);
  const [msgs, setMsgs] = useState<AiMsg[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya Asisten AI IMO MANTAP. Tanyakan apa saja seputar hipertensi, gula darah, atau asam urat. Saya bukan pengganti dokter — untuk keluhan serius segera ke fasilitas kesehatan.",
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || loading) return;
    const next: AiMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setText("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghubungi AI";
      toast.error(msg);
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)]">
      <div className="flex-1 overflow-y-auto rounded-t-xl border border-b-0 bg-secondary/20 p-3 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="h-7 w-7 shrink-0 rounded-full bg-secondary flex items-center justify-center">
                <UserIcon className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
              Mengetik…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="rounded-b-xl border bg-card p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tanyakan Asisten AI IMO MANTAP tentang kesehatan Anda…"
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
