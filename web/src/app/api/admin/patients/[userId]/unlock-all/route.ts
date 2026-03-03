import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { listNodes, listUnlocksByUser, insertUnlocks } from '@/lib/lambdaDataClient';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;

  try {
    const [allNodes, currentUnlocks] = await Promise.all([listNodes(), listUnlocksByUser(userId)]);
    const currentlyUnlockedIds = new Set(currentUnlocks.map((u) => u.node_id));
    const nodesToUnlock = allNodes
      .filter((node) => !currentlyUnlockedIds.has((node as { id: string }).id))
      .map((node) => ({
        user_id: userId,
        node_id: (node as { id: string }).id,
        unlocked_by: 'admin' as const,
        source: 'admin_unlock_all',
      }));

    if (nodesToUnlock.length > 0) {
      await insertUnlocks(nodesToUnlock);
    }

    return NextResponse.json({ 
      success: true, 
      unlockedCount: nodesToUnlock.length 
    });

  } catch (error) {
    console.error('Unlock all failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
