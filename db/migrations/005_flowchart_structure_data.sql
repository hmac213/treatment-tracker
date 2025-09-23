-- Migration: Update data structure to match the actual treatment flowchart
-- This creates the true DAG structure with shared nodes and proper conditional paths

-- Clear existing node categories to rebuild properly
DELETE FROM public.node_categories;

-- We'll use ON CONFLICT to handle existing edges rather than deleting them all

-- Create or update nodes to match the flowchart structure
-- Using ON CONFLICT to update existing nodes or insert new ones

-- Root node
INSERT INTO public.nodes (key, title, summary, video_url, is_root, order_index) VALUES
('root', 'Starting head and neck radiation treatment', 'Initial assessment and treatment planning for head and neck radiation therapy.', 'https://vimeo.com/example-root', true, 1)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  video_url = EXCLUDED.video_url,
  is_root = EXCLUDED.is_root,
  order_index = EXCLUDED.order_index;

-- Skincare nodes
INSERT INTO public.nodes (key, title, summary, video_url, is_root, order_index) VALUES
('calendula', 'Calendula cream 2x daily', 'Apply calendula cream to affected skin areas twice daily for protection and healing.', 'https://vimeo.com/example-calendula', false, 10),
('silvadene', 'Silvadene cream 2x daily', 'Apply Silvadene cream twice daily for advanced skin protection and infection prevention.', 'https://vimeo.com/example-silvadene', false, 11),
('mepilex', 'Cover with Mepilex padding', 'Use Mepilex dressing to protect and cushion damaged skin areas.', 'https://vimeo.com/example-mepilex', false, 12)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  video_url = EXCLUDED.video_url,
  order_index = EXCLUDED.order_index;

-- Nutrition nodes  
INSERT INTO public.nodes (key, title, summary, video_url, is_root, order_index) VALUES
('eat_any', 'Eat foods you enjoy', 'Continue eating your preferred foods as tolerated to maintain nutrition and quality of life.', 'https://vimeo.com/example-eat-any', false, 20),
('liquid_diet', 'Complete liquid diet', 'Switch to a complete liquid diet when solid foods become difficult to tolerate.', 'https://vimeo.com/example-liquid', false, 21),
('tube_feeding', 'Tube placement with tube feeding', 'Feeding tube placement for nutritional support when oral intake is insufficient.', 'https://vimeo.com/example-tube', false, 22)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  video_url = EXCLUDED.video_url,
  order_index = EXCLUDED.order_index;

-- Oral Care nodes
INSERT INTO public.nodes (key, title, summary, video_url, is_root, order_index) VALUES
('baking_mugard_2x', 'Baking soda rinse + MuGard 2x/day', 'Rinse with baking soda solution followed by MuGard twice daily for basic oral care.', 'https://vimeo.com/example-baking-2x', false, 30),
('supportive', 'Supportive measures', 'Additional supportive care measures including hydration and humidification.', 'https://vimeo.com/example-supportive', false, 31),
('baking_mugard_4x', 'Baking soda + MuGard 4-6x/day', 'Increase frequency to 4-6 times daily for more intensive oral care.', 'https://vimeo.com/example-baking-4x', false, 32),
('apply_mugard_spot', 'Apply MuGard to focal area', 'Direct application of MuGard to specific problem areas in the mouth.', 'https://vimeo.com/example-mugard-spot', false, 33)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  video_url = EXCLUDED.video_url,
  order_index = EXCLUDED.order_index;

-- Pain nodes
INSERT INTO public.nodes (key, title, summary, video_url, is_root, order_index) VALUES
('lidocaine', '2% Viscous Lidocaine rinse', 'Use viscous lidocaine rinse for topical pain relief in the mouth and throat.', 'https://vimeo.com/example-lidocaine', false, 40),
('dox_morph', 'Doxepin or morphine mouth rinse', 'Specialized mouth rinse containing doxepin or morphine for severe oral pain.', 'https://vimeo.com/example-dox-morph', false, 41),
('opioid', 'Opioid pain medication', 'Systemic opioid medication for moderate to severe pain management.', 'https://vimeo.com/example-opioid', false, 42),
('gabapentin', 'Medication for nerve pain (gabapentin)', 'Gabapentin or similar medication specifically for neuropathic pain involving neck, ear, or nerve areas.', 'https://vimeo.com/example-gabapentin', false, 43)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  video_url = EXCLUDED.video_url,
  order_index = EXCLUDED.order_index;

