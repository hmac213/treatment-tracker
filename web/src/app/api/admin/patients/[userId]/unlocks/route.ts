import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { listUnlocksByUser, listNodes } from '@/lib/lambdaDataClient';

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
  let unlocks;
  try {
    const [unlocksList, nodes] = await Promise.all([listUnlocksByUser(userId), listNodes()]);
    const nodeMap = new Map(nodes.map((n) => [(n as { id: string }).id, n]));
    unlocks = unlocksList
      .sort((a, b) => (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? ''))
      .map((u) => {
        const node = nodeMap.get(u.node_id) as { key?: string; title?: string } | undefined;
        return {
          node_id: u.node_id,
          unlocked_at: u.unlocked_at,
          unlocked_by: u.unlocked_by,
          source: u.source,
          node: node ? { key: node.key, title: node.title } : null,
        };
      });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch unlocks' }, { status: 500 });
  }
  return NextResponse.json({ unlocks });
}
