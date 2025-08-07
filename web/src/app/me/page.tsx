import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/session';
import Link from 'next/link';

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

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Your path</h1>
      <ul className="space-y-3">
        {nodes.map((node) => (
          <li key={node.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{node.title}</div>
                {node.summary && (
                  <p className="text-gray-700 mt-1">{node.summary}</p>
                )}
              </div>
              {node.video_url && (
                <a className="rounded bg-blue-600 text-white px-4 py-2 text-lg" href={node.video_url} target="_blank" rel="noreferrer">Play</a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div>
        <Link href="/unlock" className="rounded bg-green-600 text-white px-4 py-2 text-lg">Unlock next steps</Link>
      </div>
    </main>
  );
} 