-- Assign categories to nodes (including multiple categories for shared nodes)
INSERT INTO public.node_categories (node_id, category) 
SELECT n.id, c.category
FROM public.nodes n
CROSS JOIN (VALUES 
  -- Skincare category
  ('calendula', 'skincare'),
  ('silvadene', 'skincare'),
  ('mepilex', 'skincare'),
  
  -- Nutrition category
  ('eat_any', 'nutrition'),
  ('liquid_diet', 'nutrition'),
  ('tube_feeding', 'nutrition'),
  
  -- Oral Care category
  ('baking_mugard_2x', 'oral_care'),
  ('supportive', 'oral_care'),
  ('baking_mugard_4x', 'oral_care'),
  ('apply_mugard_spot', 'oral_care'),
  
  -- Pain category  
  ('lidocaine', 'pain'),
  ('dox_morph', 'pain'),
  ('opioid', 'pain'),
  ('gabapentin', 'pain'),
  
  -- SHARED NODES (appear in multiple categories)
  -- Baking soda + MuGard appears in both oral care AND pain management
  ('baking_mugard_2x', 'pain'),
  ('baking_mugard_4x', 'pain'),
  ('lidocaine', 'oral_care')
) AS c(node_key, category)
WHERE n.key = c.node_key
ON CONFLICT (node_id, category) DO NOTHING;

-- Create the DAG structure with proper conditional edges
DO $$
DECLARE
    root_id uuid;
    calendula_id uuid;
    silvadene_id uuid;
    mepilex_id uuid;
    eat_any_id uuid;
    liquid_diet_id uuid;
    tube_feeding_id uuid;
    baking_2x_id uuid;
    supportive_id uuid;
    baking_4x_id uuid;
    mugard_spot_id uuid;
    lidocaine_id uuid;
    dox_morph_id uuid;
    opioid_id uuid;
    gabapentin_id uuid;
BEGIN
    -- Get node IDs
    SELECT id INTO root_id FROM public.nodes WHERE key = 'root';
    SELECT id INTO calendula_id FROM public.nodes WHERE key = 'calendula';
    SELECT id INTO silvadene_id FROM public.nodes WHERE key = 'silvadene';
    SELECT id INTO mepilex_id FROM public.nodes WHERE key = 'mepilex';
    SELECT id INTO eat_any_id FROM public.nodes WHERE key = 'eat_any';
    SELECT id INTO liquid_diet_id FROM public.nodes WHERE key = 'liquid_diet';
    SELECT id INTO tube_feeding_id FROM public.nodes WHERE key = 'tube_feeding';
    SELECT id INTO baking_2x_id FROM public.nodes WHERE key = 'baking_mugard_2x';
    SELECT id INTO supportive_id FROM public.nodes WHERE key = 'supportive';
    SELECT id INTO baking_4x_id FROM public.nodes WHERE key = 'baking_mugard_4x';
    SELECT id INTO mugard_spot_id FROM public.nodes WHERE key = 'apply_mugard_spot';
    SELECT id INTO lidocaine_id FROM public.nodes WHERE key = 'lidocaine';
    SELECT id INTO dox_morph_id FROM public.nodes WHERE key = 'dox_morph';
    SELECT id INTO opioid_id FROM public.nodes WHERE key = 'opioid';
    SELECT id INTO gabapentin_id FROM public.nodes WHERE key = 'gabapentin';

    -- Root to first-level treatments (always available)
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
    (root_id, calendula_id, 'always', null, 'Basic skincare available from start', 100),
    (root_id, eat_any_id, 'always', null, 'Normal eating encouraged initially', 100),
    (root_id, baking_2x_id, 'always', null, 'Basic oral care routine', 100),
    (root_id, lidocaine_id, 'always', null, 'Basic pain management available', 100)
    ON CONFLICT (parent_id, child_id, unlock_type) DO UPDATE SET
      description = EXCLUDED.description,
      weight = EXCLUDED.weight;

    -- Skincare progression
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
    (calendula_id, silvadene_id, 'symptom_match', '{"any": ["skin_breakdown", "radiation_dermatitis"]}', 'Advanced skincare for skin damage', 90),
    (silvadene_id, mepilex_id, 'symptom_match', '{"any": ["severe_skin_damage", "open_wounds"]}', 'Protective dressing for severe damage', 80)
    ON CONFLICT (parent_id, child_id, unlock_type) DO UPDATE SET
      unlock_value = EXCLUDED.unlock_value,
      description = EXCLUDED.description,
      weight = EXCLUDED.weight;

    -- Nutrition progression  
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
    (eat_any_id, liquid_diet_id, 'symptom_match', '{"any": ["weight_loss", "difficulty_swallowing", "decreased_appetite"]}', 'Liquid diet for swallowing difficulties', 90),
    (liquid_diet_id, tube_feeding_id, 'symptom_match', '{"any": ["severe_weight_loss", "unable_to_swallow"]}', 'Feeding tube for severe nutrition issues', 80)
    ON CONFLICT (parent_id, child_id, unlock_type) DO UPDATE SET
      unlock_value = EXCLUDED.unlock_value,
      description = EXCLUDED.description,
      weight = EXCLUDED.weight;

    -- Oral care progression
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
    (baking_2x_id, supportive_id, 'symptom_match', '{"any": ["dry_mouth", "mouth_sores"]}', 'Additional supportive measures', 90),
    (baking_2x_id, baking_4x_id, 'symptom_match', '{"any": ["mouth_pain", "increased_mucositis"]}', 'Increased oral care frequency', 85),
    (baking_4x_id, mugard_spot_id, 'symptom_match', '{"any": ["focal_oral_lesions", "persistent_sores"]}', 'Targeted MuGard application', 80)
    ON CONFLICT (parent_id, child_id, unlock_type) DO UPDATE SET
      unlock_value = EXCLUDED.unlock_value,
      description = EXCLUDED.description,
      weight = EXCLUDED.weight;

    -- Pain management progression
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
    (lidocaine_id, dox_morph_id, 'symptom_match', '{"any": ["persistent_pain", "severe_mouth_pain"]}', 'Advanced topical pain management', 85),
    (lidocaine_id, opioid_id, 'symptom_match', '{"any": ["pain_remains", "pain_worsens"]}', 'Systemic pain medication', 80),
    (opioid_id, gabapentin_id, 'symptom_match', '{"all": ["pain_remains", "neck_pain", "ear_pain", "nerve_pain"]}', 'Specialized nerve pain medication', 75)
    ON CONFLICT (parent_id, child_id, unlock_type) DO UPDATE SET
      unlock_value = EXCLUDED.unlock_value,
      description = EXCLUDED.description,
      weight = EXCLUDED.weight;

    -- CROSS-CATEGORY CONNECTIONS (DAG structure)
    -- Oral care can also lead to pain treatments
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
    (baking_4x_id, dox_morph_id, 'symptom_match', '{"any": ["severe_oral_pain", "mucositis_pain"]}', 'Oral pain leads to specialized rinse', 70),
    (supportive_id, opioid_id, 'symptom_match', '{"any": ["systemic_pain", "overall_discomfort"]}', 'Supportive care may require systemic pain management', 70)
    ON CONFLICT (parent_id, child_id, unlock_type) DO UPDATE SET
      unlock_value = EXCLUDED.unlock_value,
      description = EXCLUDED.description,
      weight = EXCLUDED.weight;

    -- Pain treatments can also help with oral care
    INSERT INTO public.edges (parent_id, child_id, unlock_type, unlock_value, description, weight) VALUES
    (dox_morph_id, mugard_spot_id, 'symptom_match', '{"any": ["focal_pain_persists", "specific_problem_areas"]}', 'Targeted treatment after systemic approach', 65)
    ON CONFLICT (parent_id, child_id, unlock_type) DO UPDATE SET
      unlock_value = EXCLUDED.unlock_value,
      description = EXCLUDED.description,
      weight = EXCLUDED.weight;

