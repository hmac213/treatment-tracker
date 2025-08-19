import 'server-only';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';

export type SessionUser = { id: string; email: string; ts: number; admin?: boolean };

function parseSigned(signed: string | undefined): SessionUser | null {
  if (!signed) return null;
  const secret = process.env.APP_SECRET;
  if (!secret) return null;
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const h = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(value) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const signed = cookieStore.get('session')?.value;
  return parseSigned(signed);
}

export function getSessionUserFromRequest(req: NextRequest): SessionUser | null {
  const signed = req.cookies.get('session')?.value;
  return parseSigned(signed);
} 