// Ondalık virgül / binlik nokta ayracı yoğun tablolarda görsel olarak
// ayırt edilemediği ve tekrar tekrar yanlış okunmasına yol açtığı için
// tüm tonaj gösterimleri tam tona yuvarlanır (ör. 858718,632 -> 858.719).
const tonFmt = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const kisaFmt = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export function formatTon(n: number): string {
  return `${tonFmt.format(n)} ton`;
}

export function formatSayi(n: number): string {
  return tonFmt.format(n);
}

export function formatKisa(n: number): string {
  if (Math.abs(n) >= 1000) return `${kisaFmt.format(n / 1000)} bin`;
  return kisaFmt.format(n);
}

export function formatTarih(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function bugunISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Türkçe biçimli tonaj girdisini sayıya çevirir:
// "23.147,500" -> 23147.5 | "1.250" -> 1250 | "1250,75" -> 1250.75 | "850" -> 850
export function parseTonaj(girdi: string): number | null {
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
