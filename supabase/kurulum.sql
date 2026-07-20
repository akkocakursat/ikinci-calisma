-- ============================================================
-- İTHAL MISIR SEVKİYAT VE STOKLARI - VERİTABANI KURULUMU
-- Proje: https://mhqjrvghrhnyzuzeprpx.supabase.co ("ikinci-calisma")
--
-- NOT: Bu kurulum projeye migration olarak UYGULANDI (08.07.2026).
-- Dosya, yeniden kurulum gerekirse referans olarak saklanmaktadır:
-- Supabase Dashboard > SQL Editor'e yapıştırıp "Run" ile çalıştırın.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) KULLANICI PROFİLLERİ VE ROLLER
--    admin  = Yönetici  (her şey + kullanıcı yönetimi + silme)
--    editor = Operasyon (stok giriş/çıkış, depo ve firma ekleme)
--    viewer = Rapor     (görüntüleme + rapor indirme)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  ad_soyad text,
  rol text not null default 'viewer' check (rol in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

-- Yeni kullanıcı Supabase Auth'a eklendiğinde otomatik profil oluşturur.
-- İlk kayıt olan kullanıcı otomatik olarak Yönetici (admin) olur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, rol)
  values (
    new.id,
    new.email,
    case when not exists (select 1 from public.profiles) then 'admin' else 'viewer' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tetikleyici fonksiyonu API üzerinden (RPC) çağrılamasın
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Oturum açan kullanıcının rolünü döndüren yardımcı fonksiyon (RLS için).
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.profiles where id = auth.uid()
$$;

-- my_role RLS politikalarında authenticated rolüyle çalışır; anon için kapat
revoke execute on function public.my_role() from public, anon;

-- ------------------------------------------------------------
-- 2) DEPOLAR (depo adı + antrepo/lokasyon)
--    Aynı "ad" ile birden çok antrepo eklenebilir; arayüzde
--    tek başlık altında gruplanır.
-- ------------------------------------------------------------
create table if not exists public.depolar (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  antrepo text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ad, antrepo)
);

-- ------------------------------------------------------------
-- 3) FİRMALAR (sevkiyat yapılan alıcı firmalar)
-- ------------------------------------------------------------
create table if not exists public.firmalar (
  id uuid primary key default gen_random_uuid(),
  ad text not null unique,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4) STOK HAREKETLERİ (giriş = stok girişi, cikis = firmaya sevkiyat)
-- ------------------------------------------------------------
create table if not exists public.hareketler (
  id uuid primary key default gen_random_uuid(),
  depo_id uuid not null references public.depolar(id) on delete restrict,
  firma_id uuid references public.firmalar(id) on delete restrict,
  tip text not null check (tip in ('giris', 'cikis')),
  tonaj numeric(12,3) not null check (tonaj > 0),
  tarih date not null default current_date,
  gemi text, -- ürünün geldiği/ait olduğu gemi
  plaka text, -- araç plakası
  aciklama text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Çıkış hareketinde firma seçimi zorunludur
  constraint cikis_firma_gerekli check (tip = 'giris' or firma_id is not null)
);

create index if not exists hareketler_depo_idx on public.hareketler (depo_id);
create index if not exists hareketler_firma_idx on public.hareketler (firma_id);
create index if not exists hareketler_tarih_idx on public.hareketler (tarih);

-- ------------------------------------------------------------
-- 4b) SATIŞ SİPARİŞLERİ (firma + depo bazlı söz verilen tonaj)
-- ------------------------------------------------------------
create table if not exists public.siparisler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmalar(id) on delete restrict,
  depo_id uuid references public.depolar(id) on delete restrict, -- boş = genel sipariş
  miktar numeric(12,3) not null check (miktar > 0),
  tarih date not null default current_date,
  termin date, -- son teslim tarihi (uyarılar için)
  gemi text, -- satılan ürünün geldiği gemi
  aciklama text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists siparisler_firma_idx on public.siparisler (firma_id);
create index if not exists siparisler_depo_idx on public.siparisler (depo_id);

alter table public.siparisler enable row level security;

drop policy if exists "siparisler_select" on public.siparisler;
create policy "siparisler_select" on public.siparisler
  for select to authenticated using (true);

drop policy if exists "siparisler_insert" on public.siparisler;
create policy "siparisler_insert" on public.siparisler
  for insert to authenticated
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "siparisler_update" on public.siparisler;
create policy "siparisler_update" on public.siparisler
  for update to authenticated
  using (public.my_role() in ('admin', 'editor'))
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "siparisler_delete" on public.siparisler;
create policy "siparisler_delete" on public.siparisler
  for delete to authenticated
  using (public.my_role() = 'admin');

-- ------------------------------------------------------------
-- 5) ÖZET GÖRÜNÜMLER (raporlar için)
-- ------------------------------------------------------------
create or replace view public.depo_stok
with (security_invoker = on) as
select
  d.id as depo_id,
  d.ad,
  d.antrepo,
  d.aktif,
  coalesce(sum(h.tonaj) filter (where h.tip = 'giris'), 0) as toplam_giris,
  coalesce(sum(h.tonaj) filter (where h.tip = 'cikis'), 0) as toplam_cikis,
  coalesce(sum(case when h.tip = 'giris' then h.tonaj else -h.tonaj end), 0) as kalan_stok,
  string_agg(distinct h.gemi, ', ') filter (where h.tip = 'giris' and h.gemi is not null) as gemiler
