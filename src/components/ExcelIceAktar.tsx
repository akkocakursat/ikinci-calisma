"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Depo, Firma, Hareket } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { formatSayi, parseTonaj } from "@/lib/format";
import { Buton } from "@/components/ui";

type SatirDurum = "ok" | "yeni-firma" | "uyari" | "hata";

interface OnizlemeSatiri {
  satirNo: number;
  tarih: string | null;
  firmaAd: string;
  plaka: string;
  tonaj: number | null;
  depoEtiket: string;
  gemi: string;
  depoId: string | null;
  firmaId: string | null;
  durum: SatirDurum;
  mesaj: string;
}

function trBuyuk(s: string) {
  return s.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

function tarihCevir(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v))
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(
      v.getDate()
    ).padStart(2, "0")}`;
  if (typeof v === "number" && v > 20000 && v < 60000) {
    // Excel seri tarihi
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(+d) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

export default function ExcelIceAktar({
  depolar,
  firmalar,
  hareketler,
  tamamlandi,
}: {
  depolar: Depo[];
  firmalar: Firma[];
  hareketler: Hareket[];
  tamamlandi: () => void;
}) {
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [satirlar, setSatirlar] = useState<OnizlemeSatiri[]>([]);
  const [uyarililariAktar, setUyarililariAktar] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  async function sablonIndir() {
    const XLSX = await import("xlsx");
    const veri = [
      ["TARİH", "FİRMA", "PLAKA", "TONAJ", "DEPO ADI", "ANTREPO", "GEMİ ADI"],
      ["14.07.2026", "ÖRNEK YEM SAN.", "31 ABC 123", "27,540", "DÖNMEZOĞLU", "MİLAS-SİNCAN", "SABEEL STAR"],
      ["14.07.2026", "ÖRNEK TAVUKÇULUK", "01 XY 456", "26,280", "TOROS", "", "NEW SHAIM"],
    ];
    const sayfa = XLSX.utils.aoa_to_sheet(veri);
    sayfa["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    const kitap = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(kitap, sayfa, "Sevkiyatlar");
    XLSX.writeFile(kitap, "sevkiyat-sablonu.xlsx");
  }

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(null);
    setSonuc(null);
    setSatirlar([]);

    try {
      const XLSX = await import("xlsx");
      const veri = await dosya.arrayBuffer();
      const kitap = XLSX.read(veri, { cellDates: true });
      const sayfa = kitap.Sheets[kitap.SheetNames[0]];
      const ham: unknown[][] = XLSX.utils.sheet_to_json(sayfa, { header: 1, defval: "" });

      // Başlık satırını bul
      const baslikIdx = ham.findIndex((r) =>
        r.some((h) => ["TARİH", "TARIH"].includes(trBuyuk(String(h))))
      );
      if (baslikIdx === -1) {
        setHata("Başlık satırı bulunamadı. İlk satırda TARİH, FİRMA, TONAJ, DEPO ADI sütunları olmalı — şablonu indirip kullanın.");
        return;
      }
      const basliklar = ham[baslikIdx].map((h) => trBuyuk(String(h)));
      const kolon = (adlar: string[]) => basliklar.findIndex((b) => adlar.includes(b));
      const iTarih = kolon(["TARİH", "TARIH"]);
      const iFirma = kolon(["FİRMA", "FIRMA", "FİRMA ADI", "FIRMA ADI"]);
      const iPlaka = kolon(["PLAKA", "ARAÇ PLAKA", "ARAC PLAKA"]);
      const iTonaj = kolon(["TONAJ", "TON", "MİKTAR", "MIKTAR"]);
      const iDepo = kolon(["DEPO ADI", "DEPO"]);
      const iAntrepo = kolon(["ANTREPO", "ANTREPO ADI", "LOKASYON"]);
      const iGemi = kolon(["GEMİ ADI", "GEMI ADI", "GEMİ", "GEMI"]);

      if (iFirma === -1 || iTonaj === -1 || iDepo === -1) {
        setHata("FİRMA, TONAJ ve DEPO ADI sütunları zorunludur. Şablonu indirip kullanın.");
        return;
      }

      // Eşleştirme haritaları
      const firmaMap = new Map(firmalar.map((f) => [trBuyuk(f.ad), f.id]));
      const depoAdMap = new Map<string, Depo[]>();
      for (const d of depolar) {
        const liste = depoAdMap.get(trBuyuk(d.ad)) ?? [];
        liste.push(d);
        depoAdMap.set(trBuyuk(d.ad), liste);
      }
      const mevcutKayitlar = new Set(
        hareketler
          .filter((h) => h.tip === "cikis")
          .map((h) => `${h.tarih}|${h.depo_id}|${trBuyuk(h.firma?.ad ?? "")}|${Number(h.tonaj)}`)
      );
      const dosyaIci = new Set<string>();

      const sonucSatirlar: OnizlemeSatiri[] = [];
      for (let i = baslikIdx + 1; i < ham.length; i++) {
        const r = ham[i];
        const bos = r.every((c) => String(c ?? "").trim() === "");
        if (bos) continue;

        const firmaAd = trBuyuk(String(r[iFirma] ?? ""));
        const plaka = trBuyuk(String(iPlaka >= 0 ? r[iPlaka] ?? "" : ""));
        const depoAd = trBuyuk(String(r[iDepo] ?? ""));
        const antrepo = trBuyuk(String(iAntrepo >= 0 ? r[iAntrepo] ?? "" : ""));
        const gemi = trBuyuk(String(iGemi >= 0 ? r[iGemi] ?? "" : ""));
        const tarih = iTarih >= 0 ? tarihCevir(r[iTarih]) : null;
        const tonajHam = r[iTonaj];
        const tonaj =
          typeof tonajHam === "number" && tonajHam > 0 ? tonajHam : parseTonaj(String(tonajHam ?? ""));

        const satir: OnizlemeSatiri = {
          satirNo: i + 1,
          tarih,
          firmaAd,
          plaka,
          tonaj,
          depoEtiket: antrepo ? `${depoAd} (${antrepo})` : depoAd,
          gemi,
          depoId: null,
          firmaId: firmaMap.get(firmaAd) ?? null,
          durum: "ok",
          mesaj: "",
        };

        // Doğrulamalar
        if (!tarih) {
          satir.durum = "hata";
          satir.mesaj = "Tarih okunamadı (GG.AA.YYYY biçiminde olmalı)";
        } else if (!firmaAd) {
          satir.durum = "hata";
          satir.mesaj = "Firma adı boş";
        } else if (!tonaj) {
          satir.durum = "hata";
          satir.mesaj = "Tonaj okunamadı";
        } else if (!depoAd) {
          satir.durum = "hata";
          satir.mesaj = "Depo adı boş";
        } else {
          const adaylar = depoAdMap.get(depoAd) ?? [];
          if (!adaylar.length) {
            satir.durum = "hata";
            satir.mesaj = `"${depoAd}" adında depo yok — önce Depolar sayfasından ekleyin`;
          } else if (antrepo) {
            const eslesen = adaylar.find((d) => trBuyuk(d.antrepo ?? "") === antrepo);
            if (!eslesen) {
              satir.durum = "hata";
              satir.mesaj = `"${depoAd}" deposunda "${antrepo}" antreposu yok`;
            } else satir.depoId = eslesen.id;
          } else if (adaylar.length === 1) {
            satir.depoId = adaylar[0].id;
          } else {
            satir.durum = "hata";
            satir.mesaj = `"${depoAd}" deposunun ${adaylar.length} antreposu var — ANTREPO sütununu doldurun`;
          }
        }

        // Mükerrer kontrolleri
        if (satir.durum !== "hata" && satir.depoId && tarih && tonaj) {
          const anahtar = `${tarih}|${satir.depoId}|${firmaAd}|${tonaj}`;
          if (mevcutKayitlar.has(anahtar)) {
            satir.durum = "uyari";
            satir.mesaj = "Sistemde birebir aynı kayıt var (mükerrer olabilir)";
          } else if (dosyaIci.has(anahtar)) {
            satir.durum = "uyari";
            satir.mesaj = "Dosya içinde birebir aynı satır tekrar ediyor";
          }
          dosyaIci.add(anahtar);
        }

        if (satir.durum === "ok" && !satir.firmaId) {
          satir.durum = "yeni-firma";
          satir.mesaj = "Yeni firma — otomatik oluşturulacak";
        }

        sonucSatirlar.push(satir);
      }

      if (!sonucSatirlar.length) {
        setHata("Dosyada veri satırı bulunamadı.");
        return;
      }
      setSatirlar(sonucSatirlar);
    } catch (err) {
      setHata("Dosya okunamadı: " + String(err));
    } finally {
      if (dosyaRef.current) dosyaRef.current.value = "";
    }
  }

  const aktarilacaklar = satirlar.filter(
    (s) => s.durum === "ok" || s.durum === "yeni-firma" || (s.durum === "uyari" && uyarililariAktar)
  );
  const hataSayisi = satirlar.filter((s) => s.durum === "hata").length;
  const uyariSayisi = satirlar.filter((s) => s.durum === "uyari").length;
  const toplamTonaj = aktarilacaklar.reduce((a, s) => a + (s.tonaj ?? 0), 0);

  async function iceAktar() {
    setBekliyor(true);
    setHata(null);
    const supabase = createClient();

    // Eksik firmaları oluştur
    const yeniFirmaAdlari = [
      ...new Set(aktarilacaklar.filter((s) => !s.firmaId).map((s) => s.firmaAd)),
    ];
    const firmaIdMap = new Map<string, string>();
    for (const ad of yeniFirmaAdlari) {
      const { data: mevcut } = await supabase.from("firmalar").select("id").eq("ad", ad).maybeSingle();
      if (mevcut) {
        firmaIdMap.set(ad, mevcut.id);
        continue;
      }
      const { data: yeni, error } = await supabase.from("firmalar").insert({ ad }).select("id").single();
      if (error) {
        setHata(`"${ad}" firması oluşturulamadı: ${error.message}`);
        setBekliyor(false);
        return;
      }
      firmaIdMap.set(ad, yeni.id);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const kayitlar = aktarilacaklar.map((s) => ({
      depo_id: s.depoId!,
      firma_id: s.firmaId ?? firmaIdMap.get(s.firmaAd)!,
      tip: "cikis" as const,
      tonaj: s.tonaj!,
      tarih: s.tarih!,
      gemi: s.gemi || null,
      plaka: s.plaka || null,
      aciklama: null,
      created_by: user?.id,
    }));

    const { error } = await supabase.from("hareketler").insert(kayitlar);
    setBekliyor(false);
    if (error) {
      setHata("Kayıtlar eklenemedi: " + error.message);
      return;
    }
    setSonuc(
      `${kayitlar.length} sevkiyat kaydı başarıyla eklendi (toplam ${formatSayi(toplamTonaj)} ton). ` +
        (yeniFirmaAdlari.length ? `${yeniFirmaAdlari.length} yeni firma oluşturuldu. ` : "") +
        "Depo stokları ve sipariş bakiyeleri otomatik güncellendi."
    );
    setSatirlar([]);
    tamamlandi();
  }

  const durumRozet: Record<SatirDurum, { stil: string; etiket: string }> = {
    ok: { stil: "bg-brand/10 text-brand-dark", etiket: "✓ Hazır" },
    "yeni-firma": { stil: "bg-emerald-50 text-emerald-700", etiket: "+ Yeni firma" },
    uyari: { stil: "bg-accent-soft text-amber-800", etiket: "⚠ Mükerrer?" },
    hata: { stil: "bg-red-50 text-red-700", etiket: "✗ Hata" },
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-hairline bg-page/60 p-4 text-sm text-ink-2">
        <p className="mb-2">
          <b className="text-ink">Nasıl çalışır:</b> Şablonu indirin, sevkiyat çıkışlarınızı
          satır satır doldurun ve dosyayı buraya yükleyin. Satırlar denetlenir, önizlemeyi
          onayladığınızda tüm çıkışlar işlenir — depo stokları ve sipariş bakiyeleri otomatik düşer.
        </p>
        <p className="text-xs text-muted">
          Sütunlar: TARİH (GG.AA.YYYY) · FİRMA · PLAKA · TONAJ (ton, örn. 27,540) · DEPO ADI ·
          ANTREPO (varsa) · GEMİ ADI (isteğe bağlı). Kabul edilen dosyalar: .xlsx, .xls, .csv
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Buton tur="ikincil" onClick={sablonIndir}>
          <Download size={15} /> Excel Şablonunu İndir
        </Buton>
        <Buton onClick={() => dosyaRef.current?.click()}>
          <Upload size={15} /> Dosya Seç ve Yükle
        </Buton>
        <input
          ref={dosyaRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={dosyaSecildi}
          className="hidden"
        />
      </div>

      {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>}
      {sonuc && (
        <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm font-medium text-brand-dark">
          ✓ {sonuc}
        </p>
      )}

      {satirlar.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <FileSpreadsheet size={15} className="text-brand" />
              {satirlar.length} satır okundu
            </span>
            <span className="text-brand-dark">{aktarilacaklar.length} aktarılacak</span>
            {uyariSayisi > 0 && <span className="text-amber-700">{uyariSayisi} mükerrer uyarısı</span>}
            {hataSayisi > 0 && <span className="text-red-600">{hataSayisi} hatalı (atlanacak)</span>}
            <span className="tabular text-ink-2">
              Toplam: <b className="text-ink">{formatSayi(toplamTonaj)} ton</b>
            </span>
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-hairline">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="tablo-baslik">
                  <th className="px-2">#</th>
                  <th className="px-2">Tarih</th>
                  <th className="px-2">Firma</th>
                  <th className="px-2">Plaka</th>
                  <th className="px-2 text-right">Tonaj</th>
                  <th className="px-2">Depo</th>
                  <th className="px-2">Gemi</th>
                  <th className="px-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s) => (
                  <tr
                    key={s.satirNo}
                    className={`border-b border-hairline/40 last:border-0 ${
                      s.durum === "hata" ? "bg-red-50/50" : s.durum === "uyari" ? "bg-accent-soft/50" : ""
                    }`}
                  >
                    <td className="tabular px-2 py-1.5 text-muted">{s.satirNo}</td>
                    <td className="px-2 py-1.5">{s.tarih ?? "—"}</td>
                    <td className="px-2 py-1.5 font-medium">{s.firmaAd || "—"}</td>
                    <td className="px-2 py-1.5">{s.plaka || "—"}</td>
                    <td className="tabular px-2 py-1.5 text-right">
                      {s.tonaj ? formatSayi(s.tonaj) : "—"}
                    </td>
                    <td className="px-2 py-1.5">{s.depoEtiket || "—"}</td>
                    <td className="px-2 py-1.5">{s.gemi || "—"}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 font-medium ${durumRozet[s.durum].stil}`}
                        title={s.mesaj}
                      >
                        {durumRozet[s.durum].etiket}
                      </span>
                      {s.mesaj && <span className="ml-1.5 text-muted">{s.mesaj}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uyariSayisi > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={uyarililariAktar}
                onChange={(e) => setUyarililariAktar(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              Mükerrer uyarısı olan {uyariSayisi} satırı da aktar (mükerrer olmadıklarından eminim)
            </label>
          )}

          <Buton
            onClick={iceAktar}
            disabled={bekliyor || !aktarilacaklar.length}
            className="w-full justify-center"
          >
            {bekliyor
              ? "Aktarılıyor…"
              : `${aktarilacaklar.length} Sevkiyat Kaydını İçe Aktar (${formatSayi(toplamTonaj)} ton)`}
          </Buton>
        </>
      )}
    </div>
  );
}
