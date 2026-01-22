-- Migration: Add bonus content videos support
-- This allows bonus videos to be associated with categories (skincare, nutrition, oral_care, introduction)
-- Note: No bonus content for pain category

-- Create bonus_content_videos table
create table if not exists public.bonus_content_videos (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('skincare', 'nutrition', 'oral_care', 'introduction')),
  video_url text not null,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, order_index)
);

create index if not exists idx_bonus_content_videos_category on public.bonus_content_videos(category);

create trigger trg_bonus_content_videos_updated_at
before update on public.bonus_content_videos
for each row execute procedure set_updated_at();

-- Create bonus_content_positions table to store clickable box positions
create table if not exists public.bonus_content_positions (
  category text primary key check (category in ('skincare', 'nutrition', 'oral_care', 'introduction')),
  pos_x numeric not null,
  pos_y numeric not null,
  width numeric not null,
  height numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_bonus_content_positions_updated_at
before update on public.bonus_content_positions
for each row execute procedure set_updated_at();

-- Grant permissions
alter table public.bonus_content_videos enable row level security;
grant all on public.bonus_content_videos to authenticated;
grant all on public.bonus_content_videos to service_role;

alter table public.bonus_content_positions enable row level security;
grant all on public.bonus_content_positions to authenticated;
grant all on public.bonus_content_positions to service_role;
