"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DepoStok } from "@/lib/types";
import { formatSayi } from "@/lib/format";
import { Card, Buton, Modal, Yukleniyor, BosDurum } from "@/components/ui";
import { useProfil } from "@/components/AppShell";

interface DepoFormVeri {
  id?: string;
  ad: string;
  gemi: string;
  aktif: boolean;
}

export default function DepolarSayfasi() {
  const { profil } = useProfil();
  const duzenleyebilir = profil?.rol === "admin" || profil?.rol === "editor";

  const [stoklar, setStoklar] = useState<DepoStok[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState<DepoFormVeri | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const yenile = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("depo_stok").select("*").order("ad");
    setStoklar((data as DepoStok[]) ?? []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  const toplam = useMemo(() => {
    const giris = stoklar.reduce((a, s) => a + Number(s.toplam_giris), 0);
    const cikis = stoklar.reduce((a, s) => a + Number(s.toplam_cikis), 0);
    return { giris, cikis, kalan: giris - cikis };
  }, [stoklar]);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.ad.trim()) return setHata("Depo adı boş olamaz.");
    setHata(null);
    setBekliyor(true);

    const supabase = createClient();
    const kayit = {
      ad: form.ad.trim().toLocaleUpperCase("tr-TR"),
      gemi: form.gemi.trim() ? form.gemi.trim().toLocaleUpperCase("tr-TR") : null,
      aktif: form.aktif,
    };

    const { error } = form.id
      ? await supabase.from("depolar").update(kayit).eq("id", form.id)
      : await supabase.from("depolar").insert(kayit);

    setBekliyor(false);
    if (error) {
      setHata(
        error.code === "23505"
          ? "Bu depo + gemi kombinasyonu zaten kayıtlı."
          : "Kaydedilemedi: " + error.message
      );
      return;
    }
    setForm(null);
    yenile();
  }

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Depolar</h1>
          <p className="mt-1 text-sm text-muted">
            {stoklar.length} depo — kalan toplam stok {formatSayi(toplam.kalan)} ton
          </p>
        </div>
        {duzenleyebilir && (
          <Buton onClick={() => { setHata(null); setForm({ ad: "", gemi: "", aktif: true }); }}>
            <Plus size={15} /> Yeni Depo
          </Buton>
        )}
      </header>

      <Card>
        {stoklar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted">
                  <th className="pb-2 pr-4 font-medium">Depo</th>
                  <th className="pb-2 pr-4 font-medium">Gemi</th>
                  <th className="pb-2 pr-4 text-right font-medium">Giriş (ton)</th>
                  <th className="pb-2 pr-4 text-right font-medium">Çıkış (ton)</th>
                  <th className="pb-2 pr-4 text-right font-medium">Kalan (ton)</th>
                  <th className="pb-2 pr-4 font-medium">Doluluk</th>
                  <th className="pb-2 pr-4 font-medium">Durum</th>
                  {duzenleyebilir && <th className="pb-2 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {stoklar.map((s) => {
                  const giris = Number(s.toplam_giris);
                  const kalan = Number(s.kalan_stok);
                  const oran = giris > 0 ? Math.max(0, Math.min(100, (kalan / giris) * 100)) : 0;
                  return (
                    <tr key={s.depo_id} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                      <td className="py-2.5 pr-4 font-medium text-ink">{s.ad}</td>
                      <td className="py-2.5 pr-4 text-ink-2">{s.gemi ?? "—"}</td>
                      <td className="tabular py-2.5 pr-4 text-right text-ink-2">{formatSayi(giris)}</td>
                      <td className="tabular py-2.5 pr-4 text-right text-ink-2">
                        {formatSayi(Number(s.toplam_cikis))}
                      </td>
                      <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                        {formatSayi(kalan)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-hairline">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${oran}%` }}
                            />
                          </div>
                          <span className="tabular text-xs text-muted">%{Math.round(oran)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.aktif ? "bg-emerald-50 text-emerald-700" : "bg-page text-muted"
                          }`}
                        >
                          {s.aktif ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      {duzenleyebilir && (
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setHata(null);
                              setForm({ id: s.depo_id, ad: s.ad, gemi: s.gemi ?? "", aktif: s.aktif });
                            }}
                            className="rounded-lg p-1.5 text-muted transition hover:bg-page hover:text-ink"
                            aria-label="Düzenle"
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-hairline text-sm font-semibold text-ink">
                  <td className="pt-2.5 pr-4" colSpan={2}>
                    GENEL TOPLAM
                  </td>
                  <td className="tabular pt-2.5 pr-4 text-right">{formatSayi(toplam.giris)}</td>
                  <td className="tabular pt-2.5 pr-4 text-right">{formatSayi(toplam.cikis)}</td>
                  <td className="tabular pt-2.5 pr-4 text-right">{formatSayi(toplam.kalan)}</td>
                  <td colSpan={duzenleyebilir ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz depo kaydı yok." />
        )}
      </Card>

      <Modal
        acik={form !== null}
        baslik={form?.id ? "Depoyu Düzenle" : "Yeni Depo Ekle"}
        kapat={() => setForm(null)}
      >
        {form && (
          <form onSubmit={kaydet} className="space-y-4">
            <div>
              <label htmlFor="depoAd">Depo Adı</label>
              <input
                id="depoAd"
                type="text"
                value={form.ad}
                onChange={(e) => setForm({ ...form, ad: e.target.value })}
                placeholder="örn. TOROS"
                required
              />
            </div>
            <div>
              <label htmlFor="depoGemi">Gemi (isteğe bağlı)</label>
              <input
                id="depoGemi"
                type="text"
                value={form.gemi}
                onChange={(e) => setForm({ ...form, gemi: e.target.value })}
                placeholder="örn. NEW SHAIM"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.aktif}
                onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
              Depo aktif (yeni hareket girilebilir)
            </label>
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
