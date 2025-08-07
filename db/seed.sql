-- Minimal seed for the head & neck radiation treatment decision tree

-- Clear existing (idempotent-ish for dev)
truncate table public.user_events restart identity cascade;
truncate table public.user_unlocked_nodes restart identity cascade;
truncate table public.edges restart identity cascade;
truncate table public.nodes restart identity cascade;
truncate table public.symptoms restart identity cascade;

-- Symptoms (keys kept short)
insert into public.symptoms (key, label, description) values
  ('moist_desquamation', 'Moist desquamation', 'Skin breakdown with weeping'),
  ('skin_high_risk', 'High-risk skin area', 'High friction/sensitivity'),
  ('weight_loss_5', 'Weight loss ≥5%', 'Approximate 5% loss'),
  ('weight_loss_10', 'Weight loss ≥10%', 'Approximate 10% loss'),
  ('dry_mouth', 'Dry mouth', 'Xerostomia'),
  ('oral_mucositis', 'Oral mucositis increased', 'Increased ulceration/inflammation'),
  ('focal_mucositis', 'Focal mucositis reachable', 'A specific reachable spot'),
  ('oral_pain_eating', 'Oral pain with eating/swallowing', 'Difficult eating or swallowing'),
  ('pain_persists', 'Pain remains/worsens', 'Pain not relieved'),
  ('neck_ear_nerve_pain', 'Neck/Ear/Nerve pain', 'Referred or neuropathic pain');

-- Nodes
-- Root and four category branches
insert into public.nodes (key, title, summary, video_url, is_root, order_index) values
  ('root', 'Starting head and neck radiation treatment', 'Overview of your care path.', 'https://example.com/video/root', true, 0),
  ('skincare', 'Skincare', 'Skin care during treatment.', 'https://example.com/video/skincare', false, 1),
  ('nutrition', 'Nutrition', 'Eating well during treatment.', 'https://example.com/video/nutrition', false, 2),
  ('oral_care', 'Oral Care', 'Keeping your mouth comfortable.', 'https://example.com/video/oralcare', false, 3),
  ('pain', 'Pain', 'Managing pain safely.', 'https://example.com/video/pain', false, 4);

-- Skincare branch nodes
insert into public.nodes (key, title, summary, video_url, order_index) values
  ('calendula', 'Calendula cream 2x daily', 'Apply twice daily.', 'https://example.com/video/calendula', 10),
  ('silvadene', 'Silvadene cream 2x daily', 'Use for moist desquamation.', 'https://example.com/video/silvadene', 11),
  ('mepliex', 'Cover with Mepilex padding', 'Protect high-risk skin areas.', 'https://example.com/video/mepilex', 12);

-- Nutrition branch nodes
insert into public.nodes (key, title, summary, video_url, order_index) values
  ('eat_any', 'Eat foods you enjoy', 'No special restrictions if possible.', 'https://example.com/video/eat', 20),
  ('liquid_diet', 'Complete liquid diet', 'Switch to liquid diet if needed.', 'https://example.com/video/liquid', 21),
  ('tube_feeding', 'Tube placement with tube feeding', 'Dobhoff/NG or PEG as indicated.', 'https://example.com/video/tube', 22);

-- Oral care branch nodes
insert into public.nodes (key, title, summary, video_url, order_index) values
  ('baking_mugard_2x', 'Baking soda rinse + MuGard 2x/day', 'Rinse and swallow as directed.', 'https://example.com/video/mugard_basic', 30),
  ('supportive', 'Supportive measures', 'Water, humidifier.', 'https://example.com/video/supportive', 31),
  ('baking_mugard_4x', 'Baking soda + MuGard 4-6x/day', 'Increase frequency for mucositis.', 'https://example.com/video/mugard_increase', 32),
  ('apply_mugard_spot', 'Apply MuGard to focal area', 'Use swab/q-tip on reachable spot.', 'https://example.com/video/mugard_spot', 33);

-- Pain branch nodes
insert into public.nodes (key, title, summary, video_url, order_index) values
  ('lidocaine', '2% Viscous Lidocaine rinse', 'Rinse and spit or rinse and swallow.', 'https://example.com/video/lidocaine', 40),
  ('gabapentin', 'Medication for nerve pain (gabapentin)', 'For neuropathic pain.', 'https://example.com/video/gabapentin', 41),
  ('opioid', 'Opioid pain medication', 'Use as directed.', 'https://example.com/video/opioid', 42),
  ('dox_morph', 'Doxepin or morphine mouth rinse', 'For oral pain with eating/swallowing.', 'https://example.com/video/dox_morph', 43);

-- Edges from root to branches
insert into public.edges (parent_id, child_id, unlock_type)
select p.id, c.id, 'always'
from public.nodes p, public.nodes c
where p.key = 'root' and c.key in ('skincare','nutrition','oral_care','pain');

-- Skincare edges
insert into public.edges (parent_id, child_id, unlock_type)
select p.id, c.id, 'always' from public.nodes p, public.nodes c where p.key = 'skincare' and c.key = 'calendula';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["moist_desquamation"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'calendula' and c.key = 'silvadene';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["skin_high_risk"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'silvadene' and c.key = 'mepliex';

-- Nutrition edges
insert into public.edges (parent_id, child_id, unlock_type)
select p.id, c.id, 'always' from public.nodes p, public.nodes c where p.key = 'nutrition' and c.key = 'eat_any';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["weight_loss_5"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'eat_any' and c.key = 'liquid_diet';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["weight_loss_10"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'liquid_diet' and c.key = 'tube_feeding';

-- Oral care edges
insert into public.edges (parent_id, child_id, unlock_type)
select p.id, c.id, 'always' from public.nodes p, public.nodes c where p.key = 'oral_care' and c.key = 'baking_mugard_2x';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["dry_mouth"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'baking_mugard_2x' and c.key = 'supportive';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["oral_mucositis"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'baking_mugard_2x' and c.key = 'baking_mugard_4x';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["focal_mucositis"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'baking_mugard_4x' and c.key = 'apply_mugard_spot';

-- Pain edges
insert into public.edges (parent_id, child_id, unlock_type)
select p.id, c.id, 'always' from public.nodes p, public.nodes c where p.key = 'pain' and c.key = 'lidocaine';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["oral_pain_eating"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'lidocaine' and c.key = 'dox_morph';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["pain_persists"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'dox_morph' and c.key = 'opioid';

insert into public.edges (parent_id, child_id, unlock_type, unlock_value)
select p.id, c.id, 'symptom_match', '{"any":["neck_ear_nerve_pain"]}'::jsonb
from public.nodes p, public.nodes c where p.key = 'supportive' and c.key = 'gabapentin';

-- Default admin and demo user (optional)
insert into public.users (email, name) values
  ('admin@example.org','Admin'),
  ('demo@example.org','Demo User')
  on conflict (email) do nothing;

-- Unlock root for demo user
insert into public.user_unlocked_nodes (user_id, node_id, unlocked_by, source)
select u.id, n.id, 'system', 'seed'
from public.users u, public.nodes n
where u.email = 'demo@example.org' and n.key = 'root'
on conflict (user_id, node_id) do nothing; 