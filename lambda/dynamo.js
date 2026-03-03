import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const doc = DynamoDBDocumentClient.from(client);

const prefix = process.env.TABLE_PREFIX || 'treatment_tracker';
export const tables = {
  users: `${prefix}_users`,
  nodes: `${prefix}_nodes`,
  nodeCategories: `${prefix}_node_categories`,
  nodeVideos: `${prefix}_node_videos`,
  edges: `${prefix}_edges`,
  symptoms: `${prefix}_symptoms`,
  userUnlockedNodes: `${prefix}_user_unlocked_nodes`,
  userEvents: `${prefix}_user_events`,
  categoryVideos: `${prefix}_category_videos`,
  categoryPositions: `${prefix}_category_positions`,
  symptomPositions: `${prefix}_symptom_positions`,
  bonusContentVideos: `${prefix}_bonus_content_videos`,
  bonusContentPositions: `${prefix}_bonus_content_positions`,
  introTreeNodes: `${prefix}_introduction_tree_nodes`,
  introTreeNodeVideos: `${prefix}_introduction_tree_node_videos`,
};
