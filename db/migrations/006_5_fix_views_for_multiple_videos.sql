-- To properly update the views, we must drop dependent views first,
-- then recreate them in the correct order.

-- 1. Drop the top-level view first
DROP VIEW IF EXISTS public.tree_structure_view;

-- 2. Drop the base view that needs to be changed
DROP VIEW IF EXISTS public.node_categories_view;

-- 3. Recreate the base view ('node_categories_view') without the 'video_url' column
CREATE VIEW public.node_categories_view AS
SELECT 
  n.id,
  n.key,
  n.title,
  n.summary,
  n.is_root,
  n.order_index,
  n.created_at,
  n.updated_at,
  ARRAY_AGG(nc.category ORDER BY nc.category) FILTER (WHERE nc.category IS NOT NULL) as categories
FROM public.nodes n
LEFT JOIN public.node_categories nc ON n.id = nc.node_id
GROUP BY n.id;

-- 4. Recreate the dependent view ('tree_structure_view')
CREATE VIEW public.tree_structure_view AS
SELECT 
  e.id as edge_id,
  e.parent_id,
  e.child_id,
  e.unlock_type,
  e.unlock_value,
  e.description as edge_description,
  e.weight,
  p.key as parent_key,
  p.title as parent_title,
  c.key as child_key,
  c.title as child_title,
  p.categories as parent_categories,
  c.categories as child_categories
FROM public.edges e
JOIN public.node_categories_view p ON e.parent_id = p.id
JOIN public.node_categories_view c ON e.child_id = c.id
ORDER BY e.weight DESC, e.created_at;
