import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUserFromRequest } from '@/lib/session';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
import { getCategoryForNodeKey, type CategoryKey } from '@/lib/categories';

export const runtime = 'nodejs';

const schema = z.object({ symptoms: z.array(z.string()).default([]), category: z.string().optional() });

type EdgeRow = {
  id: string;
  parent_id: string;
  child_id: string;
  unlock_type: 'always' | 'manual' | 'symptom_match';
  unlock_value: Record<string, unknown> | null;
  child?: { key: string }[] | { key: string } | null;
};

type UnlockedRow = { node_id: string };

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parse = schema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const reported = new Set(parse.data.symptoms);
  const category = parse.data.category as CategoryKey | undefined;

  const supabase = createServiceClient();

  const { data: unlocked } = await supabase
    .from('user_unlocked_nodes')
    .select('node_id');

  const unlockedIds = new Set((unlocked ?? []).map((r: UnlockedRow) => r.node_id));

  const { data: edges } = await supabase
    .from('edges')
    .select('id,parent_id,child_id,unlock_type,unlock_value, child:child_id(key)');

  const toUnlock: string[] = [];
  for (const e of (edges ?? []) as EdgeRow[]) {
    if (!unlockedIds.has(e.parent_id)) continue;

    if (category) {
      const childKey = Array.isArray(e.child) ? e.child[0]?.key : e.child?.key;
      if (!childKey || getCategoryForNodeKey(childKey) !== category) continue;
    }

    if (e.unlock_type === 'always') {
      toUnlock.push(e.child_id);
      continue;
    }
    if (e.unlock_type === 'symptom_match') {
      const rule = (e.unlock_value ?? {}) as { any?: unknown; all?: unknown };
      const any = Array.isArray(rule.any) ? (rule.any as string[]) : [];
      const all = Array.isArray(rule.all) ? (rule.all as string[]) : [];
      const anyOk = any.length === 0 || any.some((k) => reported.has(k));
      const allOk = all.length === 0 || all.every((k) => reported.has(k));
      if (anyOk && allOk) toUnlock.push(e.child_id);
    }
  }

  const uniqueChildIds = Array.from(new Set(toUnlock)).filter((id) => !unlockedIds.has(id));

  if (uniqueChildIds.length > 0) {
    const rows = uniqueChildIds.map((node_id) => ({ user_id: user.id, node_id, unlocked_by: 'user', source: category ?? 'symptoms' }));
    await supabase.from('user_unlocked_nodes').insert(rows).select('*');
  }

  // After unlocking symptom-based nodes, also process any newly available 'always' edges
  await ensureUserHasBasicUnlocks(user.id);

  return NextResponse.json({ unlocked: uniqueChildIds });
} 