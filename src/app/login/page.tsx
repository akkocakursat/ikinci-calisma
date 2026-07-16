"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import SunarLogo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function girisYap(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: sifre });
    if (error) {
      setHata("Giriş yapılamadı. E-posta veya şifre hatalı.");
      setBekliyor(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center drop-shadow-lg">
            <SunarLogo boyut={60} />
          </div>
          <p className="text-xs font-semibold tracking-[0.3em] text-brand">SUNAR</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">İthal Mısır Takip</h1>
          <p className="mt-1 text-sm text-muted">Devam etmek için hesabınızla giriş yapın</p>
        </div>

        <form
          onSubmit={girisYap}
          className="rounded-2xl border border-hairline bg-surface p-6 shadow-sm"
        >
          <div className="mb-4">
            <label htmlFor="email">E-posta</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@firma.com"
            />
          </div>
          <div className="mb-5">
            <label htmlFor="sifre">Şifre</label>
            <input
              id="sifre"
              type="password"
              required
              autoComplete="current-password"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {hata && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>
          )}

          <button
            type="submit"
            disabled={bekliyor}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {bekliyor && <Loader2 size={16} className="animate-spin" />}
            Giriş Yap
          </button>

          <p className="mt-4 text-center text-xs text-muted">
            Hesabınız yoksa sistem yöneticinizle iletişime geçin.
          </p>
        </form>
      </div>
    </main>
  );
}
