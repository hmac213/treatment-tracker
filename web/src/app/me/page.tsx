import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/session';
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

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Your path</h1>
      <div className="space-y-4">
        {Object.entries(branches).map(([catKey, list]) => (
          <CategoryCard key={catKey} cat={catKey as CategoryKey} nodes={list} />
        ))}
      </div>
    </main>
  );
}

function CategoryCard({ cat, nodes }: { cat: CategoryKey; nodes: NodeRecord[] }) {
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
      <div className="px-4 pb-4">
        <Link href={`/unlock/${cat}`} className="inline-block rounded bg-green-700 text-white px-3 py-2 text-lg">Update symptoms</Link>
      </div>
    </div>
  );
} 