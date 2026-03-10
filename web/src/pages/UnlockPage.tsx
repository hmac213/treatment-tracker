import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { categoryInfo, getCategoryForNodeKey, type CategoryKey } from '@/lib/categories';
import { useAuth } from '@/components/AuthProvider';
import { UnlockForm, type Symptom } from '@/components/UnlockForm';
import { getSymptomsByKeys, listEdges, listNodes, listSymptoms, listUnlocksByUser } from '@/lib/lambdaDataClient';

const validCategories: CategoryKey[] = ['start', 'skincare', 'nutrition', 'oral_care', 'pain'];

export function UnlockPage() {
  const { user } = useAuth();
  const { category } = useParams();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [invalidCategory, setInvalidCategory] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      setInvalidCategory(false);

      try {
        if (!category) {
          const allSymptoms = await listSymptoms();
          if (active) setSymptoms(allSymptoms);
          return;
        }

        if (!validCategories.includes(category as CategoryKey)) {
          if (active) setInvalidCategory(true);
          return;
        }

        const [unlocked, edges, nodes] = await Promise.all([
          listUnlocksByUser(user.id),
          listEdges(),
          listNodes(),
        ]);

        const nodeById = new Map(nodes.map((n) => [(n as { id: string }).id, n]));
        const unlockedIds = new Set(unlocked.map((u) => u.node_id));
        const candidateSymptomKeys = new Set<string>();

        for (const edge of edges as Array<{ parent_id: string; child_id: string; unlock_type: string; unlock_value: unknown }>) {
          if (!unlockedIds.has(edge.parent_id)) continue;
          const childNode = nodeById.get(edge.child_id) as { key?: string } | undefined;
          const childKey = childNode?.key;
          if (!childKey || getCategoryForNodeKey(childKey as CategoryKey) !== category) continue;
          if (unlockedIds.has(edge.child_id)) continue;
          if (edge.unlock_type === 'symptom_match' && edge.unlock_value) {
            const rule = edge.unlock_value as { any?: string[]; all?: string[] };
            for (const key of [...(rule.any ?? []), ...(rule.all ?? [])]) {
              candidateSymptomKeys.add(key);
            }
          }
        }

        const rows = candidateSymptomKeys.size > 0 ? await getSymptomsByKeys(Array.from(candidateSymptomKeys)) : [];
        if (active) setSymptoms(rows);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [category, user]);

  if (!user) {
    return null;
  }

  if (invalidCategory) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-lg">Category not found.</p>
        <Link to="/me" className="text-blue-700 underline">
          Back to my dashboard
        </Link>
      </main>
    );
  }

  if (loading) {
    return <main className="mx-auto max-w-3xl p-6">Loading...</main>;
  }

  const info = category ? categoryInfo[category as CategoryKey] : null;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">
        {info ? `${info.label}: Update symptoms` : 'Unlock next steps'}
      </h1>
      <UnlockForm symptoms={symptoms} category={category as CategoryKey | undefined} />
      {category && symptoms.length === 0 && (
        <p className="text-gray-700">No additional symptoms needed right now for this category.</p>
      )}
      <Link to="/me" className="text-blue-700 underline">
        Back to my dashboard
      </Link>
    </main>
  );
}
