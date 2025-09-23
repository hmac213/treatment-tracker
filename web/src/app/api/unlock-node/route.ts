import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUserFromRequest } from '@/lib/session';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const { nodeId } = await req.json();
    
    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if user already has this node unlocked
    const { data: existingUnlock } = await supabase
      .from('user_unlocked_nodes')
      .select('id')
      .eq('user_id', user.id)
      .eq('node_id', nodeId)
      .maybeSingle();

    if (existingUnlock) {
      return NextResponse.json({ error: 'Node already unlocked' }, { status: 400 });
    }

    // Get all unlocked nodes for this user
    const { data: unlocked } = await supabase
      .from('user_unlocked_nodes')
      .select('node_id')
      .eq('user_id', user.id);

    const unlockedIds = new Set((unlocked ?? []).map(u => u.node_id));

    // Check if this node can be unlocked (has an unlocked parent)
    const { data: edges } = await supabase
      .from('edges')
      .select('parent_id, child_id, unlock_type, unlock_value')
      .eq('child_id', nodeId);

    const canUnlock = (edges ?? []).some(edge => 
      unlockedIds.has(edge.parent_id) && 
      (edge.unlock_type === 'always' || edge.unlock_type === 'symptom_match')
    );

    if (!canUnlock) {
      return NextResponse.json({ error: 'Node cannot be unlocked yet' }, { status: 400 });
    }

    // Unlock the node
    const { error: unlockError } = await supabase
      .from('user_unlocked_nodes')
      .insert({
        user_id: user.id,
        node_id: nodeId,
        unlocked_by: 'user',
        source: 'patient_unlock'
      });

    if (unlockError) {
      console.error('Failed to unlock node:', unlockError);
      return NextResponse.json({ error: 'Failed to unlock node' }, { status: 500 });
    }

    // Process any newly available 'always' edges
    await ensureUserHasBasicUnlocks(user.id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unlock node error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


