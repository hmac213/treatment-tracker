import { getSessionUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabaseClient';
import { NodeEditor } from '@/components/NodeEditor';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Node = { id: string; key: string; title: string; summary?: string | null; video_url?: string | null; is_root: boolean; order_index: number; pos_x?: number | null; pos_y?: number | null; category?: string | null };
type Edge = { id: string; parent_id: string; child_id: string; unlock_type: 'always' | 'manual' | 'symptom_match'; unlock_value: unknown; description?: string | null; weight?: number };

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
      video_url,
      is_root,
      order_index,
      pos_x,
      pos_y,
      node_categories(category)
    `);
  
  // Transform the data to match the expected format
  const nodes = nodesData?.map(node => ({
    ...node,
    categories: node.node_categories?.map((nc: any) => nc.category) || []
  })) || [];
  
  const { data: edges } = await supabase
    .from('edges')
    .select('id,parent_id,child_id,unlock_type,unlock_value,description,weight')
    .order('weight', { ascending: false });

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        <div className="shrink-0 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Node Editor</h1>
          <p className="text-muted-foreground">
            Edit individual node properties and characteristics
          </p>
        </div>
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
      </div>
    </AdminLayout>
  );
} 