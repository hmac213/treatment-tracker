import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
import { getStoredSession, clearStoredSession, setStoredSession, type SessionUser } from '@/lib/clientSession';
import {
  createUser,
  deleteAllUnlocks,
  deleteAllUserEvents,
  deleteBonusContentVideosByCategory,
  deleteCategoryVideosByCategory,
  deleteIntroTreeNode,
  deleteIntroTreeNodeVideo,
  deleteNodeVideo,
  deleteUnlocksByUser,
  deleteUser,
  getEdgesByChild,
  getIntroNodeByKey,
  getNodeByKey,
  getUnlock,
  getSymptomsByKeys,
  getUserByEmail,
  getUserById,
  insertUnlocks,
  listAllUnlocks,
  listBonusContentPositions,
  listBonusContentVideos,
  listCategoryPositions,
  listCategoryVideos,
  listEdges,
  listIntroTreeNodeVideos,
  listIntroTreeNodes,
  listNodeVideos,
  listNodes,
  listSymptoms,
  listSymptomPositions,
  listUnlocksByUser,
  listUsers,
  putBonusContentPosition,
  putBonusContentVideo,
  putCategoryPosition,
  putCategoryVideo,
  putEdge,
  putIntroTreeNode,
  putIntroTreeNodeVideo,
  putNode,
  putNodeVideo,
  putSymptom,
  putSymptomPosition,
  setNodeCategories,
} from '@/lib/lambdaDataClient';
import { getCategoryForNodeKey, type CategoryKey } from '@/lib/categories';

const loginSchema = z.object({ email: z.string().email() });
const adminLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const unlockSymptomsSchema = z.object({ symptoms: z.array(z.string()).default([]), category: z.string().optional() });
const createUserSchema = z.object({ email: z.string().email(), name: z.string().min(1) });
const clearDataSchema = z.object({ action: z.enum(['users', 'unlocks', 'all']) });
const symptomSchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
});

let installed = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function parseBody(init?: RequestInit) {
  if (!init?.body) return {};
  if (typeof init.body === 'string') {
    return JSON.parse(init.body);
  }
  return {};
}

function getSession() {
  return getStoredSession();
}

function setSession(user: SessionUser) {
  setStoredSession(user);
}

function requireSession() {
  const session = getSession();
  if (!session) {
    return { error: json({ error: 'Unauthorized' }, 401) };
  }
  return { session };
}

async function requireAdmin() {
  const session = getSession();
  if (!session?.admin) {
    return { error: json({ error: 'Unauthorized' }, 401) };
  }

  const user = await getUserById(session.id);
  if (!user?.is_admin) {
    return { error: json({ error: 'Admin access required' }, 403) };
  }

  return { session, user };
}

async function handleLogin(body: unknown) {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid email' }, 400);

  const data = await getUserByEmail(parsed.data.email.toLowerCase());
  if (!data) return json({ error: 'Email not found' }, 404);

  await ensureUserHasBasicUnlocks(data.id);

  const session: SessionUser = { id: data.id, email: data.email, ts: Date.now() };
  setSession(session);

  return json({ ok: true, user: { id: data.id, email: data.email, name: data.name } });
}

async function handleAdminLogin(body: unknown) {
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid input' }, 400);

  const data = await getUserByEmail(parsed.data.email.toLowerCase());
  const passwordHash = (data as { password_hash?: string } | null)?.password_hash;
  if (!data || !data.is_admin || !passwordHash) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const ok = await bcrypt.compare(parsed.data.password, passwordHash);
  if (!ok) return json({ error: 'Unauthorized' }, 401);

  const session: SessionUser = { id: data.id, email: data.email, admin: true, ts: Date.now() };
  setSession(session);
  return json({ ok: true, user: { id: data.id, email: data.email } });
}

async function handleUnlockNode(body: unknown) {
  const auth = requireSession();
  if ('error' in auth) return auth.error;

  const nodeId = (body as { nodeId?: string }).nodeId;
  if (!nodeId) return json({ error: 'nodeId is required' }, 400);

  const existingUnlock = await getUnlock(auth.session.id, nodeId);
  if (existingUnlock) return json({ error: 'Node already unlocked' }, 400);

  const unlocked = await listUnlocksByUser(auth.session.id);
  const unlockedIds = new Set(unlocked.map((u) => u.node_id));

  const edges = await getEdgesByChild(nodeId);
  const canUnlock = edges.some(
    (edge) =>
      unlockedIds.has(edge.parent_id) &&
      (edge.unlock_type === 'always' || edge.unlock_type === 'symptom_match')
  );

  if (!canUnlock) return json({ error: 'Node cannot be unlocked yet' }, 400);

  await insertUnlocks([{ user_id: auth.session.id, node_id: nodeId, unlocked_by: 'user', source: 'patient_unlock' }]);
  await ensureUserHasBasicUnlocks(auth.session.id);

  return json({ success: true });
}

