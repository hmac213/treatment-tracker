import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type Video = { id?: string; video_url: string; title: string; order_index: number };
type BodyNode = { 
  id: string; 
  key: string; 
  title: string; 
  summary?: string | null; 
  is_root?: boolean; 
  order_index?: number; 
  pos_x?: number | null; 
  pos_y?: number | null; 
  category?: string | null;
  node_videos: Video[];
};
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
        .rpc('upsert_node_with_videos', {
          p_node_id: node.id,
          p_title: node.title,
          p_summary: node.summary ?? null,
          p_videos: node.node_videos || []
        });
      
      if (error) {
        console.error('Failed to update node with videos:', error);
        return NextResponse.json({ error: 'Failed to update node' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
} 