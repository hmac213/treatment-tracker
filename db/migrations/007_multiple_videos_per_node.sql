-- 1. Create the new node_videos table
create table if not exists public.node_videos (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(id) on delete cascade,
  video_url text not null,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_node_videos_node_id on public.node_videos(node_id);

create trigger trg_node_videos_updated_at
before update on public.node_videos
for each row execute procedure set_updated_at();

-- 2. Move existing data from nodes.video_url to node_videos
insert into public.node_videos (node_id, video_url, title, order_index)
select id, video_url, title, 0
from public.nodes
where video_url is not null and video_url != '';

-- 3. Remove the old video_url column from the nodes table
alter table public.nodes
drop column if exists video_url;

