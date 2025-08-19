import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabaseClient';
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

    // Fetch all symptoms
    const { data: symptoms, error: symptomsError } = await supabase
      .from('symptoms')
      .select('*')
      .order('label');

    if (symptomsError) {
      throw new Error('Failed to fetch symptoms: ' + symptomsError.message);
    }

    return NextResponse.json({ symptoms: symptoms || [] });

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
    const parse = symptomSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { key, label, description } = parse.data;

    // Insert new symptom
    const { data: symptom, error: insertError } = await supabase
      .from('symptoms')
      .insert({
        key,
        label,
        description: description || null,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error('Failed to create symptom: ' + insertError.message);
    }

    return NextResponse.json({ symptom });

  } catch (error) {
    console.error('Error creating symptom:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
