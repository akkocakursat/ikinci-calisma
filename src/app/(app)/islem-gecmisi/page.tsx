"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { IslemGecmisi } from "@/lib/types";
import { Card, Yukleniyor, BosDurum } from "@/components/ui";

const TABLO_ETIKETLERI: Record<string, string> = {
  hareketler: "Stok Hareketi",
  siparisler: "Sipariş",
  depolar: "Depo",
  firmalar: "Firma",
  profiles: "Kullanıcı",
};

const ISLEM_ROZETLERI: Record<IslemGecmisi["islem"], { etiket: string; stil: string }> = {
  ekleme: { etiket: "Ekleme", stil: "bg-emerald-100 text-emerald-800" },
  guncelleme: { etiket: "Güncelleme", stil: "bg-accent-soft text-amber-800" },
  silme: { etiket: "Silme", stil: "bg-red-50 text-red-700" },
};

function tarihSaat(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IslemGecmisiSayfasi() {
  const [loglar, setLoglar] = useState<IslemGecmisi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  // filtreler
  const [fTablo, setFTablo] = useState("");
  const [fIslem, setFIslem] = useState("");
  const [fKullanici, setFKullanici] = useState("");

  const yenile = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("islem_gecmisi")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLoglar((data as IslemGecmisi[]) ?? []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  const kullanicilar = useMemo(
    () => [...new Set(loglar.map((l) => l.kullanici_email).filter(Boolean))] as string[],
    [loglar]
  );

  const filtreli = useMemo(
    () =>
      loglar.filter((l) => {
        if (fTablo && l.tablo !== fTablo) return false;
        if (fIslem && l.islem !== fIslem) return false;
        if (fKullanici && l.kullanici_email !== fKullanici) return false;
        return true;
      }),
    [loglar, fTablo, fIslem, fKullanici]
  );

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-ink">İşlem Geçmişi</h1>
        <p className="mt-1 text-sm text-muted">
          Sistemdeki tüm ekleme, güncelleme ve silme işlemlerinin kaydı — son 500 işlem.
          Loglar otomatik tutulur ve değiştirilemez.
        </p>
      </header>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label>Bölüm</label>
            <select value={fTablo} onChange={(e) => setFTablo(e.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(TABLO_ETIKETLERI).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>İşlem Tipi</label>
            <select value={fIslem} onChange={(e) => setFIslem(e.target.value)}>
              <option value="">Tümü</option>
              <option value="ekleme">Ekleme</option>
              <option value="guncelleme">Güncelleme</option>
              <option value="silme">Silme</option>
            </select>
          </div>
          <div>
            <label>Kullanıcı</label>
            <select value={fKullanici} onChange={(e) => setFKullanici(e.target.value)}>
              <option value="">Tümü</option>
              {kullanicilar.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card>
        {filtreli.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pr-4">Tarih / Saat</th>
                  <th className="pr-4">Kullanıcı</th>
                  <th className="pr-4">İşlem</th>
                  <th className="pr-4">Bölüm</th>
                  <th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {filtreli.map((l) => (
                  <tr key={l.id} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                    <td className="tabular whitespace-nowrap py-2 pr-4 text-ink-2">
                      {tarihSaat(l.created_at)}
                    </td>
                    <td className="py-2 pr-4 text-ink">{l.kullanici_email ?? "sistem"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ISLEM_ROZETLERI[l.islem].stil}`}
                      >
                        {ISLEM_ROZETLERI[l.islem].etiket}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-ink-2">
                      {TABLO_ETIKETLERI[l.tablo] ?? l.tablo}
                    </td>
                    <td className="py-2 text-ink">{l.ozet ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Filtrelere uyan işlem kaydı yok. (Loglama bugün itibarıyla başladı; bundan sonraki her işlem burada görünecek.)" />
        )}
      </Card>
    </div>
  );
}
