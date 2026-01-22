import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, key, position } = body;

  if (!type || !key || !position) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (type === 'node') {
    // Update node position and box dimensions
    const { error } = await supabase
      .from('nodes')
      .update({
        pos_x: position.x,
        pos_y: position.y,
        box_width: position.width,
        box_height: position.height,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key);

    if (error) {
      console.error('Failed to save node position:', error);
      return NextResponse.json({ error: 'Failed to save node position' }, { status: 500 });
    }
  } else if (type === 'symptom') {
    // Update or insert symptom position
    const { error } = await supabase
      .from('symptom_positions')
      .upsert({
        position_key: key,
        pos_x: position.x,
        pos_y: position.y,
        width: position.width,
        height: position.height,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'position_key',
      });

    if (error) {
      console.error('Failed to save symptom position:', error);
      return NextResponse.json({ error: 'Failed to save symptom position' }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  // Get all nodes with positions
  const { data: nodes, error: nodesError } = await supabase
    .from('nodes')
    .select('key, pos_x, pos_y, box_width, box_height')
    .not('pos_x', 'is', null);

  if (nodesError) {
    console.error('Failed to fetch node positions:', nodesError);
    return NextResponse.json({ error: 'Failed to fetch node positions' }, { status: 500 });
  }

  // Get all symptom positions
  const { data: symptoms, error: symptomsError } = await supabase
    .from('symptom_positions')
    .select('*');

  if (symptomsError) {
    console.error('Failed to fetch symptom positions:', symptomsError);
    return NextResponse.json({ error: 'Failed to fetch symptom positions' }, { status: 500 });
  }

  // Format node positions
  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  (nodes || []).forEach(node => {
    if (node.pos_x !== null && node.pos_y !== null) {
      nodePositions[node.key] = {
        x: Number(node.pos_x),
        y: Number(node.pos_y),
        width: Number(node.box_width || 10),
        height: Number(node.box_height || 5),
      };
    }
  });

  // Format symptom positions
  const symptomPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  (symptoms || []).forEach(symptom => {
    symptomPositions[symptom.position_key] = {
      x: Number(symptom.pos_x),
      y: Number(symptom.pos_y),
      width: Number(symptom.width),
      height: Number(symptom.height),
    };
  });

  return NextResponse.json({
    nodes: nodePositions,
    symptoms: symptomPositions,
  });
}
