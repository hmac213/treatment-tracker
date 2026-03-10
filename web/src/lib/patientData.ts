import {
  listBonusContentPositions,
  listBonusContentVideos,
  listCategoriesByNode,
  listCategoryPositions,
  listCategoryVideos,
  listEdges,
  listNodeVideos,
  listNodes,
  listSymptoms,
  listSymptomPositions,
  listUnlocksByUser,
} from '@/lib/lambdaDataClient';
import { type PatientNode, type UnlockableChild } from '@/components/PatientTreeView';

type AppNode = {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  is_root: boolean;
  categories?: string[];
  node_videos: { id: string; video_url: string; title: string; order_index: number }[];
  pos_x?: number | null;
  pos_y?: number | null;
  box_width?: number | null;
  box_height?: number | null;
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

export async function loadPatientViewData(userId: string) {
  const [
    nodesRaw,
    edgesRaw,
    unlockedRaw,
    symptomsRaw,
    categoryVideosRaw,
    categoryPositionsRaw,
    symptomPositionsRaw,
    bonusVideosRaw,
    bonusPositionsRaw,
  ] = await Promise.all([
    listNodes(),
    listEdges(),
    listUnlocksByUser(userId),
    listSymptoms(),
    listCategoryVideos(),
    listCategoryPositions(),
    listSymptomPositions(),
    listBonusContentVideos(),
    listBonusContentPositions(),
  ]);

  const nodes: AppNode[] = await Promise.all(
    nodesRaw.map(async (node) => {
      const nodeId = (node as { id: string }).id;
      const [categories, nodeVideos] = await Promise.all([listCategoriesByNode(nodeId), listNodeVideos(nodeId)]);

      return {
        ...node,
        id: nodeId,
        key: (node as { key: string }).key,
        title: (node as { title: string }).title,
        summary: (node as { summary?: string | null }).summary ?? null,
        is_root: (node as { is_root?: boolean }).is_root ?? false,
        pos_x: (node as { pos_x?: number | null }).pos_x,
        pos_y: (node as { pos_y?: number | null }).pos_y,
        box_width: (node as { box_width?: number | null }).box_width,
        box_height: (node as { box_height?: number | null }).box_height,
        categories: categories.map((c) => c.category),
        node_videos: nodeVideos.map((v) => ({
          id: v.id,
          video_url: v.video_url,
          title: v.title,
          order_index: v.order_index,
        })),
      } as AppNode;
    })
  );

  const edges = edgesRaw.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)) as AppEdge[];
  const unlockedNodeIds = new Set(unlockedRaw.map((u) => u.node_id));
  const symptomsMap = new Map(symptomsRaw.map((s) => [s.key, s.label]));

  const categoryVideos: Record<string, { id: string; video_url: string; title: string; order_index: number }[]> = {};
  categoryVideosRaw.forEach((video) => {
    if (!categoryVideos[video.category]) categoryVideos[video.category] = [];
    categoryVideos[video.category].push({
      id: video.id,
      video_url: video.video_url,
      title: video.title,
      order_index: video.order_index,
    });
  });

  const categoryPositions: Record<string, { pos_x: number; pos_y: number; width: number; height: number }> = {};
  categoryPositionsRaw.forEach((pos) => {
    categoryPositions[pos.category] = {
      pos_x: Number(pos.pos_x),
      pos_y: Number(pos.pos_y),
      width: Number(pos.width),
      height: Number(pos.height),
    };
  });

  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  nodes.forEach((node) => {
    if (node.pos_x != null && node.pos_y != null) {
      nodePositions[node.key] = {
        x: Number(node.pos_x),
        y: Number(node.pos_y),
        width: Number(node.box_width ?? 10),
        height: Number(node.box_height ?? 5),
      };
    }
  });

  const symptomPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  symptomPositionsRaw.forEach((pos) => {
    symptomPositions[pos.position_key] = {
      x: Number(pos.pos_x),
      y: Number(pos.pos_y),
      width: Number(pos.width),
      height: Number(pos.height),
    };
  });

  const bonusContentVideos: Record<string, { id: string; video_url: string; title: string; order_index: number }[]> = {};
  bonusVideosRaw.forEach((video) => {
    if (!bonusContentVideos[video.category]) bonusContentVideos[video.category] = [];
    bonusContentVideos[video.category].push({
      id: video.id,
      video_url: video.video_url,
      title: video.title,
      order_index: video.order_index,
    });
  });

  const bonusContentPositions: Record<string, { pos_x: number; pos_y: number; width: number; height: number }> = {};
  bonusPositionsRaw.forEach((pos) => {
    bonusContentPositions[pos.category] = {
      pos_x: Number(pos.pos_x),
      pos_y: Number(pos.pos_y),
      width: Number(pos.width),
      height: Number(pos.height),
    };
  });

  return {
    nodes,
    edges,
    unlockedNodeIds,
    symptomsMap,
    categoryVideos,
    categoryPositions,
    nodePositions,
    symptomPositions,
    bonusContentVideos,
    bonusContentPositions,
    treeStructure: buildPatientTreeStructure(nodes, edges, unlockedNodeIds, symptomsMap),
  };
}

