"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Firma, FirmaDepoOzet } from "@/lib/types";
import { formatSayi } from "@/lib/format";
import { Card, Buton, Modal, Yukleniyor, BosDurum } from "@/components/ui";
import { useProfil } from "@/components/AppShell";

export default function FirmalarSayfasi() {
  const { profil } = useProfil();
  const duzenleyebilir = profil?.rol === "admin" || profil?.rol === "editor";

  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [ozet, setOzet] = useState<FirmaDepoOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState<{ id?: string; ad: string } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const yenile = useCallback(async () => {
    const supabase = createClient();
    const [f, o] = await Promise.all([
      supabase.from("firmalar").select("*").order("ad"),
      supabase.from("firma_depo_ozet").select("*"),
    ]);
    setFirmalar((f.data as Firma[]) ?? []);
    setOzet((o.data as FirmaDepoOzet[]) ?? []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  const satirlar = useMemo(() => {
    const m = new Map<string, { tonaj: number; sevkiyat: number; depolar: Set<string> }>();
    for (const o of ozet) {
      const kayit = m.get(o.firma_id) ?? { tonaj: 0, sevkiyat: 0, depolar: new Set<string>() };
      kayit.tonaj += Number(o.toplam_tonaj);
      kayit.sevkiyat += Number(o.sevkiyat_sayisi);
      kayit.depolar.add(o.depo_id);
      m.set(o.firma_id, kayit);
    }
    return firmalar
      .map((f) => {
        const k = m.get(f.id);
        return {
          firma: f,
          tonaj: k?.tonaj ?? 0,
          sevkiyat: k?.sevkiyat ?? 0,
          depoSayisi: k?.depolar.size ?? 0,
        };
      })
      .sort((a, b) => b.tonaj - a.tonaj);
  }, [firmalar, ozet]);

  const genelToplam = useMemo(
    () => satirlar.reduce((a, s) => a + s.tonaj, 0),
    [satirlar]
  );

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.ad.trim()) return setHata("Firma adı boş olamaz.");
    setHata(null);
    setBekliyor(true);

    const supabase = createClient();
    const ad = form.ad.trim().toLocaleUpperCase("tr-TR");
    const { error } = form.id
      ? await supabase.from("firmalar").update({ ad }).eq("id", form.id)
      : await supabase.from("firmalar").insert({ ad });

    setBekliyor(false);
    if (error) {
      setHata(error.code === "23505" ? "Bu firma zaten kayıtlı." : "Kaydedilemedi: " + error.message);
      return;
    }
    setForm(null);
    yenile();
  }

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Firmalar</h1>
          <p className="mt-1 text-sm text-muted">
            {firmalar.length} alıcı firma — toplam sevkiyat {formatSayi(genelToplam)} ton
          </p>
        </div>
        {duzenleyebilir && (
          <Buton onClick={() => { setHata(null); setForm({ ad: "" }); }}>
            <Plus size={15} /> Yeni Firma
          </Buton>
        )}
      </header>

      <Card>
        {satirlar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pb-2 pr-4 font-medium">Firma</th>
                  <th className="pb-2 pr-4 text-right font-medium">Toplam Tonaj</th>
                  <th className="pb-2 pr-4 text-right font-medium">Sevkiyat Sayısı</th>
                  <th className="pb-2 pr-4 text-right font-medium">Çalıştığı Depo</th>
                  {duzenleyebilir && <th className="pb-2 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {satirlar.map(({ firma, tonaj, sevkiyat, depoSayisi }) => (
                  <tr key={firma.id} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                    <td className="py-2.5 pr-4 font-medium text-ink">{firma.ad}</td>
                    <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                      {formatSayi(tonaj)}
                    </td>
                    <td className="tabular py-2.5 pr-4 text-right text-ink-2">{sevkiyat}</td>
                    <td className="tabular py-2.5 pr-4 text-right text-ink-2">{depoSayisi}</td>
                    {duzenleyebilir && (
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => { setHata(null); setForm({ id: firma.id, ad: firma.ad }); }}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-page hover:text-ink"
                          aria-label="Düzenle"
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tablo-toplam">
                  <td className="pt-2.5 pr-4">GENEL TOPLAM</td>
                  <td className="tabular pt-2.5 pr-4 text-right">{formatSayi(genelToplam)}</td>
                  <td colSpan={duzenleyebilir ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz firma kaydı yok. Sevkiyat eklerken yeni firma da ekleyebilirsiniz." />
        )}
      </Card>

      <Modal
        acik={form !== null}
        baslik={form?.id ? "Firmayı Düzenle" : "Yeni Firma Ekle"}
        kapat={() => setForm(null)}
      >
        {form && (
          <form onSubmit={kaydet} className="space-y-4">
            <div>
              <label htmlFor="firmaAd">Firma Adı</label>
              <input
                id="firmaAd"
                type="text"
                value={form.ad}
                onChange={(e) => setForm({ ...form, ad: e.target.value })}
                placeholder="örn. ABC YEM SAN."
                required
              />
            </div>
            {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>}
            <Buton tip="submit" disabled={bekliyor} className="w-full justify-center">
              {bekliyor ? "Kaydediliyor…" : "Kaydet"}
            </Buton>
          </form>
        )}
      </Modal>
    </div>
  );
}
