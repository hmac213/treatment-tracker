import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type BodyNode = { id: string; key: string; title: string; summary?: string | null; video_url?: string | null; is_root?: boolean; order_index?: number; pos_x?: number | null; pos_y?: number | null; category?: string | null };
type BodyEdge = { id: string; parent_id: string; child_id: string; unlock_type: 'always' | 'manual' | 'symptom_match'; unlock_value?: unknown };

type SaveBody = { nodes?: BodyNode[]; edges?: BodyEdge[] };

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SaveBody;
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];

  const supabase = createServiceClient();

  // Only update individual nodes, DO NOT delete everything!
  if (nodes.length > 0) {
    for (const node of nodes) {
      const { error } = await supabase
        .from('nodes')
        .update({
          title: node.title,
          summary: node.summary ?? null,
          video_url: node.video_url ?? null,
          updated_at: new Date().toISOString()
        })
        .eq('id', node.id);
      
      if (error) {
        console.error('Failed to update node:', error);
        return NextResponse.json({ error: 'Failed to update node' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
} 