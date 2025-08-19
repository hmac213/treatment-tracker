import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabaseClient';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const requestSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function sign(value: string) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error('APP_SECRET not set');
  const h = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  return `${value}.${h}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { email, password } = parsed.data;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('users')
    .select('id,email,name,is_admin,password_hash')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error || !data || !data.is_admin || !data.password_hash) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = JSON.stringify({ id: data.id, email: data.email, admin: true, ts: Date.now() });
  const signed = sign(payload);

  const res = NextResponse.json({ ok: true, user: { id: data.id, email: data.email } });
  res.cookies.set('session', signed, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
} 