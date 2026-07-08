-- ============================================================
-- İTHAL MISIR SEVKİYAT VE STOKLARI - VERİTABANI KURULUMU
-- Proje: https://enqxvjsqjmbjkcivudbe.supabase.co
--
-- Bu dosyanın TAMAMINI Supabase Dashboard > SQL Editor'e
-- yapıştırıp "Run" ile bir kez çalıştırın.
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

-- ------------------------------------------------------------
-- 2) DEPOLAR (depo adı + gemi)
-- ------------------------------------------------------------
create table if not exists public.depolar (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  gemi text,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ad, gemi)
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
-- 5) ÖZET GÖRÜNÜMLER (raporlar için)
-- ------------------------------------------------------------
create or replace view public.depo_stok
with (security_invoker = on) as
select
  d.id as depo_id,
  d.ad,
  d.gemi,
  d.aktif,
  coalesce(sum(h.tonaj) filter (where h.tip = 'giris'), 0) as toplam_giris,
  coalesce(sum(h.tonaj) filter (where h.tip = 'cikis'), 0) as toplam_cikis,
  coalesce(sum(case when h.tip = 'giris' then h.tonaj else -h.tonaj end), 0) as kalan_stok
from public.depolar d
left join public.hareketler h on h.depo_id = d.id
group by d.id;

create or replace view public.firma_depo_ozet
with (security_invoker = on) as
select
  f.id as firma_id,
  f.ad as firma,
  d.id as depo_id,
  d.ad as depo,
  d.gemi,
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
-- 7) MEVCUT DEPOLARIN KAYDI
-- ------------------------------------------------------------
insert into public.depolar (ad, gemi) values
  ('TOROS',       'NEW SHAIM'),
  ('ZMA',         'LADY SHUA'),
  ('SANKO',       'MOAYAD Y'),
  ('DÖNMEZOĞLU',  'MİLAS-SİNCAN'),
  ('DÖNMEZOĞLU',  'MİLAS-ÖZERLİ'),
  ('DÖNMEZOĞLU',  'MİLAS-AKÇAY'),
  ('DÖNMEZOĞLU',  'MİLAS-DÖRTYOL'),
  ('DÖNMEZOĞLU',  'PRİNCE FAORUK'),
  ('KARCAN',      'SMS PANAMERA'),
  ('TATLOG',      'SMS PANAMERA'),
  ('GÜLTEKİN',    'SMS PANAMERA'),
  ('BANMAR',      'MUSTAFA BEY'),
  ('KARASU',      'BJ EXPRESS'),
  ('BATIÇİM',     'SCOTLAND'),
  ('TOSYALI',     'AL KARRAR'),
  ('SERTEL',      'SCOTLAND'),
  ('TİRYAKİ',     'AL KARRAR'),
  ('TATLOG',      'MV RİZE'),
  ('KIZILOVA',    'SABEEL STAR'),
  ('SOYLU',       'SABEEL STAR'),
  ('DÖNMEZOĞLU',  'SABEEL STAR')
on conflict (ad, gemi) do nothing;

-- KURULUM TAMAM ✔
-- Sıradaki adım: Supabase Dashboard > Authentication > Users >
-- "Add user" ile kullanıcıları e-posta + şifre ile ekleyin.
-- İlk eklenen kullanıcı otomatik YÖNETİCİ olur; diğerlerinin
-- rolünü sitedeki "Kullanıcılar" sayfasından değiştirebilirsiniz.
