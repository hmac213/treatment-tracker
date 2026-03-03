import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import {
  listBonusContentVideos,
  listBonusContentPositions,
  putBonusContentPosition,
  deleteBonusContentVideosByCategory,
  putBonusContentVideo,
} from '@/lib/lambdaDataClient';

export async function GET(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const [videos, positions] = await Promise.all([listBonusContentVideos(), listBonusContentPositions()]);
    const videosByCategory = videos.reduce((acc, video) => {
      if (!acc[video.category]) acc[video.category] = [];
      acc[video.category].push(video);
      return acc;
    }, {} as Record<string, typeof videos>);
    const positionsMap = positions.reduce(
      (acc, pos) => {
        acc[pos.category] = { pos_x: pos.pos_x, pos_y: pos.pos_y, width: pos.width, height: pos.height };
        return acc;
      },
      {} as Record<string, { pos_x: number; pos_y: number; width: number; height: number }>
    );
    return NextResponse.json({ videos: videosByCategory, positions: positionsMap });
  } catch (err) {
    console.error('Failed to fetch bonus content:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { category, videos, position } = body;

  if (!category || !['skincare', 'nutrition', 'oral_care', 'introduction'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  try {
    if (position) {
      await putBonusContentPosition({
        category,
        pos_x: position.pos_x,
        pos_y: position.pos_y,
        width: position.width,
        height: position.height,
      });
    }
    if (Array.isArray(videos)) {
      await deleteBonusContentVideosByCategory(category);
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i] as { video_url: string; title: string; order_index?: number };
        await putBonusContentVideo({
          category,
          video_url: v.video_url,
          title: v.title,
          order_index: v.order_index ?? i,
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Failed to save bonus content:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
