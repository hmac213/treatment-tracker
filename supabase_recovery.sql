-- SUPABASE DATA RECOVERY SCRIPT
-- Run this in your Supabase SQL Editor to restore all data

BEGIN;

-- First ensure the schema is correct (from migration 004)
-- Create node_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.node_categories (
    node_id uuid REFERENCES public.nodes(id) ON DELETE CASCADE,
    category text NOT NULL,
    PRIMARY KEY (node_id, category)
);

-- Add missing columns to edges table if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'description') THEN
        ALTER TABLE public.edges ADD COLUMN description text;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'weight') THEN
        ALTER TABLE public.edges ADD COLUMN weight integer DEFAULT 0;
    END IF;
END $$;

-- Update edges unique constraint to allow multiple unlock types
ALTER TABLE public.edges DROP CONSTRAINT IF EXISTS edges_unique_path;
CREATE UNIQUE INDEX IF NOT EXISTS edges_unique_path ON public.edges (parent_id, child_id, unlock_type);

-- Now restore the data (from migration 006)
DO $$
DECLARE
    root_id uuid;
    
    -- Node IDs
    calendula_id uuid;
    silvadene_id uuid;
    mepilex_id uuid;
    
    eat_any_id uuid;
    liquid_diet_id uuid;
    tube_feeding_id uuid;
    
    baking_2x_id uuid;
    supportive_id uuid;
    medications_supplements_id uuid;
    baking_4x_id uuid;
    mugard_direct_id uuid;
    lidocaine_id uuid;
    dox_morph_id uuid;
    opioid_id uuid;
    nerve_pain_id uuid;
