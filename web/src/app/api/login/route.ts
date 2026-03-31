import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail } from '@/lib/lambdaDataClient';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
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
  try {
    if (!process.env.APP_SECRET) {
      console.error('[login] APP_SECRET is not set');
      return NextResponse.json({ error: 'Server misconfiguration: APP_SECRET not set' }, { status: 500 });
    }
    if (!process.env.LAMBDA_DATA_API_URL?.trim()) {
      console.error('[login] LAMBDA_DATA_API_URL is not set');
      return NextResponse.json({ error: 'Server misconfiguration: LAMBDA_DATA_API_URL not set' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const parse = requestSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const email = parse.data.email.toLowerCase();
    let data;
    try {
      data = await getUserByEmail(email);
    } catch (err) {
      console.error('[login] getUserByEmail failed:', err);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Auto-unlock root and all 'always' nodes for this user (non-blocking: don't fail login)
    try {
      await ensureUserHasBasicUnlocks(data.id);
    } catch (err) {
      console.error('[login] ensureUserHasBasicUnlocks failed:', err);
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
  } catch (err) {
    console.error('[login] Unexpected error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 