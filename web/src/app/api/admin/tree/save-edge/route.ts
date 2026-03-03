import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { listEdges, putEdge } from '@/lib/lambdaDataClient';

export async function POST(request: NextRequest) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user?.admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { edgeId, description } = await request.json();

    if (!edgeId) {
      return NextResponse.json({ error: 'Edge ID is required' }, { status: 400 });
    }

    const edges = await listEdges();
    const edge = edges.find((e) => (e as { id: string }).id === edgeId);
    if (!edge) {
      return NextResponse.json({ error: 'Edge not found' }, { status: 404 });
    }

    const e = edge as { id: string; parent_id: string; child_id: string; unlock_type: string; unlock_value?: unknown; description?: string | null; weight?: number };
    await putEdge({
      id: e.id,
      parent_id: e.parent_id,
      child_id: e.child_id,
      unlock_type: e.unlock_type,
      unlock_value: e.unlock_value,
      description: description ?? e.description ?? null,
      weight: e.weight,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Edge save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
