import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUserFromRequest } from '@/lib/session';

export const runtime = 'nodejs';

const clearDataSchema = z.object({
  action: z.enum(['users', 'unlocks', 'all']),
});

export async function POST(req: NextRequest) {
  try {
    // Verify admin session
    const session = getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const supabase = createServiceClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.id)
      .single();

    if (userError || !user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const parse = clearDataSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { action } = parse.data;

    // Execute the appropriate clearing action
    switch (action) {
      case 'users':
        // Clear all users except admins
        const { error: usersError } = await supabase
          .from('users')
          .delete()
          .eq('is_admin', false);
        
        if (usersError) {
          throw new Error('Failed to clear users: ' + usersError.message);
        }
        break;

      case 'unlocks':
        // Clear all user progress data
        const { error: unlocksError1 } = await supabase
          .from('user_unlocked_nodes')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

        const { error: unlocksError2 } = await supabase
          .from('user_events')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        
        if (unlocksError1 || unlocksError2) {
          throw new Error('Failed to clear user progress data');
        }
        break;

      case 'all':
        // Clear all data except admin users and core tree structure
        // First clear dependent tables
        await supabase.from('user_unlocked_nodes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('user_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        // Clear non-admin users
        const { error: allUsersError } = await supabase
          .from('users')
          .delete()
          .eq('is_admin', false);
        
        if (allUsersError) {
          throw new Error('Failed to clear all data: ' + allUsersError.message);
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${action} data` 
    });

  } catch (error) {
    console.error('Error clearing data:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