function buildPatientTreeStructure(
  nodes: AppNode[],
  edges: AppEdge[],
  unlockedIds: Set<string>,
  symptomsMap: Map<string, string>
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map<string, { node: AppNode; edge: AppEdge }[]>();

  edges.forEach((edge) => {
    const childNode = nodeMap.get(edge.child_id);
    if (!childNode) return;
    if (!childrenMap.has(edge.parent_id)) {
      childrenMap.set(edge.parent_id, []);
    }
    childrenMap.get(edge.parent_id)!.push({ node: childNode, edge });
  });

  const immediatelyUnlockable = new Set<string>();
  const unlockDescriptions = new Map<string, { description: string; type: string; value: unknown }>();

  edges.forEach((edge) => {
    if (unlockedIds.has(edge.parent_id) && !unlockedIds.has(edge.child_id)) {
      immediatelyUnlockable.add(edge.child_id);
      unlockDescriptions.set(edge.child_id, {
        description: edge.description || 'This step can be unlocked now',
        type: edge.unlock_type,
        value: edge.unlock_value,
      });
    }
  });

  const unlockableChildrenMap = new Map<string, UnlockableChild[]>();
  edges.forEach((edge) => {
    if (!unlockedIds.has(edge.parent_id) || unlockedIds.has(edge.child_id)) return;
    const childNode = nodeMap.get(edge.child_id);
    if (!childNode) return;
    if (!unlockableChildrenMap.has(edge.parent_id)) {
      unlockableChildrenMap.set(edge.parent_id, []);
    }

    const symptoms: string[] = [];
    if (edge.unlock_type === 'symptom_match' && edge.unlock_value) {
      const rule = edge.unlock_value as { any?: string[]; all?: string[] };
      symptoms.push(...(rule.any || []), ...(rule.all || []));
    }

    unlockableChildrenMap.get(edge.parent_id)!.push({
      childId: edge.child_id,
      childTitle: childNode.title,
      symptoms: symptoms.map((key) => symptomsMap.get(key) || key).filter(Boolean),
      unlockDescription: edge.description || `Unlock ${childNode.title}`,
      edge: {
        id: edge.id,
        unlock_type: edge.unlock_type,
        unlock_value: edge.unlock_value,
      },
    });
  });

  const rootNodes = nodes.filter((n) => n.is_root);

  function buildPatientNode(nodeId: string, depth = 0): PatientNode | null {
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
      .filter((child): child is PatientNode => child !== null);

    const unlockInfo = unlockDescriptions.get(nodeId);
    return {
      id: node.id,
      key: node.key,
      title: node.title,
      summary: node.summary,
      is_root: node.is_root,
      node_videos: node.node_videos || [],
      node_categories: node.categories?.map((category) => ({ category })) || [],
      depth,
      children: childNodes,
      hasChildren: childNodes.length > 0,
      isUnlocked: unlockedIds.has(node.id),
      isImmediatelyUnlockable: immediatelyUnlockable.has(node.id),
      unlockDescription: unlockInfo?.description || null,
      unlockType: (unlockInfo?.type as 'always' | 'manual' | 'symptom_match') || null,
      unlockValue: (unlockInfo?.value as Record<string, unknown>) || null,
      unlockableChildren: unlockableChildrenMap.get(node.id) || [],
    };
  }

  return rootNodes.map((root) => buildPatientNode(root.id, 0)).filter((node): node is PatientNode => node !== null);
}
