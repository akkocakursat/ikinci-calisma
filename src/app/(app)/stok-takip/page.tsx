"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DepoGemiStok, DepoStok, FirmaDepoOzet, Hareket, Siparis } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { formatSayi } from "@/lib/format";
import { Card, Yukleniyor, BosDurum } from "@/components/ui";
import { YatayBarGrafik, RENK } from "@/components/charts";

function PayCubugu({ oran, renk = "bg-brand" }: { oran: number; renk?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-hairline">
        <div
          className={`h-full rounded-full ${renk}`}
          style={{ width: `${Math.max(0, Math.min(100, oran))}%` }}
        />
      </div>
      <span className="tabular text-xs text-muted">%{Math.round(oran)}</span>
    </div>
  );
}

export default function StokTakipSayfasi() {
  const [stoklar, setStoklar] = useState<DepoStok[]>([]);
  const [gemiStoklar, setGemiStoklar] = useState<DepoGemiStok[]>([]);
  const [cikislar, setCikislar] = useState<Hareket[]>([]);
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [firmaOzet, setFirmaOzet] = useState<FirmaDepoOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acikDepolar, setAcikDepolar] = useState<Set<string>>(new Set());
  const [acikFirmalar, setAcikFirmalar] = useState<Set<string>>(new Set());
  const [depoAra, setDepoAra] = useState("");
  const [firmaAra, setFirmaAra] = useState("");

  function kumeToggle(k: Set<string>, id: string): Set<string> {
    const yeni = new Set(k);
    if (yeni.has(id)) yeni.delete(id);
    else yeni.add(id);
    return yeni;
  }

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("depo_stok").select("*").order("ad").order("antrepo"),
      supabase.from("depo_gemi_stok").select("*").order("gemi"),
      supabase
        .from("hareketler")
        .select("id, firma_id, depo_id, gemi, tonaj, tip, tarih, depo:depolar(id, ad, antrepo), firma:firmalar(id, ad)")
        .eq("tip", "cikis")
        .limit(5000),
      supabase.from("siparisler").select("id, firma_id, miktar, firma:firmalar(id, ad)"),
      supabase.from("firma_depo_ozet").select("*"),
    ]).then(([s, g, c, sip, o]) => {
      setStoklar((s.data as DepoStok[]) ?? []);
      setGemiStoklar((g.data as DepoGemiStok[]) ?? []);
      setCikislar((c.data as unknown as Hareket[]) ?? []);
      setSiparisler((sip.data as unknown as Siparis[]) ?? []);
      setFirmaOzet((o.data as FirmaDepoOzet[]) ?? []);
      setYukleniyor(false);
    });
  }, []);

  // ---- DEPO BAZLI: depo -> antrepo -> gemi kalan stokları ----
  const depoTakip = useMemo(() => {
    const gemilerByDepo = new Map<string, DepoGemiStok[]>();
    for (const g of gemiStoklar) {
      const liste = gemilerByDepo.get(g.depo_id) ?? [];
      liste.push(g);
      gemilerByDepo.set(g.depo_id, liste);
    }

    const t = depoAra.trim().toLocaleUpperCase("tr-TR");
    const gruplar = stoklar
      .filter((s) => Number(s.toplam_giris) > 0 || Number(s.kalan_stok) !== 0)
      .filter(
        (s) =>
          !t ||
          s.ad.includes(t) ||
          (s.antrepo ?? "").toLocaleUpperCase("tr-TR").includes(t) ||
          (gemilerByDepo.get(s.depo_id) ?? []).some((g) => g.gemi.includes(t))
      )
      .map((s) => {
        const gemiler = (gemilerByDepo.get(s.depo_id) ?? [])
          .filter((g) => Number(g.kalan) !== 0)
          .sort((a, b) => Number(b.kalan) - Number(a.kalan));
        return { stok: s, gemiler };
      })
      // stoğu çok olan depo üstte
      .sort((a, b) => Number(b.stok.kalan_stok) - Number(a.stok.kalan_stok));

    const toplamKalan = gruplar.reduce((a, g) => a + Number(g.stok.kalan_stok), 0);
    return { gruplar, toplamKalan };
  }, [stoklar, gemiStoklar, depoAra]);

  const depoGrafik = useMemo(
    () =>
      [...stoklar]
        .filter((s) => Number(s.kalan_stok) > 0)
        .sort((a, b) => Number(b.kalan_stok) - Number(a.kalan_stok))
        .map((s) => ({ ad: depoTamAd(s), deger: Number(s.kalan_stok) })),
    [stoklar]
  );

  // ---- FİRMA BAZLI: firma -> depo/antrepo/gemi aldıkları + açık sipariş ----
  const firmaTakip = useMemo(() => {
    interface Satir {
      depoEtiket: string;
      gemi: string;
      tonaj: number;
    }
    const m = new Map<string, { ad: string; toplam: number; satirlar: Map<string, Satir> }>();
    for (const h of cikislar) {
      if (!h.firma_id) continue;
      const f = m.get(h.firma_id) ?? { ad: h.firma?.ad ?? "?", toplam: 0, satirlar: new Map() };
      const depoEtiket = h.depo ? depoTamAd(h.depo) : "?";
      const gemi = h.gemi ?? "GEMİ BELİRTİLMEMİŞ";
      const anahtar = `${depoEtiket}|${gemi}`;
      const satir = f.satirlar.get(anahtar) ?? { depoEtiket, gemi, tonaj: 0 };
      satir.tonaj += Number(h.tonaj);
      f.toplam += Number(h.tonaj);
      f.satirlar.set(anahtar, satir);
      m.set(h.firma_id, f);
    }

    // açık sipariş: firmanın toplam siparişi - toplam çektiği
    const siparisToplam = new Map<string, number>();
    for (const s of siparisler)
      siparisToplam.set(s.firma_id, (siparisToplam.get(s.firma_id) ?? 0) + Number(s.miktar));
    const sevkToplam = new Map<string, number>();
    for (const o of firmaOzet)
      sevkToplam.set(o.firma_id, (sevkToplam.get(o.firma_id) ?? 0) + Number(o.toplam_tonaj));

    // sipariş verip henüz hiç çekmemiş firmalar da listelensin
    for (const [firmaId] of siparisToplam) {
      if (!m.has(firmaId)) {
        const s = siparisler.find((x) => x.firma_id === firmaId);
        m.set(firmaId, { ad: s?.firma?.ad ?? "?", toplam: 0, satirlar: new Map() });
      }
    }

    const gruplar = [...m.entries()]
      .map(([firmaId, f]) => ({
        firmaId,
        ad: f.ad,
        toplam: f.toplam,
        acikSiparis: Math.max(0, (siparisToplam.get(firmaId) ?? 0) - (sevkToplam.get(firmaId) ?? 0)),
        satirlar: [...f.satirlar.values()].sort((a, b) => b.tonaj - a.tonaj),
      }))
      // açık siparişi olan firmalar üstte (açık tonaja göre), sonra en çok çekenler
      .sort((a, b) => {
        const aAcik = a.acikSiparis > 0 ? 0 : 1;
        const bAcik = b.acikSiparis > 0 ? 0 : 1;
        if (aAcik !== bAcik) return aAcik - bAcik;
        return b.acikSiparis - a.acikSiparis || b.toplam - a.toplam;
      });

    const t = firmaAra.trim().toLocaleUpperCase("tr-TR");
    const filtreli = t ? gruplar.filter((g) => g.ad.includes(t)) : gruplar;

    const genelToplam = filtreli.reduce((a, g) => a + g.toplam, 0);
    const genelAcik = filtreli.reduce((a, g) => a + g.acikSiparis, 0);
    return { gruplar: filtreli, genelToplam, genelAcik };
  }, [cikislar, siparisler, firmaOzet, firmaAra]);

  const firmaGrafik = useMemo(
    () =>
      firmaTakip.gruplar
        .filter((g) => g.toplam > 0)
        .slice(0, 10)
        .map((g) => ({ ad: g.ad, deger: g.toplam })),
    [firmaTakip]
  );

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Stok Takip</h1>
        <p className="mt-1 text-sm text-muted">
          Depo → antrepo → gemi bazında kalan stoklar ve firma bazında çekilen ürünler
        </p>
      </header>

      {/* ================= DEPO BAZLI ================= */}
      <Card title="Depo Bazlı Stok Takip — hangi depoda, hangi gemiden ne kaldı?" className="mb-6">
        <div className="mb-4 max-w-sm">
          <input
            type="text"
            value={depoAra}
            onChange={(e) => setDepoAra(e.target.value)}
            placeholder="🔍 Depo, antrepo veya gemi ara…"
          />
        </div>
        {depoGrafik.length > 0 && (
          <div className="mb-6">
            <YatayBarGrafik veri={depoGrafik} renk={RENK.seri1} />
          </div>
        )}
        {depoTakip.gruplar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pr-4">Depo / Antrepo</th>
                  <th className="pr-4">Gemi</th>
                  <th className="pr-4 text-right">Kalan Stok (kg)</th>
                  <th>Depo İçindeki Pay</th>
                </tr>
              </thead>
              <tbody>
                {depoTakip.gruplar.map(({ stok, gemiler }) => {
                  const depoKalan = Number(stok.kalan_stok);
                  const acik = acikDepolar.has(stok.depo_id);
                  return [
                    <tr
                      key={stok.depo_id}
                      onClick={() =>
                        gemiler.length && setAcikDepolar((k) => kumeToggle(k, stok.depo_id))
                      }
                      className={`border-b border-hairline/60 bg-brand/[0.05] ${
                        gemiler.length ? "cursor-pointer hover:bg-brand/[0.09]" : ""
                      }`}
                    >
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                          {gemiler.length ? (
                            acik ? (
                              <ChevronDown size={15} className="text-muted" />
                            ) : (
                              <ChevronRight size={15} className="text-muted" />
                            )
                          ) : (
                            <span className="w-[15px]" />
                          )}
                          {depoTamAd(stok)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted">
                        {gemiler.length ? `${gemiler.length} gemi — detay için tıklayın` : "—"}
                      </td>
                      <td className="tabular py-2.5 pr-4 text-right font-bold text-ink">
                        {formatSayi(depoKalan)}
                      </td>
                      <td className="py-2.5">
                        <PayCubugu
                          oran={
                            depoTakip.toplamKalan > 0 ? (depoKalan / depoTakip.toplamKalan) * 100 : 0
                          }
                        />
                      </td>
                    </tr>,
                    ...(acik ? gemiler : []).map((g) => (
                      <tr key={stok.depo_id + g.gemi} className="border-b border-hairline/40 last:border-0">
                        <td className="py-2 pl-8 pr-4 text-ink-2"></td>
                        <td className="py-2 pr-4 font-medium text-ink">⚓ {g.gemi}</td>
                        <td className="tabular py-2 pr-4 text-right font-semibold text-yesil">
                          {formatSayi(Number(g.kalan))}
                        </td>
                        <td className="py-2">
                          <PayCubugu
                            oran={depoKalan > 0 ? (Number(g.kalan) / depoKalan) * 100 : 0}
                            renk="bg-accent"
                          />
                        </td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
              <tfoot>
                <tr className="tablo-toplam">
                  <td className="pr-4" colSpan={2}>
                    GENEL TOPLAM KALAN STOK
                  </td>
                  <td className="tabular pr-4 text-right">{formatSayi(depoTakip.toplamKalan)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz stok kaydı yok. Stok Hareketleri sayfasından giriş yapın." />
        )}
      </Card>

      {/* ================= FİRMA BAZLI ================= */}
      <Card title="Firma Bazlı Stok Takip — hangi firma, hangi depodan/gemiden ne çekti?">
        <div className="mb-4 max-w-sm">
          <input
            type="text"
            value={firmaAra}
            onChange={(e) => setFirmaAra(e.target.value)}
            placeholder="🔍 Firma ara…"
          />
        </div>
        {firmaGrafik.length > 0 && (
          <div className="mb-6">
            <YatayBarGrafik veri={firmaGrafik} renk={RENK.seri2} etiketGenislik={150} />
          </div>
        )}
        {firmaTakip.gruplar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pr-4">Firma / Depo</th>
                  <th className="pr-4">Gemi</th>
                  <th className="pr-4 text-right">Çektiği (kg)</th>
                  <th className="text-right">Açık Siparişi (kg)</th>
                </tr>
              </thead>
              <tbody>
                {firmaTakip.gruplar.map((g) => [
                  <tr
                    key={g.firmaId}
                    onClick={() =>
                      g.satirlar.length && setAcikFirmalar((k) => kumeToggle(k, g.firmaId))
                    }
                    className={`border-b border-hairline/60 bg-brand/[0.05] ${
                      g.satirlar.length ? "cursor-pointer hover:bg-brand/[0.09]" : ""
                    }`}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        {g.satirlar.length ? (
                          acikFirmalar.has(g.firmaId) ? (
                            <ChevronDown size={15} className="text-muted" />
                          ) : (
                            <ChevronRight size={15} className="text-muted" />
                          )
                        ) : (
                          <span className="w-[15px]" />
                        )}
                        {g.ad}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted">
                      {g.satirlar.length
                        ? `${g.satirlar.length} kaynak — detay için tıklayın`
                        : "henüz çekmedi"}
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right font-bold text-ink">
                      {formatSayi(g.toplam)}
                    </td>
                    <td
                      className={`tabular py-2.5 text-right font-semibold ${
                        g.acikSiparis > 0 ? "text-amber-700" : "text-yesil"
                      }`}
                    >
                      {formatSayi(g.acikSiparis)}
                    </td>
                  </tr>,
                  ...(acikFirmalar.has(g.firmaId) ? g.satirlar : []).map((s) => (
                    <tr
                      key={g.firmaId + s.depoEtiket + s.gemi}
                      className="border-b border-hairline/40 last:border-0"
                    >
                      <td className="py-2 pl-8 pr-4 text-ink-2">{s.depoEtiket}</td>
                      <td className="py-2 pr-4 text-ink-2">⚓ {s.gemi}</td>
                      <td className="tabular py-2 pr-4 text-right font-medium text-ink">
                        {formatSayi(s.tonaj)}
                      </td>
                      <td></td>
                    </tr>
                  )),
                ])}
              </tbody>
              <tfoot>
                <tr className="tablo-toplam">
                  <td className="pr-4" colSpan={2}>
                    GENEL TOPLAM
                  </td>
                  <td className="tabular pr-4 text-right">{formatSayi(firmaTakip.genelToplam)}</td>
                  <td className="tabular text-right text-amber-800">
                    {formatSayi(firmaTakip.genelAcik)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz sevkiyat veya sipariş kaydı yok." />
        )}
      </Card>
    </div>
  );
}
