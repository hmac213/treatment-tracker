-- Test script to create a completely fresh user with no unlocks
-- This will help verify the auto-unlock system works correctly

-- 1) Create a fresh test user
insert into public.users (email, name)
values ('fresh@example.org', 'Fresh User')
on conflict (email) do update
set name = excluded.name;

-- 2) Remove any existing unlocks for this user (start completely fresh)
delete from public.user_unlocked_nodes
where user_id = (select id from public.users where email = 'fresh@example.org');

-- 3) Show that the user has NO unlocks initially
select 
  u.id as user_id, 
  u.email,
  count(un.node_id) as unlocked_count
from public.users u
left join public.user_unlocked_nodes un on un.user_id = u.id
where u.email = 'fresh@example.org'
group by u.id, u.email;

-- 4) Show what nodes SHOULD be auto-unlocked (root + all 'always' edges)
-- This is what we expect the auto-unlock system to create

-- Root node
select 'ROOT' as type, n.key, n.title
from public.nodes n
where n.is_root = true;

-- All nodes reachable via 'always' edges from root
with recursive reachable as (
  -- Start with root
  select n.id, n.key, n.title, 0 as level
  from public.nodes n
  where n.is_root = true
  
  union all
  
  -- Add children via 'always' edges
  select child.id, child.key, child.title, r.level + 1
  from reachable r
  join public.edges e on e.parent_id = r.id and e.unlock_type = 'always'
  join public.nodes child on child.id = e.child_id
  where r.level < 10  -- prevent infinite recursion
)
select 'ALWAYS' as type, key, title, level
from reachable
where level > 0
order by level, key;
