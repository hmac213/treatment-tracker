import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import {
  listIntroTreeNodes,
  listIntroTreeNodeVideos,
  getIntroNodeByKey,
  putIntroTreeNode,
  deleteIntroTreeNode,
  deleteIntroTreeNodeVideo,
  putIntroTreeNodeVideo,
} from '@/lib/lambdaDataClient';

export async function GET(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const nodes = await listIntroTreeNodes();
    const formattedNodes = await Promise.all(
      nodes.map(async (node) => {
        const videos = await listIntroTreeNodeVideos(node.id);
        return {
          id: node.id,
          node_key: node.node_key,
          title: node.title,
          pos_x: node.pos_x,
          pos_y: node.pos_y,
          width: node.width,
          height: node.height,
          videos: videos.sort((a, b) => a.order_index - b.order_index),
        };
      })
    );
    formattedNodes.sort((a, b) => a.title.localeCompare(b.title));
    return NextResponse.json({ nodes: formattedNodes });
  } catch (err) {
    console.error('Failed to fetch introduction tree nodes:', err);
    return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, node } = body;

  if (action === 'upsert_node') {
    const { id, node_key, title, pos_x, pos_y, width, height, videos } = node;

    try {
      const existing = id ? null : await getIntroNodeByKey(node_key);
      const nodeId = (existing as { id?: string } | null)?.id ?? id ?? undefined;
      const savedNode = await putIntroTreeNode({
        id: nodeId,
        node_key,
        title,
        pos_x: Number(pos_x),
        pos_y: Number(pos_y),
        width: Number(width),
        height: Number(height),
      });
      const savedId = (savedNode as { id: string }).id;

      if (Array.isArray(videos)) {
        const existingVideos = await listIntroTreeNodeVideos(savedId);
        for (const v of existingVideos) {
          await deleteIntroTreeNodeVideo(savedId, v.id);
        }
        const toInsert = videos.filter((v: { video_url?: string; title?: string }) => v.video_url && v.title);
        for (let i = 0; i < toInsert.length; i++) {
          const v = toInsert[i] as { video_url: string; title: string; order_index?: number };
          await putIntroTreeNodeVideo(savedId, {
            video_url: v.video_url,
            title: v.title,
            order_index: v.order_index !== undefined ? v.order_index : i,
          });
        }
      }

      return NextResponse.json({ node: { ...savedNode, id: savedId } });
    } catch (err) {
      console.error('Failed to save intro node:', err);
      return NextResponse.json({ error: 'Failed to save node' }, { status: 500 });
    }
  }

  if (action === 'delete_node') {
    const { id } = node;
    if (!id) {
      return NextResponse.json({ error: 'Node ID required' }, { status: 400 });
    }
    try {
      await deleteIntroTreeNode(id);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete node:', err);
      return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
