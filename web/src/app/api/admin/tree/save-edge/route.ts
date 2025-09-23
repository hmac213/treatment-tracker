import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    // Check if user is logged in as admin
    const user = getSessionUserFromRequest(request);
    if (!user?.admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { edgeId, description } = await request.json();

    if (!edgeId) {
      return NextResponse.json({ error: 'Edge ID is required' }, { status: 400 });
    }

    // Update the edge description in the database
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('edges')
      .update({ 
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', edgeId);

    if (error) {
      console.error('Failed to update edge:', error);
      return NextResponse.json({ error: 'Failed to update edge description' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Edge save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
