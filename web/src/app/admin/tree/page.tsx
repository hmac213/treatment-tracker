import { getSessionUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabaseClient';
import { NodeEditor } from '@/components/NodeEditor';
import { AdminTreeView } from '@/components/AdminTreeView';
import { AdminLayout } from '@/components/AdminLayout';
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
type Edge = { id: string; parent_id: string; child_id: string; unlock_type: 'always' | 'manual' | 'symptom_match'; unlock_value: unknown; description?: string | null; weight?: number };

type AppNode = {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  is_root: boolean;
  categories?: string[];
  node_videos: { id: string; video_url: string; title: string; order_index: number }[];
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

export default async function TreePage() {
  const user = await getSessionUser();
  if (!user?.admin) {
    redirect('/admin');
  }

  const supabase = createServiceClient();
  
  // Get nodes with their categories using the new junction table
  const { data: nodesData } = await supabase
    .from('nodes')
    .select(`
      id,
      key,
      title,
      summary,
      is_root,
      order_index,
      pos_x,
      pos_y,
      node_categories(category),
      node_videos(*)
    `);
  
  // Transform the data to match the expected format
  const nodes = nodesData?.map(node => ({
    ...node,
    categories: node.node_categories?.map((nc: { category: string }) => nc.category) || []
  })) || [];
  
  const { data: edges } = await supabase
    .from('edges')
    .select('id,parent_id,child_id,unlock_type,unlock_value,description,weight')
    .order('weight', { ascending: false });

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        <div className="shrink-0 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Tree Editor</h1>
          <p className="text-muted-foreground">
            Edit node properties, category videos, and tree structure
          </p>
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
                <CardDescription>
                  Browse the treatment tree and edit node content, titles, and categories
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <NodeEditor initialNodes={(nodes ?? []) as Node[]} initialEdges={(edges ?? []) as Edge[]} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tree" className="flex-1 flex flex-col min-h-0">
            <AdminTreeView 
              initialNodes={(nodes ?? []).map(n => ({
                id: n.id,
                key: n.key,
                title: n.title,
                summary: n.summary ?? null,
                is_root: n.is_root,
                categories: n.categories || [],
                node_videos: n.node_videos || [],
              }))} 
              initialEdges={(edges ?? []).map(e => ({
                id: e.id,
                parent_id: e.parent_id,
                child_id: e.child_id,
                unlock_type: e.unlock_type,
                unlock_value: (e.unlock_value as Record<string, unknown>) ?? null,
                description: e.description ?? null,
                weight: e.weight,
              }))} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
} 