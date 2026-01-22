-- Migration: Add category videos support
-- This allows videos to be associated with category labels (skincare, nutrition, oral_care, pain)
-- These are separate from node videos and are always visible

-- Create category_videos table
create table if not exists public.category_videos (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('skincare', 'nutrition', 'oral_care', 'pain')),
  video_url text not null,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, order_index)
);

create index if not exists idx_category_videos_category on public.category_videos(category);

create trigger trg_category_videos_updated_at
before update on public.category_videos
for each row execute procedure set_updated_at();

-- Create category_positions table to store clickable box positions for category labels
create table if not exists public.category_positions (
  category text primary key check (category in ('skincare', 'nutrition', 'oral_care', 'pain')),
  pos_x numeric not null,
  pos_y numeric not null,
  width numeric not null,
  height numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_category_positions_updated_at
before update on public.category_positions
for each row execute procedure set_updated_at();

-- Grant permissions
alter table public.category_videos enable row level security;
grant all on public.category_videos to authenticated;
grant all on public.category_videos to service_role;

alter table public.category_positions enable row level security;
grant all on public.category_positions to authenticated;
grant all on public.category_positions to service_role;
