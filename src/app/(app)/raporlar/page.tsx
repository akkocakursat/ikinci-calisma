"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DepoStok, FirmaDepoOzet, Siparis } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { formatSayi } from "@/lib/format";
import { csvIndir } from "@/lib/csv";
import { xlsxIndir } from "@/lib/xlsx";
import { Card, Buton, Yukleniyor, BosDurum } from "@/components/ui";
import { GirisCikisBar } from "@/components/charts";
import SiparisTakip from "@/components/SiparisTakip";

export default function RaporlarSayfasi() {
  const [ozet, setOzet] = useState<FirmaDepoOzet[]>([]);
  const [stoklar, setStoklar] = useState<DepoStok[]>([]);
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [firmaAra, setFirmaAra] = useState("");

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("firma_depo_ozet").select("*"),
      supabase.from("depo_stok").select("*").order("ad"),
      supabase
        .from("siparisler")
        .select("*, firma:firmalar(id, ad), depo:depolar(id, ad, antrepo)"),
    ]).then(([o, s, sip]) => {
      setOzet((o.data as FirmaDepoOzet[]) ?? []);
      setStoklar((s.data as DepoStok[]) ?? []);
      setSiparisler((sip.data as Siparis[]) ?? []);
      setYukleniyor(false);
    });
  }, []);

  // ---- Firma × Depo pivot ----
  const pivot = useMemo(() => {
    // sevkiyat yapılmış depolar, ada göre sıralı
    const depoMap = new Map<string, { id: string; etiket: string }>();
    for (const o of ozet) {
      if (!depoMap.has(o.depo_id))
        depoMap.set(o.depo_id, {
          id: o.depo_id,
          etiket: depoTamAd({ ad: o.depo, antrepo: o.antrepo }),
        });
    }
    const depolar = [...depoMap.values()].sort((a, b) =>
      a.etiket.localeCompare(b.etiket, "tr-TR")
    );

    const firmaMap = new Map<string, { ad: string; hucre: Map<string, number>; toplam: number }>();
    for (const o of ozet) {
      const f = firmaMap.get(o.firma_id) ?? { ad: o.firma, hucre: new Map(), toplam: 0 };
      const t = Number(o.toplam_tonaj);
      f.hucre.set(o.depo_id, (f.hucre.get(o.depo_id) ?? 0) + t);
      f.toplam += t;
      firmaMap.set(o.firma_id, f);
    }
    const t = firmaAra.trim().toLocaleUpperCase("tr-TR");
    const firmalar = [...firmaMap.values()]
      .filter((f) => !t || f.ad.includes(t))
      .sort((a, b) => b.toplam - a.toplam);

    const depoToplam = new Map<string, number>();
    for (const d of depolar) {
      depoToplam.set(
        d.id,
        firmalar.reduce((a, f) => a + (f.hucre.get(d.id) ?? 0), 0)
      );
    }
    const genelToplam = firmalar.reduce((a, f) => a + f.toplam, 0);

    return { depolar, firmalar, depoToplam, genelToplam };
  }, [ozet, firmaAra]);

  // ---- Depo bazlı giriş/çıkış grafiği verisi ----
  const grafikVeri = useMemo(
    () =>
      stoklar
        .filter((s) => Number(s.toplam_giris) > 0 || Number(s.toplam_cikis) > 0)
        .map((s) => ({
          ad: depoTamAd(s),
          giris: Number(s.toplam_giris),
          cikis: Number(s.toplam_cikis),
        })),
    [stoklar]
  );

  const stokToplam = useMemo(() => {
    const giris = stoklar.reduce((a, s) => a + Number(s.toplam_giris), 0);
    const cikis = stoklar.reduce((a, s) => a + Number(s.toplam_cikis), 0);
    return { giris, cikis, kalan: giris - cikis };
  }, [stoklar]);

  function pivotIndir() {
    csvIndir(`firma-depo-raporu-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Firma", ...pivot.depolar.map((d) => d.etiket), "FİRMA TOPLAMI (kg)"],
      ...pivot.firmalar.map((f) => [
        f.ad,
        ...pivot.depolar.map((d) => (f.hucre.get(d.id) ?? 0) * 1000),
        f.toplam * 1000,
      ]),
      [
        "DEPO TOPLAMI",
        ...pivot.depolar.map((d) => (pivot.depoToplam.get(d.id) ?? 0) * 1000),
        pivot.genelToplam * 1000,
      ],
    ]);
  }

  function stokIndir() {
    csvIndir(`depo-stok-raporu-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Depo", "Antrepo", "Toplam Giriş (kg)", "Toplam Çıkış (kg)", "Kalan Stok (kg)"],
      ...stoklar.map((s) => [
        s.ad,
        s.antrepo ?? "",
        Number(s.toplam_giris) * 1000,
        Number(s.toplam_cikis) * 1000,
        Number(s.kalan_stok) * 1000,
      ]),
      ["GENEL TOPLAM", "", stokToplam.giris * 1000, stokToplam.cikis * 1000, stokToplam.kalan * 1000],
    ]);
  }

  function tumRaporuExcelAktar() {
    xlsxIndir(`ithal-misir-rapor-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        ad: "Firma x Depo",
        satirlar: [
          ["Firma", ...pivot.depolar.map((d) => d.etiket), "FİRMA TOPLAMI (kg)"],
          ...pivot.firmalar.map((f) => [
            f.ad,
            ...pivot.depolar.map((d) => (f.hucre.get(d.id) ?? 0) * 1000),
            f.toplam * 1000,
          ]),
          [
            "DEPO TOPLAMI",
            ...pivot.depolar.map((d) => (pivot.depoToplam.get(d.id) ?? 0) * 1000),
            pivot.genelToplam * 1000,
          ],
        ],
      },
      {
        ad: "Depo Stok Özeti",
        satirlar: [
          ["Depo", "Antrepo", "Toplam Giriş (kg)", "Toplam Çıkış (kg)", "Kalan Stok (kg)"],
          ...stoklar.map((s) => [
            s.ad,
            s.antrepo ?? "",
            Number(s.toplam_giris) * 1000,
            Number(s.toplam_cikis) * 1000,
            Number(s.kalan_stok) * 1000,
          ]),
          ["GENEL TOPLAM", "", stokToplam.giris * 1000, stokToplam.cikis * 1000, stokToplam.kalan * 1000],
        ],
      },
    ]);
  }

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Raporlar</h1>
          <p className="mt-1 text-sm text-muted">
            Firma – depo bazlı sevkiyat dağılımı, alt toplamlar ve genel toplamlar
          </p>
        </div>
        <Buton tur="ikincil" onClick={tumRaporuExcelAktar} disabled={!stoklar.length}>
          <FileSpreadsheet size={15} /> Tüm Raporu Excel İndir
        </Buton>
      </header>

      <Card title="Sipariş Takibi — Firma Bazlı Sipariş / Teslimat Durumu (kg)" className="mb-6">
        <SiparisTakip siparisler={siparisler} ozet={ozet} stoklar={stoklar} />
      </Card>

      <Card
        title="Firma × Depo Sevkiyat Tablosu (kg)"
        className="mb-6"
        action={
          <Buton tur="ikincil" onClick={pivotIndir} disabled={!pivot.firmalar.length}>
            <Download size={15} /> CSV İndir
          </Buton>
        }
      >
        <div className="mb-4 max-w-sm">
          <input
            type="text"
            value={firmaAra}
            onChange={(e) => setFirmaAra(e.target.value)}
            placeholder="🔍 Firma ara…"
          />
        </div>
        {pivot.firmalar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="sticky left-0 bg-[#f1f7f3] pr-4 text-left">
                    Firma
                  </th>
                  {pivot.depolar.map((d) => (
                    <th key={d.id} className="whitespace-nowrap pb-2 px-3 text-right font-medium">
                      {d.etiket}
                    </th>
                  ))}
                  <th className="whitespace-nowrap pb-2 pl-3 text-right font-semibold text-ink">
                    FİRMA TOPLAMI
                  </th>
                </tr>
              </thead>
              <tbody>
                {pivot.firmalar.map((f) => (
                  <tr key={f.ad} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                    <td className="sticky left-0 whitespace-nowrap bg-surface py-2 pr-4 font-medium text-ink">
                      {f.ad}
                    </td>
                    {pivot.depolar.map((d) => {
                      const v = f.hucre.get(d.id);
                      return (
                        <td key={d.id} className="tabular whitespace-nowrap py-2 px-3 text-right text-ink-2">
                          {v ? formatSayi(v) : "·"}
                        </td>
                      );
                    })}
                    <td className="tabular whitespace-nowrap py-2 pl-3 text-right font-semibold text-ink">
                      {formatSayi(f.toplam)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tablo-toplam">
                  <td className="sticky left-0 bg-accent-soft pr-4">DEPO TOPLAMI</td>
                  {pivot.depolar.map((d) => (
                    <td key={d.id} className="tabular whitespace-nowrap pt-2.5 px-3 text-right">
                      {formatSayi(pivot.depoToplam.get(d.id) ?? 0)}
                    </td>
                  ))}
                  <td className="tabular whitespace-nowrap pt-2.5 pl-3 text-right text-brand-dark">
                    {formatSayi(pivot.genelToplam)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz sevkiyat kaydı yok. Stok Hareketleri sayfasından sevkiyat ekleyin." />
        )}
      </Card>

      <Card title="Depo Bazlı Toplam Giriş / Çıkış (kg)" className="mb-6">
        {grafikVeri.length ? (
          <GirisCikisBar veri={grafikVeri} />
        ) : (
          <BosDurum mesaj="Grafik için henüz veri yok." />
        )}
      </Card>

      <Card
        title="Depo Stok Özeti (kg)"
        action={
          <Buton tur="ikincil" onClick={stokIndir} disabled={!stoklar.length}>
            <Download size={15} /> CSV İndir
          </Buton>
        }
      >
        {stoklar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pb-2 pr-4 font-medium">Depo</th>
                  <th className="pb-2 pr-4 font-medium">Antrepo</th>
                  <th className="pb-2 pr-4 text-right font-medium">Toplam Giriş</th>
                  <th className="pb-2 pr-4 text-right font-medium">Toplam Çıkış</th>
                  <th className="pb-2 text-right font-medium">Kalan Stok</th>
                </tr>
              </thead>
              <tbody>
                {stoklar.map((s) => (
                  <tr key={s.depo_id} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                    <td className="py-2 pr-4 font-medium text-ink">{s.ad}</td>
                    <td className="py-2 pr-4 text-ink-2">{s.antrepo ?? "—"}</td>
                    <td className="tabular py-2 pr-4 text-right text-ink-2">
                      {formatSayi(Number(s.toplam_giris))}
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-ink-2">
                      {formatSayi(Number(s.toplam_cikis))}
                    </td>
                    <td className="tabular py-2 text-right font-semibold text-ink">
                      {formatSayi(Number(s.kalan_stok))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tablo-toplam">
                  <td className="pt-2.5 pr-4" colSpan={2}>
                    GENEL TOPLAM
                  </td>
                  <td className="tabular pt-2.5 pr-4 text-right">{formatSayi(stokToplam.giris)}</td>
                  <td className="tabular pt-2.5 pr-4 text-right">{formatSayi(stokToplam.cikis)}</td>
                  <td className="tabular pt-2.5 text-right text-brand-dark">
                    {formatSayi(stokToplam.kalan)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz depo kaydı yok." />
        )}
      </Card>
    </div>
  );
}
