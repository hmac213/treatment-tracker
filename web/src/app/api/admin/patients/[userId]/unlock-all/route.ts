import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

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
  const supabase = createServiceClient();

  try {
    // Get all nodes
    const { data: allNodes } = await supabase
      .from('nodes')
      .select('id');

    if (!allNodes) {
      return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
    }

    // Get currently unlocked nodes for this user
    const { data: currentUnlocks } = await supabase
      .from('user_unlocked_nodes')
      .select('node_id')
      .eq('user_id', userId);

    const currentlyUnlockedIds = new Set((currentUnlocks || []).map(u => u.node_id));
    
    // Find nodes that aren't unlocked yet
    const nodesToUnlock = allNodes
      .filter(node => !currentlyUnlockedIds.has(node.id))
      .map(node => ({
        user_id: userId,
        node_id: node.id,
        unlocked_by: 'admin',
        source: 'admin_unlock_all'
      }));

    if (nodesToUnlock.length > 0) {
      const { error } = await supabase
        .from('user_unlocked_nodes')
        .insert(nodesToUnlock);

      if (error) {
        return NextResponse.json({ error: 'Failed to unlock nodes' }, { status: 500 });
      }
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
