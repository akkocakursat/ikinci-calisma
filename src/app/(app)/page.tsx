"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, ArrowDownToLine, ArrowUpFromLine, Warehouse, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DepoStok, FirmaDepoOzet, Hareket } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { formatSayi, formatTarih } from "@/lib/format";
import { Card, StatCard, Yukleniyor, BosDurum } from "@/components/ui";
import { YatayBarGrafik, GunlukTrend, RENK } from "@/components/charts";

export default function GenelBakis() {
  const [stoklar, setStoklar] = useState<DepoStok[]>([]);
  const [firmaOzet, setFirmaOzet] = useState<FirmaDepoOzet[]>([]);
  const [sonHareketler, setSonHareketler] = useState<Hareket[]>([]);
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
        .limit(8),
      supabase
        .from("hareketler")
        .select("tarih, tonaj")
        .eq("tip", "cikis")
        .gte("tarih", otuzGunOnce),
    ]).then(([s, f, h, t]) => {
      setStoklar((s.data as DepoStok[]) ?? []);
      setFirmaOzet((f.data as FirmaDepoOzet[]) ?? []);
      setSonHareketler((h.data as Hareket[]) ?? []);
      setTrendHam((t.data as { tarih: string; tonaj: number }[]) ?? []);
      setYukleniyor(false);
    });
  }, []);

  const toplamlar = useMemo(() => {
    const giris = stoklar.reduce((a, s) => a + Number(s.toplam_giris), 0);
    const cikis = stoklar.reduce((a, s) => a + Number(s.toplam_cikis), 0);
    return { giris, cikis, kalan: giris - cikis };
  }, [stoklar]);

  const stokGrafik = useMemo(
    () =>
      [...stoklar]
        .filter((s) => s.aktif)
        .sort((a, b) => Number(b.kalan_stok) - Number(a.kalan_stok))
        .map((s) => ({ ad: depoTamAd(s), deger: Number(s.kalan_stok) })),
    [stoklar]
  );

  const firmaGrafik = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of firmaOzet) m.set(o.firma, (m.get(o.firma) ?? 0) + Number(o.toplam_tonaj));
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ad, deger]) => ({ ad, deger }));
  }, [firmaOzet]);

  const firmaSayisi = useMemo(() => new Set(firmaOzet.map((o) => o.firma_id)).size, [firmaOzet]);

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
        <p className="mt-1 text-sm text-muted">
          İthal mısır stok durumu ve sevkiyat özeti — {formatTarih(new Date().toISOString())}
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Kalan Toplam Stok"
          value={`${formatSayi(toplamlar.kalan)} ton`}
          icon={<Boxes size={18} />}
        />
        <StatCard
          label="Toplam Giriş"
          value={`${formatSayi(toplamlar.giris)} ton`}
          icon={<ArrowDownToLine size={18} />}
        />
        <StatCard
          label="Toplam Sevkiyat (Çıkış)"
          value={`${formatSayi(toplamlar.cikis)} ton`}
          icon={<ArrowUpFromLine size={18} />}
        />
        <StatCard
          label="Aktif Depo / Alıcı Firma"
          value={`${stoklar.filter((s) => s.aktif).length} / ${firmaSayisi}`}
          sub="depo / firma"
          icon={<Warehouse size={18} />}
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card title="Depo Bazlı Kalan Stok (ton)">
          {stokGrafik.length ? (
            <YatayBarGrafik veri={stokGrafik} renk={RENK.seri1} />
          ) : (
            <BosDurum mesaj="Henüz stok kaydı yok. Stok Hareketleri sayfasından giriş yapın." />
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="Son 30 Gün Günlük Sevkiyat (ton)">
            {trend.length ? (
              <GunlukTrend veri={trend} />
            ) : (
              <BosDurum mesaj="Son 30 günde sevkiyat kaydı yok." />
            )}
          </Card>
          <Card title="En Çok Ürün Alan Firmalar (ilk 10, ton)">
            {firmaGrafik.length ? (
              <YatayBarGrafik veri={firmaGrafik} renk={RENK.seri2} etiketGenislik={150} />
            ) : (
              <BosDurum mesaj="Henüz sevkiyat kaydı yok." />
            )}
          </Card>
        </div>
      </div>

      <Card
        title="Son Hareketler"
        action={
          <Link href="/hareketler" className="text-sm font-medium text-brand hover:underline">
            Tümünü gör →
          </Link>
        }
      >
        {sonHareketler.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="pb-2 pr-4 font-medium">Tarih</th>
                  <th className="pb-2 pr-4 font-medium">İşlem</th>
                  <th className="pb-2 pr-4 font-medium">Depo</th>
                  <th className="pb-2 pr-4 font-medium">Firma</th>
                  <th className="pb-2 text-right font-medium">Tonaj</th>
                </tr>
              </thead>
              <tbody>
                {sonHareketler.map((h) => (
                  <tr key={h.id} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2.5 pr-4 text-ink-2">{formatTarih(h.tarih)}</td>
                    <td className="py-2.5 pr-4">
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
                    <td className="py-2.5 pr-4 text-ink">{h.depo ? depoTamAd(h.depo) : "—"}</td>
                    <td className="py-2.5 pr-4 text-ink">{h.firma?.ad ?? "—"}</td>
                    <td className="tabular py-2.5 text-right font-medium text-ink">
                      {formatSayi(Number(h.tonaj))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz hareket kaydı yok." />
        )}
      </Card>
    </div>
  );
}
