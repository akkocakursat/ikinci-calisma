"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Warehouse,
  Building2,
  BarChart3,
  Users,
  LogOut,
  Ship,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profil } from "@/lib/types";
import { RolRozeti } from "@/components/ui";

const ProfilContext = createContext<{ profil: Profil | null; yukleniyor: boolean }>({
  profil: null,
  yukleniyor: true,
});

export function useProfil() {
  return useContext(ProfilContext);
}

const NAV = [
  { href: "/", ad: "Genel Bakış", Icon: LayoutDashboard },
  { href: "/hareketler", ad: "Stok Hareketleri", Icon: ArrowLeftRight },
  { href: "/depolar", ad: "Depolar", Icon: Warehouse },
  { href: "/firmalar", ad: "Firmalar", Icon: Building2 },
  { href: "/raporlar", ad: "Raporlar", Icon: BarChart3 },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [menuAcik, setMenuAcik] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setYukleniyor(false);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfil((data as Profil) ?? null);
      setYukleniyor(false);
    });
  }, []);

  async function cikisYap() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ href, ad, Icon }) => {
        const aktif = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuAcik(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              aktif ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:bg-page hover:text-ink"
            }`}
          >
            <Icon size={17} />
            {ad}
          </Link>
        );
      })}
      {profil?.rol === "admin" && (
        <Link
          href="/kullanicilar"
          onClick={() => setMenuAcik(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            pathname === "/kullanicilar"
              ? "bg-brand text-white shadow-sm"
              : "text-ink-2 hover:bg-page hover:text-ink"
          }`}
        >
          <Users size={17} />
          Kullanıcılar
        </Link>
      )}
    </nav>
  );

  const altBilgi = (
    <div className="border-t border-hairline pt-4">
      {profil && (
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-medium text-ink">
            {profil.ad_soyad || profil.email}
          </p>
          <div className="mt-1">
            <RolRozeti rol={profil.rol} />
          </div>
        </div>
      )}
      <button
        onClick={cikisYap}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-2 transition hover:bg-page hover:text-ink"
      >
        <LogOut size={17} />
        Çıkış Yap
      </button>
    </div>
  );

  return (
    <ProfilContext.Provider value={{ profil, yukleniyor }}>
      <div className="flex min-h-screen">
        {/* Masaüstü kenar çubuğu */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-hairline bg-surface p-4 lg:flex">
          <div className="mb-6 flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
              <Ship size={18} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">İthal Mısır</p>
              <p className="text-xs text-muted">Sevkiyat ve Stok</p>
            </div>
          </div>
          {nav}
          {altBilgi}
        </aside>

        {/* Mobil üst çubuk */}
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-hairline bg-surface px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <Ship size={16} />
            </div>
            <p className="text-sm font-semibold text-ink">İthal Mısır Sevkiyat</p>
          </div>
          <button
            onClick={() => setMenuAcik(!menuAcik)}
            className="rounded-lg p-2 text-ink-2 hover:bg-page"
            aria-label="Menü"
          >
            {menuAcik ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuAcik && (
          <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMenuAcik(false)}>
            <div
              className="mt-14 flex h-[calc(100%-3.5rem)] w-72 flex-col bg-surface p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {nav}
              {altBilgi}
            </div>
          </div>
        )}

        <main className="flex-1 px-4 pb-10 pt-20 lg:ml-64 lg:px-8 lg:pt-8">{children}</main>
      </div>
    </ProfilContext.Provider>
  );
}
