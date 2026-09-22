import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Anda adalah Asisten AI IMO MANTAP, sebuah chatbot edukatif untuk pasien dengan kondisi hipertensi, diabetes (gula darah), dan asam urat di Indonesia.

Aturan:
- Jawab dalam Bahasa Indonesia yang ramah, singkat, dan mudah dipahami.
- Berikan edukasi umum: pola makan, gaya hidup, cara minum obat, kapan harus periksa.
- JANGAN memberikan diagnosis pasti atau mengganti resep dokter/apoteker.
- Untuk keluhan serius (nyeri dada, sesak napas berat, pingsan, gula darah sangat tinggi/rendah, tekanan darah >180/120) segera arahkan ke IGD/dokter.
- Sarankan konsultasi dengan apoteker via menu Konsultasi untuk pertanyaan spesifik tentang obat.
- Gunakan format ringkas, boleh pakai bullet bila perlu.`;

export const askAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { messages?: ChatMsg[] };
    if (!Array.isArray(v.messages)) throw new Error("messages harus array");
    return { messages: v.messages.slice(-20) };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY tidak tersedia");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("Terlalu banyak permintaan, coba lagi sebentar.");
    if (res.status === 402) throw new Error("Kuota AI habis. Hubungi admin untuk top up.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI error: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "(tidak ada jawaban)";
    return { reply };
  });
