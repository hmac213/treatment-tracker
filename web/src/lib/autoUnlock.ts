import { createServiceClient } from './supabaseClient';

/**
 * Auto-unlock system for new users:
 * 1. Ensures root node is unlocked
 * 2. Recursively unlocks all nodes with 'always' unlock_type edges
 * 
 * Updated to work with new schema (node_categories table, edges with description/weight)
 */
export async function ensureUserHasBasicUnlocks(userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Get user's currently unlocked nodes
  const { data: currentUnlocks } = await supabase
    .from('user_unlocked_nodes')
    .select('node_id')
    .eq('user_id', userId);

  const unlockedIds = new Set((currentUnlocks ?? []).map(r => r.node_id));

  // If user has no unlocks, start with root (now identified by key='root')
  if (unlockedIds.size === 0) {
    const { data: rootNode } = await supabase
      .from('nodes')
      .select('id')
      .eq('key', 'root')
      .single();

    if (rootNode) {
      await supabase
        .from('user_unlocked_nodes')
        .insert({
          user_id: userId,
          node_id: rootNode.id,
          unlocked_by: 'system',
          source: 'auto_root'
        });
      unlockedIds.add(rootNode.id);
    }
  }

  // Now recursively unlock all 'always' edges
  let foundNewUnlocks = true;
  let iterations = 0;
  const maxIterations = 20; // Prevent infinite loops

  while (foundNewUnlocks && iterations < maxIterations) {
    iterations++;
    foundNewUnlocks = false;

    // Get all edges where parent is unlocked but child is not
    const { data: edges } = await supabase
      .from('edges')
      .select('parent_id, child_id, unlock_type')
      .eq('unlock_type', 'always');

    const toUnlock: string[] = [];

    for (const edge of edges ?? []) {
      // Parent must be unlocked
      if (!unlockedIds.has(edge.parent_id)) continue;
      
      // Child must not be unlocked yet
      if (unlockedIds.has(edge.child_id)) continue;

      toUnlock.push(edge.child_id);
    }

    if (toUnlock.length > 0) {
      // Insert new unlocks
      const insertData = toUnlock.map(nodeId => ({
        user_id: userId,
        node_id: nodeId,
        unlocked_by: 'system' as const,
        source: 'auto_always'
      }));

      await supabase
        .from('user_unlocked_nodes')
        .insert(insertData);

      // Update our tracking set
      toUnlock.forEach(id => unlockedIds.add(id));
      foundNewUnlocks = true;
    }
  }
}
