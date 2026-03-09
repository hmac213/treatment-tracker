import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { doc, tables as T } from './dynamo.js';

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------- Users ----------
export async function getUserByEmail(email) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.users,
    IndexName: 'gsi_email',
    KeyConditionExpression: 'gsi_pk = :pk AND gsi_sk = :sk',
    ExpressionAttributeValues: { ':pk': 'EMAIL', ':sk': (email || '').toLowerCase() },
  }));
  return Items && Items[0] ? stripKeys(Items[0]) : null;
}

export async function getUserById(id) {
  const { Item } = await doc.send(new GetCommand({
    TableName: T.users,
    Key: { pk: `USER#${id}` },
  }));
  return Item ? stripKeys(Item) : null;
}

export async function createUser({ email, name, is_admin }) {
  const id = uuid();
  const item = {
    pk: `USER#${id}`,
    gsi_pk: 'EMAIL',
    gsi_sk: (email || '').toLowerCase(),
    id,
    email: (email || '').toLowerCase(),
    name: name || null,
    is_admin: is_admin === true,
    created_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.users, Item: item }));
  return stripKeys(item);
}

/** Put a user record as-is (for migration). Preserves id, password_hash, created_at. */
export async function putUser(record) {
  const id = record.id;
  if (!id) throw new Error('putUser requires record.id');
  const item = {
    pk: `USER#${id}`,
    gsi_pk: 'EMAIL',
    gsi_sk: (record.email || '').toLowerCase(),
    id,
    email: (record.email || '').toLowerCase(),
    name: record.name ?? null,
    is_admin: record.is_admin === true,
    password_hash: record.password_hash ?? null,
    created_at: record.created_at || now(),
  };
  await doc.send(new PutCommand({ TableName: T.users, Item: item }));
  return stripKeys(item);
}

export async function listUsers() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.users }));
  return (Items || []).map(stripKeys).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function deleteUser(id) {
  await doc.send(new DeleteCommand({
    TableName: T.users,
    Key: { pk: `USER#${id}` },
  }));
}

export async function listAllUnlocks() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.userUnlockedNodes }));
  return (Items || []).map(stripKeys);
}

export async function deleteAllUnlocks() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.userUnlockedNodes }));
  for (const item of Items || []) {
    await doc.send(new DeleteCommand({
      TableName: T.userUnlockedNodes,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
}

export async function deleteAllUserEvents() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.userEvents }));
  for (const item of Items || []) {
    await doc.send(new DeleteCommand({
      TableName: T.userEvents,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
}

// ---------- Nodes ----------
export async function getNodeByKey(key) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.nodes,
    IndexName: 'gsi_key',
    KeyConditionExpression: 'gsi_pk = :pk AND gsi_sk = :sk',
    ExpressionAttributeValues: { ':pk': 'NODE_KEY', ':sk': key },
  }));
  return Items && Items[0] ? stripKeys(Items[0]) : null;
}

export async function getNodeById(id) {
  const { Item } = await doc.send(new GetCommand({
    TableName: T.nodes,
    Key: { pk: `NODE#${id}` },
  }));
  return Item ? stripKeys(Item) : null;
}

export async function listNodes() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.nodes }));
  return (Items || []).map(stripKeys);
}

export async function putNode(node) {
  const id = node.id || uuid();
  const item = {
    pk: `NODE#${id}`,
    gsi_pk: 'NODE_KEY',
    gsi_sk: node.key,
    id,
    key: node.key,
    title: node.title,
    summary: node.summary ?? null,
    is_root: node.is_root ?? false,
    order_index: node.order_index ?? 0,
    pos_x: node.pos_x ?? null,
    pos_y: node.pos_y ?? null,
    box_width: node.box_width ?? null,
    box_height: node.box_height ?? null,
    created_at: node.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.nodes, Item: item }));
  return stripKeys(item);
}

// ---------- Node categories ----------
export async function listCategoriesByNode(nodeId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.nodeCategories,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `NODE#${nodeId}` },
  }));
  return (Items || []).map((i) => ({ node_id: i.node_id, category: i.category, created_at: i.created_at }));
}

