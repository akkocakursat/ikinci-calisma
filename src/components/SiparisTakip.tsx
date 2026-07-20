"use client";

import { useMemo } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import type { DepoStok, FirmaDepoOzet, Siparis } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { bugunISO, formatSayi, formatTarih } from "@/lib/format";
import { csvIndir } from "@/lib/csv";
import { xlsxIndir } from "@/lib/xlsx";
import { Buton, BosDurum } from "@/components/ui";

interface DepoSatiri {
  anahtar: string;
  depoEtiket: string;
  genel: boolean; // depo seçilmemiş "genel" sipariş satırı
  siparis: number; // bu depoya bağlanan sipariş
  sevk: number; // bu depodan fiilen sevk edilen
  depoKalan: number | null; // depodaki kalan stok (genel satırda yok)
}

interface FirmaGrubu {
  firmaId: string;
  firma: string;
  satirlar: DepoSatiri[];
  siparis: number; // firmanın toplam siparişi (genel + depoya bağlı)
  sevk: number; // firmanın TÜM depolardan çektiği toplam
  kalan: number; // açık sipariş
  termin: string | null; // en erken termin tarihi
}

type TerminDurumu = "gecikti" | "yaklasiyor" | null;

function terminDurumu(termin: string | null, kalan: number): TerminDurumu {
  if (!termin || kalan <= 0) return null;
  const bugun = bugunISO();
  if (termin < bugun) return "gecikti";
  const yediGunSonra = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  if (termin <= yediGunSonra) return "yaklasiyor";
  return null;
}

