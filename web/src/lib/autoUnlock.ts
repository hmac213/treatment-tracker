import {
  listUnlocksByUser,
  getNodeByKey,
  insertUnlocks,
  getEdgesByUnlockType,
} from './lambdaDataClient';

/**
 * Auto-unlock system for new users:
 * 1. Ensures root node is unlocked
 * 2. Recursively unlocks all nodes with 'always' unlock_type edges
 */
export async function ensureUserHasBasicUnlocks(userId: string): Promise<void> {
  const currentUnlocks = await listUnlocksByUser(userId);
  const unlockedIds = new Set(currentUnlocks.map((r) => r.node_id));

  // If user has no unlocks, start with root (key='root')
  if (unlockedIds.size === 0) {
    const rootNode = await getNodeByKey('root');
    if (rootNode && rootNode.id) {
      await insertUnlocks([
        {
          user_id: userId,
          node_id: rootNode.id as string,
          unlocked_by: 'system',
          source: 'auto_root',
        },
      ]);
      unlockedIds.add(rootNode.id as string);
    }
  }

  // Recursively unlock all 'always' edges
  let foundNewUnlocks = true;
  let iterations = 0;
  const maxIterations = 20;

  while (foundNewUnlocks && iterations < maxIterations) {
    iterations++;
    foundNewUnlocks = false;

    const edges = await getEdgesByUnlockType('always');
    const toUnlock: string[] = [];

    for (const edge of edges) {
      if (!unlockedIds.has(edge.parent_id)) continue;
      if (unlockedIds.has(edge.child_id)) continue;
      toUnlock.push(edge.child_id);
    }

    if (toUnlock.length > 0) {
      await insertUnlocks(
        toUnlock.map((nodeId) => ({
          user_id: userId,
          node_id: nodeId,
          unlocked_by: 'system' as const,
          source: 'auto_always',
        }))
      );
      toUnlock.forEach((id) => unlockedIds.add(id));
      foundNewUnlocks = true;
    }
  }
}
