import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/session';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
import Link from 'next/link';
import { categoryInfo, getCategoryForNodeKey, type CategoryKey } from '@/lib/categories';
import { NodeDisclosure } from '@/components/NodeDisclosure';

type NodeRecord = {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  video_url: string | null;
};

type Row = { node: NodeRecord | NodeRecord[] };
type EdgeRow = { parent_id: string; child_id: string; unlock_type: 'always' | 'manual' | 'symptom_match'; unlock_value: Record<string, unknown> | null; child?: { key: string }[] | { key: string } | null };

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-lg">Please go back and enter your email.</p>
        <Link href="/" className="text-blue-600 underline">Back to home</Link>
      </main>
    );
  }

  const supabase = createServiceClient();

  // Ensure user has basic unlocks (root + all 'always' edges) every time they visit dashboard
  await ensureUserHasBasicUnlocks(user.id);

  const { data: unlocked, error } = await supabase
    .from('user_unlocked_nodes')
    .select('node:node_id(id,key,title,summary,video_url)')
    .eq('user_id', user.id)
    .order('unlocked_at', { ascending: true });

  if (error) {
    return <main className="mx-auto max-w-3xl p-6">Failed to load your path.</main>;
  }

  const rows = (unlocked ?? []) as Row[];
  const nodes: NodeRecord[] = rows
    .map((r) => (Array.isArray(r.node) ? r.node[0] : r.node))
    .filter((n): n is NodeRecord => Boolean(n));

  const branches: Record<CategoryKey, NodeRecord[]> = {
    start: [], skincare: [], nutrition: [], oral_care: [], pain: [],
  };
  for (const n of nodes) branches[getCategoryForNodeKey(n.key)].push(n);

  // Check which categories have available symptoms to unlock
  const unlockedIds = new Set(nodes.map((n) => n.id));
  const { data: edges } = await supabase
    .from('edges')
    .select('parent_id,child_id,unlock_type,unlock_value, child:child_id(key)');

  const categoryHasSymptoms: Record<CategoryKey, boolean> = {
    start: false, skincare: false, nutrition: false, oral_care: false, pain: false,
  };

  for (const e of (edges ?? []) as EdgeRow[]) {
    // Parent must be unlocked
    if (!unlockedIds.has(e.parent_id)) continue;

    // Child must not already be unlocked
    if (unlockedIds.has(e.child_id)) continue;

    // Must be symptom-based unlock
    if (e.unlock_type !== 'symptom_match') continue;

    // Determine which category this child belongs to
    const childKey = Array.isArray(e.child) ? e.child[0]?.key : e.child?.key;
    if (childKey) {
      const childCategory = getCategoryForNodeKey(childKey);
      categoryHasSymptoms[childCategory] = true;
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Your path</h1>
      <div className="space-y-4">
        {Object.entries(branches).map(([catKey, list]) => (
          <CategoryCard key={catKey} cat={catKey as CategoryKey} nodes={list} hasSymptoms={categoryHasSymptoms[catKey as CategoryKey]} />
        ))}
      </div>
    </main>
  );
}

function CategoryCard({ cat, nodes, hasSymptoms }: { cat: CategoryKey; nodes: NodeRecord[]; hasSymptoms: boolean }) {
  const info = categoryInfo[cat];
  return (
    <div className="rounded-lg border" style={{ backgroundColor: info.color }}>
      <div className="px-4 py-3 border-b">
        <div className="text-xl font-semibold">{info.label}</div>
      </div>
      <div className="p-4 space-y-3">
        {nodes.length === 0 && (
          <div className="text-gray-700">No steps unlocked yet.</div>
        )}
        {nodes.map((n) => (
          <NodeDisclosure key={n.id} title={n.title} videoUrl={n.video_url ?? undefined} summary={n.summary ?? undefined} />
        ))}
      </div>
      {hasSymptoms && (
        <div className="px-4 pb-4">
          <Link href={`/unlock/${cat}`} className="inline-block rounded bg-green-700 text-white px-3 py-2 text-lg">Update symptoms</Link>
        </div>
      )}
    </div>
  );
} 