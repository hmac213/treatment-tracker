import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;
  const supabase = createServiceClient();

  const { data: unlocks, error } = await supabase
    .from('user_unlocked_nodes')
    .select(`
      node_id,
      unlocked_at,
      unlocked_by,
      source,
      node:node_id (
        key,
        title
      )
    `)
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch unlocks' }, { status: 500 });
  }

  return NextResponse.json({ unlocks });
}
