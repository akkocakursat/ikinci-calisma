"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  Warehouse,
  Building2,
  BarChart3,
  History,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import SunarLogo, { SunarAmblem } from "@/components/Logo";
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
  { href: "/stok-takip", ad: "Stok Takip", Icon: Boxes },
  { href: "/siparisler", ad: "Siparişler", Icon: ClipboardList },
  { href: "/depolar", ad: "Depolar", Icon: Warehouse },
  { href: "/firmalar", ad: "Firmalar", Icon: Building2 },
  { href: "/raporlar", ad: "Raporlar", Icon: BarChart3 },
  { href: "/islem-gecmisi", ad: "İşlem Geçmişi", Icon: History },
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
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/50">
        Menü
      </p>
      {NAV.map(({ href, ad, Icon }) => {
        const aktif = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuAcik(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              aktif
                ? "bg-white/15 text-white shadow-inner ring-1 ring-white/15"
                : "text-emerald-100/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={17} className={aktif ? "text-accent" : undefined} />
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
              ? "bg-white/15 text-white shadow-inner ring-1 ring-white/15"
              : "text-emerald-100/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Users size={17} className={pathname === "/kullanicilar" ? "text-accent" : undefined} />
          Kullanıcılar
        </Link>
      )}
    </nav>
  );

  const altBilgi = (
    <div className="border-t border-white/15 pt-4">
      {profil && (
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-medium text-white">
            {profil.ad_soyad || profil.email}
          </p>
          <div className="mt-1">
            <RolRozeti rol={profil.rol} />
          </div>
        </div>
      )}
      <button
        onClick={cikisYap}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-100/75 transition hover:bg-white/10 hover:text-white"
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
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-brand-deep p-4 lg:flex">
          <div className="mb-6 border-b border-white/10 px-1 pb-5 pt-1">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md">
              <SunarAmblem boyut={30} />
            </div>
            <p className="font-baslik text-base font-bold leading-snug text-white">
              İthal Mısır Takip
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/60">
              Sunar Operasyon Sistemi
            </p>
          </div>
          {nav}
          {altBilgi}
        </aside>

        {/* Mobil üst çubuk */}
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-brand-deep px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center rounded-lg bg-white px-2 py-1.5">
              <SunarLogo yukseklik={17} />
            </span>
            <p className="text-sm font-semibold text-white">İthal Mısır Takip</p>
          </div>
          <button
            onClick={() => setMenuAcik(!menuAcik)}
            className="rounded-lg p-2 text-emerald-100/90 hover:bg-white/10"
            aria-label="Menü"
          >
            {menuAcik ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuAcik && (
          <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={() => setMenuAcik(false)}>
            <div
              className="mt-14 flex h-[calc(100%-3.5rem)] w-72 flex-col bg-brand-deep p-4"
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