export async function setNodeCategories(nodeId, categories) {
  const pk = `NODE#${nodeId}`;
  const existing = await doc.send(new QueryCommand({
    TableName: T.nodeCategories,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': pk },
  }));
  const toDelete = (existing.Items || []).filter((i) => !categories.includes(i.category));
  const toPut = categories.map((category) => ({
    pk,
    sk: `CATEGORY#${category}`,
    node_id: nodeId,
    category,
    created_at: now(),
  }));
  for (const item of toDelete) {
    await doc.send(new DeleteCommand({
      TableName: T.nodeCategories,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
  for (const item of toPut) {
    await doc.send(new PutCommand({ TableName: T.nodeCategories, Item: item }));
  }
  return toPut.map((i) => ({ node_id: i.node_id, category: i.category }));
}

// ---------- Node videos ----------
export async function listNodeVideos(nodeId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.nodeVideos,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `NODE#${nodeId}` },
  }));
  return (Items || []).map(stripKeys).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

export async function putNodeVideo(nodeId, video) {
  const id = video.id || uuid();
  const item = {
    pk: `NODE#${nodeId}`,
    sk: `VIDEO#${id}`,
    id,
    node_id: nodeId,
    video_url: video.video_url,
    title: video.title,
    order_index: video.order_index ?? 0,
    created_at: video.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.nodeVideos, Item: item }));
  return stripKeys(item);
}

export async function deleteNodeVideo(nodeId, videoId) {
  await doc.send(new DeleteCommand({
    TableName: T.nodeVideos,
    Key: { pk: `NODE#${nodeId}`, sk: `VIDEO#${videoId}` },
  }));
}

// ---------- Edges ----------
export async function listEdges() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.edges }));
  return (Items || []).map(stripKeys);
}

export async function getEdgesByChild(childId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.edges,
    IndexName: 'gsi_child',
    KeyConditionExpression: 'gsi_child_pk = :pk',
    ExpressionAttributeValues: { ':pk': childId },
  }));
  return (Items || []).map(stripKeys);
}

export async function getEdgesByUnlockType(unlockType) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.edges,
    IndexName: 'gsi_unlock_type',
    KeyConditionExpression: 'gsi_unlock_type_pk = :pk',
    ExpressionAttributeValues: { ':pk': unlockType },
  }));
  return (Items || []).map(stripKeys);
}

export async function putEdge(edge) {
  const id = edge.id || uuid();
  const item = {
    pk: `EDGE#${id}`,
    gsi_child_pk: edge.child_id,
    gsi_child_sk: id,
    gsi_parent_pk: edge.parent_id,
    gsi_parent_sk: id,
    gsi_unlock_type_pk: edge.unlock_type,
    gsi_unlock_type_sk: id,
    id,
    parent_id: edge.parent_id,
    child_id: edge.child_id,
    unlock_type: edge.unlock_type,
    unlock_value: edge.unlock_value ?? null,
    description: edge.description ?? null,
    weight: edge.weight ?? 0,
    created_at: edge.created_at || now(),
  };
  await doc.send(new PutCommand({ TableName: T.edges, Item: item }));
  return stripKeys(item);
}

export async function deleteEdge(edgeId) {
  await doc.send(new DeleteCommand({
    TableName: T.edges,
    Key: { pk: `EDGE#${edgeId}` },
  }));
}

// ---------- Symptoms ----------
export async function listSymptoms() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.symptoms }));
  return (Items || []).map(stripKeys).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
}

export async function getSymptomsByKeys(keys) {
  if (!keys || keys.length === 0) return [];
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.symptoms,
    IndexName: 'gsi_key',
    KeyConditionExpression: 'gsi_pk = :pk',
    ExpressionAttributeValues: { ':pk': 'SYMPTOM_KEY' },
  }));
  const keySet = new Set(keys);
  return (Items || []).map(stripKeys).filter((s) => keySet.has(s.key));
}

export async function putSymptom(symptom) {
  const id = symptom.id || uuid();
  const item = {
    pk: `SYMPTOM#${id}`,
    gsi_pk: 'SYMPTOM_KEY',
    gsi_sk: symptom.key,
    id,
    key: symptom.key,
    label: symptom.label,
    description: symptom.description ?? null,
  };
  await doc.send(new PutCommand({ TableName: T.symptoms, Item: item }));
  return stripKeys(item);
}

// ---------- User unlocked nodes ----------
export async function listUnlocksByUser(userId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.userUnlockedNodes,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}` },
  }));
  return (Items || []).map((i) => ({ node_id: i.node_id, unlocked_at: i.unlocked_at, unlocked_by: i.unlocked_by, source: i.source }));
}

export async function getUnlock(userId, nodeId) {
  const { Item } = await doc.send(new GetCommand({
    TableName: T.userUnlockedNodes,
    Key: { pk: `USER#${userId}`, sk: `UNLOCK#${nodeId}` },
  }));
  return Item ? stripKeys(Item) : null;
}

