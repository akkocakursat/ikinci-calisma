const tonFmt = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
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
