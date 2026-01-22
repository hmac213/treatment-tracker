import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/session';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
import Link from 'next/link';
import { PatientTreeView, type PatientNode, type UnlockableChild } from '@/components/PatientTreeView';
import { InteractiveSVGTree } from '@/components/InteractiveSVGTree';

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

  // Fetch all nodes with their categories and positions
  const { data: nodesData } = await supabase
    .from('nodes')
    .select(`
      id,
      key,
      title,
      summary,
      is_root,
      pos_x,
      pos_y,
      box_width,
      box_height,
      node_categories(category),
      node_videos(*)
    `);

  const nodes: AppNode[] = nodesData?.map(node => ({
    ...node,
    categories: node.node_categories?.map((nc: { category: string }) => nc.category) || []
  })) || [];

  // Fetch all edges
  const { data: edges } = await supabase
    .from('edges')
    .select('id,parent_id,child_id,unlock_type,unlock_value,description,weight')
    .order('weight', { ascending: false });

  // Fetch user's unlocked nodes
  const { data: unlockedData } = await supabase
    .from('user_unlocked_nodes')
    .select('node_id')
    .eq('user_id', user.id);

  const unlockedNodeIds = new Set(unlockedData?.map(u => u.node_id) || []);

  // Fetch all symptoms for symptom matching
  const { data: symptomsData } = await supabase
    .from('symptoms')
    .select('key, label');

  const symptomsMap = new Map((symptomsData || []).map(s => [s.key, s.label]));

  // Fetch category videos and positions
  const { data: categoryVideosData } = await supabase
    .from('category_videos')
    .select('*')
    .order('category', { ascending: true })
    .order('order_index', { ascending: true });

  const { data: categoryPositionsData } = await supabase
    .from('category_positions')
    .select('*');

  // Group videos by category
  const categoryVideos: Record<string, { id: string; video_url: string; title: string; order_index: number }[]> = {};
  (categoryVideosData || []).forEach(video => {
    if (!categoryVideos[video.category]) {
      categoryVideos[video.category] = [];
    }
    categoryVideos[video.category].push({
      id: video.id,
      video_url: video.video_url,
      title: video.title,
      order_index: video.order_index,
    });
  });

  // Create positions map
  const categoryPositions: Record<string, { pos_x: number; pos_y: number; width: number; height: number }> = {};
  (categoryPositionsData || []).forEach(pos => {
    categoryPositions[pos.category] = {
      pos_x: Number(pos.pos_x),
      pos_y: Number(pos.pos_y),
      width: Number(pos.width),
      height: Number(pos.height),
    };
  });

  // Fetch node positions
  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  (nodesData || []).forEach(node => {
    if (node.pos_x !== null && node.pos_y !== null) {
      nodePositions[node.key] = {
        x: Number(node.pos_x),
        y: Number(node.pos_y),
        width: Number(node.box_width || 10),
        height: Number(node.box_height || 5),
      };
    }
  });

  // Fetch symptom positions
  const { data: symptomPositionsData } = await supabase
    .from('symptom_positions')
    .select('*');

  const symptomPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  (symptomPositionsData || []).forEach(pos => {
    symptomPositions[pos.position_key] = {
      x: Number(pos.pos_x),
      y: Number(pos.pos_y),
      width: Number(pos.width),
      height: Number(pos.height),
    };
  });

  // Fetch bonus content videos and positions
  const { data: bonusContentVideosData } = await supabase
    .from('bonus_content_videos')
    .select('*')
    .order('category', { ascending: true })
    .order('order_index', { ascending: true });

  const { data: bonusContentPositionsData } = await supabase
    .from('bonus_content_positions')
    .select('*');

  // Group bonus videos by category
  const bonusContentVideos: Record<string, { id: string; video_url: string; title: string; order_index: number }[]> = {};
  (bonusContentVideosData || []).forEach(video => {
    if (!bonusContentVideos[video.category]) {
      bonusContentVideos[video.category] = [];
    }
    bonusContentVideos[video.category].push({
      id: video.id,
      video_url: video.video_url,
      title: video.title,
      order_index: video.order_index,
    });
  });

  // Create bonus positions map
  const bonusContentPositions: Record<string, { pos_x: number; pos_y: number; width: number; height: number }> = {};
  (bonusContentPositionsData || []).forEach(pos => {
    bonusContentPositions[pos.category] = {
      pos_x: Number(pos.pos_x),
      pos_y: Number(pos.pos_y),
      width: Number(pos.width),
      height: Number(pos.height),
    };
  });

  // Build the patient tree structure
  const buildPatientTreeStructure = (nodes: AppNode[], edges: AppEdge[], unlockedIds: Set<string>) => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const childrenMap = new Map<string, { node: AppNode; edge: AppEdge }[]>();
    
    // Group edges by parent
    edges.forEach(edge => {
      const childNode = nodeMap.get(edge.child_id);
      if (childNode) {
        if (!childrenMap.has(edge.parent_id)) {
          childrenMap.set(edge.parent_id, []);
        }
        childrenMap.get(edge.parent_id)!.push({ node: childNode, edge });
      }
    });
    
    // Find which nodes are immediately unlockable
    const immediatelyUnlockable = new Set<string>();
    const unlockDescriptions = new Map<string, { description: string; type: string; value: unknown }>();
    
    edges.forEach(edge => {
      if (unlockedIds.has(edge.parent_id) && !unlockedIds.has(edge.child_id)) {
        immediatelyUnlockable.add(edge.child_id);
        unlockDescriptions.set(edge.child_id, {
          description: edge.description || 'This step can be unlocked now',
          type: edge.unlock_type,
          value: edge.unlock_value
        });
      }
    });

    // Build unlockable children map for each unlocked node
    const unlockableChildrenMap = new Map<string, UnlockableChild[]>();
    
    edges.forEach(edge => {
      // Only consider edges from unlocked parents to locked children
      if (unlockedIds.has(edge.parent_id) && !unlockedIds.has(edge.child_id)) {
        const childNode = nodeMap.get(edge.child_id);
        if (childNode) {
          if (!unlockableChildrenMap.has(edge.parent_id)) {
            unlockableChildrenMap.set(edge.parent_id, []);
          }
          
          // Extract symptoms from unlock_value
          const symptoms: string[] = [];
          if (edge.unlock_type === 'symptom_match' && edge.unlock_value) {
            const rule = edge.unlock_value as { any?: string[]; all?: string[] };
            const anySymptoms = rule.any || [];
            const allSymptoms = rule.all || [];
            symptoms.push(...anySymptoms, ...allSymptoms);
          }
          
          // Convert symptom keys to labels
          const symptomLabels = symptoms
            .map(key => symptomsMap.get(key) || key)
            .filter(Boolean);
          
          unlockableChildrenMap.get(edge.parent_id)!.push({
            childId: edge.child_id,
            childTitle: childNode.title,
            symptoms: symptomLabels,
            unlockDescription: edge.description || `Unlock ${childNode.title}`,
            edge: {
              id: edge.id,
              unlock_type: edge.unlock_type,
              unlock_value: edge.unlock_value
            }
          });
        }
      }
    });
    
    const rootNodes = nodes.filter(n => n.is_root);
    
    function buildPatientNode(nodeId: string, depth: number = 0): PatientNode | null {
      const node = nodeMap.get(nodeId);
      if (!node) return null;
      
      const nodeChildren = childrenMap.get(nodeId) || [];
      nodeChildren.sort((a, b) => {
        const weightA = a.edge.weight ?? 0;
        const weightB = b.edge.weight ?? 0;
        if (weightA !== weightB) return weightA - weightB;
        return a.node.title.localeCompare(b.node.title);
      });
      
      const childNodes = nodeChildren
        .map(({ node: childNode }) => buildPatientNode(childNode.id, depth + 1))
        .filter((node): node is PatientNode => node !== null);
      
      const unlockInfo = unlockDescriptions.get(nodeId);
      
      return {
        id: node.id,
        key: node.key,
        title: node.title,
        summary: node.summary,
        is_root: node.is_root,
        node_videos: node.node_videos || [],
        node_categories: node.categories?.map(cat => ({ category: cat })) || [],
        depth,
        children: childNodes,
        hasChildren: childNodes.length > 0,
        isUnlocked: unlockedIds.has(node.id),
        isImmediatelyUnlockable: immediatelyUnlockable.has(node.id),
        unlockDescription: unlockInfo?.description || null,
        unlockType: (unlockInfo?.type as 'always' | 'manual' | 'symptom_match') || null,
        unlockValue: (unlockInfo?.value as Record<string, unknown>) || null,
        unlockableChildren: unlockableChildrenMap.get(node.id) || []
      };
    }
    
    return rootNodes.map(root => buildPatientNode(root.id, 0)).filter((node): node is PatientNode => node !== null);
  };
  
  const treeStructure = buildPatientTreeStructure(nodes, edges || [], unlockedNodeIds);

  return (
    <main className="w-full">
      {/* Mobile/Small screens: Tree list view */}
      <div className="lg:hidden mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold mb-6">Your Treatment Path</h1>
        <PatientTreeView treeStructure={treeStructure} />
      </div>

      {/* Large screens: Interactive SVG tree */}
      <div className="hidden lg:block w-full h-screen">
        <InteractiveSVGTree 
          nodes={nodes} 
          edges={edges || []} 
          unlockedNodeIds={unlockedNodeIds}
          symptomsMap={symptomsMap}
          categoryVideos={categoryVideos}
          categoryPositions={categoryPositions}
          bonusContentVideos={bonusContentVideos}
          bonusContentPositions={bonusContentPositions}
          nodePositions={nodePositions}
          symptomPositions={symptomPositions}
        />
      </div>
    </main>
  );
} 