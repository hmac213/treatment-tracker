import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserById, listSymptoms, putSymptom } from '@/lib/lambdaDataClient';
import { getSessionUserFromRequest } from '@/lib/session';

export const runtime = 'nodejs';

const symptomSchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
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
    const symptoms = await listSymptoms();
    return NextResponse.json({ symptoms });

  } catch (error) {
    console.error('Error fetching symptoms:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

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
    const parse = symptomSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { key, label, description } = parse.data;
    const symptom = await putSymptom({ key, label, description: description ?? undefined });
    return NextResponse.json({ symptom });

  } catch (error) {
    console.error('Error creating symptom:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
