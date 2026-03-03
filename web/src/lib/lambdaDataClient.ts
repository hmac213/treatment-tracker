/**
 * Client for the treatment-tracker Lambda data API.
 * All methods call the Lambda URL with action + params and return the parsed data (or throw).
 * Set LAMBDA_DATA_API_URL in env (server-side only).
 */

const LAMBDA_URL = process.env.LAMBDA_DATA_API_URL;

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!LAMBDA_URL?.trim()) {
    throw new Error('LAMBDA_DATA_API_URL is not set');
  }
  const res = await fetch(LAMBDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!json.success) {
    throw new Error(json.error || 'Lambda request failed');
  }
  return json.data as T;
}

// ---------- Users ----------
export async function getUserByEmail(email: string) {
  return invoke<{ id: string; email: string; name: string | null; created_at: string; is_admin?: boolean } | null>(
    'GetUserByEmail',
    { email }
  );
}

export async function getUserById(id: string) {
  return invoke<{ id: string; email: string; name: string | null; created_at: string; is_admin?: boolean } | null>(
    'GetUserById',
    { id }
  );
}

export async function createUser(params: { email: string; name?: string; is_admin?: boolean }) {
  return invoke<{ id: string; email: string; name: string | null; created_at: string }>('CreateUser', params);
}

export async function listUsers() {
  return invoke<Array<{ id: string; email: string; name: string | null; created_at: string; is_admin?: boolean }>>(
    'ListUsers'
  );
}

export async function deleteUser(id: string) {
  return invoke<void>('DeleteUser', { id });
}

// ---------- Nodes ----------
export async function getNodeByKey(key: string) {
  return invoke<Record<string, unknown> | null>('GetNodeByKey', { key });
}

export async function getNodeById(id: string) {
  return invoke<Record<string, unknown> | null>('GetNodeById', { id });
}

export async function listNodes() {
  return invoke<Record<string, unknown>[]>('ListNodes');
}

export async function putNode(node: {
  id?: string;
  key: string;
  title: string;
  summary?: string | null;
  is_root?: boolean;
  order_index?: number;
  pos_x?: number | null;
  pos_y?: number | null;
  box_width?: number | null;
  box_height?: number | null;
}) {
  return invoke<Record<string, unknown>>('PutNode', node);
}

// ---------- Node categories & videos ----------
export async function listCategoriesByNode(nodeId: string) {
  return invoke<Array<{ node_id: string; category: string; created_at?: string }>>('ListCategoriesByNode', {
    nodeId,
  });
}

export async function setNodeCategories(nodeId: string, categories: string[]) {
  return invoke<Array<{ node_id: string; category: string }>>('SetNodeCategories', { nodeId, categories });
}

export async function listNodeVideos(nodeId: string) {
  return invoke<Array<{ id: string; node_id: string; video_url: string; title: string; order_index: number }>>(
    'ListNodeVideos',
    { nodeId }
  );
}

export async function putNodeVideo(
  nodeId: string,
  video: { id?: string; video_url: string; title: string; order_index?: number }
) {
  return invoke<Record<string, unknown>>('PutNodeVideo', { nodeId, video });
}

export async function deleteNodeVideo(nodeId: string, videoId: string) {
  return invoke<void>('DeleteNodeVideo', { nodeId, videoId });
}

// ---------- Edges ----------
export async function listEdges() {
  return invoke<Array<{
    id: string;
    parent_id: string;
    child_id: string;
    unlock_type: string;
    unlock_value: unknown;
    description?: string | null;
    weight?: number;
    created_at?: string;
  }>>('ListEdges');
}

export async function getEdgesByChild(childId: string) {
  return invoke<Array<{ parent_id: string; child_id: string; unlock_type: string; unlock_value: unknown }>>(
    'GetEdgesByChild',
    { childId }
  );
}

export async function getEdgesByUnlockType(unlockType: string) {
  return invoke<Array<{ parent_id: string; child_id: string; unlock_type: string }>>('GetEdgesByUnlockType', {
    unlockType,
  });
}

export async function putEdge(edge: {
  id?: string;
  parent_id: string;
  child_id: string;
  unlock_type: string;
  unlock_value?: unknown;
  description?: string | null;
  weight?: number;
}) {
  return invoke<Record<string, unknown>>('PutEdge', edge);
}

export async function deleteEdge(edgeId: string) {
  return invoke<void>('DeleteEdge', { edgeId });
}

// ---------- Symptoms ----------
export async function listSymptoms() {
  return invoke<Array<{ id: string; key: string; label: string; description?: string | null }>>('ListSymptoms');
}

export async function getSymptomsByKeys(keys: string[]) {
  return invoke<Array<{ id: string; key: string; label: string; description?: string | null }>>('GetSymptomsByKeys', {
    keys,
  });
}

export async function putSymptom(symptom: { id?: string; key: string; label: string; description?: string | null }) {
  return invoke<Record<string, unknown>>('PutSymptom', symptom);
}

