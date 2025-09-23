-- Apply new migrations for DAG structure
\i db/migrations/004_dag_structure_multiple_categories.sql
\i db/migrations/005_flowchart_structure_data.sql

-- Verify the new structure
SELECT 'Node Categories:' as info;
SELECT n.key, n.title, ARRAY_AGG(nc.category) as categories 
FROM nodes n 
LEFT JOIN node_categories nc ON n.id = nc.node_id 
GROUP BY n.id, n.key, n.title 
ORDER BY n.key;

SELECT 'Edge Structure:' as info;
SELECT 
  p.key as parent,
  c.key as child,
  e.unlock_type,
  e.description,
  e.weight
FROM edges e
JOIN nodes p ON e.parent_id = p.id
JOIN nodes c ON e.child_id = c.id
ORDER BY e.weight DESC, p.key, c.key;
