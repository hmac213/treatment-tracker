import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type BodyNode = { id: string; key: string; title: string; summary?: string | null; video_url?: string | null; is_root?: boolean; order_index?: number; pos_x?: number | null; pos_y?: number | null };
type BodyEdge = { id: string; parent_id: string; child_id: string; unlock_type: 'always' | 'manual' | 'symptom_match'; unlock_value?: unknown };

type SaveBody = { nodes?: BodyNode[]; edges?: BodyEdge[] };

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SaveBody;
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];

  const supabase = createServiceClient();

  const { error: delUnlocksErr } = await supabase.from('user_unlocked_nodes').delete().gte('unlocked_at', '1970-01-01');
  if (delUnlocksErr) return NextResponse.json({ error: 'failed' }, { status: 500 });

  const { error: delEdgesErr } = await supabase.from('edges').delete().gte('created_at', '1970-01-01');
  if (delEdgesErr) return NextResponse.json({ error: 'failed' }, { status: 500 });

  const { error: delNodesErr } = await supabase.from('nodes').delete().gte('created_at', '1970-01-01');
  if (delNodesErr) return NextResponse.json({ error: 'failed' }, { status: 500 });

  if (nodes.length > 0) {
    const sanitized = nodes.map((n) => ({
      id: n.id,
      key: n.key,
      title: n.title,
      summary: n.summary ?? null,
      video_url: n.video_url ?? null,
      is_root: !!n.is_root,
      order_index: Number(n.order_index ?? 0),
      pos_x: typeof n.pos_x === 'number' ? n.pos_x : null,
      pos_y: typeof n.pos_y === 'number' ? n.pos_y : null,
    }));
    const { error } = await supabase.from('nodes').insert(sanitized);
    if (error) return NextResponse.json({ error: 'insert nodes' }, { status: 500 });
  }
  if (edges.length > 0) {
    const sanitizedE = edges.map((e) => ({
      id: e.id,
      parent_id: e.parent_id,
      child_id: e.child_id,
      unlock_type: e.unlock_type,
      unlock_value: e.unlock_value ?? null,
    }));
    const { error } = await supabase.from('edges').insert(sanitizedE);
    if (error) return NextResponse.json({ error: 'insert edges' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
} 