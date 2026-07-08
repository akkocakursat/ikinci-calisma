import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "İthal Mısır Sevkiyat ve Stokları",
  description: "Depo bazlı ithal mısır stok ve sevkiyat takip sistemi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