async function handleUnlockBySymptoms(body: unknown) {
  const auth = requireSession();
  if ('error' in auth) return auth.error;

  const parsed = unlockSymptomsSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid' }, 400);

  const reported = new Set(parsed.data.symptoms);
  const category = parsed.data.category as CategoryKey | undefined;

  const unlocked = await listUnlocksByUser(auth.session.id);
  const unlockedIds = new Set(unlocked.map((r) => r.node_id));
  const [edges, nodes] = await Promise.all([listEdges(), listNodes()]);
  const nodeById = new Map(nodes.map((n) => [(n as { id: string }).id, n]));

  const toUnlock: string[] = [];
  for (const e of edges as Array<{ parent_id: string; child_id: string; unlock_type: string; unlock_value: unknown }>) {
    if (!unlockedIds.has(e.parent_id)) continue;

    const childNode = nodeById.get(e.child_id) as { key?: string } | undefined;
    const childKey = childNode?.key;
    if (category && (!childKey || getCategoryForNodeKey(childKey as CategoryKey) !== category)) continue;

    if (e.unlock_type === 'always') {
      toUnlock.push(e.child_id);
      continue;
    }

    if (e.unlock_type === 'symptom_match') {
      const rule = (e.unlock_value ?? {}) as { any?: unknown; all?: unknown };
      const any = Array.isArray(rule.any) ? (rule.any as string[]) : [];
      const all = Array.isArray(rule.all) ? (rule.all as string[]) : [];
      const anyOk = any.length === 0 || any.some((k) => reported.has(k));
      const allOk = all.length === 0 || all.every((k) => reported.has(k));
      if (anyOk && allOk) toUnlock.push(e.child_id);
    }
  }

  const uniqueChildIds = Array.from(new Set(toUnlock)).filter((id) => !unlockedIds.has(id));
  if (uniqueChildIds.length > 0) {
    await insertUnlocks(
      uniqueChildIds.map((node_id) => ({
        user_id: auth.session.id,
        node_id,
        unlocked_by: 'user',
        source: category ?? 'symptoms',
      }))
    );
  }

  await ensureUserHasBasicUnlocks(auth.session.id);
  return json({ unlocked: uniqueChildIds });
}

async function handleAdminPatientsUnlocks(userId: string) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const [unlocksList, nodes] = await Promise.all([listUnlocksByUser(userId), listNodes()]);
  const nodeMap = new Map(nodes.map((n) => [(n as { id: string }).id, n]));
  const unlocks = unlocksList
    .sort((a, b) => (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? ''))
    .map((u) => {
      const node = nodeMap.get(u.node_id) as { key?: string; title?: string } | undefined;
      return {
        node_id: u.node_id,
        unlocked_at: u.unlocked_at,
        unlocked_by: u.unlocked_by,
        source: u.source,
        node: node ? { key: node.key, title: node.title } : null,
      };
    });

  return json({ unlocks });
}

