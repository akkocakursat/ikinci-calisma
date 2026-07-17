type Hucre = string | number | null | undefined;

export interface ExcelSayfasi {
  ad: string;
  satirlar: Hucre[][];
}

// Çok sayfalı gerçek Excel (.xlsx) dosyası indirir; sütun genişlikleri içeriğe göre ayarlanır
export async function xlsxIndir(dosyaAdi: string, sayfalar: ExcelSayfasi[]) {
  const XLSX = await import("xlsx");
  const kitap = XLSX.utils.book_new();

  for (const s of sayfalar) {
    const sayfa = XLSX.utils.aoa_to_sheet(s.satirlar);
    const kolonSayisi = Math.max(...s.satirlar.map((r) => r.length), 1);
    const genislikler: { wch: number }[] = [];
    for (let k = 0; k < kolonSayisi; k++) {
      let enUzun = 8;
      for (const satir of s.satirlar) {
        const uzunluk = String(satir[k] ?? "").length;
        if (uzunluk > enUzun) enUzun = uzunluk;
      }
      genislikler.push({ wch: Math.min(enUzun + 2, 42) });
    }
    sayfa["!cols"] = genislikler;
    XLSX.utils.book_append_sheet(kitap, sayfa, s.ad.slice(0, 31));
  }

  XLSX.writeFile(kitap, dosyaAdi);
}
