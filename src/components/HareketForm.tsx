"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Depo, Firma, Hareket, HareketTipi } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { bugunISO, parseTonaj } from "@/lib/format";
import { Buton } from "@/components/ui";

export default function HareketForm({
  tip,
  depolar,
  firmalar,
  duzenlenen,
  kaydedildi,
}: {
  tip: HareketTipi;
  depolar: Depo[];
  firmalar: Firma[];
  duzenlenen?: Hareket | null;
  kaydedildi: () => void;
}) {
  const [depoId, setDepoId] = useState(duzenlenen?.depo_id ?? "");
  const [firmaId, setFirmaId] = useState(duzenlenen?.firma_id ?? "");
  const [yeniFirma, setYeniFirma] = useState("");
  const [yeniFirmaModu, setYeniFirmaModu] = useState(false);
  const [tonaj, setTonaj] = useState(duzenlenen ? String(duzenlenen.tonaj) : "");
  const [gemi, setGemi] = useState(duzenlenen?.gemi ?? "");
  const [tarih, setTarih] = useState(duzenlenen?.tarih ?? bugunISO());
  const [aciklama, setAciklama] = useState(duzenlenen?.aciklama ?? "");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    const tonajSayi = parseTonaj(tonaj);
    if (!depoId) return setHata("Lütfen depo seçin.");
    if (!tonajSayi) return setHata("Tonaj sıfırdan büyük bir sayı olmalı (örn. 23.147,500).");
    if (tip === "cikis" && !yeniFirmaModu && !firmaId) return setHata("Lütfen firma seçin.");
    if (tip === "cikis" && yeniFirmaModu && !yeniFirma.trim())
      return setHata("Yeni firma adını yazın.");

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

    const kayit = {
      depo_id: depoId,
      firma_id: tip === "cikis" ? firma : null,
      tip,
      tonaj: tonajSayi,
      tarih,
      gemi: tip === "giris" ? gemi.trim().toLocaleUpperCase("tr-TR") || null : null,
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
        <select id="depo" value={depoId} onChange={(e) => setDepoId(e.target.value)} required>
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
          <label htmlFor="tonaj">Tonaj (ton)</label>
          <input
            id="tonaj"
            type="text"
            inputMode="decimal"
            value={tonaj}
            onChange={(e) => setTonaj(e.target.value)}
            placeholder="ton — örn. 1.250,500"
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

      {tip === "giris" && (
        <div>
          <label htmlFor="gemi">Gemi Adı (isteğe bağlı)</label>
          <input
            id="gemi"
            type="text"
            value={gemi}
            onChange={(e) => setGemi(e.target.value)}
            placeholder="örn. NEW SHAIM"
          />
        </div>
      )}

      <div>
        <label htmlFor="aciklama">Açıklama (isteğe bağlı)</label>
        <input
          id="aciklama"
          type="text"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          placeholder="Plaka, irsaliye no vb."
        />
      </div>

      {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>}

      <Buton tip="submit" disabled={bekliyor} className="w-full justify-center">
        {bekliyor ? "Kaydediliyor…" : duzenlenen ? "Değişiklikleri Kaydet" : tip === "giris" ? "Stok Girişi Kaydet" : "Sevkiyatı Kaydet"}
      </Buton>
    </form>
  );
}