from public.depolar d
left join public.hareketler h on h.depo_id = d.id
group by d.id;

create or replace view public.depo_gemi_stok
with (security_invoker = on) as
select
  h.depo_id,
  coalesce(h.gemi, 'GEMİ BELİRTİLMEMİŞ') as gemi,
  coalesce(sum(h.tonaj) filter (where h.tip = 'giris'), 0) as giris,
  count(*) filter (where h.tip = 'giris') as giris_sayisi,
  coalesce(sum(h.tonaj) filter (where h.tip = 'cikis'), 0) as cikis,
  coalesce(sum(case when h.tip = 'giris' then h.tonaj else -h.tonaj end), 0) as kalan
from public.hareketler h
group by h.depo_id, coalesce(h.gemi, 'GEMİ BELİRTİLMEMİŞ');

create or replace view public.firma_depo_ozet
with (security_invoker = on) as
select
  f.id as firma_id,
  f.ad as firma,
  d.id as depo_id,
  d.ad as depo,
  d.antrepo,
  sum(h.tonaj) as toplam_tonaj,
  count(*) as sevkiyat_sayisi
from public.hareketler h
join public.firmalar f on f.id = h.firma_id
join public.depolar d on d.id = h.depo_id
where h.tip = 'cikis'
group by f.id, d.id;

-- ------------------------------------------------------------
-- 6) SATIR BAZLI GÜVENLİK (RLS)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.depolar enable row level security;
alter table public.firmalar enable row level security;
alter table public.hareketler enable row level security;

-- Profiller: giriş yapan herkes okuyabilir, sadece admin rol değiştirebilir
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- Depolar: herkes okur; admin + editor ekler/düzenler; admin siler
drop policy if exists "depolar_select" on public.depolar;
create policy "depolar_select" on public.depolar
  for select to authenticated using (true);

drop policy if exists "depolar_insert" on public.depolar;
create policy "depolar_insert" on public.depolar
  for insert to authenticated
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "depolar_update" on public.depolar;
create policy "depolar_update" on public.depolar
  for update to authenticated
  using (public.my_role() in ('admin', 'editor'))
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "depolar_delete" on public.depolar;
create policy "depolar_delete" on public.depolar
  for delete to authenticated
  using (public.my_role() = 'admin');

-- Firmalar: herkes okur; admin + editor ekler/düzenler; admin siler
drop policy if exists "firmalar_select" on public.firmalar;
create policy "firmalar_select" on public.firmalar
  for select to authenticated using (true);

drop policy if exists "firmalar_insert" on public.firmalar;
create policy "firmalar_insert" on public.firmalar
  for insert to authenticated
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "firmalar_update" on public.firmalar;
create policy "firmalar_update" on public.firmalar
  for update to authenticated
  using (public.my_role() in ('admin', 'editor'))
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "firmalar_delete" on public.firmalar;
create policy "firmalar_delete" on public.firmalar
  for delete to authenticated
  using (public.my_role() = 'admin');

-- Hareketler: herkes okur; admin + editor ekler/düzenler; admin siler
drop policy if exists "hareketler_select" on public.hareketler;
create policy "hareketler_select" on public.hareketler
  for select to authenticated using (true);

drop policy if exists "hareketler_insert" on public.hareketler;
create policy "hareketler_insert" on public.hareketler
  for insert to authenticated
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "hareketler_update" on public.hareketler;
create policy "hareketler_update" on public.hareketler
  for update to authenticated
  using (public.my_role() in ('admin', 'editor'))
  with check (public.my_role() in ('admin', 'editor'));

drop policy if exists "hareketler_delete" on public.hareketler;
create policy "hareketler_delete" on public.hareketler
  for delete to authenticated
  using (public.my_role() = 'admin');

-- ------------------------------------------------------------
-- 7) DEPOLAR
-- ------------------------------------------------------------
-- Depolar hazır liste ile OLUŞTURULMAZ; kullanıcı sitedeki
-- "Depolar > Yeni Depo / Antrepo" ekranından kendisi ekler.

-- ------------------------------------------------------------
-- 8) İŞLEM GEÇMİŞİ (denetim kaydı)
--    Tüm ekleme/güncelleme/silme işlemleri tetikleyiciyle
--    otomatik loglanır; loglar değiştirilemez/silinemez.
--    (Canlı projeye "islem_gecmisi" migration'ı ile uygulandı;
--    yeniden kurulumda o migration içeriği de çalıştırılmalıdır.)
-- ------------------------------------------------------------

-- KURULUM TAMAM ✔
-- Sıradaki adım: Supabase Dashboard > Authentication > Users >
-- "Add user" ile kullanıcıları e-posta + şifre ile ekleyin.
-- İlk eklenen kullanıcı otomatik YÖNETİCİ olur; diğerlerinin
-- rolünü sitedeki "Kullanıcılar" sayfasından değiştirebilirsiniz.
