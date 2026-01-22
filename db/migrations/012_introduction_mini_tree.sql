-- Migration: Add introduction mini tree nodes
-- This allows nodes in the introduction bonus content popup to be managed

-- Create introduction_tree_nodes table
create table if not exists public.introduction_tree_nodes (
  id uuid primary key default gen_random_uuid(),
  node_key text not null unique, -- e.g., 'logistics', 'treatment_plan', etc.
  title text not null,
  pos_x numeric not null default 0,
  pos_y numeric not null default 0,
  width numeric not null default 10,
  height numeric not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create introduction_tree_node_videos table
create table if not exists public.introduction_tree_node_videos (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.introduction_tree_nodes(id) on delete cascade,
  video_url text not null,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_introduction_tree_node_videos_node_id on public.introduction_tree_node_videos(node_id);
create index if not exists idx_introduction_tree_node_videos_order on public.introduction_tree_node_videos(node_id, order_index);

create trigger trg_introduction_tree_nodes_updated_at
before update on public.introduction_tree_nodes
for each row execute procedure set_updated_at();

create trigger trg_introduction_tree_node_videos_updated_at
before update on public.introduction_tree_node_videos
for each row execute procedure set_updated_at();

-- Grant permissions
alter table public.introduction_tree_nodes enable row level security;
grant all on public.introduction_tree_nodes to authenticated;
grant all on public.introduction_tree_nodes to service_role;

alter table public.introduction_tree_node_videos enable row level security;
grant all on public.introduction_tree_node_videos to authenticated;
grant all on public.introduction_tree_node_videos to service_role;
