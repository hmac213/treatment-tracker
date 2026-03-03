import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { deleteUnlocksByUser } from '@/lib/lambdaDataClient';
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

  try {
    await deleteUnlocksByUser(userId);
    await ensureUserHasBasicUnlocks(userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Reset progress failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
