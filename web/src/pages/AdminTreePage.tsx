import { useEffect, useState } from 'react';
import { listCategoriesByNode, listEdges, listNodeVideos, listNodes } from '@/lib/lambdaDataClient';
import { AdminLayout } from '@/components/AdminLayout';
import { NodeEditor } from '@/components/NodeEditor';
import { AdminTreeView } from '@/components/AdminTreeView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Node = {
  id: string;
  key: string;
  title: string;
  summary?: string | null;
  is_root: boolean;
  order_index: number;
  pos_x?: number | null;
  pos_y?: number | null;
  category?: string | null;
  node_videos: { id: string; video_url: string; title: string; order_index: number }[];
};

type Edge = {
  id: string;
  parent_id: string;
  child_id: string;
  unlock_type: 'always' | 'manual' | 'symptom_match';
  unlock_value: unknown;
  description?: string | null;
  weight?: number;
};

type AppNode = {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  is_root: boolean;
  categories?: string[];
  node_videos: { id: string; video_url: string; title: string; order_index: number }[];
  order_index: number;
  pos_x?: number | null;
  pos_y?: number | null;
};

type AppEdge = {
  id: string;
  parent_id: string;
  child_id: string;
  unlock_type: 'always' | 'manual' | 'symptom_match';
  unlock_value: Record<string, unknown> | null;
  description?: string | null;
  weight?: number;
};

export function AdminTreePage() {
  const [nodes, setNodes] = useState<AppNode[] | null>(null);
  const [edges, setEdges] = useState<AppEdge[] | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const [nodesRaw, edgesRaw] = await Promise.all([listNodes(), listEdges()]);
      const mappedNodes = await Promise.all(
        nodesRaw.map(async (node) => {
          const nodeId = (node as { id: string }).id;
          const [categories, nodeVideos] = await Promise.all([listCategoriesByNode(nodeId), listNodeVideos(nodeId)]);
          return {
            id: nodeId,
            key: (node as { key: string }).key,
            title: (node as { title: string }).title,
            summary: (node as { summary?: string | null }).summary ?? null,
            is_root: (node as { is_root?: boolean }).is_root ?? false,
            order_index: (node as { order_index?: number }).order_index ?? 0,
            pos_x: (node as { pos_x?: number | null }).pos_x,
            pos_y: (node as { pos_y?: number | null }).pos_y,
            categories: categories.map((c) => c.category),
            node_videos: nodeVideos.map((v) => ({
              id: v.id,
              video_url: v.video_url,
              title: v.title,
              order_index: v.order_index,
            })),
          };
        })
      );

      if (!active) return;
      setNodes(mappedNodes);
      setEdges(edgesRaw.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)) as AppEdge[]);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  if (!nodes || !edges) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        <div className="shrink-0 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Tree Editor</h1>
          <p className="text-muted-foreground">Edit node properties, category videos, and tree structure</p>
        </div>
        <Tabs defaultValue="nodes" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mb-4">
            <TabsTrigger value="nodes">Node Editor</TabsTrigger>
            <TabsTrigger value="tree">Tree View & Category Videos</TabsTrigger>
          </TabsList>
          <TabsContent value="nodes" className="flex-1 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="shrink-0">
                <CardTitle>Node Properties Editor</CardTitle>
                <CardDescription>Browse the treatment tree and edit node content, titles, and categories</CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <NodeEditor initialNodes={nodes as Node[]} initialEdges={edges as Edge[]} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tree" className="flex-1 flex flex-col min-h-0">
            <AdminTreeView initialNodes={nodes} initialEdges={edges} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
