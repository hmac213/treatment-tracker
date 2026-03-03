import * as ops from './operations.js';

const ACTIONS = {
  // Users
  GetUserByEmail: (p) => ops.getUserByEmail(p.email),
  GetUserById: (p) => ops.getUserById(p.id),
  CreateUser: (p) => ops.createUser(p),
  ListUsers: () => ops.listUsers(),
  DeleteUser: (p) => ops.deleteUser(p.id),

  // Admin bulk
  ListAllUnlocks: () => ops.listAllUnlocks(),
  DeleteAllUnlocks: () => ops.deleteAllUnlocks(),
  DeleteAllUserEvents: () => ops.deleteAllUserEvents(),

  // Nodes
  GetNodeByKey: (p) => ops.getNodeByKey(p.key),
  GetNodeById: (p) => ops.getNodeById(p.id),
  ListNodes: () => ops.listNodes(),
  PutNode: (p) => ops.putNode(p),

  // Node categories & videos
  ListCategoriesByNode: (p) => ops.listCategoriesByNode(p.nodeId),
  SetNodeCategories: (p) => ops.setNodeCategories(p.nodeId, p.categories),
  ListNodeVideos: (p) => ops.listNodeVideos(p.nodeId),
  PutNodeVideo: (p) => ops.putNodeVideo(p.nodeId, p.video),
  DeleteNodeVideo: (p) => ops.deleteNodeVideo(p.nodeId, p.videoId),

  // Edges
  ListEdges: () => ops.listEdges(),
  GetEdgesByChild: (p) => ops.getEdgesByChild(p.childId),
  GetEdgesByUnlockType: (p) => ops.getEdgesByUnlockType(p.unlockType),
  PutEdge: (p) => ops.putEdge(p),
  DeleteEdge: (p) => ops.deleteEdge(p.edgeId),

  // Symptoms
  ListSymptoms: () => ops.listSymptoms(),
  GetSymptomsByKeys: (p) => ops.getSymptomsByKeys(p.keys),
  PutSymptom: (p) => ops.putSymptom(p),

  // Unlocks
  ListUnlocksByUser: (p) => ops.listUnlocksByUser(p.userId),
  GetUnlock: (p) => ops.getUnlock(p.userId, p.nodeId),
  InsertUnlocks: (p) => ops.insertUnlocks(p.rows),
  DeleteUnlocksByUser: (p) => ops.deleteUnlocksByUser(p.userId),

  // Events
  InsertUserEvent: (p) => ops.insertUserEvent(p.userId, p.type, p.metadata),
  DeleteUserEventsByUser: (p) => ops.deleteUserEventsByUser(p.userId),

  // Category videos & positions
  ListCategoryVideos: () => ops.listCategoryVideos(),
  ListCategoryPositions: () => ops.listCategoryPositions(),
  PutCategoryPosition: (p) => ops.putCategoryPosition(p.record),
  PutCategoryVideo: (p) => ops.putCategoryVideo(p.record),
  DeleteCategoryVideosByCategory: (p) => ops.deleteCategoryVideosByCategory(p.category),
  PutBonusContentVideo: (p) => ops.putBonusContentVideo(p.record),
  DeleteBonusContentVideosByCategory: (p) => ops.deleteBonusContentVideosByCategory(p.category),

  // Symptom positions
  ListSymptomPositions: () => ops.listSymptomPositions(),
  PutSymptomPosition: (p) => ops.putSymptomPosition(p.record),

  // Bonus content
  ListBonusContentVideos: () => ops.listBonusContentVideos(),
  ListBonusContentPositions: () => ops.listBonusContentPositions(),
  PutBonusContentPosition: (p) => ops.putBonusContentPosition(p.record),

  // Introduction tree
  ListIntroTreeNodes: () => ops.listIntroTreeNodes(),
  GetIntroNodeByKey: (p) => ops.getIntroNodeByKey(p.nodeKey),
  PutIntroTreeNode: (p) => ops.putIntroTreeNode(p.node),
  DeleteIntroTreeNode: (p) => ops.deleteIntroTreeNode(p.nodeId),
  ListIntroTreeNodeVideos: (p) => ops.listIntroTreeNodeVideos(p.nodeId),
  PutIntroTreeNodeVideo: (p) => ops.putIntroTreeNodeVideo(p.nodeId, p.video),
  DeleteIntroTreeNodeVideo: (p) => ops.deleteIntroTreeNodeVideo(p.nodeId, p.videoId),
};

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  let body;
  try {
    const raw = typeof event.body === 'string' ? event.body : (event.body && JSON.stringify(event.body)) || '{}';
    body = JSON.parse(raw);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON body' }),
    };
  }

  const { action, params = {} } = body;
  if (!action || typeof action !== 'string') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Missing or invalid "action"' }),
    };
  }

  const fn = ACTIONS[action];
  if (!fn) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
    };
  }

  try {
    const data = await fn(params);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data }),
    };
  } catch (err) {
    console.error('Lambda error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Internal server error',
      }),
    };
  }
}