export async function insertUnlocks(rows) {
  for (const row of rows) {
    const id = uuid();
    await doc.send(new PutCommand({
      TableName: T.userUnlockedNodes,
      Item: {
        pk: `USER#${row.user_id}`,
        sk: `UNLOCK#${row.node_id}`,
        id,
        user_id: row.user_id,
        node_id: row.node_id,
        unlocked_at: row.unlocked_at || now(),
        unlocked_by: row.unlocked_by || 'user',
        source: row.source ?? null,
      },
    }));
  }
}

export async function deleteUnlocksByUser(userId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.userUnlockedNodes,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}` },
  }));
  for (const item of Items || []) {
    await doc.send(new DeleteCommand({
      TableName: T.userUnlockedNodes,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
}

// ---------- User events ----------
export async function insertUserEvent(userId, type, metadata = null) {
  const id = uuid();
  const created_at = now();
  await doc.send(new PutCommand({
    TableName: T.userEvents,
    Item: {
      pk: `USER#${userId}`,
      sk: `EVENT#${created_at}#${id}`,
      id,
      user_id: userId,
      type,
      metadata: metadata ?? null,
      created_at,
    },
  }));
  return { id, created_at };
}

/** Batch insert user events (for migration). Each row: { user_id, type, metadata, created_at, id }. */
export async function insertUserEvents(rows) {
  for (const row of rows) {
    const id = row.id || uuid();
    const created_at = row.created_at || now();
    await doc.send(new PutCommand({
      TableName: T.userEvents,
      Item: {
        pk: `USER#${row.user_id}`,
        sk: `EVENT#${created_at}#${id}`,
        id,
        user_id: row.user_id,
        type: row.type,
        metadata: row.metadata ?? null,
        created_at,
      },
    }));
  }
  return { count: rows.length };
}

export async function deleteUserEventsByUser(userId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.userEvents,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${userId}` },
  }));
  for (const item of Items || []) {
    await doc.send(new DeleteCommand({
      TableName: T.userEvents,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
}

// ---------- Category videos & positions ----------
export async function listCategoryVideos() {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.categoryVideos,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'CATEGORY_VIDEO' },
  }));
  return (Items || []).map(stripKeys).sort((a, b) => {
    const c = (a.category || '').localeCompare(b.category || '');
    return c !== 0 ? c : (a.order_index ?? 0) - (b.order_index ?? 0);
  });
}

export async function listCategoryPositions() {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.categoryPositions,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'CATEGORY_POSITION' },
  }));
  return (Items || []).map(stripKeys);
}

export async function putCategoryVideo(record) {
  const id = record.id || uuid();
  const category = record.category;
  const order_index = record.order_index ?? 0;
  const item = {
    pk: 'CATEGORY_VIDEO',
    sk: `${category}#${order_index}#${id}`,
    id,
    category,
    video_url: record.video_url,
    title: record.title,
    order_index,
    created_at: record.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.categoryVideos, Item: item }));
  return stripKeys(item);
}

export async function deleteCategoryVideosByCategory(category) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.categoryVideos,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': 'CATEGORY_VIDEO', ':prefix': `${category}#` },
  }));
  for (const item of Items || []) {
    await doc.send(new DeleteCommand({
      TableName: T.categoryVideos,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
}

export async function putBonusContentVideo(record) {
  const id = record.id || uuid();
  const category = record.category;
  const order_index = record.order_index ?? 0;
  const item = {
    pk: 'BONUS_VIDEO',
    sk: `${category}#${order_index}#${id}`,
    id,
    category,
    video_url: record.video_url,
    title: record.title,
    order_index,
    created_at: record.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.bonusContentVideos, Item: item }));
  return stripKeys(item);
}

export async function deleteBonusContentVideosByCategory(category) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.bonusContentVideos,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': 'BONUS_VIDEO', ':prefix': `${category}#` },
  }));
  for (const item of Items || []) {
    await doc.send(new DeleteCommand({
      TableName: T.bonusContentVideos,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
}

export async function putCategoryPosition(record) {
  const category = record.category;
  const item = {
    pk: 'CATEGORY_POSITION',
    sk: category,
    category,
    pos_x: record.pos_x,
    pos_y: record.pos_y,
    width: record.width,
    height: record.height,
    created_at: record.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.categoryPositions, Item: item }));
  return stripKeys(item);
}

// ---------- Symptom positions ----------
export async function listSymptomPositions() {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.symptomPositions,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'SYMPTOM_POSITION' },
  }));
  return (Items || []).map(stripKeys);
}

