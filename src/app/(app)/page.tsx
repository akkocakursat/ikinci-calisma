"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, ArrowUpFromLine, ClipboardList, PackageCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DepoStok, FirmaDepoOzet, Hareket, Siparis } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { bugunISO, formatSayi, formatTarih } from "@/lib/format";
import { Card, StatCard, Yukleniyor, BosDurum } from "@/components/ui";
import { YatayBarGrafik, GunlukTrend, RENK } from "@/components/charts";

export default function GenelBakis() {
  const [stoklar, setStoklar] = useState<DepoStok[]>([]);
  const [firmaOzet, setFirmaOzet] = useState<FirmaDepoOzet[]>([]);
  const [sonHareketler, setSonHareketler] = useState<Hareket[]>([]);
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [trendHam, setTrendHam] = useState<{ tarih: string; tonaj: number }[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const otuzGunOnce = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    Promise.all([
      supabase.from("depo_stok").select("*"),
      supabase.from("firma_depo_ozet").select("*"),
      supabase
        .from("hareketler")
        .select("*, depo:depolar(id, ad, antrepo), firma:firmalar(id, ad)")
        .order("tarih", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("hareketler")
        .select("tarih, tonaj")
        .eq("tip", "cikis")
        .gte("tarih", otuzGunOnce),
      supabase.from("siparisler").select("id, firma_id, depo_id, miktar, termin, firma:firmalar(id, ad)"),
    ]).then(([s, f, h, t, sip]) => {
      setStoklar((s.data as DepoStok[]) ?? []);
      setFirmaOzet((f.data as FirmaDepoOzet[]) ?? []);
      setSonHareketler((h.data as Hareket[]) ?? []);
      setTrendHam((t.data as { tarih: string; tonaj: number }[]) ?? []);
      setSiparisler((sip.data as unknown as Siparis[]) ?? []);
      setYukleniyor(false);
    });
  }, []);

  const bugun = bugunISO();
  const yediGunSonra = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Firma bazlı açık sipariş listesi (termin ve durumla)
  const acikSiparisler = useMemo(() => {
    const sevk = new Map<string, number>();
    for (const o of firmaOzet)
      sevk.set(o.firma_id, (sevk.get(o.firma_id) ?? 0) + Number(o.toplam_tonaj));

    const m = new Map<string, { ad: string; siparis: number; termin: string | null }>();
    for (const s of siparisler) {
      const f = m.get(s.firma_id) ?? { ad: s.firma?.ad ?? "?", siparis: 0, termin: null };
      f.siparis += Number(s.miktar);
      if (s.termin && (!f.termin || s.termin < f.termin)) f.termin = s.termin;
      m.set(s.firma_id, f);
    }

    return [...m.entries()]
      .map(([id, f]) => {
        const acik = Math.max(0, f.siparis - (sevk.get(id) ?? 0));
        const durum: "gecikti" | "yaklasiyor" | "normal" =
          acik > 0 && f.termin && f.termin < bugun
            ? "gecikti"
            : acik > 0 && f.termin && f.termin <= yediGunSonra
              ? "yaklasiyor"
              : "normal";
        return { id, ad: f.ad, acik, sevk: sevk.get(id) ?? 0, termin: f.termin, durum };
      })
      .filter((f) => f.acik > 0)
      .sort((a, b) => {
        const sira = { gecikti: 0, yaklasiyor: 1, normal: 2 };
        if (sira[a.durum] !== sira[b.durum]) return sira[a.durum] - sira[b.durum];
        return b.acik - a.acik;
      });
  }, [siparisler, firmaOzet, bugun, yediGunSonra]);

  const toplamlar = useMemo(() => {
    const giris = stoklar.reduce((a, s) => a + Number(s.toplam_giris), 0);
    const cikis = stoklar.reduce((a, s) => a + Number(s.toplam_cikis), 0);
    const acikSiparis = acikSiparisler.reduce((a, f) => a + f.acik, 0);
    const kalan = giris - cikis;
    return { giris, cikis, kalan, acikSiparis, netKalan: kalan - acikSiparis };
  }, [stoklar, acikSiparisler]);

  // Dikkat gerektiren durumlar
  const uyarilar = useMemo(() => {
    const liste: { renk: "kirmizi" | "sari"; metin: string; href: string }[] = [];
    for (const f of acikSiparisler) {
      if (f.durum === "gecikti")
        liste.push({
          renk: "kirmizi",
          metin: `${f.ad} — ${formatSayi(f.acik)} kg açık sipariş, termin ${formatTarih(f.termin!)} (GECİKTİ)`,
          href: "/siparisler",
        });
      else if (f.durum === "yaklasiyor")
        liste.push({
          renk: "sari",
          metin: `${f.ad} — ${formatSayi(f.acik)} kg açık sipariş, termin ${formatTarih(f.termin!)}`,
          href: "/siparisler",
        });
    }
    if (toplamlar.netKalan < 0)
      liste.push({
        renk: "kirmizi",
        metin: `Taahhütler mevcut stoğu ${formatSayi(Math.abs(toplamlar.netKalan))} kg aşıyor`,
        href: "/siparisler",
      });
    return liste;
  }, [acikSiparisler, toplamlar.netKalan]);

  const stokGrafik = useMemo(
    () =>
      [...stoklar]
        .filter((s) => s.aktif && Number(s.kalan_stok) > 0)
        .sort((a, b) => Number(b.kalan_stok) - Number(a.kalan_stok))
        .map((s) => ({ ad: depoTamAd(s), deger: Number(s.kalan_stok) })),
    [stoklar]
  );

  const trend = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of trendHam) m.set(h.tarih, (m.get(h.tarih) ?? 0) + Number(h.tonaj));
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tarih, tonaj]) => ({ tarih, tonaj }));
  }, [trendHam]);

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Genel Bakış</h1>
        <p className="mt-1 text-sm text-muted">{formatTarih(new Date().toISOString())}</p>
      </header>

      {uyarilar.length > 0 && (
        <Card title="⚠ Dikkat Gerektirenler" className="mb-6 border-red-200">
          <ul className="space-y-2">
            {uyarilar.map((u, i) => (
              <li key={i}>
                <Link
                  href={u.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    u.renk === "kirmizi"
                      ? "bg-red-50 text-red-800 hover:bg-red-100"
                      : "bg-accent-soft text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  {u.metin} →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Mevcut Stok" value={`${formatSayi(toplamlar.kalan)} kg`} icon={<Boxes size={17} />} />
        <StatCard label="Sevk Edilen" value={`${formatSayi(toplamlar.cikis)} kg`} icon={<ArrowUpFromLine size={17} />} />
        <StatCard
          label="Açık Sipariş"
          value={`${formatSayi(toplamlar.acikSiparis)} kg`}
          sub={acikSiparisler.length ? `${acikSiparisler.length} firma bekliyor` : undefined}
          icon={<ClipboardList size={17} />}
        />
        <StatCard
          label="Satılabilir Stok"
          value={`${formatSayi(toplamlar.netKalan)} kg`}
          sub={toplamlar.netKalan < 0 ? "⚠ stok aşımı!" : undefined}
          icon={<PackageCheck size={17} />}
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card title="Depo Bazlı Kalan Stok (kg)">
          {stokGrafik.length ? (
            <YatayBarGrafik veri={stokGrafik} renk={RENK.seri1} />
          ) : (
            <BosDurum mesaj="Henüz stok yok." />
          )}
        </Card>

        <Card
          title="Açık Siparişler"
          action={
            <Link href="/siparisler" className="text-sm font-medium text-brand hover:underline">
              Tümü →
            </Link>
          }
        >
          {acikSiparisler.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pr-4">Firma</th>
                  <th className="pr-4 text-right">Açık (kg)</th>
                  <th className="pr-4">Termin</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {acikSiparisler.slice(0, 8).map((f) => (
                  <tr key={f.id} className="border-b border-hairline/50 last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink">{f.ad}</td>
                    <td className="tabular py-2 pr-4 text-right font-semibold text-amber-700">
                      {formatSayi(f.acik)}
                    </td>
                    <td
                      className={`py-2 pr-4 ${
                        f.durum === "gecikti"
                          ? "font-semibold text-red-600"
                          : f.durum === "yaklasiyor"
                            ? "font-semibold text-amber-700"
                            : "text-ink-2"
                      }`}
                    >
                      {f.termin ? formatTarih(f.termin) : "—"}
                    </td>
                    <td className="py-2">
                      {f.durum === "gecikti" ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Gecikti
                        </span>
                      ) : f.durum === "yaklasiyor" ? (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Yaklaşıyor
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <BosDurum mesaj="Açık sipariş yok — tüm siparişler teslim edildi." />
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Son 30 Gün Sevkiyat (kg)">
          {trend.length ? <GunlukTrend veri={trend} /> : <BosDurum mesaj="Son 30 günde sevkiyat yok." />}
        </Card>

        <Card
          title="Son Hareketler"
          action={
            <Link href="/hareketler" className="text-sm font-medium text-brand hover:underline">
              Tümü →
            </Link>
          }
        >
          {sonHareketler.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pr-4">Tarih</th>
                  <th className="pr-4">İşlem</th>
                  <th className="pr-4">Depo → Firma</th>
                  <th className="text-right">Tonaj</th>
                </tr>
              </thead>
              <tbody>
                {sonHareketler.map((h) => (
                  <tr key={h.id} className="border-b border-hairline/50 last:border-0">
                    <td className="py-2 pr-4 text-ink-2">{formatTarih(h.tarih)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.tip === "giris"
                            ? "bg-brand/10 text-brand-dark"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {h.tip === "giris" ? "Giriş" : "Sevkiyat"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-ink">
                      {h.depo ? depoTamAd(h.depo) : "—"}
                      {h.firma ? ` → ${h.firma.ad}` : ""}
                    </td>
                    <td className="tabular py-2 text-right font-medium text-ink">
                      {formatSayi(Number(h.tonaj))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <BosDurum mesaj="Henüz hareket yok." />
          )}
        </Card>
      </div>
    </div>
  );
}
