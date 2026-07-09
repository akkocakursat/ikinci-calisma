"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import type { DepoStok, FirmaDepoOzet, Siparis } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { formatSayi } from "@/lib/format";
import { csvIndir } from "@/lib/csv";
import { Buton, BosDurum } from "@/components/ui";

interface TakipSatiri {
  depoEtiket: string;
  siparis: number;
  aldigi: number;
  alacagi: number;
  depoKalan: number;
}

interface FirmaGrubu {
  firma: string;
  satirlar: TakipSatiri[];
  siparis: number;
  aldigi: number;
  alacagi: number;
}

function DurumRozeti({ satir }: { satir: TakipSatiri }) {
  if (satir.alacagi <= 0)
    return (
      <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
        ✓ Tamamlandı
      </span>
    );
  if (satir.alacagi > satir.depoKalan)
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        ⚠ Stok yetersiz
      </span>
    );
  const oran = satir.siparis > 0 ? Math.round((satir.aldigi / satir.siparis) * 100) : 0;
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Devam ediyor · %{oran}
    </span>
  );
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
  const gruplar = useMemo<FirmaGrubu[]>(() => {
    // teslim edilen: firma+depo bazında toplam çıkış
    const teslim = new Map<string, number>();
    for (const o of ozet)
      teslim.set(`${o.firma_id}|${o.depo_id}`, Number(o.toplam_tonaj));

    const depoKalan = new Map<string, number>();
    for (const s of stoklar) depoKalan.set(s.depo_id, Number(s.kalan_stok));

    // sipariş: firma+depo bazında toplanır
    const hucre = new Map<
      string,
      { firma: string; depoEtiket: string; firmaId: string; depoId: string; siparis: number }
    >();
    for (const s of siparisler) {
      const k = `${s.firma_id}|${s.depo_id}`;
      const mevcut = hucre.get(k) ?? {
        firma: s.firma?.ad ?? "?",
        depoEtiket: s.depo ? depoTamAd(s.depo) : "?",
        firmaId: s.firma_id,
        depoId: s.depo_id,
        siparis: 0,
      };
      mevcut.siparis += Number(s.miktar);
      hucre.set(k, mevcut);
    }

    const firmaMap = new Map<string, FirmaGrubu>();
    for (const h of hucre.values()) {
      const aldigi = teslim.get(`${h.firmaId}|${h.depoId}`) ?? 0;
      const satir: TakipSatiri = {
        depoEtiket: h.depoEtiket,
        siparis: h.siparis,
        aldigi,
        alacagi: Math.max(0, h.siparis - aldigi),
        depoKalan: depoKalan.get(h.depoId) ?? 0,
      };
      const grup = firmaMap.get(h.firma) ?? {
        firma: h.firma,
        satirlar: [],
        siparis: 0,
        aldigi: 0,
        alacagi: 0,
      };
      grup.satirlar.push(satir);
      grup.siparis += satir.siparis;
      grup.aldigi += satir.aldigi;
      grup.alacagi += satir.alacagi;
      firmaMap.set(h.firma, grup);
    }
    const liste = [...firmaMap.values()].sort((a, b) => b.siparis - a.siparis);
    for (const g of liste)
      g.satirlar.sort((a, b) => a.depoEtiket.localeCompare(b.depoEtiket, "tr-TR"));
    return liste;
  }, [siparisler, ozet, stoklar]);

  const genel = useMemo(
    () => ({
      siparis: gruplar.reduce((a, g) => a + g.siparis, 0),
      aldigi: gruplar.reduce((a, g) => a + g.aldigi, 0),
      alacagi: gruplar.reduce((a, g) => a + g.alacagi, 0),
    }),
    [gruplar]
  );

  function disaAktar() {
    csvIndir(`siparis-takip-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Firma",
        "Depo",
        "Sipariş (ton)",
        "Aldığı (ton)",
        "Alacağı (ton)",
        "Depoda Kalan (ton)",
        "Durum",
      ],
      ...gruplar.flatMap((g) =>
        g.satirlar.map((s) => [
          g.firma,
          s.depoEtiket,
          s.siparis,
          s.aldigi,
          s.alacagi,
          s.depoKalan,
          s.alacagi <= 0 ? "Tamamlandı" : s.alacagi > s.depoKalan ? "Stok yetersiz" : "Devam ediyor",
        ])
      ),
      ["GENEL TOPLAM", "", genel.siparis, genel.aldigi, genel.alacagi, "", ""],
    ]);
  }

  if (!gruplar.length)
    return <BosDurum mesaj="Henüz sipariş kaydı yok. 'Yeni Sipariş' ile firma siparişi ekleyin." />;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Buton tur="ikincil" onClick={disaAktar}>
          <Download size={15} /> CSV İndir
        </Buton>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="tablo-baslik">
              <th className="pr-4">Firma / Depo</th>
              <th className="pr-4 text-right">Sipariş (ton)</th>
              <th className="pr-4 text-right">Aldığı (ton)</th>
              <th className="pr-4 text-right">Alacağı (ton)</th>
              <th className="pr-4 text-right">Depoda Kalan (ton)</th>
              <th className="pr-4">Teslimat</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {gruplar.map((g) => [
              <tr key={g.firma} className="border-b border-hairline/60 bg-brand/[0.035]">
                <td className="py-2.5 pr-4 font-semibold text-ink">{g.firma}</td>
                <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                  {formatSayi(g.siparis)}
                </td>
                <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                  {formatSayi(g.aldigi)}
                </td>
                <td className="tabular py-2.5 pr-4 text-right font-semibold text-brand-dark">
                  {formatSayi(g.alacagi)}
                </td>
                <td className="py-2.5 pr-4"></td>
                <td className="py-2.5 pr-4"></td>
                <td className="py-2.5"></td>
              </tr>,
              ...g.satirlar.map((s) => {
                const oran =
                  s.siparis > 0 ? Math.max(0, Math.min(100, (s.aldigi / s.siparis) * 100)) : 0;
                return (
                  <tr key={g.firma + s.depoEtiket} className="border-b border-hairline/40 last:border-0">
                    <td className="py-2 pl-6 pr-4 text-ink-2">{s.depoEtiket}</td>
                    <td className="tabular py-2 pr-4 text-right text-ink-2">
                      {formatSayi(s.siparis)}
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-ink-2">
                      {formatSayi(s.aldigi)}
                    </td>
                    <td className="tabular py-2 pr-4 text-right font-medium text-ink">
                      {formatSayi(s.alacagi)}
                    </td>
                    <td className="tabular py-2 pr-4 text-right text-ink-2">
                      {formatSayi(s.depoKalan)}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-hairline">
                          <div
                            className={`h-full rounded-full ${oran >= 100 ? "bg-brand" : "bg-accent"}`}
                            style={{ width: `${oran}%` }}
                          />
                        </div>
                        <span className="tabular text-xs text-muted">%{Math.round(oran)}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <DurumRozeti satir={s} />
                    </td>
                  </tr>
                );
              }),
            ])}
          </tbody>
          <tfoot>
            <tr className="tablo-toplam">
              <td className="pr-4">GENEL TOPLAM</td>
              <td className="tabular pr-4 text-right">{formatSayi(genel.siparis)}</td>
              <td className="tabular pr-4 text-right">{formatSayi(genel.aldigi)}</td>
              <td className="tabular pr-4 text-right text-brand-dark">
                {formatSayi(genel.alacagi)}
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
