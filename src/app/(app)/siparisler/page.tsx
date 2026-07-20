"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Depo, DepoGemiStok, DepoStok, Firma, FirmaDepoOzet, Siparis } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { bugunISO, formatSayi, formatTarih, parseTonaj } from "@/lib/format";
import { Card, Buton, Modal, Yukleniyor, BosDurum } from "@/components/ui";
import { useProfil } from "@/components/AppShell";
import SiparisTakip from "@/components/SiparisTakip";

export default function SiparislerSayfasi() {
  const { profil } = useProfil();
  const duzenleyebilir = profil?.rol === "admin" || profil?.rol === "editor";
  const silebilir = profil?.rol === "admin";

  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [depolar, setDepolar] = useState<Depo[]>([]);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [ozet, setOzet] = useState<FirmaDepoOzet[]>([]);
  const [stoklar, setStoklar] = useState<DepoStok[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [modalAcik, setModalAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Siparis | null>(null);
  const [ara, setAra] = useState("");

  const [gemiStoklar, setGemiStoklar] = useState<DepoGemiStok[]>([]);

  // form alanları
  const [firmaAd, setFirmaAd] = useState("");
  const [depoId, setDepoId] = useState("");
  const [gemi, setGemi] = useState("");
  const [miktar, setMiktar] = useState("");
  const [tarih, setTarih] = useState(bugunISO());
  const [termin, setTermin] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [mukerrerUyarisi, setMukerrerUyarisi] = useState<string | null>(null);

  const yenile = useCallback(async () => {
    const supabase = createClient();
    const [s, d, f, o, st, g] = await Promise.all([
      supabase
        .from("siparisler")
        .select("*, firma:firmalar(id, ad), depo:depolar(id, ad, antrepo)")
        .order("tarih", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("depolar").select("*").order("ad").order("antrepo"),
      supabase.from("firmalar").select("*").order("ad"),
      supabase.from("firma_depo_ozet").select("*"),
      supabase.from("depo_stok").select("*"),
      supabase.from("depo_gemi_stok").select("*").order("gemi"),
    ]);
    setSiparisler((s.data as Siparis[]) ?? []);
    setDepolar((d.data as Depo[]) ?? []);
    setFirmalar((f.data as Firma[]) ?? []);
    setOzet((o.data as FirmaDepoOzet[]) ?? []);
    setStoklar((st.data as DepoStok[]) ?? []);
    setGemiStoklar((g.data as DepoGemiStok[]) ?? []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  function formAc(s?: Siparis) {
    setDuzenlenen(s ?? null);
    setFirmaAd(s?.firma?.ad ?? "");
    setDepoId(s?.depo_id ?? "");
    setGemi(s?.gemi ?? "");
    setMiktar(s ? String(s.miktar) : "");
    setTarih(s?.tarih ?? bugunISO());
    setTermin(s?.termin ?? bugunISO());
    setAciklama(s?.aciklama ?? "");
    setHata(null);
    setMukerrerUyarisi(null);
    setModalAcik(true);
  }

  // Seçilen depoda stoğu bulunan gemiler
  const depoGemileri = depoId
    ? gemiStoklar.filter((g) => g.depo_id === depoId && Number(g.kalan) > 0)
    : [];

  // Arama: firma, depo veya gemiye göre hem takip hem kayıt listesi süzülür
  const araT = ara.trim().toLocaleUpperCase("tr-TR");
  const siparisFiltreli = araT
    ? siparisler.filter(
        (s) =>
          (s.firma?.ad ?? "").includes(araT) ||
          (s.depo ? depoTamAd(s.depo).toLocaleUpperCase("tr-TR") : "GENEL").includes(araT) ||
          (s.gemi ?? "").includes(araT)
      )
    : siparisler;

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    const miktarSayi = parseTonaj(miktar);
    const ad = firmaAd.trim().toLocaleUpperCase("tr-TR");
    if (!ad) return setHata("Lütfen firma adını yazın.");
    if (!miktarSayi) return setHata("Miktar sıfırdan büyük bir sayı olmalı (örn. 5.000).");

    setBekliyor(true);
    const supabase = createClient();

    // Firma adını eşleştir; yoksa otomatik oluştur
    let firma: string | null =
      firmalar.find((f) => f.ad.toLocaleUpperCase("tr-TR") === ad)?.id ?? null;
    if (!firma) {
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

    // Mükerrer kontrolü: aynı firma + depo + miktar + tarih siparişi var mı?
    const kombinasyon = [firma, depoId, miktarSayi, tarih].join("|");
    if (mukerrerUyarisi !== kombinasyon) {
      let sorgu = supabase
        .from("siparisler")
        .select("id", { count: "exact", head: true })
        .eq("firma_id", firma)
        .eq("miktar", miktarSayi)
        .eq("tarih", tarih);
      sorgu = depoId ? sorgu.eq("depo_id", depoId) : sorgu.is("depo_id", null);
      if (duzenlenen) sorgu = sorgu.neq("id", duzenlenen.id);
      const { count } = await sorgu;
      if ((count ?? 0) > 0) {
        setMukerrerUyarisi(kombinasyon);
        setBekliyor(false);
        return;
      }
    }
    setMukerrerUyarisi(null);

    const kayit = {
      firma_id: firma,
      depo_id: depoId || null, // boş = GENEL sipariş, hangi depodan sevk edilirse oradan düşer
      gemi: depoId ? gemi || null : null,
      miktar: miktarSayi,
      tarih,
      termin: termin || null,
      aciklama: aciklama.trim() || null,
    };

    let error;
    if (duzenlenen) {
      ({ error } = await supabase.from("siparisler").update(kayit).eq("id", duzenlenen.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("siparisler").insert({ ...kayit, created_by: user?.id }));
    }

    setBekliyor(false);
    if (error) {
      setHata("Kaydedilemedi: " + error.message);
      return;
    }
    setModalAcik(false);
    yenile();
  }

  async function sil(s: Siparis) {
    if (!confirm(`${s.firma?.ad} — ${formatSayi(Number(s.miktar))} tonluk siparişi silmek istediğinize emin misiniz?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("siparisler").delete().eq("id", s.id);
    if (error) alert("Silinemedi: " + error.message);
    else yenile();
  }

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Satış Siparişleri</h1>
          <p className="mt-1 text-sm text-muted">
            Firma siparişleri, teslim edilen ve kalan tonajların takibi
          </p>
        </div>
        {duzenleyebilir && (
          <Buton onClick={() => formAc()}>
            <Plus size={15} /> Yeni Sipariş
          </Buton>
        )}
      </header>

      <Card title="Sipariş Takip Tablosu" className="mb-6">
        <div className="mb-4 max-w-sm">
          <input
            type="text"
            value={ara}
            onChange={(e) => setAra(e.target.value)}
            placeholder="🔍 Firma, depo veya gemi ara…"
          />
        </div>
        <SiparisTakip siparisler={siparisFiltreli} ozet={ozet} stoklar={stoklar} />
      </Card>

      <Card title="Sipariş Kayıtları">
        {siparisFiltreli.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pr-4">Tarih</th>
                  <th className="pr-4">Termin</th>
                  <th className="pr-4">Firma</th>
                  <th className="pr-4">Depo</th>
                  <th className="pr-4">Gemi</th>
                  <th className="pr-4 text-right">Miktar (ton)</th>
                  <th className="pr-4">Açıklama</th>
                  {(duzenleyebilir || silebilir) && <th></th>}
                </tr>
              </thead>
              <tbody>
                {siparisFiltreli.map((s) => (
                  <tr key={s.id} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                    <td className="py-2.5 pr-4 text-ink-2">{formatTarih(s.tarih)}</td>
                    <td
                      className={`py-2.5 pr-4 ${
                        s.termin && s.termin < bugunISO()
                          ? "font-semibold text-red-600"
                          : "text-ink-2"
                      }`}
                    >
                      {s.termin ? formatTarih(s.termin) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-ink">{s.firma?.ad ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-ink">
                      {s.depo ? depoTamAd(s.depo) : <span className="italic text-muted">GENEL</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-ink-2">{s.gemi ?? "—"}</td>
                    <td className="tabular py-2.5 pr-4 text-right font-medium text-ink">
                      {formatSayi(Number(s.miktar))}
                    </td>
                    <td className="max-w-[200px] truncate py-2.5 pr-4 text-ink-2">
                      {s.aciklama ?? ""}
                    </td>
                    {(duzenleyebilir || silebilir) && (
                      <td className="py-2.5 text-right">
                        <span className="inline-flex gap-1">
                          {duzenleyebilir && (
                            <button
                              onClick={() => formAc(s)}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-page hover:text-ink"
                              aria-label="Düzenle"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {silebilir && (
                            <button
                              onClick={() => sil(s)}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-red-50 hover:text-red-600"
                              aria-label="Sil"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz sipariş kaydı yok." />
        )}
      </Card>

      <Modal
        acik={modalAcik}
        baslik={duzenlenen ? "Siparişi Düzenle" : "Yeni Satış Siparişi"}
        kapat={() => setModalAcik(false)}
      >
        <form onSubmit={kaydet} className="space-y-4">
          <div>
            <label htmlFor="sipFirma">Firma Adı</label>
            <input
              id="sipFirma"
              type="text"
              list="firmaListesi"
              value={firmaAd}
              onChange={(e) => setFirmaAd(e.target.value)}
              placeholder="Firma adını yazın veya listeden seçin"
              required
            />
            <datalist id="firmaListesi">
              {firmalar.map((f) => (
                <option key={f.id} value={f.ad} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-muted">
              Kayıtlı firmalar yazarken önerilir; yeni bir ad yazarsanız firma otomatik oluşturulur.
            </p>
          </div>

          <div>
            <label htmlFor="sipDepo">Verilecek Depo</label>
            <select
              id="sipDepo"
              value={depoId}
              onChange={(e) => {
                setDepoId(e.target.value);
                setGemi("");
              }}
            >
              <option value="">GENEL — depo henüz belli değil</option>
              {depolar
                .filter((d) => d.aktif || d.id === duzenlenen?.depo_id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {depoTamAd(d)}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              Depo belli değilse GENEL bırakın; firma hangi depodan çekerse çeksin siparişten düşülür.
            </p>
          </div>

          {depoId && depoGemileri.length > 0 && (
            <div>
              <label htmlFor="sipGemi">Gemi (isteğe bağlı)</label>
              <select id="sipGemi" value={gemi} onChange={(e) => setGemi(e.target.value)}>
                <option value="">Gemi seçin…</option>
                {depoGemileri.map((g) => (
                  <option key={g.gemi} value={g.gemi}>
                    {g.gemi} — kalan {formatSayi(Number(g.kalan))} ton
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">
                Bu depodaki gemiler, gemi bazlı kalan stoklarıyla listelenir.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sipMiktar">Sipariş Miktarı (ton)</label>
              <input
                id="sipMiktar"
                type="text"
                inputMode="decimal"
                value={miktar}
                onChange={(e) => setMiktar(e.target.value)}
                placeholder="örn. 5.000"
                required
              />
            </div>
            <div>
              <label htmlFor="sipTarih">Sipariş Tarihi</label>
              <input
                id="sipTarih"
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="sipTermin">Termin — Son Teslim Tarihi</label>
            <input
              id="sipTermin"
              type="date"
              value={termin}
              onChange={(e) => setTermin(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              Doldurursanız termini geçen veya yaklaşan açık siparişler panelde uyarıyla gösterilir.
            </p>
          </div>

          <div>
            <label htmlFor="sipAciklama">Açıklama (isteğe bağlı)</label>
            <input
              id="sipAciklama"
              type="text"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Sözleşme no, teslim şartı vb."
            />
          </div>

          {hata && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>}

          {mukerrerUyarisi && (
            <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-amber-900">
              ⚠ <b>Mükerrer kayıt uyarısı:</b> Aynı firma, depo, miktar ve tarihte bir sipariş
              zaten mevcut. Mükerrer <b>değilse</b> aşağıdaki butona tekrar basarak onaylayın;
              mükerrerse pencereyi kapatın.
            </p>
          )}

          <Buton
            tip="submit"
            disabled={bekliyor}
            tur={mukerrerUyarisi ? "tehlike" : "birincil"}
            className="w-full justify-center"
          >
            {bekliyor
              ? "Kaydediliyor…"
              : mukerrerUyarisi
                ? "Mükerrer Değil, Yine de Kaydet"
                : duzenlenen
                  ? "Değişiklikleri Kaydet"
                  : "Siparişi Kaydet"}
          </Buton>
        </form>
      </Modal>
    </div>
  );
}