END $$;

-- Create some basic symptoms that match our unlock conditions
INSERT INTO public.symptoms (key, label, description) VALUES
-- Skincare symptoms
('skin_breakdown', 'Skin breakdown or irritation', 'Redness, peeling, or irritation of the skin'),
('radiation_dermatitis', 'Radiation dermatitis', 'Skin damage from radiation treatment'),
('severe_skin_damage', 'Severe skin damage', 'Significant skin breakdown requiring protective measures'),
('open_wounds', 'Open wounds or sores', 'Broken skin or open sores in treatment area'),

-- Nutrition symptoms
('weight_loss', 'Weight loss', 'Unintentional weight loss during treatment'),
('difficulty_swallowing', 'Difficulty swallowing', 'Problems with swallowing food or liquids'),
('decreased_appetite', 'Decreased appetite', 'Reduced desire to eat'),
('severe_weight_loss', 'Severe weight loss', 'Significant weight loss requiring intervention'),
('unable_to_swallow', 'Unable to swallow', 'Complete inability to swallow safely'),

-- Oral care symptoms
('dry_mouth', 'Dry mouth (xerostomia)', 'Reduced saliva production'),
('mouth_sores', 'Mouth sores', 'Sores or ulcers in the mouth'),
('mouth_pain', 'Mouth pain', 'Pain in the mouth or throat'),
('increased_mucositis', 'Increased mucositis', 'Worsening inflammation of mouth lining'),
('focal_oral_lesions', 'Focal oral lesions', 'Specific problem areas in the mouth'),
('persistent_sores', 'Persistent sores', 'Ongoing or worsening oral sores'),

-- Pain symptoms
('persistent_pain', 'Persistent pain', 'Ongoing pain despite current treatment'),
('severe_mouth_pain', 'Severe mouth pain', 'Intense pain in mouth or throat'),
('pain_remains', 'Pain remains or worsens', 'Current pain management is insufficient'),
('pain_worsens', 'Pain is getting worse', 'Pain intensity is increasing'),
('neck_pain', 'Neck pain', 'Pain in the neck area'),
('ear_pain', 'Ear pain', 'Pain in or around the ears'),
('nerve_pain', 'Nerve pain', 'Shooting or burning nerve-type pain'),
('severe_oral_pain', 'Severe oral pain', 'Intense pain in the mouth'),
('mucositis_pain', 'Mucositis pain', 'Pain from inflamed mouth lining'),
('systemic_pain', 'Systemic pain', 'Overall body pain'),
('overall_discomfort', 'Overall discomfort', 'General discomfort affecting quality of life'),
('focal_pain_persists', 'Focal pain persists', 'Specific areas of ongoing pain'),
('specific_problem_areas', 'Specific problem areas', 'Particular locations requiring targeted treatment')
ON CONFLICT (key) DO NOTHING;
