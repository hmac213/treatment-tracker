import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listUnlocksByUser, listEdges, insertUnlocks } from '@/lib/lambdaDataClient';
import { getSessionUserFromRequest } from '@/lib/session';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
import { getCategoryForNodeKey, type CategoryKey } from '@/lib/categories';

export const runtime = 'nodejs';

const schema = z.object({ symptoms: z.array(z.string()).default([]), category: z.string().optional() });

export async function POST(req: NextRequest) {
  const user = getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parse = schema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const reported = new Set(parse.data.symptoms);
  const category = parse.data.category as CategoryKey | undefined;

  const unlocked = await listUnlocksByUser(user.id);
  const unlockedIds = new Set(unlocked.map((r) => r.node_id));

  const edges = await listEdges();
  const nodes = await import('@/lib/lambdaDataClient').then((m) => m.listNodes());
  const nodeById = new Map(nodes.map((n) => [(n as { id: string }).id, n]));

  const toUnlock: string[] = [];
  for (const e of edges as Array<{ parent_id: string; child_id: string; unlock_type: string; unlock_value: unknown }>) {
    if (!unlockedIds.has(e.parent_id)) continue;

    const childNode = nodeById.get(e.child_id) as { key?: string } | undefined;
    const childKey = childNode?.key;
    if (category && (!childKey || getCategoryForNodeKey(childKey as CategoryKey) !== category)) continue;

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
    const rows = uniqueChildIds.map((node_id) => ({
      user_id: user.id,
      node_id,
      unlocked_by: 'user',
      source: category ?? 'symptoms',
    }));
    await insertUnlocks(rows);
  }

  // After unlocking symptom-based nodes, also process any newly available 'always' edges
  await ensureUserHasBasicUnlocks(user.id);

  return NextResponse.json({ unlocked: uniqueChildIds });
} 