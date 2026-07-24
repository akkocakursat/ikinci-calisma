"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Depo, DepoGemiStok, Firma, Hareket, HareketTipi } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { bugunISO, formatSayi, parseTonaj } from "@/lib/format";
import { Buton } from "@/components/ui";

export default function HareketForm({
  tip,
  depolar,
  firmalar,
  gemiStoklar = [],
  duzenlenen,
  kaydedildi,
}: {
  tip: HareketTipi;
  depolar: Depo[];
  firmalar: Firma[];
  gemiStoklar?: DepoGemiStok[];
  duzenlenen?: Hareket | null;
  kaydedildi: () => void;
}) {
  const [depoId, setDepoId] = useState(duzenlenen?.depo_id ?? "");
  const [firmaId, setFirmaId] = useState(duzenlenen?.firma_id ?? "");
  const [yeniFirma, setYeniFirma] = useState("");
  const [yeniFirmaModu, setYeniFirmaModu] = useState(false);
  const [tonaj, setTonaj] = useState(duzenlenen ? String(duzenlenen.tonaj) : "");
  const [gemi, setGemi] = useState(duzenlenen?.gemi ?? "");
  const [plaka, setPlaka] = useState(duzenlenen?.plaka ?? "");
  const [tarih, setTarih] = useState(duzenlenen?.tarih ?? bugunISO());
  const [aciklama, setAciklama] = useState(duzenlenen?.aciklama ?? "");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  // mükerrer kayıt uyarısı: uyarılan değer kombinasyonu saklanır,
  // kullanıcı aynı değerlerle ikinci kez "Kaydet"e basarsa onaylanmış sayılır
  const [mukerrerUyarisi, setMukerrerUyarisi] = useState<string | null>(null);
  // büyük değer uyarısı: yazım hatalarının (fazladan/eksik hane) tonajı
  // ciddi şekilde şişirmesini önlemek için makul üst sınırın (ton cinsinden)
  // üstünde onay istenir (uyarılan değerle aynı değer tekrar gönderilirse kabul edilir)
  const [buyukDegerUyarisi, setBuyukDegerUyarisi] = useState<number | null>(null);
  const BUYUK_DEGER_ESIGI = 50000; // ton

  // Sevkiyatta: seçilen depoda stoğu bulunan gemiler (düzenlemede mevcut gemi de listelenir)
  const depoGemileri = depoId
    ? gemiStoklar.filter(
        (g) =>
          g.depo_id === depoId && (Number(g.kalan) > 0 || (duzenlenen && g.gemi === duzenlenen.gemi))
      )
    : [];

  // Girişte: bilinen tüm gemi adları öneri olarak sunulur
  const tumGemiler = [...new Set(gemiStoklar.map((g) => g.gemi))].sort((a, b) =>
    a.localeCompare(b, "tr-TR")
  );

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    const tonajSayi = parseTonaj(tonaj);
    if (!depoId) return setHata("Lütfen depo seçin.");
    if (!tonajSayi) return setHata("Tonaj (kg) sıfırdan büyük bir sayı olmalı (örn. 23.147).");
    if (tip === "cikis" && !yeniFirmaModu && !firmaId) return setHata("Lütfen firma seçin.");
    if (tip === "cikis" && yeniFirmaModu && !yeniFirma.trim())
      return setHata("Yeni firma adını yazın.");

    if (tonajSayi > BUYUK_DEGER_ESIGI && buyukDegerUyarisi !== tonajSayi) {
      setBuyukDegerUyarisi(tonajSayi);
      return;
    }

    setBekliyor(true);
    const supabase = createClient();

    let firma = firmaId || null;
    if (tip === "cikis" && yeniFirmaModu) {
      const ad = yeniFirma.trim().toLocaleUpperCase("tr-TR");
      const { data: mevcut } = await supabase.from("firmalar").select("id").eq("ad", ad).maybeSingle();
      if (mevcut) {
        firma = mevcut.id;
      } else {
        const { data: yeni, error } = await supabase
          .from("firmalar")
          .insert({ ad })
          .select("id")
          .single();
        if (error) {
          setHata("Firma eklenemedi: " + error.message);
          setBekliyor(false);
          return;
        }
        firma = yeni.id;
      }
    }

    // Mükerrer kontrolü: aynı tarih + depo + tip + tonaj (+ firma) kaydı var mı?
    const kombinasyon = [depoId, tip, tonajSayi, tarih, firma ?? ""].join("|");
    if (mukerrerUyarisi !== kombinasyon) {
      let sorgu = supabase
        .from("hareketler")
        .select("id", { count: "exact", head: true })
        .eq("depo_id", depoId)
        .eq("tip", tip)
        .eq("tonaj", tonajSayi)
        .eq("tarih", tarih);
      if (tip === "cikis" && firma) sorgu = sorgu.eq("firma_id", firma);
      if (duzenlenen) sorgu = sorgu.neq("id", duzenlenen.id);
      const { count } = await sorgu;
      if ((count ?? 0) > 0) {
        setMukerrerUyarisi(kombinasyon);
        setBekliyor(false);
        return;
      }
    }
    setMukerrerUyarisi(null);
    setBuyukDegerUyarisi(null);

    const kayit = {
      depo_id: depoId,
      firma_id: tip === "cikis" ? firma : null,
      tip,
      tonaj: tonajSayi,
      tarih,
      gemi: gemi.trim().toLocaleUpperCase("tr-TR") || null,
      plaka: plaka.trim().toLocaleUpperCase("tr-TR") || null,
      aciklama: aciklama.trim() || null,
    };

    let error;
    if (duzenlenen) {
      ({ error } = await supabase.from("hareketler").update(kayit).eq("id", duzenlenen.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("hareketler").insert({ ...kayit, created_by: user?.id }));
    }

    if (error) {
      setHata("Kaydedilemedi: " + error.message);
      setBekliyor(false);
      return;
    }
    kaydedildi();
  }

  return (
    <form onSubmit={kaydet} className="space-y-4">
      <div>
        <label htmlFor="depo">Depo</label>
        <select
          id="depo"
          value={depoId}
          onChange={(e) => {
            setDepoId(e.target.value);
            if (tip === "cikis") setGemi("");
          }}
          required
        >
          <option value="">Depo seçin…</option>
          {depolar.map((d) => (
            <option key={d.id} value={d.id}>
              {depoTamAd(d)}
            </option>
          ))}
        </select>
      </div>

      {tip === "cikis" && (
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="firma">Alıcı Firma</label>
            <button
              type="button"
              onClick={() => setYeniFirmaModu(!yeniFirmaModu)}
              className="mb-1 text-xs font-medium text-brand hover:underline"
            >
              {yeniFirmaModu ? "Listeden seç" : "+ Yeni firma ekle"}
            </button>
          </div>
          {yeniFirmaModu ? (
            <input
              id="firma"
              type="text"
              value={yeniFirma}
              onChange={(e) => setYeniFirma(e.target.value)}
              placeholder="Yeni firma adı"
            />
          ) : (
            <select id="firma" value={firmaId} onChange={(e) => setFirmaId(e.target.value)}>
              <option value="">Firma seçin…</option>
              {firmalar.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ad}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="tonaj">Tonaj (kg)</label>
          <input
            id="tonaj"
            type="text"
            inputMode="decimal"
            value={tonaj}
            onChange={(e) => setTonaj(e.target.value)}
            placeholder="kg — örn. 27.540"
            required
          />
        </div>
        <div>
          <label htmlFor="tarih">Tarih</label>
          <input
            id="tarih"
            type="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          {tip === "cikis" ? (
            <>
              <label htmlFor="gemi">Gemi</label>
              <select
                id="gemi"
                value={gemi}
                onChange={(e) => setGemi(e.target.value)}
                disabled={!depoId}
              >
                <option value="">
                  {!depoId
                    ? "Önce depo seçin…"
                    : depoGemileri.length
                      ? "Gemi seçin…"
                      : "Bu depoda gemi stoğu yok"}
                </option>
                {depoGemileri.map((g) => (
                  <option key={g.gemi} value={g.gemi}>
                    {g.gemi} — kalan {formatSayi(Number(g.kalan))} kg
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label htmlFor="gemi">Gemi Adı</label>
              <input
                id="gemi"
                type="text"
                list="gemiListesi"
                value={gemi}
                onChange={(e) => setGemi(e.target.value)}
                placeholder="örn. NEW SHAIM"
              />
              <datalist id="gemiListesi">
                {tumGemiler.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </>
          )}
        </div>
        <div>
          <label htmlFor="plaka">Araç Plakası (isteğe bağlı)</label>
          <input
            id="plaka"
            type="text"
            value={plaka}
            onChange={(e) => setPlaka(e.target.value)}
            placeholder="örn. 31 ABC 123"
          />
        </div>
      </div>

      <div>
        <label htmlFor="aciklama">Açıklama (isteğe bağlı)</label>
        <input
          id="aciklama"
          type="text"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="İrsaliye no, not vb."
        />
      </div>

      {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>}

      {mukerrerUyarisi && (
        <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-amber-900">
          ⚠ <b>Mükerrer kayıt uyarısı:</b> Aynı tarih, depo{tip === "cikis" ? ", firma" : ""} ve
          tonajda bir kayıt zaten mevcut. Bu kayıt mükerrer <b>değilse</b> aşağıdaki butona tekrar
          basarak onaylayın; mükerrerse pencereyi kapatın.
        </p>
      )}

      {buyukDegerUyarisi !== null && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ <b>Çok büyük bir tonaj:</b> {formatSayi(buyukDegerUyarisi)} kg olarak kaydedilecek.
          Bu, alışılmışın çok üzerinde bir değer — yazarken bir hane fazla/eksik girilmiş olabilir.
          Değer gerçekten doğruysa aşağıdaki butona tekrar basarak onaylayın; değilse kg değerini
          kontrol edip yeniden yazın.
        </p>
      )}

      <Buton
        tip="submit"
        disabled={bekliyor}
        tur={mukerrerUyarisi || buyukDegerUyarisi !== null ? "tehlike" : "birincil"}
        className="w-full justify-center"
      >
        {bekliyor
          ? "Kaydediliyor…"
          : mukerrerUyarisi
            ? "Mükerrer Değil, Yine de Kaydet"
            : buyukDegerUyarisi !== null
              ? "Tonaj Doğru, Yine de Kaydet"
              : duzenlenen
                ? "Değişiklikleri Kaydet"
                : tip === "giris"
                  ? "Stok Girişi Kaydet"
                  : "Sevkiyatı Kaydet"}
      </Buton>
    </form>
  );
}
