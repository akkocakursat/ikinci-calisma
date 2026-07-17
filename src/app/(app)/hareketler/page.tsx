"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Download, FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Depo, Firma, Hareket, HareketTipi } from "@/lib/types";
import { depoTamAd } from "@/lib/types";
import { formatSayi, formatTarih } from "@/lib/format";
import { csvIndir } from "@/lib/csv";
import { Card, Buton, Modal, Yukleniyor, BosDurum } from "@/components/ui";
import { useProfil } from "@/components/AppShell";
import HareketForm from "@/components/HareketForm";
import ExcelIceAktar from "@/components/ExcelIceAktar";

export default function HareketlerSayfasi() {
  const { profil } = useProfil();
  const duzenleyebilir = profil?.rol === "admin" || profil?.rol === "editor";
  const silebilir = profil?.rol === "admin";

  const [hareketler, setHareketler] = useState<Hareket[]>([]);
  const [depolar, setDepolar] = useState<Depo[]>([]);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  // filtreler
  const [fTip, setFTip] = useState("");
  const [fDepo, setFDepo] = useState("");
  const [fFirma, setFFirma] = useState("");
  const [fBas, setFBas] = useState("");
  const [fBit, setFBit] = useState("");

  // modal durumu
  const [modalTip, setModalTip] = useState<HareketTipi | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Hareket | null>(null);
  const [excelModal, setExcelModal] = useState(false);

  const yenile = useCallback(async () => {
    const supabase = createClient();
    const [h, d, f] = await Promise.all([
      supabase
        .from("hareketler")
        .select("*, depo:depolar(id, ad, antrepo), firma:firmalar(id, ad)")
        .order("tarih", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("depolar").select("*").order("ad"),
      supabase.from("firmalar").select("*").order("ad"),
    ]);
    setHareketler((h.data as Hareket[]) ?? []);
    setDepolar((d.data as Depo[]) ?? []);
    setFirmalar((f.data as Firma[]) ?? []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  const filtreli = useMemo(
    () =>
      hareketler.filter((h) => {
        if (fTip && h.tip !== fTip) return false;
        if (fDepo && h.depo_id !== fDepo) return false;
        if (fFirma && h.firma_id !== fFirma) return false;
        if (fBas && h.tarih < fBas) return false;
        if (fBit && h.tarih > fBit) return false;
        return true;
      }),
    [hareketler, fTip, fDepo, fFirma, fBas, fBit]
  );

  const ozet = useMemo(() => {
    let giris = 0;
    let cikis = 0;
    for (const h of filtreli) {
      if (h.tip === "giris") giris += Number(h.tonaj);
      else cikis += Number(h.tonaj);
    }
    return { giris, cikis };
  }, [filtreli]);

  async function sil(h: Hareket) {
    if (!confirm(`${formatTarih(h.tarih)} tarihli ${formatSayi(Number(h.tonaj))} tonluk kaydı silmek istediğinize emin misiniz?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("hareketler").delete().eq("id", h.id);
    if (error) alert("Silinemedi: " + error.message);
    else yenile();
  }

  function disaAktar() {
    csvIndir(`stok-hareketleri-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Tarih", "İşlem", "Depo", "Antrepo", "Gemi", "Firma", "Plaka", "Tonaj", "Açıklama"],
      ...filtreli.map((h) => [
        formatTarih(h.tarih),
        h.tip === "giris" ? "Giriş" : "Sevkiyat",
        h.depo?.ad ?? "",
        h.depo?.antrepo ?? "",
        h.gemi ?? "",
        h.firma?.ad ?? "",
        h.plaka ?? "",
        Number(h.tonaj),
        h.aciklama ?? "",
      ]),
    ]);
  }

  if (yukleniyor) return <Yukleniyor />;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Stok Hareketleri</h1>
          <p className="mt-1 text-sm text-muted">Depo giriş ve firma sevkiyat kayıtları</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Buton tur="ikincil" onClick={disaAktar}>
            <Download size={15} /> CSV İndir
          </Buton>
          {duzenleyebilir && (
            <>
              <Buton tur="ikincil" onClick={() => setExcelModal(true)}>
                <FileSpreadsheet size={15} /> Excel&apos;den Yükle
              </Buton>
              <Buton tur="ikincil" onClick={() => { setDuzenlenen(null); setModalTip("giris"); }}>
                <ArrowDownToLine size={15} /> Stok Girişi
              </Buton>
              <Buton onClick={() => { setDuzenlenen(null); setModalTip("cikis"); }}>
                <ArrowUpFromLine size={15} /> Sevkiyat (Çıkış)
              </Buton>
            </>
          )}
        </div>
      </header>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <label>İşlem Tipi</label>
            <select value={fTip} onChange={(e) => setFTip(e.target.value)}>
              <option value="">Tümü</option>
              <option value="giris">Giriş</option>
              <option value="cikis">Sevkiyat (Çıkış)</option>
            </select>
          </div>
          <div>
            <label>Depo</label>
            <select value={fDepo} onChange={(e) => setFDepo(e.target.value)}>
              <option value="">Tümü</option>
              {depolar.map((d) => (
                <option key={d.id} value={d.id}>
                  {depoTamAd(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Firma</label>
            <select value={fFirma} onChange={(e) => setFFirma(e.target.value)}>
              <option value="">Tümü</option>
              {firmalar.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ad}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Başlangıç</label>
            <input type="date" value={fBas} onChange={(e) => setFBas(e.target.value)} />
          </div>
          <div>
            <label>Bitiş</label>
            <input type="date" value={fBit} onChange={(e) => setFBit(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-hairline pt-3 text-sm">
          <span className="text-ink-2">
            Kayıt: <b className="tabular text-ink">{filtreli.length}</b>
          </span>
          <span className="text-ink-2">
            Toplam Giriş: <b className="tabular text-ink">{formatSayi(ozet.giris)} ton</b>
          </span>
          <span className="text-ink-2">
            Toplam Sevkiyat: <b className="tabular text-ink">{formatSayi(ozet.cikis)} ton</b>
          </span>
        </div>
      </Card>

      <Card>
        {filtreli.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pb-2 pr-4 font-medium">Tarih</th>
                  <th className="pb-2 pr-4 font-medium">İşlem</th>
                  <th className="pb-2 pr-4 font-medium">Depo</th>
                  <th className="pb-2 pr-4 font-medium">Gemi</th>
                  <th className="pb-2 pr-4 font-medium">Firma</th>
                  <th className="pb-2 pr-4 font-medium">Plaka</th>
                  <th className="pb-2 pr-4 text-right font-medium">Tonaj</th>
                  <th className="pb-2 pr-4 font-medium">Açıklama</th>
                  {(duzenleyebilir || silebilir) && <th className="pb-2 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {filtreli.map((h) => (
                  <tr key={h.id} className="border-b border-hairline/60 last:border-0 hover:bg-page/60">
                    <td className="py-2.5 pr-4 text-ink-2">{formatTarih(h.tarih)}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.tip === "giris"
                            ? "bg-brand/10 text-brand-dark"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {h.tip === "giris" ? "Giriş" : "Sevkiyat"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-ink">{h.depo ? depoTamAd(h.depo) : "—"}</td>
                    <td className="py-2.5 pr-4 text-ink-2">{h.gemi ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-ink">{h.firma?.ad ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-ink-2">{h.plaka ?? "—"}</td>
                    <td className="tabular py-2.5 pr-4 text-right font-medium text-ink">
                      {formatSayi(Number(h.tonaj))}
                    </td>
                    <td className="max-w-[180px] truncate py-2.5 pr-4 text-ink-2">
                      {h.aciklama ?? ""}
                    </td>
                    {(duzenleyebilir || silebilir) && (
                      <td className="py-2.5 text-right">
                        <span className="inline-flex gap-1">
                          {duzenleyebilir && (
                            <button
                              onClick={() => { setDuzenlenen(h); setModalTip(h.tip); }}
                              className="rounded-lg p-1.5 text-muted transition hover:bg-page hover:text-ink"
                              aria-label="Düzenle"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {silebilir && (
                            <button
                              onClick={() => sil(h)}
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
          <BosDurum mesaj="Filtrelere uyan kayıt bulunamadı." />
        )}
      </Card>

      <Modal
        acik={excelModal}
        baslik="Excel'den Toplu Sevkiyat Yükle"
        kapat={() => setExcelModal(false)}
        genis
      >
        <ExcelIceAktar
          depolar={depolar.filter((d) => d.aktif)}
          firmalar={firmalar}
          hareketler={hareketler}
          tamamlandi={yenile}
        />
      </Modal>

      <Modal
        acik={modalTip !== null}
        baslik={
          duzenlenen
            ? "Kaydı Düzenle"
            : modalTip === "giris"
              ? "Stok Girişi Ekle"
              : "Sevkiyat (Çıkış) Ekle"
        }
        kapat={() => { setModalTip(null); setDuzenlenen(null); }}
      >
        {modalTip && (
          <HareketForm
            tip={modalTip}
            depolar={depolar.filter((d) => d.aktif || d.id === duzenlenen?.depo_id)}
            firmalar={firmalar}
            duzenlenen={duzenlenen}
            kaydedildi={() => { setModalTip(null); setDuzenlenen(null); yenile(); }}
          />
        )}
      </Modal>
    </div>
  );
}
