import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Disclaimer } from "@/components/Disclaimer";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Masuk / Daftar — IMO MANTAP" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  // Hindari beda tampilan antara render server dan browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Cek sesi lama SEBELUM form ditampilkan, supaya tidak terjadi
  // redirect mendadak saat pengguna sedang mengetik.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        const role = await fetchUserRole(data.session.user.id);
        if (!active) return;
        nav({ to: roleHome(role), replace: true });
        return;
      }
      setCheckingSession(false);
    });
    return () => {
      active = false;
    };
  }, [nav]);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");

  const [regMethod, setRegMethod] = useState<"email" | "phone">("email");
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const identifier = loginEmail.trim();
    // Pasien hasil skrining masuk memakai kode responden (mis. "R1").
    const email = identifier.includes("@")
      ? identifier.toLowerCase()
      : `${identifier.toLowerCase()}@pasien.imomantap.com`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: loginPw,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    const role = await fetchUserRole(data.user.id);
    toast.success("Selamat datang!");
    nav({ to: roleHome(role), replace: true });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const commonOptions = {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: regName,
        phone_number: regMethod === "phone" ? regPhone : "",
        role: "pasien",
      },
    };
    const { data, error } =
      regMethod === "email"
        ? await supabase.auth.signUp({
            email: regEmail,
            password: regPw,
            options: commonOptions,
          })
        : await supabase.auth.signUp({
            phone: regPhone,
            password: regPw,
            options: commonOptions,
          });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      toast.success(
        regMethod === "email"
          ? "Pendaftaran berhasil. Cek email untuk verifikasi."
          : "Pendaftaran berhasil. Cek SMS/WhatsApp untuk verifikasi.",
      );
      return;
    }
    toast.success("Akun dibuat. Lengkapi profil Anda.");
    nav({ to: "/pasien", replace: true });
  }

  if (checkingSession) {
    return mounted ? (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Memuat...
      </div>
    ) : null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">IMO MANTAP</span>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Masuk</TabsTrigger>
              <TabsTrigger value="register">Daftar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="le">Email atau Kode Pasien</Label>
                  <Input
                    id="le"
                    type="text"
                    required
                    placeholder="contoh: R1 atau nama@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lp">Password</Label>
                  <Input
                    id="lp"
                    type="password"
                    required
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Memproses..." : "Masuk"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="rn">Nama Lengkap</Label>
                  <Input
                    id="rn"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Daftar menggunakan</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setRegMethod("email")}
                      className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                        regMethod === "email" ? "bg-background shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegMethod("phone")}
                      className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                        regMethod === "phone" ? "bg-background shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      No. HP
                    </button>
                  </div>
                </div>
                {regMethod === "email" ? (
                  <div>
                    <Label htmlFor="re">Email</Label>
                    <Input
                      id="re"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="rphone">No. HP (WhatsApp)</Label>
                    <Input
                      id="rphone"
                      type="tel"
                      inputMode="tel"
                      placeholder="+628xxxxxxxxxx"
                      required
                      pattern="[0-9+\-\s]{8,20}"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Gunakan format internasional, contoh: +628123456789
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="rp">Password (min. 6 karakter)</Label>
                  <Input
                    id="rp"
                    type="password"
                    minLength={6}
                    required
                    value={regPw}
                    onChange={(e) => setRegPw(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Memproses..." : "Daftar"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Akun baru perlu diverifikasi oleh apoteker sebelum dapat digunakan sepenuhnya.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}

function roleHome(role: string | null): "/pasien" | "/apoteker" | "/admin" {
  if (role === "apoteker") return "/apoteker";
  if (role === "admin") return "/admin";
  return "/pasien";
}
