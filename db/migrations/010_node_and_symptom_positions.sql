-- Migration: Add support for storing node box dimensions and symptom diamond positions
-- This allows editing positions and sizes of all interactive elements

-- Add width and height columns to nodes for box dimensions
alter table public.nodes add column if not exists box_width double precision;
alter table public.nodes add column if not exists box_height double precision;

-- Create table for symptom diamond positions
create table if not exists public.symptom_positions (
  id uuid primary key default gen_random_uuid(),
  position_key text not null unique, -- e.g., 'calendula_silvadene' or 'dox_morph_branch'
  pos_x numeric not null,
  pos_y numeric not null,
  width numeric not null,
  height numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_symptom_positions_key on public.symptom_positions(position_key);

create trigger trg_symptom_positions_updated_at
before update on public.symptom_positions
for each row execute procedure set_updated_at();

-- Grant permissions
alter table public.symptom_positions enable row level security;
grant all on public.symptom_positions to authenticated;
grant all on public.symptom_positions to service_role;
