-- Change these values
-- (you can also run multiple times; it's idempotent)
-- Email must already be unique in public.users
-- The script will upsert the user, clear their unlocks, then unlock only the root node.
-- ------------------------------------------------------------------------------

-- 1) Create or update the test user
insert into public.users (email, name)
values ('testuser@example.org', 'Test User')
on conflict (email) do update
set name = excluded.name;

-- 2) Remove any existing unlocks for this user
delete from public.user_unlocked_nodes
where user_id = (select id from public.users where email = 'testuser@example.org');

-- 3) Unlock only the root node for this user
insert into public.user_unlocked_nodes (user_id, node_id, unlocked_by, source)
select u.id,
       (select id from public.nodes where is_root = true order by created_at asc limit 1) as node_id,
       'system' as unlocked_by,
       'default' as source
from public.users u
where u.email = 'testuser@example.org'
on conflict (user_id, node_id) do nothing;

-- 4) Show result
select u.id as user_id, u.email, n.id as node_id, n.title as node_title
from public.users u
join public.user_unlocked_nodes un on un.user_id = u.id
join public.nodes n on n.id = un.node_id
where u.email = 'testuser@example.org';