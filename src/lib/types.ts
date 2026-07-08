export type Rol = "admin" | "editor" | "viewer";

export const ROL_ETIKETLERI: Record<Rol, string> = {
  admin: "Yönetici",
  editor: "Operasyon",
  viewer: "Rapor",
};

export interface Profil {
  id: string;
  email: string | null;
  ad_soyad: string | null;
  rol: Rol;
  created_at: string;
}

export interface Depo {
  id: string;
  ad: string;
  gemi: string | null;
  aktif: boolean;
  created_at: string;
}

export interface Firma {
  id: string;
  ad: string;
  created_at: string;
}

export type HareketTipi = "giris" | "cikis";

export interface Hareket {
  id: string;
  depo_id: string;
  firma_id: string | null;
  tip: HareketTipi;
  tonaj: number;
  tarih: string;
  aciklama: string | null;
  created_by: string | null;
  created_at: string;
  depo?: Pick<Depo, "id" | "ad" | "gemi"> | null;
  firma?: Pick<Firma, "id" | "ad"> | null;
}

export interface DepoStok {
  depo_id: string;
  ad: string;
  gemi: string | null;
  aktif: boolean;
  toplam_giris: number;
  toplam_cikis: number;
  kalan_stok: number;
}

export interface FirmaDepoOzet {
  firma_id: string;
  firma: string;
  depo_id: string;
  depo: string;
  gemi: string | null;
  toplam_tonaj: number;
  sevkiyat_sayisi: number;
}

export function depoTamAd(d: { ad: string; gemi?: string | null }): string {
  return d.gemi ? `${d.ad} (${d.gemi})` : d.ad;
}
