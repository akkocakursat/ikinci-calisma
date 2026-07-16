import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "İthal Mısır Takip | SUNAR",
  description: "SUNAR — depo bazlı ithal mısır stok, sevkiyat ve sipariş takip sistemi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
