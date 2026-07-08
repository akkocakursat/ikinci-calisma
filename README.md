# İthal Mısır Sevkiyat ve Stokları

Depo bazlı ithal mısır stok ve sevkiyat takip sistemi. Next.js + Supabase + Recharts ile
hazırlanmıştır; Vercel üzerinde yayınlanmak üzere tasarlanmıştır.

**Bağlı veritabanı:** `https://enqxvjsqjmbjkcivudbe.supabase.co`

## Özellikler

- **Genel Bakış:** kalan toplam stok, toplam giriş/çıkış kartları; depo bazlı kalan stok,
  son 30 gün günlük sevkiyat trendi ve en çok ürün alan firmalar grafikleri; son hareketler.
- **Stok Hareketleri:** stok girişi ve firmaya sevkiyat (çıkış) kaydı; depo / firma / tip /
  tarih aralığı filtreleri; filtrelenmiş listeyi CSV indirme; sevkiyat eklerken yeni firma ekleme.
- **Depolar:** giriş, çıkış, kalan stok ve doluluk oranı ile depo listesi; yeni depo ekleme,
  düzenleme, pasife alma; genel toplam satırı.
- **Firmalar:** firma bazlı toplam tonaj, sevkiyat sayısı ve çalıştığı depo sayısı.
- **Raporlar:** Firma × Depo pivot tablosu (hangi firma hangi depodan ne kadar aldı —
  satır/sütun alt toplamları ve genel toplam), depo bazlı giriş/çıkış grafiği, depo stok
  özeti; hepsi Türkçe Excel uyumlu CSV olarak indirilebilir.
- **Kullanıcılar (yalnızca Yönetici):** rol atama — Yönetici / Operasyon / Rapor.

## Roller

| Rol | Yetkiler |
| --- | --- |
| **Yönetici** (`admin`) | Tüm yetkiler: kayıt silme, kullanıcı ve rol yönetimi dahil |
| **Operasyon** (`editor`) | Stok girişi/çıkışı ekleme-düzenleme, depo ve firma ekleme |
| **Rapor** (`viewer`) | Tüm sayfaları görüntüleme ve CSV rapor indirme |

Yetkiler yalnızca arayüzde değil, veritabanında satır bazlı güvenlik (RLS) ile de uygulanır.

## Kurulum — 3 adım

### 1. Veritabanını kurun

[Supabase Dashboard](https://supabase.com/dashboard) → `enqxvjsqjmbjkcivudbe` projesi →
**SQL Editor** → `supabase/kurulum.sql` dosyasının tamamını yapıştırıp **Run** deyin.
Bu işlem tabloları, güvenlik kurallarını ve 21 deponun kaydını oluşturur.

### 2. Kullanıcıları ekleyin

Dashboard → **Authentication → Users → Add user** ile 5-6 kullanıcıyı e-posta + şifre ile
ekleyin. **İlk eklenen kullanıcı otomatik Yönetici olur.** Diğerlerinin rollerini sitedeki
**Kullanıcılar** sayfasından ayarlarsınız.

### 3. Vercel'de yayınlayın

1. Bu depoyu GitHub'a gönderin (push).
2. [Vercel](https://vercel.com) → **New Project** → bu depoyu içe aktarın.
3. **Environment Variables** bölümüne şunları girin
   (Dashboard → Project Settings → API sayfasından):

   | Değişken | Değer |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://enqxvjsqjmbjkcivudbe.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | projenin **anon public** anahtarı |

4. **Deploy** deyin.

## Yerel geliştirme

```bash
cp .env.example .env.local   # anon key değerini doldurun
npm install
npm run dev                  # http://localhost:3000
```

## Teknik yapı

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS**
- **Supabase:** Auth (e-posta/şifre), Postgres, RLS; `depo_stok` ve `firma_depo_ozet` özet
  görünümleri
- **Recharts:** grafikler
- Oturum kontrolü `src/middleware.ts` içinde; giriş yapmayan kullanıcı `/login`e yönlenir.