export default function SiparisTakip({
  siparisler,
  ozet,
  stoklar,
}: {
  siparisler: Siparis[];
  ozet: FirmaDepoOzet[];
  stoklar: DepoStok[];
}) {
  const { gruplar, genel, toplamStok } = useMemo(() => {
    const depoKalan = new Map<string, number>();
    let toplamStok = 0;
    for (const s of stoklar) {
      depoKalan.set(s.depo_id, Number(s.kalan_stok));
      toplamStok += Number(s.kalan_stok);
    }

    const depoEtiketleri = new Map<string, string>();
    for (const s of stoklar) depoEtiketleri.set(s.depo_id, depoTamAd(s));

    // firmanın depo bazlı fiili sevkiyatları
    const sevkler = new Map<string, Map<string, number>>(); // firmaId -> depoId -> ton
    for (const o of ozet) {
      const m = sevkler.get(o.firma_id) ?? new Map<string, number>();
      m.set(o.depo_id, (m.get(o.depo_id) ?? 0) + Number(o.toplam_tonaj));
      sevkler.set(o.firma_id, m);
      if (!depoEtiketleri.has(o.depo_id))
        depoEtiketleri.set(o.depo_id, depoTamAd({ ad: o.depo, antrepo: o.antrepo }));
    }

    // firmanın siparişleri (depoya bağlı + genel)
    const firmaMap = new Map<
      string,
      { firma: string; depoSiparis: Map<string, number>; genelSiparis: number; termin: string | null }
    >();
    for (const s of siparisler) {
      const f = firmaMap.get(s.firma_id) ?? {
        firma: s.firma?.ad ?? "?",
        depoSiparis: new Map<string, number>(),
        genelSiparis: 0,
        termin: null,
      };
      if (s.termin && (!f.termin || s.termin < f.termin)) f.termin = s.termin;
      if (s.depo_id) {
        f.depoSiparis.set(s.depo_id, (f.depoSiparis.get(s.depo_id) ?? 0) + Number(s.miktar));
        if (s.depo && !depoEtiketleri.has(s.depo_id))
          depoEtiketleri.set(s.depo_id, depoTamAd(s.depo));
      } else {
        f.genelSiparis += Number(s.miktar);
      }
      firmaMap.set(s.firma_id, f);
    }

    const gruplar: FirmaGrubu[] = [...firmaMap.entries()].map(([firmaId, f]) => {
      const firmaSevk = sevkler.get(firmaId) ?? new Map<string, number>();

      // detay satırları: sipariş bağlanan VEYA fiilen sevk yapılan tüm depolar
      const depoIdleri = new Set<string>([...f.depoSiparis.keys(), ...firmaSevk.keys()]);
      const satirlar: DepoSatiri[] = [...depoIdleri]
        .map((depoId) => ({
          anahtar: depoId,
          depoEtiket: depoEtiketleri.get(depoId) ?? "?",
          genel: false,
          siparis: f.depoSiparis.get(depoId) ?? 0,
          sevk: firmaSevk.get(depoId) ?? 0,
          depoKalan: depoKalan.get(depoId) ?? 0,
        }))
        .sort((a, b) => a.depoEtiket.localeCompare(b.depoEtiket, "tr-TR"));

      if (f.genelSiparis > 0) {
        satirlar.unshift({
          anahtar: "genel",
          depoEtiket: "GENEL — depo farketmez",
          genel: true,
          siparis: f.genelSiparis,
          sevk: 0,
          depoKalan: null,
        });
      }

      const siparis = f.genelSiparis + [...f.depoSiparis.values()].reduce((a, b) => a + b, 0);
      const sevk = [...firmaSevk.values()].reduce((a, b) => a + b, 0);

      return {
        firmaId,
        firma: f.firma,
        satirlar,
        siparis,
        sevk,
        kalan: Math.max(0, siparis - sevk),
        termin: f.termin,
      };
    });

    // Açık siparişi olanlar üstte: önce termini geçenler, sonra açık tonaja göre;
    // tamamlananlar en altta
    gruplar.sort((a, b) => {
      const aAcik = a.kalan > 0 ? 0 : 1;
      const bAcik = b.kalan > 0 ? 0 : 1;
      if (aAcik !== bAcik) return aAcik - bAcik;
      const aGec = terminDurumu(a.termin, a.kalan) === "gecikti" ? 0 : 1;
      const bGec = terminDurumu(b.termin, b.kalan) === "gecikti" ? 0 : 1;
      if (aGec !== bGec) return aGec - bGec;
      return b.kalan - a.kalan || b.siparis - a.siparis;
    });

    const genel = {
      siparis: gruplar.reduce((a, g) => a + g.siparis, 0),
      sevk: gruplar.reduce((a, g) => a + g.sevk, 0),
      kalan: gruplar.reduce((a, g) => a + g.kalan, 0),
    };

    return { gruplar, genel, toplamStok };
  }, [siparisler, ozet, stoklar]);

  function ozetSatirlari() {
    return [
      ["Firma", "Toplam Sipariş (ton)", "Sevk Edilen (ton)", "Açık / Kalan (ton)", "Termin"],
      ...gruplar.map((g) => [
        g.firma,
        g.siparis,
        g.sevk,
        g.kalan,
        g.termin ? formatTarih(g.termin) : "",
      ]),
      ["GENEL TOPLAM", genel.siparis, genel.sevk, genel.kalan, ""],
    ];
  }

  function detaySatirlari() {
    return [
      ["Firma", "Depo", "Bağlı Sipariş (ton)", "Bu Depodan Sevk (ton)", "Depoda Kalan Stok (ton)"],
      ...gruplar.flatMap((g) =>
        g.satirlar.map((s) => [
          g.firma,
          s.depoEtiket,
          s.siparis,
          s.genel ? "" : s.sevk,
          s.depoKalan ?? "",
        ])
      ),
    ];
  }

  function disaAktar() {
    csvIndir(`siparis-takip-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["FİRMA ÖZETİ"],
      ...ozetSatirlari(),
      [],
      ["DEPO BAZLI DETAY"],
      ...detaySatirlari(),
    ]);
  }

  function excelAktar() {
    xlsxIndir(`siparis-takip-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { ad: "Firma Özeti", satirlar: ozetSatirlari() },
      { ad: "Depo Bazlı Detay", satirlar: detaySatirlari() },
    ]);
  }

  if (!gruplar.length)
    return <BosDurum mesaj="Henüz sipariş kaydı yok. 'Yeni Sipariş' ile firma siparişi ekleyin." />;

  return (
    <div>
      {/* Firma bazlı özet: toplam sipariş / sevk edilen / açık kalan */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="tablo-baslik">
              <th className="pr-4">Firma Özeti</th>
              <th className="pr-4 text-right">Toplam Sipariş (ton)</th>
              <th className="pr-4 text-right">Sevk Edilen (ton)</th>
              <th className="pr-4 text-right">Açık / Kalan (ton)</th>
              <th className="pr-4">Termin</th>
              <th className="pr-4">Tamamlanma</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {gruplar.map((g) => {
              const oran =
                g.siparis > 0 ? Math.max(0, Math.min(100, (g.sevk / g.siparis) * 100)) : 0;
              const tDurum = terminDurumu(g.termin, g.kalan);
              return (
                <tr key={g.firmaId} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                  <td className="py-2.5 pr-4 font-medium text-ink">{g.firma}</td>
                  <td className="tabular py-2.5 pr-4 text-right text-ink-2">
                    {formatSayi(g.siparis)}
                  </td>
                  <td className="tabular py-2.5 pr-4 text-right text-ink-2">
                    {formatSayi(g.sevk)}
                  </td>
                  <td
                    className={`tabular py-2.5 pr-4 text-right font-semibold ${
                      g.kalan > 0 ? "text-amber-700" : "text-yesil"
                    }`}
                  >
                    {formatSayi(g.kalan)}
                  </td>
                  <td
                    className={`whitespace-nowrap py-2.5 pr-4 ${
                      tDurum === "gecikti"
                        ? "font-semibold text-red-600"
                        : tDurum === "yaklasiyor"
                          ? "font-semibold text-amber-700"
                          : "text-ink-2"
                    }`}
                  >
                    {g.termin ? formatTarih(g.termin) : "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-hairline">
                        <div
                          className={`h-full rounded-full ${oran >= 100 ? "bg-yesil" : "bg-accent"}`}
                          style={{ width: `${oran}%` }}
                        />
                      </div>
                      <span className="tabular text-xs text-muted">%{Math.round(oran)}</span>
                    </div>
                  </td>
                  <td className="py-2.5">
                    {g.kalan <= 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        ✓ Tamamlandı
                      </span>
                    ) : tDurum === "gecikti" ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                        ⏰ Termin geçti
                      </span>
                    ) : g.kalan > toplamStok ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                        ⚠ Stok yetersiz
                      </span>
                    ) : tDurum === "yaklasiyor" ? (
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        ⏰ Termin yaklaşıyor
                      </span>
                    ) : (
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Devam ediyor
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="tablo-toplam">
              <td className="pr-4">GENEL TOPLAM</td>
              <td className="tabular pr-4 text-right">{formatSayi(genel.siparis)}</td>
              <td className="tabular pr-4 text-right">{formatSayi(genel.sevk)}</td>
              <td className="tabular pr-4 text-right text-brand-dark">{formatSayi(genel.kalan)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Depo bazlı detay: sipariş nereye bağlandı, fiilen nereden çekildi */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Depo Bazlı Detay — sipariş bağlantısı ve fiili çekişler
        </p>
        <span className="flex gap-2">
          <Buton tur="ikincil" onClick={excelAktar}>
            <FileSpreadsheet size={15} /> Excel İndir
          </Buton>
          <Buton tur="ikincil" onClick={disaAktar}>
            <Download size={15} /> CSV İndir
          </Buton>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="tablo-baslik">
              <th className="pr-4">Firma / Depo</th>
              <th className="pr-4 text-right">Bağlı Sipariş (ton)</th>
              <th className="pr-4 text-right">Bu Depodan Sevk (ton)</th>
              <th className="text-right">Depoda Kalan Stok (ton)</th>
            </tr>
          </thead>
          <tbody>
            {gruplar.map((g) => [
              <tr key={g.firmaId} className="border-b border-hairline/60 bg-brand/[0.035]">
                <td className="py-2.5 pr-4 font-semibold text-ink">{g.firma}</td>
                <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                  {formatSayi(g.siparis)}
                </td>
                <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                  {formatSayi(g.sevk)}
                </td>
                <td className="tabular py-2.5 text-right font-semibold text-brand-dark">
                  kalan: {formatSayi(g.kalan)}
                </td>
              </tr>,
              ...g.satirlar.map((s) => (
                <tr key={g.firmaId + s.anahtar} className="border-b border-hairline/40 last:border-0">
                  <td className={`py-2 pl-6 pr-4 ${s.genel ? "italic text-muted" : "text-ink-2"}`}>
                    {s.depoEtiket}
                  </td>
                  <td className="tabular py-2 pr-4 text-right text-ink-2">
                    {s.siparis ? formatSayi(s.siparis) : "·"}
                  </td>
                  <td className="tabular py-2 pr-4 text-right text-ink-2">
                    {s.genel ? "—" : s.sevk ? formatSayi(s.sevk) : "·"}
                  </td>
                  <td className="tabular py-2 text-right text-ink-2">
                    {s.depoKalan === null ? "—" : formatSayi(s.depoKalan)}
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
