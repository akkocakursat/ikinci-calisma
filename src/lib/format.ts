// Veritabanında tüm miktarlar TON olarak tutulur; kullanıcı her yerde
// KG cinsinden görmek ve girmek istediği için gösterimde 1000 ile çarpılır,
// girişte 1000'e bölünür. Ayrıca ondalık virgül / binlik nokta ayracı yoğun
// tablolarda görsel olarak ayırt edilemediği ve tekrar tekrar yanlış
// okunmasına yol açtığı için kg gösterimleri tam sayıya yuvarlanır.
const KG_CARPAN = 1000;

const kgFmt = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const kisaFmt = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export function formatTon(n: number): string {
  return `${kgFmt.format(n * KG_CARPAN)} kg`;
}

export function formatSayi(n: number): string {
  return kgFmt.format(n * KG_CARPAN);
}

export function formatKisa(n: number): string {
  const kg = n * KG_CARPAN;
  if (Math.abs(kg) >= 1000) return `${kisaFmt.format(kg / 1000)} bin`;
  return kisaFmt.format(kg);
}

export function formatTarih(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function bugunISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Türkçe biçimli sayı girdisini sayıya çevirir:
// "23.147,500" -> 23147.5 | "1.250" -> 1250 | "1250,75" -> 1250.75 | "850" -> 850
function parseSayi(girdi: string): number | null {
  let s = girdi.trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    // virgül ondalık ayracı, noktalar binlik ayracı
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // yalnızca nokta ve 3'erli gruplar: binlik ayraç ("1.250" = 1250)
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Kullanıcı formlara KG cinsinden girer (ör. "27.540" = 27.540 kg); veritabanı
// TON tuttuğu için burada 1000'e bölünür. Dönen değer TON cinsindendir.
export function parseTonaj(girdi: string): number | null {
  const kg = parseSayi(girdi);
  return kg === null ? null : kg / KG_CARPAN;
}
