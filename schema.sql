-- Jalankan di Supabase SQL Editor.
-- Semua tabel memiliki user_id dan RLS agar setiap pengguna hanya melihat datanya sendiri.

create extension if not exists pgcrypto;

create table if not exists public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_salt text,
  pin_hash text,
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount bigint not null check (amount > 0),
  category text not null default 'Umum',
  transaction_date date not null default current_date,
  note text,
  receipt_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  event_date date not null default current_date,
  entry_fee bigint not null default 0 check (entry_fee >= 0),
  prize_received bigint not null default 0 check (prize_received >= 0),
  result text not null default 'pending' check (result in ('pending','win','lose','draw')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.match_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null,
  opponent_note text,
  match_date date not null default current_date,
  result text not null default 'pending' check (result in ('pending','win','lose','draw')),
  actual_expense bigint not null default 0 check (actual_expense >= 0),
  note text,
  created_at timestamptz not null default now()
);

alter table public.app_profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.tournaments enable row level security;
alter table public.match_notes enable row level security;

drop policy if exists "profile own select" on public.app_profiles;
create policy "profile own select" on public.app_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "profile own insert" on public.app_profiles;
create policy "profile own insert" on public.app_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "profile own update" on public.app_profiles;
create policy "profile own update" on public.app_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions own access" on public.transactions;
create policy "transactions own access" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tournaments own access" on public.tournaments;
create policy "tournaments own access" on public.tournaments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "matches own access" on public.match_notes;
create policy "matches own access" on public.match_notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bucket privat untuk bukti transaksi (maksimum 5 MB per gambar).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts','receipts',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "receipt own read" on storage.objects;
create policy "receipt own read" on storage.objects for select to authenticated
using (bucket_id='receipts' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "receipt own insert" on storage.objects;
create policy "receipt own insert" on storage.objects for insert to authenticated
with check (bucket_id='receipts' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "receipt own update" on storage.objects;
create policy "receipt own update" on storage.objects for update to authenticated
using (bucket_id='receipts' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='receipts' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "receipt own delete" on storage.objects;
create policy "receipt own delete" on storage.objects for delete to authenticated
using (bucket_id='receipts' and (storage.foldername(name))[1]=auth.uid()::text);

create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index if not exists tournaments_user_date_idx on public.tournaments(user_id, event_date desc);
create index if not exists matches_user_date_idx on public.match_notes(user_id, match_date desc);
