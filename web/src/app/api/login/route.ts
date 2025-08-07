import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabaseClient';
import crypto from 'crypto';

export const runtime = 'nodejs';

const requestSchema = z.object({ email: z.string().email() });

function sign(value: string) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error('APP_SECRET not set');
  const h = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}.${h}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parse = requestSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const email = parse.data.email.toLowerCase();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('users')
    .select('id,email,name')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  const payload = JSON.stringify({ id: data.id, email: data.email, ts: Date.now() });
  const signed = sign(payload);

  const res = NextResponse.json({ ok: true, user: { id: data.id, email: data.email, name: data.name } });
  res.cookies.set('session', signed, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
} 