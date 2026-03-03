import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import {
  putNode,
  setNodeCategories,
  listNodeVideos,
  putNodeVideo,
  deleteNodeVideo,
} from '@/lib/lambdaDataClient';

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
type SaveBody = { nodes?: BodyNode[] };

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SaveBody;
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];

  try {
    for (const node of nodes) {
      await putNode({
        id: node.id,
        key: node.key,
        title: node.title,
        summary: node.summary ?? null,
        is_root: node.is_root,
        order_index: node.order_index,
        pos_x: node.pos_x,
        pos_y: node.pos_y,
      });
      await setNodeCategories(node.id, (node as { categories?: string[] }).categories ?? []);
      const existing = await listNodeVideos(node.id);
      for (const v of existing) {
        await deleteNodeVideo(node.id, v.id);
      }
      for (let i = 0; i < (node.node_videos || []).length; i++) {
        const v = node.node_videos[i];
        await putNodeVideo(node.id, {
          id: v.id,
          video_url: v.video_url,
          title: v.title,
          order_index: v.order_index ?? i,
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to update node with videos:', err);
    return NextResponse.json({ error: 'Failed to update node' }, { status: 500 });
  }
} 