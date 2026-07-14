"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DepoGemiStok, DepoStok } from "@/lib/types";
import { formatSayi } from "@/lib/format";
import { Card, Buton, Modal, Yukleniyor, BosDurum } from "@/components/ui";
import { useProfil } from "@/components/AppShell";

interface DepoFormVeri {
  id?: string;
  ad: string;
  antrepo: string;
  aktif: boolean;
}

interface DepoGrubu {
  ad: string;
  alt: DepoStok[];
  giris: number;
  cikis: number;
  kalan: number;
  gemiler: string;
}

function DolulukCubugu({ giris, kalan }: { giris: number; kalan: number }) {
  const oran = giris > 0 ? Math.max(0, Math.min(100, (kalan / giris) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-hairline">
        <div className="h-full rounded-full bg-brand" style={{ width: `${oran}%` }} />
      </div>
      <span className="tabular text-xs text-muted">%{Math.round(oran)}</span>
    </div>
  );
}

export default function DepolarSayfasi() {
  const { profil } = useProfil();
  const duzenleyebilir = profil?.rol === "admin" || profil?.rol === "editor";

  const [stoklar, setStoklar] = useState<DepoStok[]>([]);
  const [gemiStoklar, setGemiStoklar] = useState<DepoGemiStok[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acikGruplar, setAcikGruplar] = useState<Set<string>>(new Set());
  const [acikDepolar, setAcikDepolar] = useState<Set<string>>(new Set()); // gemi kırılımı açık depolar
  const [form, setForm] = useState<DepoFormVeri | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const yenile = useCallback(async () => {
    const supabase = createClient();
    const [d, g] = await Promise.all([
      supabase.from("depo_stok").select("*").order("ad").order("antrepo"),
      supabase.from("depo_gemi_stok").select("*").order("gemi"),
    ]);
    setStoklar((d.data as DepoStok[]) ?? []);
    setGemiStoklar((g.data as DepoGemiStok[]) ?? []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  const gruplar = useMemo<DepoGrubu[]>(() => {
    const m = new Map<string, DepoStok[]>();
    for (const s of stoklar) {
      const liste = m.get(s.ad) ?? [];
      liste.push(s);
      m.set(s.ad, liste);
    }
    return [...m.entries()]
      .map(([ad, alt]) => {
        const gemiSeti = new Set<string>();
        for (const s of alt)
          for (const gemi of (s.gemiler ?? "").split(", ")) if (gemi) gemiSeti.add(gemi);
        return {
          ad,
          alt,
          giris: alt.reduce((a, s) => a + Number(s.toplam_giris), 0),
          cikis: alt.reduce((a, s) => a + Number(s.toplam_cikis), 0),
          kalan: alt.reduce((a, s) => a + Number(s.kalan_stok), 0),
          gemiler: [...gemiSeti].join(", "),
        };
      })
      .sort((a, b) => a.ad.localeCompare(b.ad, "tr-TR"));
  }, [stoklar]);

  const toplam = useMemo(
    () => ({
      giris: gruplar.reduce((a, g) => a + g.giris, 0),
      cikis: gruplar.reduce((a, g) => a + g.cikis, 0),
      kalan: gruplar.reduce((a, g) => a + g.kalan, 0),
    }),
    [gruplar]
  );

  const gemiKirilim = useMemo(() => {
    const m = new Map<string, DepoGemiStok[]>();
    for (const g of gemiStoklar) {
      const liste = m.get(g.depo_id) ?? [];
      liste.push(g);
      m.set(g.depo_id, liste);
    }
    return m;
  }, [gemiStoklar]);

  function grupToggle(ad: string) {
    setAcikGruplar((eski) => {
      const yeni = new Set(eski);
      if (yeni.has(ad)) yeni.delete(ad);
      else yeni.add(ad);
      return yeni;
    });
  }

  function depoToggle(depoId: string) {
    setAcikDepolar((eski) => {
      const yeni = new Set(eski);
      if (yeni.has(depoId)) yeni.delete(depoId);
      else yeni.add(depoId);
      return yeni;
    });
  }

  // Bir deponun gemi kırılım satırları (en alt seviye)
  function gemiSatirlari(depoId: string) {
    const liste = gemiKirilim.get(depoId) ?? [];
    return liste.map((gs) => (
      <tr key={depoId + gs.gemi} className="border-b border-hairline/30 bg-accent-soft/50 last:border-0">
        <td className="py-1.5 pl-14 pr-4 text-xs font-medium text-ink-2">⚓ {gs.gemi}</td>
        <td className="py-1.5 pr-4 text-right text-xs text-muted">
          {Number(gs.giris_sayisi)} giriş
        </td>
        <td className="tabular py-1.5 pr-4 text-right text-xs font-semibold text-ink">
          {formatSayi(Number(gs.giris))}
        </td>
        <td colSpan={duzenleyebilir ? 5 : 4}></td>
      </tr>
    ));
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.ad.trim()) return setHata("Depo adı boş olamaz.");
    setHata(null);
    setBekliyor(true);

    const supabase = createClient();
    const kayit = {
      ad: form.ad.trim().toLocaleUpperCase("tr-TR"),
      antrepo: form.antrepo.trim() ? form.antrepo.trim().toLocaleUpperCase("tr-TR") : null,
      aktif: form.aktif,
    };

    const { error } = form.id
      ? await supabase.from("depolar").update(kayit).eq("id", form.id)
      : await supabase.from("depolar").insert(kayit);

    setBekliyor(false);
    if (error) {
      setHata(
        error.code === "23505"
          ? "Bu depo + antrepo kombinasyonu zaten kayıtlı."
          : "Kaydedilemedi: " + error.message
      );
      return;
    }
    // yeni eklenen/düzenlenen grubun açık kalması kullanışlı
    setAcikGruplar((eski) => new Set(eski).add(kayit.ad));
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
            {gruplar.length} depo, {stoklar.length} antrepo — kalan toplam stok{" "}
            {formatSayi(toplam.kalan)} ton
          </p>
        </div>
        {duzenleyebilir && (
          <Buton onClick={() => { setHata(null); setForm({ ad: "", antrepo: "", aktif: true }); }}>
            <Plus size={15} /> Yeni Depo / Antrepo
          </Buton>
        )}
      </header>

      <Card>
        {gruplar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pb-2 pr-4 font-medium">Depo / Antrepo</th>
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
                {gruplar.map((g) => {
                  // Tek kaydı olan ve antreposu bulunmayan depo: düz satır, açılmaz
                  const duzSatir = g.alt.length === 1 && !g.alt[0].antrepo;
                  if (duzSatir) {
                    const s = g.alt[0];
                    const kirilimVar = gemiKirilim.has(s.depo_id);
                    const gemiAcik = acikDepolar.has(s.depo_id);
                    return [
                      <tr
                        key={g.ad}
                        onClick={() => kirilimVar && depoToggle(s.depo_id)}
                        className={`border-b border-hairline/60 last:border-0 hover:bg-page/60 ${
                          kirilimVar ? "cursor-pointer" : ""
                        }`}
                      >
                        <td className="py-2.5 pr-4">
                          <span className="flex items-center gap-1.5 font-semibold text-ink">
                            {kirilimVar ? (
                              gemiAcik ? (
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
                        <td className="max-w-[220px] truncate py-2.5 pr-4 text-ink-2">
                          {s.gemiler ?? "—"}
                        </td>
                        <td className="tabular py-2.5 pr-4 text-right text-ink-2">
                          {formatSayi(g.giris)}
                        </td>
                        <td className="tabular py-2.5 pr-4 text-right text-ink-2">
                          {formatSayi(g.cikis)}
                        </td>
                        <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                          {formatSayi(g.kalan)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <DolulukCubugu giris={g.giris} kalan={g.kalan} />
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setHata(null);
                                setForm({
                                  id: s.depo_id,
                                  ad: s.ad,
                                  antrepo: s.antrepo ?? "",
                                  aktif: s.aktif,
                                });
                              }}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-page hover:text-ink"
                              aria-label="Düzenle"
                            >
                              <Pencil size={15} />
                            </button>
                          </td>
                        )}
                      </tr>,
                      ...(gemiAcik ? gemiSatirlari(s.depo_id) : []),
                    ];
                  }

                  const acik = acikGruplar.has(g.ad);
                  return [
                    <tr
                      key={g.ad}
                      onClick={() => grupToggle(g.ad)}
                      className="cursor-pointer border-b border-hairline/60 last:border-0 hover:bg-page/60"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                          {acik ? (
                            <ChevronDown size={15} className="text-muted" />
                          ) : (
                            <ChevronRight size={15} className="text-muted" />
                          )}
                          {g.ad}
                          <span className="ml-1 rounded-full bg-page px-2 py-0.5 text-xs font-medium text-muted">
                            {g.alt.length} antrepo
                          </span>
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate py-2.5 pr-4 text-xs text-muted">
                        {g.gemiler || "—"}
                      </td>
                      <td className="tabular py-2.5 pr-4 text-right text-ink-2">
                        {formatSayi(g.giris)}
                      </td>
                      <td className="tabular py-2.5 pr-4 text-right text-ink-2">
                        {formatSayi(g.cikis)}
                      </td>
                      <td className="tabular py-2.5 pr-4 text-right font-semibold text-ink">
                        {formatSayi(g.kalan)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <DolulukCubugu giris={g.giris} kalan={g.kalan} />
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs text-muted">
                          {g.alt.filter((s) => s.aktif).length}/{g.alt.length} aktif
                        </span>
                      </td>
                      {duzenleyebilir && <td className="py-2.5"></td>}
                    </tr>,
                    ...(acik
                      ? g.alt.flatMap((s) => {
                          const kirilimVar = gemiKirilim.has(s.depo_id);
                          const gemiAcik = acikDepolar.has(s.depo_id);
                          return [
                          <tr
                            key={s.depo_id}
                            onClick={() => kirilimVar && depoToggle(s.depo_id)}
                            className={`border-b border-hairline/40 bg-page/40 last:border-0 ${
                              kirilimVar ? "cursor-pointer hover:bg-page/80" : ""
                            }`}
                          >
                            <td className="py-2 pl-9 pr-4 text-ink">
                              <span className="flex items-center gap-1.5">
                                {kirilimVar ? (
                                  gemiAcik ? (
                                    <ChevronDown size={13} className="text-muted" />
                                  ) : (
                                    <ChevronRight size={13} className="text-muted" />
                                  )
                                ) : (
                                  <span className="w-[13px]" />
                                )}
                                {s.antrepo ?? "—"}
                              </span>
                            </td>
                            <td className="max-w-[220px] truncate py-2 pr-4 text-ink-2">
                              {s.gemiler ?? "—"}
                            </td>
                            <td className="tabular py-2 pr-4 text-right text-ink-2">
                              {formatSayi(Number(s.toplam_giris))}
                            </td>
                            <td className="tabular py-2 pr-4 text-right text-ink-2">
                              {formatSayi(Number(s.toplam_cikis))}
                            </td>
                            <td className="tabular py-2 pr-4 text-right font-medium text-ink">
                              {formatSayi(Number(s.kalan_stok))}
                            </td>
                            <td className="py-2 pr-4">
                              <DolulukCubugu
                                giris={Number(s.toplam_giris)}
                                kalan={Number(s.kalan_stok)}
                              />
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  s.aktif ? "bg-emerald-50 text-emerald-700" : "bg-page text-muted"
                                }`}
                              >
                                {s.aktif ? "Aktif" : "Pasif"}
                              </span>
                            </td>
                            {duzenleyebilir && (
                              <td className="py-2 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHata(null);
                                    setForm({
                                      id: s.depo_id,
                                      ad: s.ad,
                                      antrepo: s.antrepo ?? "",
                                      aktif: s.aktif,
                                    });
                                  }}
                                  className="rounded-lg p-1.5 text-muted transition hover:bg-white hover:text-ink"
                                  aria-label="Düzenle"
                                >
                                  <Pencil size={15} />
                                </button>
                              </td>
                            )}
                          </tr>,
                          ...(gemiAcik ? gemiSatirlari(s.depo_id) : []),
                          ];
                        })
                      : []),
                  ];
                })}
              </tbody>
              <tfoot>
                <tr className="tablo-toplam">
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
        baslik={form?.id ? "Depo / Antrepoyu Düzenle" : "Yeni Depo / Antrepo Ekle"}
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
                placeholder="örn. DÖNMEZOĞLU"
                required
              />
              <p className="mt-1 text-xs text-muted">
                Aynı adla birden çok antrepo eklerseniz listede tek başlık altında gruplanır.
              </p>
            </div>
            <div>
              <label htmlFor="depoAntrepo">Antrepo / Lokasyon (isteğe bağlı)</label>
              <input
                id="depoAntrepo"
                type="text"
                value={form.antrepo}
                onChange={(e) => setForm({ ...form, antrepo: e.target.value })}
                placeholder="örn. MİLAS-SİNCAN"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.aktif}
                onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
              Aktif (yeni hareket girilebilir)
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