BEGIN
    -- Get or create root node
    SELECT id INTO root_id FROM public.nodes WHERE is_root = true LIMIT 1;
    
    IF root_id IS NULL THEN
        INSERT INTO public.nodes (id, key, title, summary, is_root, order_index, created_at, updated_at)
        VALUES (gen_random_uuid(), 'root', 'Starting head and neck radiation treatment', 'Initial treatment decision point', true, 0, now(), now())
        RETURNING id INTO root_id;
    END IF;
    
    -- Insert/Update all nodes with correct keys and titles
    INSERT INTO public.nodes (id, key, title, summary, is_root, order_index, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), 'calendula', 'Calendula cream 2x daily', 'Apply calendula cream twice daily to affected areas', false, 1, now(), now()),
        (gen_random_uuid(), 'silvadene', 'Silvadene cream 2x daily', 'Apply Silvadene cream twice daily for advanced skin care', false, 2, now(), now()),
        (gen_random_uuid(), 'mepilex', 'Cover area with Mepilex padding', 'Cover treated area with Mepilex padding for protection', false, 3, now(), now()),
        
        (gen_random_uuid(), 'eat_any', 'Eat what you enjoy', 'Continue eating foods you enjoy as tolerated', false, 4, now(), now()),
        (gen_random_uuid(), 'liquid_diet', 'Complete liquid diet', 'Switch to complete liquid nutrition', false, 5, now(), now()),
        (gen_random_uuid(), 'tube_feeding', 'Dobhoff / NG tube or PEG tube', 'Tube feeding for nutritional support', false, 6, now(), now()),
        
        (gen_random_uuid(), 'baking_2x', 'Baking soda + MuGard 2x daily', 'Baking soda rinse with MuGard twice daily', false, 7, now(), now()),
        (gen_random_uuid(), 'supportive', 'Supportive measures', 'General supportive care measures', false, 8, now(), now()),
        (gen_random_uuid(), 'medications_supplements', 'Medications, supplements', 'Additional medications and supplements for oral care', false, 9, now(), now()),
        (gen_random_uuid(), 'baking_4x', 'Baking soda + MuGard 4-6x daily', 'Increased frequency baking soda rinse with MuGard', false, 10, now(), now()),
        (gen_random_uuid(), 'mugard_direct', 'Direct MuGard Application', 'Apply MuGard directly to affected areas', false, 11, now(), now()),
        (gen_random_uuid(), 'lidocaine', '2% lidocaine rinse', '2% viscous lidocaine mouth rinse for pain relief', false, 12, now(), now()),
        (gen_random_uuid(), 'dox_morph', 'Doxepin or morphine rinse', 'Doxepin or morphine mouth rinse for severe pain', false, 13, now(), now()),
        (gen_random_uuid(), 'opioid', 'Opioid pain meds', 'Opioid pain medications for systemic pain management', false, 14, now(), now()),
        (gen_random_uuid(), 'nerve_pain', 'Nerve pain meds', 'Medications for nerve pain (gabapentin, etc.)', false, 15, now(), now())
    ON CONFLICT (key) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        order_index = EXCLUDED.order_index,
        updated_at = now();
    
    -- Get node IDs
    SELECT id INTO calendula_id FROM public.nodes WHERE key = 'calendula';
    SELECT id INTO silvadene_id FROM public.nodes WHERE key = 'silvadene';
    SELECT id INTO mepilex_id FROM public.nodes WHERE key = 'mepilex';
    
    SELECT id INTO eat_any_id FROM public.nodes WHERE key = 'eat_any';
    SELECT id INTO liquid_diet_id FROM public.nodes WHERE key = 'liquid_diet';
    SELECT id INTO tube_feeding_id FROM public.nodes WHERE key = 'tube_feeding';
    
    SELECT id INTO baking_2x_id FROM public.nodes WHERE key = 'baking_2x';
    SELECT id INTO supportive_id FROM public.nodes WHERE key = 'supportive';
    SELECT id INTO medications_supplements_id FROM public.nodes WHERE key = 'medications_supplements';
    SELECT id INTO baking_4x_id FROM public.nodes WHERE key = 'baking_4x';
    SELECT id INTO mugard_direct_id FROM public.nodes WHERE key = 'mugard_direct';
    SELECT id INTO lidocaine_id FROM public.nodes WHERE key = 'lidocaine';
    SELECT id INTO dox_morph_id FROM public.nodes WHERE key = 'dox_morph';
    SELECT id INTO opioid_id FROM public.nodes WHERE key = 'opioid';
    SELECT id INTO nerve_pain_id FROM public.nodes WHERE key = 'nerve_pain';
    
    -- Clear existing categories and edges first (but preserve user progress)
    DELETE FROM public.node_categories;
    DELETE FROM public.edges;
    -- NOTE: We're NOT deleting from user_unlocked_nodes to preserve user progress
    
    -- Insert node categories
    INSERT INTO public.node_categories (node_id, category) VALUES
        -- Skincare chain
        (calendula_id, 'skincare'),
        (silvadene_id, 'skincare'),
        (mepilex_id, 'skincare'),
        
        -- Nutrition chain
        (eat_any_id, 'nutrition'),
        (liquid_diet_id, 'nutrition'),
        (tube_feeding_id, 'nutrition'),
        
        -- Oral care & pain chain
        (baking_2x_id, 'oral_care'),
        (baking_2x_id, 'pain'),
        (supportive_id, 'oral_care'),
        (medications_supplements_id, 'oral_care'),
        (baking_4x_id, 'oral_care'),
        (mugard_direct_id, 'oral_care'),
        (lidocaine_id, 'pain'),
        (dox_morph_id, 'pain'),
        (opioid_id, 'pain'),
        (nerve_pain_id, 'pain');
    
    -- Insert edges for the exact tree structure
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
        -- Root to main branches
        (root_id, calendula_id, 'always', null, 'Basic skincare treatment available from start', 100),
        (root_id, eat_any_id, 'always', null, 'Normal eating encouraged initially', 200),
        (root_id, baking_2x_id, 'always', null, 'Basic oral care and pain management', 300),
        
        -- Skincare chain
        (calendula_id, silvadene_id, 'symptom_match', '{"any": ["skin_breakdown"]}', 'Advanced skincare for skin breakdown', 110),
        (silvadene_id, mepilex_id, 'symptom_match', '{"any": ["severe_skin_damage"]}', 'Protection for severe skin damage', 120),
        
        -- Nutrition chain
        (eat_any_id, liquid_diet_id, 'symptom_match', '{"any": ["weight_loss", "difficulty_swallowing"]}', 'Liquid diet for swallowing difficulties', 210),
        (liquid_diet_id, tube_feeding_id, 'symptom_match', '{"any": ["severe_weight_loss", "unable_to_swallow"]}', 'Tube feeding for severe nutritional compromise', 220),
        
        -- Oral care branch from baking_2x
        (baking_2x_id, supportive_id, 'symptom_match', '{"any": ["dry_mouth", "mild_oral_discomfort"]}', 'Supportive measures for mild symptoms', 310),
        (supportive_id, medications_supplements_id, 'symptom_match', '{"any": ["persistent_dry_mouth"]}', 'Additional medications for persistent symptoms', 311),
        (baking_2x_id, baking_4x_id, 'symptom_match', '{"any": ["mouth_pain", "oral_lesions"]}', 'Increased frequency for oral pain', 320),
        (baking_4x_id, mugard_direct_id, 'symptom_match', '{"any": ["focal_lesions", "specific_oral_pain"]}', 'Direct application for focal lesions', 321),
        
        -- Pain branch from baking_2x
        (baking_2x_id, lidocaine_id, 'symptom_match', '{"any": ["oral_pain", "mouth_discomfort"]}', 'Lidocaine for oral pain relief', 330),
        (lidocaine_id, dox_morph_id, 'symptom_match', '{"any": ["severe_oral_pain", "inadequate_pain_relief"]}', 'Stronger rinse for severe pain', 331),
        (dox_morph_id, opioid_id, 'symptom_match', '{"any": ["systemic_pain", "severe_pain"]}', 'Systemic opioids for severe pain', 332),
        (opioid_id, nerve_pain_id, 'symptom_match', '{"all": ["persistent_pain", "neuropathic_pain"]}', 'Nerve pain medications for neuropathic component', 333);
    
END $$;

-- Clean up any orphaned user progress (for nodes that no longer exist)
-- This removes unlock records for deleted nodes but keeps valid progress
DELETE FROM public.user_unlocked_nodes 
WHERE node_id NOT IN (SELECT id FROM public.nodes);

COMMIT;

-- Verify the data was restored
SELECT 'NODES RESTORED:' as status, count(*) as count FROM public.nodes;
SELECT 'EDGES RESTORED:' as status, count(*) as count FROM public.edges;
SELECT 'CATEGORIES RESTORED:' as status, count(*) as count FROM public.node_categories;
SELECT 'USER PROGRESS PRESERVED:' as status, count(*) as count FROM public.user_unlocked_nodes;
SELECT 'USERS WITH PROGRESS:' as status, count(DISTINCT user_id) as count FROM public.user_unlocked_nodes;
