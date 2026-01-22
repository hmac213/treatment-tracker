import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  // Allow read access for all authenticated users (for patient view)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  // Get all nodes with their videos
  const { data: nodes, error: nodesError } = await supabase
    .from('introduction_tree_nodes')
    .select(`
      *,
      introduction_tree_node_videos (*)
    `)
    .order('title', { ascending: true });

  if (nodesError) {
    console.error('Failed to fetch introduction tree nodes:', nodesError);
    return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
  }

  // Format the response
  const formattedNodes = (nodes || []).map(node => ({
    id: node.id,
    node_key: node.node_key,
    title: node.title,
    pos_x: node.pos_x,
    pos_y: node.pos_y,
    width: node.width,
    height: node.height,
    videos: (node.introduction_tree_node_videos || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  return NextResponse.json({ nodes: formattedNodes });
}

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, node } = body;

  if (action === 'upsert_node') {
    const { id, node_key, title, pos_x, pos_y, width, height, videos } = node;

    const supabase = createServiceClient();

    // Upsert the node
    const nodeData: any = {
      node_key,
      title,
      pos_x: Number(pos_x),
      pos_y: Number(pos_y),
      width: Number(width),
      height: Number(height),
      updated_at: new Date().toISOString(),
    };

    if (id) {
      nodeData.id = id;
    }

    const { data: savedNode, error: nodeError } = await supabase
      .from('introduction_tree_nodes')
      .upsert(nodeData, { onConflict: id ? 'id' : 'node_key' })
      .select()
      .single();

    if (nodeError) {
      console.error('Failed to save node:', nodeError);
      return NextResponse.json({ error: 'Failed to save node' }, { status: 500 });
    }

    // Update videos if provided
    if (Array.isArray(videos)) {
      // Delete existing videos
      const { error: deleteError } = await supabase
        .from('introduction_tree_node_videos')
        .delete()
        .eq('node_id', savedNode.id);

      if (deleteError) {
        console.error('Failed to delete existing videos:', deleteError);
        return NextResponse.json({ error: 'Failed to update videos' }, { status: 500 });
      }

      // Insert new videos
      if (videos.length > 0) {
        const videosToInsert = videos
          .filter((v: any) => v.video_url && v.title)
          .map((v: any, index: number) => ({
            node_id: savedNode.id,
            video_url: v.video_url,
            title: v.title,
            order_index: v.order_index !== undefined ? v.order_index : index,
          }));

        if (videosToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('introduction_tree_node_videos')
            .insert(videosToInsert);

          if (insertError) {
            console.error('Failed to insert videos:', insertError);
            return NextResponse.json({ error: 'Failed to save videos' }, { status: 500 });
          }
        }
      }
    }

    return NextResponse.json({ node: savedNode });
  }

  if (action === 'delete_node') {
    const { id } = node;
    if (!id) {
      return NextResponse.json({ error: 'Node ID required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('introduction_tree_nodes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete node:', error);
      return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
