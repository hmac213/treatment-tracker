-- Add admin fields to users
alter table public.users add column if not exists is_admin boolean not null default false;
alter table public.users add column if not exists password_hash text;

-- Ensure pgcrypto is available
create extension if not exists pgcrypto;

-- Upsert admin user with bcrypt hash (compatible with pgcrypto 'bf')
insert into public.users (email, name, is_admin, password_hash)
values (
  'admin@example.org',
  'Admin',
  true,
  crypt('admin', gen_salt('bf'))
)
on conflict (email) do update set
  name = excluded.name,
  is_admin = true,
  password_hash = crypt('admin', gen_salt('bf')); 