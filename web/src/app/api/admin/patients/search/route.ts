import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserFromRequest } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';

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
  const supabase = createServiceClient();

  // Search by name (ILIKE) or email (ILIKE)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, created_at')
    .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({ users });
}
