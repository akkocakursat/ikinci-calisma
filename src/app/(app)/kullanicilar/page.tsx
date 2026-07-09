"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profil, Rol } from "@/lib/types";
import { ROL_ETIKETLERI } from "@/lib/types";
import { formatTarih } from "@/lib/format";
import { Card, Yukleniyor, BosDurum, RolRozeti } from "@/components/ui";
import { useProfil } from "@/components/AppShell";

export default function KullanicilarSayfasi() {
  const { profil, yukleniyor: profilYukleniyor } = useProfil();
  const [kullanicilar, setKullanicilar] = useState<Profil[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yenile = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    setKullanicilar((data as Profil[]) ?? []);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    yenile();
  }, [yenile]);

  async function rolDegistir(k: Profil, rol: Rol) {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ rol }).eq("id", k.id);
    if (error) {
      setMesaj("Rol güncellenemedi: " + error.message);
    } else {
      setMesaj(`${k.email} artık "${ROL_ETIKETLERI[rol]}" rolünde.`);
      yenile();
    }
  }

  async function adKaydet(k: Profil, adSoyad: string) {
    const supabase = createClient();
    await supabase.from("profiles").update({ ad_soyad: adSoyad.trim() || null }).eq("id", k.id);
  }

  if (profilYukleniyor || yukleniyor) return <Yukleniyor />;

  if (profil?.rol !== "admin") {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <BosDurum mesaj="Bu sayfayı yalnızca Yönetici rolündeki kullanıcılar görebilir." />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Kullanıcılar</h1>
        <p className="mt-1 text-sm text-muted">
          Yeni kullanıcı eklemek için: Supabase Dashboard → Authentication → Users → “Add user”.
          Eklenen kullanıcı burada otomatik görünür; rolünü aşağıdan seçin.
        </p>
      </header>

      {mesaj && (
        <p className="mb-4 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand-dark">{mesaj}</p>
      )}

      <Card>
        {kullanicilar.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tablo-baslik">
                  <th className="pb-2 pr-4 font-medium">E-posta</th>
                  <th className="pb-2 pr-4 font-medium">Ad Soyad</th>
                  <th className="pb-2 pr-4 font-medium">Kayıt Tarihi</th>
                  <th className="pb-2 pr-4 font-medium">Mevcut Rol</th>
                  <th className="pb-2 font-medium">Rol Değiştir</th>
                </tr>
              </thead>
              <tbody>
                {kullanicilar.map((k) => (
                  <tr key={k.id} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2.5 pr-4 text-ink">{k.email}</td>
                    <td className="py-2.5 pr-4">
                      <input
                        type="text"
                        defaultValue={k.ad_soyad ?? ""}
                        placeholder="Ad Soyad"
                        onBlur={(e) => adKaydet(k, e.target.value)}
                        className="!w-40"
                      />
                    </td>
                    <td className="py-2.5 pr-4 text-ink-2">{formatTarih(k.created_at.slice(0, 10))}</td>
                    <td className="py-2.5 pr-4">
                      <RolRozeti rol={k.rol} />
                    </td>
                    <td className="py-2.5">
                      <select
                        value={k.rol}
                        onChange={(e) => rolDegistir(k, e.target.value as Rol)}
                        disabled={k.id === profil.id}
                        className="!w-40"
                        title={k.id === profil.id ? "Kendi rolünüzü değiştiremezsiniz" : undefined}
                      >
                        <option value="admin">Yönetici — tam yetki</option>
                        <option value="editor">Operasyon — giriş/çıkış</option>
                        <option value="viewer">Rapor — görüntüleme</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <BosDurum mesaj="Henüz kullanıcı yok." />
        )}
      </Card>

      <Card title="Rol Yetkileri" className="mt-6">
        <ul className="space-y-2 text-sm text-ink-2">
          <li>
            <b className="text-ink">Yönetici:</b> tüm yetkiler — kayıt silme, kullanıcı ve rol
            yönetimi dahil.
          </li>
          <li>
            <b className="text-ink">Operasyon:</b> stok girişi/çıkışı ekleme ve düzenleme, depo ve
            firma ekleme.
          </li>
          <li>
            <b className="text-ink">Rapor:</b> tüm sayfaları görüntüleme ve CSV rapor indirme;
            veri değiştiremez.
          </li>
        </ul>
      </Card>
    </div>
  );
}
