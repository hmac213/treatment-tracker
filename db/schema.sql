-- Enable required extensions (available by default in Supabase)
create extension if not exists pgcrypto;

-- Utility: auto-update updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

-- Content nodes (video + summary)
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  summary text,
  video_url text,
  is_root boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_nodes_updated_at
before update on public.nodes
for each row execute procedure set_updated_at();

-- Directed edges defining the decision tree
create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.nodes(id) on delete cascade,
  child_id uuid not null references public.nodes(id) on delete cascade,
  unlock_type text not null check (unlock_type in ('always','manual','symptom_match')),
  unlock_value jsonb,
  created_at timestamptz not null default now(),
  unique (parent_id, child_id)
);

create index if not exists idx_edges_parent on public.edges(parent_id);
create index if not exists idx_edges_child on public.edges(child_id);

-- Symptom catalog (optional but recommended for consistency)
create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text
);

-- Per-user unlocked nodes (progress state)
create table if not exists public.user_unlocked_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  node_id uuid not null references public.nodes(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unlocked_by text not null check (unlocked_by in ('user','admin','system')),
  source text,
  unique (user_id, node_id)
);

create index if not exists idx_user_unlocked_user on public.user_unlocked_nodes(user_id);
create index if not exists idx_user_unlocked_node on public.user_unlocked_nodes(node_id);

-- Event log (analytics/audit)
create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_events_user on public.user_events(user_id);
create index if not exists idx_user_events_type on public.user_events(type); 