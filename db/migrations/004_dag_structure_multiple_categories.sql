-- Migration: Support true DAG structure with multiple categories per node
-- This enables nodes to belong to multiple treatment categories and allows complex parent-child relationships

-- Create junction table for node-category relationships (many-to-many)
CREATE TABLE IF NOT EXISTS public.node_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('skincare', 'nutrition', 'oral_care', 'pain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, category)
);

CREATE INDEX IF NOT EXISTS idx_node_categories_node ON public.node_categories(node_id);
CREATE INDEX IF NOT EXISTS idx_node_categories_category ON public.node_categories(category);

-- Migrate existing category data from nodes table to junction table
INSERT INTO public.node_categories (node_id, category)
SELECT id, category 
FROM public.nodes 
WHERE category IS NOT NULL;

-- Remove the single category column from nodes table (now handled by junction table)
ALTER TABLE public.nodes DROP COLUMN IF EXISTS category;

-- Remove the category check constraint since we're using the junction table
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_category_check;

-- Add description field to edges for better admin experience
ALTER TABLE public.edges ADD COLUMN IF NOT EXISTS description text;

-- Add weight/priority field to edges for ordering multiple paths
ALTER TABLE public.edges ADD COLUMN IF NOT EXISTS weight integer DEFAULT 0;

-- Create index for edge weight ordering
CREATE INDEX IF NOT EXISTS idx_edges_weight ON public.edges(weight DESC);

-- Update the unique constraint to allow multiple edges between same nodes 
-- (needed for DAG where different paths can connect same nodes)
-- First drop the existing constraint
ALTER TABLE public.edges DROP CONSTRAINT IF EXISTS edges_parent_id_child_id_key;

-- Add a new constraint that includes unlock_type to allow multiple relationship types
ALTER TABLE public.edges ADD CONSTRAINT edges_unique_path 
  UNIQUE (parent_id, child_id, unlock_type);

-- Create view for easy category querying
CREATE OR REPLACE VIEW public.node_categories_view AS
SELECT 
  n.id,
  n.key,
  n.title,
  n.summary,
  n.video_url,
  n.is_root,
  n.order_index,
  n.created_at,
  n.updated_at,
  ARRAY_AGG(nc.category ORDER BY nc.category) FILTER (WHERE nc.category IS NOT NULL) as categories
FROM public.nodes n
LEFT JOIN public.node_categories nc ON n.id = nc.node_id
GROUP BY n.id, n.key, n.title, n.summary, n.video_url, n.is_root, n.order_index, n.created_at, n.updated_at;

-- Create view for full tree structure with categories
CREATE OR REPLACE VIEW public.tree_structure_view AS
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
  pc.categories as parent_categories,
  cc.categories as child_categories
FROM public.edges e
JOIN public.node_categories_view p ON e.parent_id = p.id
JOIN public.node_categories_view c ON e.child_id = c.id
LEFT JOIN public.node_categories_view pc ON e.parent_id = pc.id
LEFT JOIN public.node_categories_view cc ON e.child_id = cc.id
ORDER BY e.weight DESC, e.created_at;

-- Grant permissions for new tables and views
ALTER TABLE public.node_categories ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.node_categories TO authenticated;
GRANT ALL ON public.node_categories TO service_role;

GRANT SELECT ON public.node_categories_view TO authenticated;
GRANT SELECT ON public.node_categories_view TO service_role;

GRANT SELECT ON public.tree_structure_view TO authenticated;
GRANT SELECT ON public.tree_structure_view TO service_role;
