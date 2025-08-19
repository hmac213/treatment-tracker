-- Migration: Add category field to nodes and restructure data
-- This removes the intermediate category nodes and adds category labels directly to content nodes

-- Add category field to nodes table
ALTER TABLE public.nodes ADD COLUMN category text;

-- Create a check constraint for valid categories
ALTER TABLE public.nodes ADD CONSTRAINT nodes_category_check 
  CHECK (category IS NULL OR category IN ('skincare', 'nutrition', 'oral_care', 'pain'));

-- Update existing nodes with their categories based on current structure
-- First, let's categorize the content nodes based on their current relationships

-- Skincare category nodes
UPDATE public.nodes SET category = 'skincare' 
WHERE key IN ('silvadene', 'mepliex', 'calendula');

-- Nutrition category nodes  
UPDATE public.nodes SET category = 'nutrition'
WHERE key IN ('eat_any', 'liquid_diet', 'tube_feeding');

-- Oral care category nodes
UPDATE public.nodes SET category = 'oral_care'
WHERE key IN ('baking_mugard_2x', 'supportive', 'baking_mugard_4x', 'apply_mugard_spot');

-- Pain category nodes
UPDATE public.nodes SET category = 'pain'
WHERE key IN ('lidocaine', 'gabapentin', 'opioid', 'dox_morph');

-- Now we need to restructure the edges
-- First, identify the root nodes of each category (nodes that were connected to category nodes)
-- and connect them directly to the absolute root

-- Get the root node ID
DO $$
DECLARE
    root_node_id uuid;
    skincare_root_id uuid;
    nutrition_root_id uuid;
    oral_care_root_id uuid;
    pain_root_id uuid;
BEGIN
    -- Get the absolute root node ID
    SELECT id INTO root_node_id FROM public.nodes WHERE key = 'root';
    
    -- For skincare: calendula was the first node after the category
    SELECT id INTO skincare_root_id FROM public.nodes WHERE key = 'calendula';
    
    -- For nutrition: eat_any was the first node after the category
    SELECT id INTO nutrition_root_id FROM public.nodes WHERE key = 'eat_any';
    
    -- For oral care: baking_mugard_2x was the first node after the category
    SELECT id INTO oral_care_root_id FROM public.nodes WHERE key = 'baking_mugard_2x';
    
    -- For pain: lidocaine was the first node after the category
    SELECT id INTO pain_root_id FROM public.nodes WHERE key = 'lidocaine';
    
    -- Create direct edges from root to category root nodes
    INSERT INTO public.edges (parent_id, child_id, unlock_type) VALUES
        (root_node_id, skincare_root_id, 'always'),
        (root_node_id, nutrition_root_id, 'always'),
        (root_node_id, oral_care_root_id, 'always'),
        (root_node_id, pain_root_id, 'always')
    ON CONFLICT (parent_id, child_id) DO NOTHING;
END $$;

-- Remove edges that connected root to the old category nodes
DELETE FROM public.edges 
WHERE parent_id = (SELECT id FROM public.nodes WHERE key = 'root')
  AND child_id IN (
    SELECT id FROM public.nodes WHERE key IN ('skincare', 'nutrition', 'oral_care', 'pain')
  );

-- Remove edges that connected category nodes to their first content nodes
-- (these are now redundant since we connect root directly to content roots)
DELETE FROM public.edges 
WHERE parent_id IN (
    SELECT id FROM public.nodes WHERE key IN ('skincare', 'nutrition', 'oral_care', 'pain')
  );

-- Remove the old category nodes themselves
DELETE FROM public.nodes WHERE key IN ('skincare', 'nutrition', 'oral_care', 'pain');

-- Add missing calendula node (it was referenced in edges but not in the seed)
INSERT INTO public.nodes (key, title, summary, video_url, category, order_index) VALUES
('calendula', 'Calendula cream 2x daily', 'Basic skin protection and care.', 'https://example.com/video/calendula', 'skincare', 10)
ON CONFLICT (key) DO NOTHING;
