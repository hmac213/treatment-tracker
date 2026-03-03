import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserFromRequest } from '@/lib/session';
import { listUsers } from '@/lib/lambdaDataClient';

export const runtime = 'nodejs';

const schema = z.object({ 
  searchTerm: z.string().min(1) 
});

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user?.admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parse = schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid search term' }, { status: 400 });
  }

  const { searchTerm } = parse.data;
  const term = searchTerm.toLowerCase();
  let users;
  try {
    const all = await listUsers();
    users = all
      .filter(
        (u) =>
          (u.email ?? '').toLowerCase().includes(term) || (u.name ?? '').toLowerCase().includes(term)
      )
      .slice(0, 20);
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
  return NextResponse.json({ users });
}
