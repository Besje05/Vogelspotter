create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.bird_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  bird_id text not null,
  seen boolean not null default false,
  seen_date date,
  seen_time time,
  place text,
  note text,
  photo_path text,
  updated_at timestamptz not null default now(),
  primary key (user_id, bird_id)
);

alter table public.bird_records
add column if not exists photo_path text;

alter table public.bird_records
add column if not exists seen_time time;

create table if not exists public.bird_partners (
  owner_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, partner_id),
  check (owner_id <> partner_id)
);

alter table public.profiles enable row level security;
alter table public.bird_records enable row level security;
alter table public.bird_partners enable row level security;

drop policy if exists "profiles are visible to signed in users" on public.profiles;
create policy "profiles are visible to signed in users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "users and partners read bird records" on public.bird_records;
create policy "users and partners read bird records"
on public.bird_records for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.bird_partners p
    where
      (p.owner_id = auth.uid() and p.partner_id = bird_records.user_id)
      or (p.partner_id = auth.uid() and p.owner_id = bird_records.user_id)
  )
);

drop policy if exists "users insert their own bird records" on public.bird_records;
create policy "users insert their own bird records"
on public.bird_records for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users update their own bird records" on public.bird_records;
create policy "users update their own bird records"
on public.bird_records for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "partners can see their links" on public.bird_partners;
create policy "partners can see their links"
on public.bird_partners for select
to authenticated
using (owner_id = auth.uid() or partner_id = auth.uid());

drop policy if exists "users create their own partner links" on public.bird_partners;
create policy "users create their own partner links"
on public.bird_partners for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "users remove their own partner links" on public.bird_partners;
create policy "users remove their own partner links"
on public.bird_partners for delete
to authenticated
using (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bird-photos',
  'bird-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "users and partners read bird photos" on storage.objects;
create policy "users and partners read bird photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'bird-photos'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.bird_partners p
      where
        (p.owner_id = auth.uid() and p.partner_id::text = split_part(storage.objects.name, '/', 1))
        or (p.partner_id = auth.uid() and p.owner_id::text = split_part(storage.objects.name, '/', 1))
    )
  )
);

drop policy if exists "users upload their own bird photos" on storage.objects;
create policy "users upload their own bird photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'bird-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "users update their own bird photos" on storage.objects;
create policy "users update their own bird photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'bird-photos'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'bird-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "users delete their own bird photos" on storage.objects;
create policy "users delete their own bird photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'bird-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);
