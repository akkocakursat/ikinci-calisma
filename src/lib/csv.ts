type Hucre = string | number | null | undefined;

// Türkçe Excel ile uyumlu CSV: UTF-8 BOM + noktalı virgül ayraç + ondalık virgül
export function csvIndir(dosyaAdi: string, satirlar: Hucre[][]) {
  const icerik =
    "﻿" +
    satirlar
      .map((satir) =>
        satir
          .map((h) => {
            if (h === null || h === undefined) return "";
            if (typeof h === "number") return String(h).replace(".", ",");
            return `"${String(h).replace(/"/g, '""')}"`;
          })
          .join(";")
      )
      .join("\r\n");

  const blob = new Blob([icerik], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  a.click();
  URL.revokeObjectURL(url);
}
