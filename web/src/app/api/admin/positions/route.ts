import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import {
  getNodeByKey,
  putNode,
  putSymptomPosition,
  listNodes,
  listSymptomPositions,
} from '@/lib/lambdaDataClient';

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, key, position } = body;

  if (!type || !key || !position) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    if (type === 'node') {
      const node = await getNodeByKey(key);
      if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      await putNode({
        id: (node as { id: string }).id,
        key: (node as { key: string }).key,
        title: (node as { title: string }).title,
        summary: (node as { summary?: string | null }).summary ?? null,
        is_root: (node as { is_root?: boolean }).is_root,
        order_index: (node as { order_index?: number }).order_index,
        pos_x: position.x,
        pos_y: position.y,
        box_width: position.width,
        box_height: position.height,
      });
    } else if (type === 'symptom') {
      await putSymptomPosition({
        position_key: key,
        pos_x: position.x,
        pos_y: position.y,
        width: position.width,
        height: position.height,
      });
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (err) {
    console.error('Failed to save position:', err);
    return NextResponse.json({ error: 'Failed to save position' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const [nodes, symptoms] = await Promise.all([listNodes(), listSymptomPositions()]);
    const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    nodes.forEach((node) => {
      const n = node as { key: string; pos_x?: number | null; pos_y?: number | null; box_width?: number | null; box_height?: number | null };
      if (n.pos_x != null && n.pos_y != null) {
        nodePositions[n.key] = {
          x: Number(n.pos_x),
          y: Number(n.pos_y),
          width: Number(n.box_width ?? 10),
          height: Number(n.box_height ?? 5),
        };
      }
    });
    const symptomPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    symptoms.forEach((s) => {
      symptomPositions[s.position_key] = {
        x: Number(s.pos_x),
        y: Number(s.pos_y),
        width: Number(s.width),
        height: Number(s.height),
      };
    });
    return NextResponse.json({ nodes: nodePositions, symptoms: symptomPositions });
  } catch (err) {
    console.error('Failed to fetch positions:', err);
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }
}
