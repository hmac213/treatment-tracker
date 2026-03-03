import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserById, listUsers, deleteUser, deleteAllUnlocks, deleteAllUserEvents } from '@/lib/lambdaDataClient';
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

    const user = await getUserById(session.id);
    if (!user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const parse = clearDataSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { action } = parse.data;

    switch (action) {
      case 'users': {
        const allUsers = await listUsers();
        const nonAdmins = allUsers.filter((u) => !u.is_admin);
        for (const u of nonAdmins) {
          await deleteUser(u.id);
        }
        break;
      }
      case 'unlocks':
        await deleteAllUnlocks();
        await deleteAllUserEvents();
        break;
      case 'all':
        await deleteAllUnlocks();
        await deleteAllUserEvents();
        const users = await listUsers();
        for (const u of users.filter((x) => !x.is_admin)) {
          await deleteUser(u.id);
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