async function handleRequest(url: URL, init?: RequestInit) {
  const { pathname } = url;
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = await parseBody(init);

  if (pathname === '/api/login' && method === 'POST') return handleLogin(body);
  if (pathname === '/api/admin/login' && method === 'POST') return handleAdminLogin(body);
  if (pathname === '/api/logout' && method === 'POST') {
    clearStoredSession();
    return json({ ok: true });
  }
  if (pathname === '/api/unlock-node' && method === 'POST') return handleUnlockNode(body);
  if (pathname === '/api/unlock-by-symptoms' && method === 'POST') return handleUnlockBySymptoms(body);

  if (pathname === '/api/admin/users' && method === 'POST') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'invalid' }, 400);
    await createUser({ email: parsed.data.email.toLowerCase(), name: parsed.data.name });
    return json({ ok: true });
  }

  if (pathname === '/api/admin/patients/search' && method === 'POST') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const searchTerm = String((body as { searchTerm?: string }).searchTerm ?? '').trim().toLowerCase();
    if (!searchTerm) return json({ error: 'Invalid search term' }, 400);
    const users = (await listUsers())
      .filter((u) => (u.email ?? '').toLowerCase().includes(searchTerm) || (u.name ?? '').toLowerCase().includes(searchTerm))
      .slice(0, 20);
    return json({ users });
  }

  if (pathname === '/api/admin/clear-data' && method === 'POST') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const parsed = clearDataSchema.safeParse(body);
    if (!parsed.success) return json({ error: 'Invalid request body' }, 400);

    switch (parsed.data.action) {
      case 'users': {
        const users = await listUsers();
        for (const user of users.filter((u) => !u.is_admin)) {
          await deleteUser(user.id);
        }
        break;
      }
      case 'unlocks':
        await deleteAllUnlocks();
        await deleteAllUserEvents();
        break;
      case 'all': {
        await deleteAllUnlocks();
        await deleteAllUserEvents();
        const users = await listUsers();
        for (const user of users.filter((u) => !u.is_admin)) {
          await deleteUser(user.id);
        }
        break;
      }
    }

    return json({ success: true, message: `Successfully cleared ${parsed.data.action} data` });
  }

  if (pathname === '/api/admin/symptoms') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    if (method === 'GET') {
      return json({ symptoms: await listSymptoms() });
    }
    if (method === 'POST') {
      const parsed = symptomSchema.safeParse(body);
      if (!parsed.success) return json({ error: 'Invalid request body' }, 400);
      const symptom = await putSymptom({
        key: parsed.data.key,
        label: parsed.data.label,
        description: parsed.data.description ?? undefined,
      });
      return json({ symptom });
    }
  }

  if (pathname === '/api/admin/category-videos') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    if (method === 'GET') {
      const [videos, positions] = await Promise.all([listCategoryVideos(), listCategoryPositions()]);
      const videosByCategory = videos.reduce((acc, video) => {
        if (!acc[video.category]) acc[video.category] = [];
        acc[video.category].push(video);
        return acc;
      }, {} as Record<string, typeof videos>);
      const positionsMap = positions.reduce((acc, pos) => {
        acc[pos.category] = { pos_x: pos.pos_x, pos_y: pos.pos_y, width: pos.width, height: pos.height };
        return acc;
      }, {} as Record<string, { pos_x: number; pos_y: number; width: number; height: number }>);
      return json({ videos: videosByCategory, positions: positionsMap });
    }

    if (method === 'POST') {
      const { category, videos, position } = body as {
        category?: string;
        videos?: Array<{ video_url: string; title: string; order_index?: number }>;
        position?: { pos_x: number; pos_y: number; width: number; height: number };
      };
      if (!category || !['skincare', 'nutrition', 'oral_care', 'pain'].includes(category)) {
        return json({ error: 'Invalid category' }, 400);
      }
      if (position) {
        await putCategoryPosition({ category, ...position });
      }
      if (Array.isArray(videos)) {
        await deleteCategoryVideosByCategory(category);
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          await putCategoryVideo({
            category,
            video_url: video.video_url,
            title: video.title,
            order_index: video.order_index ?? i,
          });
        }
      }
      return json({ ok: true });
    }
  }

  if (pathname === '/api/admin/bonus-content') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    if (method === 'GET') {
      const [videos, positions] = await Promise.all([listBonusContentVideos(), listBonusContentPositions()]);
      const videosByCategory = videos.reduce((acc, video) => {
        if (!acc[video.category]) acc[video.category] = [];
        acc[video.category].push(video);
        return acc;
      }, {} as Record<string, typeof videos>);
      const positionsMap = positions.reduce((acc, pos) => {
        acc[pos.category] = { pos_x: pos.pos_x, pos_y: pos.pos_y, width: pos.width, height: pos.height };
        return acc;
      }, {} as Record<string, { pos_x: number; pos_y: number; width: number; height: number }>);
      return json({ videos: videosByCategory, positions: positionsMap });
    }

    if (method === 'POST') {
      const { category, videos, position } = body as {
        category?: string;
        videos?: Array<{ video_url: string; title: string; order_index?: number }>;
        position?: { pos_x: number; pos_y: number; width: number; height: number };
      };
      if (!category || !['skincare', 'nutrition', 'oral_care', 'introduction'].includes(category)) {
        return json({ error: 'Invalid category' }, 400);
      }
      if (position) {
        await putBonusContentPosition({ category, ...position });
      }
      if (Array.isArray(videos)) {
        await deleteBonusContentVideosByCategory(category);
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          await putBonusContentVideo({
            category,
            video_url: video.video_url,
            title: video.title,
            order_index: video.order_index ?? i,
          });
        }
      }
      return json({ ok: true });
    }
  }

  if (pathname === '/api/admin/positions') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;

    if (method === 'GET') {
      const [nodes, symptoms] = await Promise.all([listNodes(), listSymptomPositions()]);
      const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
      nodes.forEach((node) => {
        const n = node as { key: string; pos_x?: number | null; pos_y?: number | null; box_width?: number | null; box_height?: number | null };
        if (n.pos_x != null && n.pos_y != null) {
          nodePositions[n.key] = {
            x: Number(n.pos_x),
            y: Number(n.pos_y),
            width: Number(n.box_width ?? 10),
            height: Number(n.box_height ?? 5),
          };
        }
      });
      const symptomPositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
      symptoms.forEach((s) => {
        symptomPositions[s.position_key] = {
          x: Number(s.pos_x),
          y: Number(s.pos_y),
          width: Number(s.width),
          height: Number(s.height),
        };
      });
      return json({ nodes: nodePositions, symptoms: symptomPositions });
    }

    if (method === 'POST') {
      const { type, key, position } = body as {
        type?: 'node' | 'symptom';
        key?: string;
        position?: { x: number; y: number; width: number; height: number };
      };
      if (!type || !key || !position) return json({ error: 'Missing required fields' }, 400);

      if (type === 'node') {
        const node = await getNodeByKey(key);
        if (!node) return json({ error: 'Node not found' }, 404);
        await putNode({
          id: (node as { id: string }).id,
          key: (node as { key: string }).key,
          title: (node as { title: string }).title,
          summary: (node as { summary?: string | null }).summary ?? null,
          is_root: (node as { is_root?: boolean }).is_root,
          order_index: (node as { order_index?: number }).order_index,
          pos_x: position.x,
          pos_y: position.y,
          box_width: position.width,
          box_height: position.height,
        });
      } else {
        await putSymptomPosition({
          position_key: key,
          pos_x: position.x,
          pos_y: position.y,
          width: position.width,
          height: position.height,
        });
      }
      return json({ ok: true });
    }
  }

  if (pathname === '/api/admin/tree/save' && method === 'POST') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const nodes = Array.isArray((body as { nodes?: unknown[] }).nodes) ? ((body as { nodes: Array<Record<string, unknown>> }).nodes) : [];
    for (const node of nodes) {
      await putNode({
        id: node.id as string,
        key: node.key as string,
        title: node.title as string,
        summary: (node.summary as string | null | undefined) ?? null,
        is_root: node.is_root as boolean | undefined,
        order_index: node.order_index as number | undefined,
        pos_x: node.pos_x as number | null | undefined,
        pos_y: node.pos_y as number | null | undefined,
      });
      await setNodeCategories(node.id as string, ((node.categories as string[] | undefined) ?? []));
      const existing = await listNodeVideos(node.id as string);
      for (const video of existing) {
        await deleteNodeVideo(node.id as string, video.id);
      }
      for (let i = 0; i < (((node.node_videos as unknown[]) ?? []).length); i++) {
        const video = (node.node_videos as Array<{ id?: string; video_url: string; title: string; order_index?: number }>)[i];
        await putNodeVideo(node.id as string, {
          id: video.id,
          video_url: video.video_url,
          title: video.title,
          order_index: video.order_index ?? i,
        });
      }
    }
    return json({ ok: true });
  }

  if (pathname === '/api/admin/tree/save-edge' && method === 'POST') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { edgeId, description } = body as { edgeId?: string; description?: string | null };
    if (!edgeId) return json({ error: 'Edge ID is required' }, 400);
    const edge = (await listEdges()).find((e) => (e as { id: string }).id === edgeId);
    if (!edge) return json({ error: 'Edge not found' }, 404);
    const e = edge as { id: string; parent_id: string; child_id: string; unlock_type: string; unlock_value?: unknown; description?: string | null; weight?: number };
    await putEdge({
      id: e.id,
      parent_id: e.parent_id,
      child_id: e.child_id,
      unlock_type: e.unlock_type,
      unlock_value: e.unlock_value,
      description: description ?? e.description ?? null,
      weight: e.weight,
    });
    return json({ success: true });
  }

  if (pathname === '/api/admin/introduction-tree') {
    const auth = method === 'GET' ? requireSession() : await requireAdmin();
    if ('error' in auth) return auth.error;

    if (method === 'GET') {
      const nodes = await listIntroTreeNodes();
      const formattedNodes = await Promise.all(
        nodes.map(async (node) => ({
          id: node.id,
          node_key: node.node_key,
          title: node.title,
          pos_x: node.pos_x,
          pos_y: node.pos_y,
          width: node.width,
          height: node.height,
          videos: (await listIntroTreeNodeVideos(node.id)).sort((a, b) => a.order_index - b.order_index),
        }))
      );
      formattedNodes.sort((a, b) => a.title.localeCompare(b.title));
      return json({ nodes: formattedNodes });
    }

    if (method === 'POST') {
      const { action, node } = body as {
        action?: 'upsert_node' | 'delete_node';
        node?: {
          id?: string;
          node_key: string;
          title: string;
          pos_x: number;
          pos_y: number;
          width: number;
          height: number;
          videos?: Array<{ video_url: string; title: string; order_index?: number }>;
        };
      };
      if (!node) return json({ error: 'Invalid action' }, 400);
      if (action === 'upsert_node') {
        const existing = node.id ? null : await getIntroNodeByKey(node.node_key);
        const nodeId = (existing as { id?: string } | null)?.id ?? node.id ?? undefined;
        const savedNode = await putIntroTreeNode({
          id: nodeId,
          node_key: node.node_key,
          title: node.title,
          pos_x: Number(node.pos_x),
          pos_y: Number(node.pos_y),
          width: Number(node.width),
          height: Number(node.height),
        });
        const savedId = (savedNode as { id: string }).id;
        if (Array.isArray(node.videos)) {
          const existingVideos = await listIntroTreeNodeVideos(savedId);
          for (const video of existingVideos) {
            await deleteIntroTreeNodeVideo(savedId, video.id);
          }
          const toInsert = node.videos.filter((video) => video.video_url && video.title);
          for (let i = 0; i < toInsert.length; i++) {
            const video = toInsert[i];
            await putIntroTreeNodeVideo(savedId, {
              video_url: video.video_url,
              title: video.title,
              order_index: video.order_index ?? i,
            });
          }
        }
        return json({ node: { ...savedNode, id: savedId } });
      }

      if (action === 'delete_node') {
        if (!node.id) return json({ error: 'Node ID required' }, 400);
        await deleteIntroTreeNode(node.id);
        return json({ ok: true });
      }
    }
  }

  const unlocksMatch = pathname.match(/^\/api\/admin\/patients\/([^/]+)\/unlocks$/);
  if (unlocksMatch && method === 'GET') {
    return handleAdminPatientsUnlocks(unlocksMatch[1]);
  }

  const resetMatch = pathname.match(/^\/api\/admin\/patients\/([^/]+)\/reset$/);
  if (resetMatch && method === 'POST') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const userId = resetMatch[1];
    await deleteUnlocksByUser(userId);
    await ensureUserHasBasicUnlocks(userId);
    return json({ success: true });
  }

  const unlockAllMatch = pathname.match(/^\/api\/admin\/patients\/([^/]+)\/unlock-all$/);
  if (unlockAllMatch && method === 'POST') {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const userId = unlockAllMatch[1];
    const [allNodes, currentUnlocks] = await Promise.all([listNodes(), listUnlocksByUser(userId)]);
    const unlockedIds = new Set(currentUnlocks.map((u) => u.node_id));
    const rows = allNodes
      .filter((node) => !unlockedIds.has((node as { id: string }).id))
      .map((node) => ({
        user_id: userId,
        node_id: (node as { id: string }).id,
        unlocked_by: 'admin' as const,
        source: 'admin_unlock_all',
      }));
    if (rows.length > 0) {
      await insertUnlocks(rows);
    }
    return json({ success: true, unlockedCount: rows.length });
  }

  return null;
}

export function installApiInterceptor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? new URL(String(input), window.location.origin) : new URL(input.url, window.location.origin);

    if (!url.pathname.startsWith('/api/')) {
      return originalFetch(input, init);
    }

    const response = await handleRequest(url, init);
    if (response) return response;

    return json({ error: `No handler for ${url.pathname}` }, 404);
  };
}
