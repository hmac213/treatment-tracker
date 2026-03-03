#!/usr/bin/env node
/**
 * Migrate all data from Supabase (Postgres) to DynamoDB.
 *
 * Prerequisites:
 *   - Supabase: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. from web/.env)
 *   - AWS: credentials for DynamoDB (env or ~/.aws/credentials)
 *   - DynamoDB tables and GSIs already created (see db/dynamodb-schema.md)
 *
 * Run from repo root:
 *   node --env-file=web/.env scripts/migrate-supabase-to-dynamodb.mjs
 *   # or: export NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... AWS_REGION=... && node scripts/migrate-supabase-to-dynamodb.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, 'web', '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      const val = m[2].replace(/^["']|["']$/g, '').trim();
      process.env[m[1]] = val;
    }
  }
}

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const tablePrefix = (process.env.TABLE_PREFIX || 'treatment_tracker').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in web/.env)');
  process.exit(1);
}

if (!supabaseUrl.startsWith('https://')) {
  console.error('NEXT_PUBLIC_SUPABASE_URL should start with https:// (got:', supabaseUrl.slice(0, 20) + '...)');
  process.exit(1);
}

async function checkSupabaseReachable() {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/users?select=id&limit=1`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok || res.status === 200) return;
    console.warn('Supabase returned status', res.status, res.statusText);
  } catch (e) {
    const code = e.cause?.code ?? e.code;
    const msg = e.cause?.message ?? e.cause ?? e.message;
    console.error('Supabase connectivity failed:', e.message);
    if (code) console.error('  code:', code);
    if (msg && String(msg) !== e.message) console.error('  cause:', msg);
    throw new Error('Cannot reach Supabase: ' + e.message + (code ? ' (' + code + ')' : ''));
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const T = {
  users: `${tablePrefix}_users`,
  nodes: `${tablePrefix}_nodes`,
  nodeCategories: `${tablePrefix}_node_categories`,
  nodeVideos: `${tablePrefix}_node_videos`,
  edges: `${tablePrefix}_edges`,
  symptoms: `${tablePrefix}_symptoms`,
  userUnlockedNodes: `${tablePrefix}_user_unlocked_nodes`,
  userEvents: `${tablePrefix}_user_events`,
  categoryVideos: `${tablePrefix}_category_videos`,
  categoryPositions: `${tablePrefix}_category_positions`,
  symptomPositions: `${tablePrefix}_symptom_positions`,
  bonusContentVideos: `${tablePrefix}_bonus_content_videos`,
  bonusContentPositions: `${tablePrefix}_bonus_content_positions`,
  introTreeNodes: `${tablePrefix}_introduction_tree_nodes`,
  introTreeNodeVideos: `${tablePrefix}_introduction_tree_node_videos`,
};

const now = () => new Date().toISOString();

async function batchWrite(tableName, items) {
  const BATCH = 25;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    await dynamo.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })),
      },
    }));
  }
}

async function listAllAuthUsers() {
  const perPage = 1000;
  const all = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, per_page: perPage });
    if (error) throw new Error('Auth listUsers: ' + error.message);
    const users = data?.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

async function migrate() {
  console.log('Reading from Supabase, writing to DynamoDB (prefix:', tablePrefix, ')\n');
  await checkSupabaseReachable();

  // 1. Users (preserve id, email, name, created_at, is_admin, password_hash)
  let userItems;
  try {
    const res = await supabase.from('users').select('*');
    if (res.error) {
      const msg = res.error.message || '';
      if (msg.includes('Could not find the table') || msg.includes('schema cache') || res.error.code === 'PGRST116') {
        console.warn('public.users not found, using Supabase Auth users instead.');
        const authUsers = await listAllAuthUsers();
        userItems = authUsers.map((u) => ({
          pk: `USER#${u.id}`,
          gsi_pk: 'EMAIL',
          gsi_sk: (u.email || '').toLowerCase(),
          id: u.id,
          email: (u.email || '').toLowerCase(),
          name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
          is_admin: false,
          password_hash: null,
          created_at: u.created_at || now(),
        }));
      } else {
        throw new Error('users: ' + msg);
      }
    } else {
      const users = res.data || [];
      userItems = users.map((r) => ({
        pk: `USER#${r.id}`,
        gsi_pk: 'EMAIL',
        gsi_sk: (r.email || '').toLowerCase(),
        id: r.id,
        email: (r.email || '').toLowerCase(),
        name: r.name ?? null,
        is_admin: r.is_admin === true,
        password_hash: r.password_hash ?? null,
        created_at: r.created_at || now(),
      }));
    }
  } catch (e) {
    if (e.message?.startsWith('users:')) throw e;
    const code = e.cause?.code ?? e.code;
    console.error('Supabase fetch error:', e.message, code ? '(' + code + ')' : '');
    if (e.cause) console.error('  cause:', e.cause);
    throw new Error('users: Supabase request failed: ' + e.message + (code ? ' (' + code + ')' : ''));
  }
  await batchWrite(T.users, userItems);
  console.log('users:', userItems.length);

  // 2. Nodes
  const { data: nodes, error: nodesErr } = await supabase.from('nodes').select('*');
  if (nodesErr) throw new Error('nodes: ' + nodesErr.message);
  const nodeItems = (nodes || []).map((r) => ({
    pk: `NODE#${r.id}`,
    gsi_pk: 'NODE_KEY',
    gsi_sk: r.key,
    id: r.id,
    key: r.key,
    title: r.title,
    summary: r.summary ?? null,
    is_root: r.is_root ?? false,
    order_index: r.order_index ?? 0,
    pos_x: r.pos_x ?? null,
    pos_y: r.pos_y ?? null,
    box_width: r.box_width ?? null,
    box_height: r.box_height ?? null,
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.nodes, nodeItems);
  console.log('nodes:', nodeItems.length);

  // 3. Node categories
  const { data: nodeCats, error: ncErr } = await supabase.from('node_categories').select('*');
  if (ncErr) throw new Error('node_categories: ' + ncErr.message);
  const ncItems = (nodeCats || []).map((r) => ({
    pk: `NODE#${r.node_id}`,
    sk: `CATEGORY#${r.category}`,
    node_id: r.node_id,
    category: r.category,
    created_at: r.created_at || now(),
  }));
  await batchWrite(T.nodeCategories, ncItems);
  console.log('node_categories:', ncItems.length);

  // 4. Node videos
  const { data: nodeVids, error: nvErr } = await supabase.from('node_videos').select('*');
  if (nvErr) throw new Error('node_videos: ' + nvErr.message);
  const nvItems = (nodeVids || []).map((r) => ({
    pk: `NODE#${r.node_id}`,
    sk: `VIDEO#${r.id}`,
    id: r.id,
    node_id: r.node_id,
    video_url: r.video_url,
    title: r.title,
    order_index: r.order_index ?? 0,
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.nodeVideos, nvItems);
  console.log('node_videos:', nvItems.length);

  // 5. Edges
  const { data: edges, error: edgesErr } = await supabase.from('edges').select('*');
  if (edgesErr) throw new Error('edges: ' + edgesErr.message);
  const edgeItems = (edges || []).map((r) => ({
    pk: `EDGE#${r.id}`,
    gsi_child_pk: r.child_id,
    gsi_child_sk: r.id,
    gsi_parent_pk: r.parent_id,
    gsi_parent_sk: r.id,
    gsi_unlock_type_pk: r.unlock_type,
    gsi_unlock_type_sk: r.id,
    id: r.id,
    parent_id: r.parent_id,
    child_id: r.child_id,
    unlock_type: r.unlock_type,
    unlock_value: r.unlock_value ?? null,
    description: r.description ?? null,
    weight: r.weight ?? 0,
    created_at: r.created_at || now(),
  }));
  await batchWrite(T.edges, edgeItems);
  console.log('edges:', edgeItems.length);

  // 6. Symptoms
  const { data: symptoms, error: symErr } = await supabase.from('symptoms').select('*');
  if (symErr) throw new Error('symptoms: ' + symErr.message);
  const symItems = (symptoms || []).map((r) => ({
    pk: `SYMPTOM#${r.id}`,
    gsi_pk: 'SYMPTOM_KEY',
    gsi_sk: r.key,
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description ?? null,
  }));
  await batchWrite(T.symptoms, symItems);
  console.log('symptoms:', symItems.length);

  // 7. User unlocked nodes
  const { data: unlocks, error: unlocksErr } = await supabase.from('user_unlocked_nodes').select('*');
  if (unlocksErr) throw new Error('user_unlocked_nodes: ' + unlocksErr.message);
  const unlockItems = (unlocks || []).map((r) => ({
    pk: `USER#${r.user_id}`,
    sk: `UNLOCK#${r.node_id}`,
    id: r.id,
    user_id: r.user_id,
    node_id: r.node_id,
    unlocked_at: r.unlocked_at || now(),
    unlocked_by: r.unlocked_by || 'user',
    source: r.source ?? null,
  }));
  await batchWrite(T.userUnlockedNodes, unlockItems);
  console.log('user_unlocked_nodes:', unlockItems.length);

  // 8. User events
  const { data: events, error: eventsErr } = await supabase.from('user_events').select('*');
  if (eventsErr) throw new Error('user_events: ' + eventsErr.message);
  const eventItems = (events || []).map((r) => ({
    pk: `USER#${r.user_id}`,
    sk: `EVENT#${r.created_at}#${r.id}`,
    id: r.id,
    user_id: r.user_id,
    type: r.type,
    metadata: r.metadata ?? null,
    created_at: r.created_at || now(),
  }));
  await batchWrite(T.userEvents, eventItems);
  console.log('user_events:', eventItems.length);

  // 9. Category videos
  const { data: catVids, error: catVErr } = await supabase.from('category_videos').select('*');
  if (catVErr) throw new Error('category_videos: ' + catVErr.message);
  const catVidItems = (catVids || []).map((r) => ({
    pk: 'CATEGORY_VIDEO',
    sk: `${r.category}#${r.order_index ?? 0}#${r.id}`,
    id: r.id,
    category: r.category,
    video_url: r.video_url,
    title: r.title,
    order_index: r.order_index ?? 0,
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.categoryVideos, catVidItems);
  console.log('category_videos:', catVidItems.length);

  // 10. Category positions
  const { data: catPos, error: catPErr } = await supabase.from('category_positions').select('*');
  if (catPErr) throw new Error('category_positions: ' + catPErr.message);
  const catPosItems = (catPos || []).map((r) => ({
    pk: 'CATEGORY_POSITION',
    sk: r.category,
    category: r.category,
    pos_x: Number(r.pos_x),
    pos_y: Number(r.pos_y),
    width: Number(r.width),
    height: Number(r.height),
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.categoryPositions, catPosItems);
  console.log('category_positions:', catPosItems.length);

  // 11. Symptom positions
  const { data: symPos, error: symPErr } = await supabase.from('symptom_positions').select('*');
  if (symPErr) throw new Error('symptom_positions: ' + symPErr.message);
  const symPosItems = (symPos || []).map((r) => ({
    pk: 'SYMPTOM_POSITION',
    sk: r.position_key,
    id: r.id,
    position_key: r.position_key,
    pos_x: Number(r.pos_x),
    pos_y: Number(r.pos_y),
    width: Number(r.width),
    height: Number(r.height),
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.symptomPositions, symPosItems);
  console.log('symptom_positions:', symPosItems.length);

  // 12. Bonus content videos
  const { data: bonusVids, error: bonusVErr } = await supabase.from('bonus_content_videos').select('*');
  if (bonusVErr) throw new Error('bonus_content_videos: ' + bonusVErr.message);
  const bonusVidItems = (bonusVids || []).map((r) => ({
    pk: 'BONUS_VIDEO',
    sk: `${r.category}#${r.order_index ?? 0}#${r.id}`,
    id: r.id,
    category: r.category,
    video_url: r.video_url,
    title: r.title,
    order_index: r.order_index ?? 0,
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.bonusContentVideos, bonusVidItems);
  console.log('bonus_content_videos:', bonusVidItems.length);

  // 13. Bonus content positions
  const { data: bonusPos, error: bonusPErr } = await supabase.from('bonus_content_positions').select('*');
  if (bonusPErr) throw new Error('bonus_content_positions: ' + bonusPErr.message);
  const bonusPosItems = (bonusPos || []).map((r) => ({
    pk: 'BONUS_POSITION',
    sk: r.category,
    category: r.category,
    pos_x: Number(r.pos_x),
    pos_y: Number(r.pos_y),
    width: Number(r.width),
    height: Number(r.height),
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.bonusContentPositions, bonusPosItems);
  console.log('bonus_content_positions:', bonusPosItems.length);

  // 14. Introduction tree nodes
  const { data: introNodes, error: introNErr } = await supabase.from('introduction_tree_nodes').select('*');
  if (introNErr) throw new Error('introduction_tree_nodes: ' + introNErr.message);
  const introNodeItems = (introNodes || []).map((r) => ({
    pk: `INTRO_NODE#${r.id}`,
    gsi_pk: 'INTRO_NODE_KEY',
    gsi_sk: r.node_key,
    id: r.id,
    node_key: r.node_key,
    title: r.title,
    pos_x: Number(r.pos_x ?? 0),
    pos_y: Number(r.pos_y ?? 0),
    width: Number(r.width ?? 10),
    height: Number(r.height ?? 5),
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.introTreeNodes, introNodeItems);
  console.log('introduction_tree_nodes:', introNodeItems.length);

  // 15. Introduction tree node videos
  const { data: introVids, error: introVErr } = await supabase.from('introduction_tree_node_videos').select('*');
  if (introVErr) throw new Error('introduction_tree_node_videos: ' + introVErr.message);
  const introVidItems = (introVids || []).map((r) => ({
    pk: `INTRO_NODE#${r.node_id}`,
    sk: `VIDEO#${r.id}`,
    id: r.id,
    node_id: r.node_id,
    video_url: r.video_url,
    title: r.title,
    order_index: r.order_index ?? 0,
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));
  await batchWrite(T.introTreeNodeVideos, introVidItems);
  console.log('introduction_tree_node_videos:', introVidItems.length);

  console.log('\nMigration complete.');
}

migrate().catch((err) => {
  console.error(err.message);
  if (err.cause) console.error('Cause:', err.cause?.message ?? err.cause, err.cause?.code ?? '');
  process.exit(1);
});
