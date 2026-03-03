import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { listUnlocksByUser, listEdges, listNodes, getSymptomsByKeys } from '@/lib/lambdaDataClient';
import { categoryInfo, type CategoryKey, getCategoryForNodeKey } from '@/lib/categories';
import { UnlockForm, type Symptom } from '@/components/UnlockForm';
import Link from 'next/link';

export default async function UnlockCategoryPage({ params }: { params: Promise<{ category: CategoryKey }> }) {
  const user = await getSessionUser();
  if (!user) notFound();

  const { category: cat } = await params;
  if (!['start', 'skincare', 'nutrition', 'oral_care', 'pain'].includes(cat)) notFound();

  const [unlocked, edges, nodes] = await Promise.all([
    listUnlocksByUser(user.id),
    listEdges(),
    listNodes(),
  ]);

  const nodeById = new Map(nodes.map((n) => [(n as { id: string }).id, n]));
  const unlockedIds = new Set(unlocked.map((u) => u.node_id));

  const candidateSymptomKeys = new Set<string>();
  for (const e of edges as Array<{ parent_id: string; child_id: string; unlock_type: string; unlock_value: unknown }>) {
    if (!unlockedIds.has(e.parent_id)) continue;
    const childNode = nodeById.get(e.child_id) as { key?: string } | undefined;
    const childKey = childNode?.key;
    if (!childKey || getCategoryForNodeKey(childKey as CategoryKey) !== cat) continue;
    if (unlockedIds.has(e.child_id)) continue;
    if (e.unlock_type === 'symptom_match' && e.unlock_value) {
      const rule = e.unlock_value as { any?: string[]; all?: string[] };
      const any = rule.any ?? [];
      const all = rule.all ?? [];
      for (const k of [...any, ...all]) candidateSymptomKeys.add(k);
    }
  }

  let symptomRows: Symptom[] = [];
  if (candidateSymptomKeys.size > 0) {
    symptomRows = await getSymptomsByKeys(Array.from(candidateSymptomKeys));
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