import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUserFromRequest } from '@/lib/session';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email(), name: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from('users').insert({ email: parsed.data.email.toLowerCase(), name: parsed.data.name });
  if (error) return NextResponse.json({ error: 'db' }, { status: 500 });
  return NextResponse.json({ ok: true });
} 