// ---------- Unlocks ----------
export async function listUnlocksByUser(userId: string) {
  return invoke<Array<{ node_id: string; unlocked_at?: string; unlocked_by?: string; source?: string | null }>>(
    'ListUnlocksByUser',
    { userId }
  );
}

export async function getUnlock(userId: string, nodeId: string) {
  return invoke<Record<string, unknown> | null>('GetUnlock', { userId, nodeId });
}

export async function insertUnlocks(
  rows: Array<{ user_id: string; node_id: string; unlocked_by?: string; source?: string | null }>
) {
  return invoke<void>('InsertUnlocks', { rows });
}

export async function deleteUnlocksByUser(userId: string) {
  return invoke<void>('DeleteUnlocksByUser', { userId });
}

export async function listAllUnlocks() {
  return invoke<Array<{ user_id: string; node_id: string; unlocked_at?: string; unlocked_by?: string; source?: string | null }>>(
    'ListAllUnlocks'
  );
}

export async function deleteAllUnlocks() {
  return invoke<void>('DeleteAllUnlocks');
}

export async function deleteAllUserEvents() {
  return invoke<void>('DeleteAllUserEvents');
}

// ---------- Events ----------
export async function insertUserEvent(userId: string, type: string, metadata?: unknown) {
  return invoke<{ id: string; created_at: string }>('InsertUserEvent', { userId, type, metadata });
}

export async function deleteUserEventsByUser(userId: string) {
  return invoke<void>('DeleteUserEventsByUser', { userId });
}

// ---------- Category videos & positions ----------
export async function listCategoryVideos() {
  return invoke<Array<{ id: string; category: string; video_url: string; title: string; order_index: number }>>(
    'ListCategoryVideos'
  );
}

export async function listCategoryPositions() {
  return invoke<Array<{ category: string; pos_x: number; pos_y: number; width: number; height: number }>>(
    'ListCategoryPositions'
  );
}

export async function putCategoryPosition(record: {
  category: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
}) {
  return invoke<Record<string, unknown>>('PutCategoryPosition', { record });
}

export async function putCategoryVideo(record: {
  id?: string;
  category: string;
  video_url: string;
  title: string;
  order_index?: number;
}) {
  return invoke<Record<string, unknown>>('PutCategoryVideo', { record });
}

export async function deleteCategoryVideosByCategory(category: string) {
  return invoke<void>('DeleteCategoryVideosByCategory', { category });
}

export async function putBonusContentVideo(record: {
  id?: string;
  category: string;
  video_url: string;
  title: string;
  order_index?: number;
}) {
  return invoke<Record<string, unknown>>('PutBonusContentVideo', { record });
}

export async function deleteBonusContentVideosByCategory(category: string) {
  return invoke<void>('DeleteBonusContentVideosByCategory', { category });
}

export async function putBonusContentPosition(record: {
  category: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
}) {
  return invoke<Record<string, unknown>>('PutBonusContentPosition', { record });
}

// ---------- Symptom positions ----------
export async function listSymptomPositions() {
  return invoke<Array<{ id: string; position_key: string; pos_x: number; pos_y: number; width: number; height: number }>>(
    'ListSymptomPositions'
  );
}

export async function putSymptomPosition(record: {
  id?: string;
  position_key: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
}) {
  return invoke<Record<string, unknown>>('PutSymptomPosition', { record });
}

// ---------- Bonus content ----------
export async function listBonusContentVideos() {
  return invoke<Array<{ id: string; category: string; video_url: string; title: string; order_index: number }>>(
    'ListBonusContentVideos'
  );
}

export async function listBonusContentPositions() {
  return invoke<Array<{ category: string; pos_x: number; pos_y: number; width: number; height: number }>>(
    'ListBonusContentPositions'
  );
}

// ---------- Introduction tree ----------
export async function listIntroTreeNodes() {
  return invoke<Array<{ id: string; node_key: string; title: string; pos_x: number; pos_y: number; width: number; height: number }>>(
    'ListIntroTreeNodes'
  );
}

export async function getIntroNodeByKey(nodeKey: string) {
  return invoke<Record<string, unknown> | null>('GetIntroNodeByKey', { nodeKey });
}

export async function putIntroTreeNode(node: {
  id?: string;
  node_key: string;
  title: string;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
}) {
  return invoke<Record<string, unknown>>('PutIntroTreeNode', { node });
}

export async function deleteIntroTreeNode(nodeId: string) {
  return invoke<void>('DeleteIntroTreeNode', { nodeId });
}

export async function listIntroTreeNodeVideos(nodeId: string) {
  return invoke<Array<{ id: string; node_id: string; video_url: string; title: string; order_index: number }>>(
    'ListIntroTreeNodeVideos',
    { nodeId }
  );
}

export async function putIntroTreeNodeVideo(
  nodeId: string,
  video: { id?: string; video_url: string; title: string; order_index?: number }
) {
  return invoke<Record<string, unknown>>('PutIntroTreeNodeVideo', { nodeId, video });
}

export async function deleteIntroTreeNodeVideo(nodeId: string, videoId: string) {
  return invoke<void>('DeleteIntroTreeNodeVideo', { nodeId, videoId });
}
