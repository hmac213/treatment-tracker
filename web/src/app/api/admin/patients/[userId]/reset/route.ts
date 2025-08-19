import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';

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
    // Delete all unlocks for this user
    const { error: deleteError } = await supabase
      .from('user_unlocked_nodes')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to reset progress' }, { status: 500 });
    }

    // Re-apply basic unlocks (root + always edges)
    await ensureUserHasBasicUnlocks(userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Reset progress failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
