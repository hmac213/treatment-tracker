import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { createServiceClient } from '@/lib/supabaseClient';
import { categoryInfo, type CategoryKey, getCategoryForNodeKey } from '@/lib/categories';
import { UnlockForm, type Symptom } from '@/components/UnlockForm';
import Link from 'next/link';

type UnlockedNodeRow = { node: { id: string; key: string }[] | { id: string; key: string } };
type EdgeRow = { parent_id: string; child_id: string; unlock_type: 'always' | 'manual' | 'symptom_match'; unlock_value: Record<string, unknown> | null; child?: { key: string }[] | { key: string } | null };

export default async function UnlockCategoryPage({ params }: { params: Promise<{ category: CategoryKey }> }) {
  const user = await getSessionUser();
  if (!user) notFound();

  const { category: cat } = await params;
  if (!['start', 'skincare', 'nutrition', 'oral_care', 'pain'].includes(cat)) notFound();

  const supabase = createServiceClient();

  // Load all unlocked nodes for the user (across all categories)
  const { data: unlocked } = await supabase
    .from('user_unlocked_nodes')
    .select('node:node_id(id,key)')
    .eq('user_id', user.id);

  const allUnlockedNodes = (unlocked ?? []).map((r: UnlockedNodeRow) => {
    const n = Array.isArray(r.node) ? r.node[0] : r.node;
    return n;
  }).filter((n): n is { id: string; key: string } => Boolean(n));

  const unlockedIds = new Set(allUnlockedNodes.map((n) => n.id));

  const { data: edges } = await supabase
    .from('edges')
    .select('parent_id,child_id,unlock_type,unlock_value, child:child_id(key)');

  const candidateSymptomKeys = new Set<string>();
  for (const e of (edges ?? []) as EdgeRow[]) {
    // Parent must be unlocked (any category)
    if (!unlockedIds.has(e.parent_id)) continue;

    // Child must belong to this category
    const childKey = Array.isArray(e.child) ? e.child[0]?.key : e.child?.key;
    const childInCat = childKey ? getCategoryForNodeKey(childKey) === cat : false;
    if (!childInCat) continue;

    // Child must not already be unlocked
    const notAlreadyUnlocked = !unlockedIds.has(e.child_id);
    if (!notAlreadyUnlocked) continue;

    // Collect symptom keys from rules
    if (e.unlock_type === 'symptom_match' && e.unlock_value) {
      const any = Array.isArray((e.unlock_value as { any?: unknown }).any) ? (e.unlock_value as { any?: string[] }).any ?? [] : [];
      const all = Array.isArray((e.unlock_value as { all?: unknown }).all) ? (e.unlock_value as { all?: string[] }).all ?? [] : [];
      for (const k of [...any, ...all]) candidateSymptomKeys.add(k);
    }
  }

  let symptomRows: Symptom[] = [];
  if (candidateSymptomKeys.size > 0) {
    const keys = Array.from(candidateSymptomKeys);
    const { data } = await supabase.from('symptoms').select('key,label').in('key', keys);
    symptomRows = (data ?? []) as Symptom[];
  }

  const info = categoryInfo[cat as CategoryKey];

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">{info.label}: Update symptoms</h1>
      <UnlockForm symptoms={symptomRows} category={cat} />
      {symptomRows.length === 0 && (
        <p className="text-gray-700">No additional symptoms needed right now for this category.</p>
      )}
      <Link href="/me" className="text-blue-700 underline">Back to my dashboard</Link>
    </main>
  );
} 