-- =====================================================================
-- Car Preview - complete Supabase migration
-- Run this ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cars (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 120),
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
                check (slug not in ('admin','api','login','logout','assets','static','public','favicon','og','robots','sitemap','auth','app','new','edit','cars','dashboard','404')),
  description   text,
  cover_file_id uuid,
  is_published  boolean not null default true,
  expires_at    timestamptz,                       -- NULL = never expires
  view_count    bigint not null default 0,
  total_bytes   bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

create table if not exists public.car_files (
  id         uuid primary key default gen_random_uuid(),
  car_id     uuid not null,
  path       text not null,
  thumb_path text,
  name       text not null,
  mime       text not null default 'application/octet-stream',
  size       bigint not null default 0,
  sort_order integer not null default 0,
  is_image   boolean not null default false,
  constraint car_files_car_id_fkey foreign key (car_id) references public.cars(id) on delete cascade
);

-- cover image pointer (added after car_files exists to avoid a circular create)
do $$ begin
  alter table public.cars
    add constraint cars_cover_file_fk foreign key (cover_file_id)
    references public.car_files(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.slug_history (
  old_slug text primary key,
  car_id   uuid not null references public.cars(id) on delete cascade
);

create table if not exists public.deletion_log (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  slug        text,
  file_count  integer not null default 0,
  bytes_freed bigint not null default 0,
  deleted_at  timestamptz not null default now()
);

-- ---------- Indexes ----------
create index if not exists idx_cars_expires_at   on public.cars (expires_at) where expires_at is not null;
create index if not exists idx_cars_created_at   on public.cars (created_at desc);
create index if not exists idx_car_files_car     on public.car_files (car_id, sort_order);
create index if not exists idx_slug_history_car  on public.slug_history (car_id);

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_cars_touch on public.cars;
create trigger trg_cars_touch before update on public.cars
for each row execute function public.touch_updated_at();

-- ---------- Helper: is the current user an admin? ----------
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Row Level Security ----------
alter table public.admins       enable row level security;
alter table public.cars         enable row level security;
alter table public.car_files    enable row level security;
alter table public.slug_history enable row level security;
alter table public.deletion_log enable row level security;

-- admins: you can see your own row (login check); admins see everyone.
-- Writes happen ONLY from serverless functions (service role bypasses RLS).
drop policy if exists "admins read" on public.admins;
create policy "admins read" on public.admins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- cars
drop policy if exists "cars public read" on public.cars;
create policy "cars public read" on public.cars for select to anon, authenticated
  using (is_published and (expires_at is null or expires_at > now()));
drop policy if exists "cars admin all" on public.cars;
create policy "cars admin all" on public.cars for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- car_files
drop policy if exists "car_files public read" on public.car_files;
create policy "car_files public read" on public.car_files for select to anon, authenticated
  using (exists (
    select 1 from public.cars c
    where c.id = car_files.car_id and c.is_published and (c.expires_at is null or c.expires_at > now())
  ));
drop policy if exists "car_files admin all" on public.car_files;
create policy "car_files admin all" on public.car_files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- slug_history + deletion_log: admin only
drop policy if exists "slug_history admin all" on public.slug_history;
create policy "slug_history admin all" on public.slug_history for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "deletion_log admin all" on public.deletion_log;
create policy "deletion_log admin all" on public.deletion_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Public page RPC ----------
-- One call returns status + car + files, and lets us tell "hidden" / "expired" /
-- "not found" apart without exposing hidden or expired data to the public.
create or replace function public.get_public_car(p_slug text) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare c public.cars;
begin
  select * into c from public.cars where slug = lower(p_slug);
  if not found then
    select cars.* into c from public.slug_history h
      join public.cars on cars.id = h.car_id where h.old_slug = lower(p_slug);
    if not found then return jsonb_build_object('status', 'not_found'); end if;
    return jsonb_build_object('status', 'redirect', 'redirect_slug', c.slug);
  end if;
  if not c.is_published then return jsonb_build_object('status', 'hidden'); end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'car', jsonb_build_object(
      'id', c.id, 'title', c.title, 'slug', c.slug, 'description', c.description,
      'cover_file_id', c.cover_file_id, 'expires_at', c.expires_at, 'created_at', c.created_at),
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'path', f.path, 'thumb_path', f.thumb_path, 'name', f.name,
        'mime', f.mime, 'size', f.size, 'is_image', f.is_image, 'sort_order', f.sort_order)
        order by f.sort_order)
      from public.car_files f where f.car_id = c.id), '[]'::jsonb)
  );
end $$;
grant execute on function public.get_public_car(text) to anon, authenticated;

-- ---------- View counter RPC (admin views are ignored) ----------
create or replace function public.increment_view(p_slug text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return; end if;
  update public.cars set view_count = view_count + 1
  where slug = lower(p_slug) and is_published and (expires_at is null or expires_at > now());
end $$;
grant execute on function public.increment_view(text) to anon, authenticated;

-- ---------- Total storage used (bytes) - admins only ----------
create or replace function public.storage_usage() returns bigint
language plpgsql security definer stable set search_path = public, storage as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'car-files'), 0);
end $$;
revoke all on function public.storage_usage() from public;
grant execute on function public.storage_usage() to authenticated;

-- ---------- Storage bucket + policies ----------
-- Public bucket = anyone with a file URL can read it (needed for public car pages).
insert into storage.buckets (id, name, public)
values ('car-files', 'car-files', true)
on conflict (id) do update set public = true;

drop policy if exists "car-files admin select" on storage.objects;
create policy "car-files admin select" on storage.objects for select to authenticated
  using (bucket_id = 'car-files' and public.is_admin());
drop policy if exists "car-files admin insert" on storage.objects;
create policy "car-files admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'car-files' and public.is_admin());
drop policy if exists "car-files admin update" on storage.objects;
create policy "car-files admin update" on storage.objects for update to authenticated
  using (bucket_id = 'car-files' and public.is_admin())
  with check (bucket_id = 'car-files' and public.is_admin());
drop policy if exists "car-files admin delete" on storage.objects;
create policy "car-files admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'car-files' and public.is_admin());

-- =====================================================================
-- DONE. Next: create the first admin (see supabase/seed_first_admin.sql)
-- =====================================================================