export async function putSymptomPosition(record) {
  const key = record.position_key;
  const item = {
    pk: 'SYMPTOM_POSITION',
    sk: key,
    id: record.id || uuid(),
    position_key: key,
    pos_x: record.pos_x,
    pos_y: record.pos_y,
    width: record.width,
    height: record.height,
    created_at: record.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.symptomPositions, Item: item }));
  return stripKeys(item);
}

// ---------- Bonus content ----------
export async function listBonusContentVideos() {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.bonusContentVideos,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'BONUS_VIDEO' },
  }));
  return (Items || []).map(stripKeys).sort((a, b) => {
    const c = (a.category || '').localeCompare(b.category || '');
    return c !== 0 ? c : (a.order_index ?? 0) - (b.order_index ?? 0);
  });
}

export async function listBonusContentPositions() {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.bonusContentPositions,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'BONUS_POSITION' },
  }));
  return (Items || []).map(stripKeys);
}

export async function putBonusContentPosition(record) {
  const category = record.category;
  const item = {
    pk: 'BONUS_POSITION',
    sk: category,
    category,
    pos_x: record.pos_x,
    pos_y: record.pos_y,
    width: record.width,
    height: record.height,
    created_at: record.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.bonusContentPositions, Item: item }));
  return stripKeys(item);
}

// ---------- Introduction tree ----------
export async function listIntroTreeNodes() {
  const { Items } = await doc.send(new ScanCommand({ TableName: T.introTreeNodes }));
  return (Items || []).map(stripKeys);
}

export async function getIntroNodeByKey(nodeKey) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.introTreeNodes,
    IndexName: 'gsi_node_key',
    KeyConditionExpression: 'gsi_pk = :pk AND gsi_sk = :sk',
    ExpressionAttributeValues: { ':pk': 'INTRO_NODE_KEY', ':sk': nodeKey },
  }));
  return Items && Items[0] ? stripKeys(Items[0]) : null;
}

export async function putIntroTreeNode(node) {
  const id = node.id || uuid();
  const item = {
    pk: `INTRO_NODE#${id}`,
    gsi_pk: 'INTRO_NODE_KEY',
    gsi_sk: node.node_key,
    id,
    node_key: node.node_key,
    title: node.title,
    pos_x: node.pos_x ?? 0,
    pos_y: node.pos_y ?? 0,
    width: node.width ?? 10,
    height: node.height ?? 5,
    created_at: node.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.introTreeNodes, Item: item }));
  return stripKeys(item);
}

export async function deleteIntroTreeNode(nodeId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.introTreeNodeVideos,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `INTRO_NODE#${nodeId}` },
  }));
  for (const item of Items || []) {
    await doc.send(new DeleteCommand({
      TableName: T.introTreeNodeVideos,
      Key: { pk: item.pk, sk: item.sk },
    }));
  }
  await doc.send(new DeleteCommand({
    TableName: T.introTreeNodes,
    Key: { pk: `INTRO_NODE#${nodeId}` },
  }));
}

export async function listIntroTreeNodeVideos(nodeId) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: T.introTreeNodeVideos,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `INTRO_NODE#${nodeId}` },
  }));
  return (Items || []).map(stripKeys).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

export async function deleteIntroTreeNodeVideo(nodeId, videoId) {
  await doc.send(new DeleteCommand({
    TableName: T.introTreeNodeVideos,
    Key: { pk: `INTRO_NODE#${nodeId}`, sk: `VIDEO#${videoId}` },
  }));
}

export async function putIntroTreeNodeVideo(nodeId, video) {
  const id = video.id || uuid();
  const item = {
    pk: `INTRO_NODE#${nodeId}`,
    sk: `VIDEO#${id}`,
    id,
    node_id: nodeId,
    video_url: video.video_url,
    title: video.title,
    order_index: video.order_index ?? 0,
    created_at: video.created_at || now(),
    updated_at: now(),
  };
  await doc.send(new PutCommand({ TableName: T.introTreeNodeVideos, Item: item }));
  return stripKeys(item);
}

// ---------- Helpers ----------
const KEY_ATTRS = new Set(['pk', 'sk', 'gsi_pk', 'gsi_sk', 'gsi_child_pk', 'gsi_child_sk', 'gsi_parent_pk', 'gsi_parent_sk', 'gsi_unlock_type_pk', 'gsi_unlock_type_sk']);
function stripKeys(item) {
  if (!item) return null;
  const out = { ...item };
  KEY_ATTRS.forEach((k) => delete out[k]);
  return out;
}
