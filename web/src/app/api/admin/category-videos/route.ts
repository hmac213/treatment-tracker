import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  // Get category videos
  const { data: videos, error: videosError } = await supabase
    .from('category_videos')
    .select('*')
    .order('category', { ascending: true })
    .order('order_index', { ascending: true });

  if (videosError) {
    console.error('Failed to fetch category videos:', videosError);
    return NextResponse.json({ error: 'Failed to fetch category videos' }, { status: 500 });
  }

  // Get category positions
  const { data: positions, error: positionsError } = await supabase
    .from('category_positions')
    .select('*');

  if (positionsError) {
    console.error('Failed to fetch category positions:', positionsError);
    return NextResponse.json({ error: 'Failed to fetch category positions' }, { status: 500 });
  }

  // Group videos by category
  const videosByCategory = (videos || []).reduce((acc, video) => {
    if (!acc[video.category]) {
      acc[video.category] = [];
    }
    acc[video.category].push(video);
    return acc;
  }, {} as Record<string, typeof videos>);

  // Create positions map
  const positionsMap = (positions || []).reduce((acc, pos) => {
    acc[pos.category] = {
      pos_x: pos.pos_x,
      pos_y: pos.pos_y,
      width: pos.width,
      height: pos.height,
    };
    return acc;
  }, {} as Record<string, { pos_x: number; pos_y: number; width: number; height: number }>);

  return NextResponse.json({
    videos: videosByCategory,
    positions: positionsMap,
  });
}

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { category, videos, position } = body;

  if (!category || !['skincare', 'nutrition', 'oral_care', 'pain'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Update or insert position if provided
  if (position) {
    const { error: posError } = await supabase
      .from('category_positions')
      .upsert({
        category,
        pos_x: position.pos_x,
        pos_y: position.pos_y,
        width: position.width,
        height: position.height,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'category',
      });

    if (posError) {
      console.error('Failed to save category position:', posError);
      return NextResponse.json({ error: 'Failed to save position' }, { status: 500 });
    }
  }

  // Update videos if provided
  if (Array.isArray(videos)) {
    // Delete existing videos for this category
    const { error: deleteError } = await supabase
      .from('category_videos')
      .delete()
      .eq('category', category);

    if (deleteError) {
      console.error('Failed to delete existing videos:', deleteError);
      return NextResponse.json({ error: 'Failed to update videos' }, { status: 500 });
    }

    // Insert new videos
    if (videos.length > 0) {
      const videosToInsert = videos.map((v: { video_url: string; title: string; order_index: number }) => ({
        category,
        video_url: v.video_url,
        title: v.title,
        order_index: v.order_index || 0,
      }));

      const { error: insertError } = await supabase
        .from('category_videos')
        .insert(videosToInsert);

      if (insertError) {
        console.error('Failed to insert videos:', insertError);
        return NextResponse.json({ error: 'Failed to save videos' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
