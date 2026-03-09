#!/usr/bin/env node
/**
 * Migrate all data from Supabase (Postgres) to DynamoDB via the existing Lambda.
 * Pulls from Supabase locally; pushes via Lambda (no AWS credentials needed).
 *
 * Prerequisites:
 *   - Supabase: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (e.g. in web/.env)
 *   - Lambda: LAMBDA_DATA_API_URL (e.g. in web/.env) — script loads web/.env
 *   - DynamoDB tables and GSIs already created; Lambda has IAM access
 *
 * Run: node scripts/migrate-supabase-to-dynamodb.mjs  (from repo root or scripts/)
 */

import { createClient } from '@supabase/supabase-js';
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
const lambdaUrl = (process.env.LAMBDA_DATA_API_URL || '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in web/.env)');
  process.exit(1);
}
if (!lambdaUrl) {
  console.error('Set LAMBDA_DATA_API_URL (e.g. in web/.env)');
  process.exit(1);
}
if (!supabaseUrl.startsWith('https://')) {
  console.error('NEXT_PUBLIC_SUPABASE_URL should start with https://');
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
    console.error('Supabase connectivity failed:', e.message, code ? '(' + code + ')' : '');
    throw new Error('Cannot reach Supabase: ' + e.message);
  }
}

/** Call the data Lambda. No AWS credentials needed. */
async function lambdaCall(action, params = {}) {
  const res = await fetch(lambdaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) throw new Error(json.error || res.statusText || 'Lambda error');
  return json.data;
}

const supabase = createClient(supabaseUrl, supabaseKey);
const now = () => new Date().toISOString();

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
  console.log('Reading from Supabase, pushing to DynamoDB via Lambda\n');
  await checkSupabaseReachable();

  // 1. Users (preserve id, email, name, created_at, is_admin, password_hash)
  let userRecords;
  try {
    const res = await supabase.from('users').select('*');
    if (res.error) {
      const msg = res.error.message || '';
      if (msg.includes('Could not find the table') || msg.includes('schema cache') || res.error.code === 'PGRST116') {
        console.warn('public.users not found, using Supabase Auth users instead.');
        const authUsers = await listAllAuthUsers();
        userRecords = authUsers.map((u) => ({
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
      userRecords = users.map((r) => ({
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
    throw new Error('users: Supabase request failed: ' + e.message);
  }
  for (const record of userRecords) await lambdaCall('PutUser', { record });
  console.log('users:', userRecords.length);

  // 2. Nodes
  const { data: nodes, error: nodesErr } = await supabase.from('nodes').select('*');
  if (nodesErr) throw new Error('nodes: ' + nodesErr.message);
  const nodeRecords = (nodes || []).map((r) => ({
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
  for (const node of nodeRecords) await lambdaCall('PutNode', node);
  console.log('nodes:', nodeRecords.length);

  // 3. Node categories (group by node_id, then SetNodeCategories per node)
  const { data: nodeCats, error: ncErr } = await supabase.from('node_categories').select('*');
  if (ncErr) throw new Error('node_categories: ' + ncErr.message);
  const ncByNode = {};
  for (const r of nodeCats || []) {
    if (!ncByNode[r.node_id]) ncByNode[r.node_id] = [];
    ncByNode[r.node_id].push(r.category);
  }
  for (const [nodeId, categories] of Object.entries(ncByNode)) {
    await lambdaCall('SetNodeCategories', { nodeId, categories });
  }
  console.log('node_categories:', Object.keys(ncByNode).length, 'nodes');

  // 4. Node videos
  const { data: nodeVids, error: nvErr } = await supabase.from('node_videos').select('*');
  if (nvErr) throw new Error('node_videos: ' + nvErr.message);
  for (const r of nodeVids || []) {
    await lambdaCall('PutNodeVideo', {
      nodeId: r.node_id,
      video: {
        id: r.id,
        video_url: r.video_url,
        title: r.title,
        order_index: r.order_index ?? 0,
        created_at: r.created_at || now(),
        updated_at: r.updated_at || now(),
      },
    });
  }
  console.log('node_videos:', (nodeVids || []).length);

  // 5. Edges
  const { data: edges, error: edgesErr } = await supabase.from('edges').select('*');
  if (edgesErr) throw new Error('edges: ' + edgesErr.message);
  for (const r of edges || []) {
    await lambdaCall('PutEdge', {
      id: r.id,
      parent_id: r.parent_id,
      child_id: r.child_id,
      unlock_type: r.unlock_type,
      unlock_value: r.unlock_value ?? null,
      description: r.description ?? null,
      weight: r.weight ?? 0,
      created_at: r.created_at || now(),
    });
  }
  console.log('edges:', (edges || []).length);

  // 6. Symptoms
  const { data: symptoms, error: symErr } = await supabase.from('symptoms').select('*');
  if (symErr) throw new Error('symptoms: ' + symErr.message);
  for (const r of symptoms || []) {
    await lambdaCall('PutSymptom', { id: r.id, key: r.key, label: r.label, description: r.description ?? null });
  }
  console.log('symptoms:', (symptoms || []).length);

  // 7. User unlocked nodes (batch via InsertUnlocks)
  const { data: unlocks, error: unlocksErr } = await supabase.from('user_unlocked_nodes').select('*');
  if (unlocksErr) throw new Error('user_unlocked_nodes: ' + unlocksErr.message);
  const unlockRows = (unlocks || []).map((r) => ({
    user_id: r.user_id,
    node_id: r.node_id,
    unlocked_at: r.unlocked_at || now(),
    unlocked_by: r.unlocked_by || 'user',
    source: r.source ?? null,
  }));
  const UNLOCK_BATCH = 25;
  for (let i = 0; i < unlockRows.length; i += UNLOCK_BATCH) {
    await lambdaCall('InsertUnlocks', { rows: unlockRows.slice(i, i + UNLOCK_BATCH) });
  }
  console.log('user_unlocked_nodes:', unlockRows.length);

  // 8. User events (batch via InsertUserEvents)
  const { data: events, error: eventsErr } = await supabase.from('user_events').select('*');
  if (eventsErr) throw new Error('user_events: ' + eventsErr.message);
  const eventRows = (events || []).map((r) => ({
    user_id: r.user_id,
    type: r.type,
    metadata: r.metadata ?? null,
    created_at: r.created_at || now(),
    id: r.id,
  }));
  const EVENT_BATCH = 25;
  for (let i = 0; i < eventRows.length; i += EVENT_BATCH) {
    await lambdaCall('InsertUserEvents', { rows: eventRows.slice(i, i + EVENT_BATCH) });
  }
  console.log('user_events:', eventRows.length);

  // 9. Category videos
  const { data: catVids, error: catVErr } = await supabase.from('category_videos').select('*');
  if (catVErr) throw new Error('category_videos: ' + catVErr.message);
  for (const r of catVids || []) {
    await lambdaCall('PutCategoryVideo', {
      record: {
        id: r.id,
        category: r.category,
        video_url: r.video_url,
        title: r.title,
        order_index: r.order_index ?? 0,
        created_at: r.created_at || now(),
      },
    });
  }
  console.log('category_videos:', (catVids || []).length);

  // 10. Category positions
  const { data: catPos, error: catPErr } = await supabase.from('category_positions').select('*');
  if (catPErr) throw new Error('category_positions: ' + catPErr.message);
  for (const r of catPos || []) {
    await lambdaCall('PutCategoryPosition', {
      record: {
        category: r.category,
        pos_x: Number(r.pos_x),
        pos_y: Number(r.pos_y),
        width: Number(r.width),
        height: Number(r.height),
        created_at: r.created_at || now(),
      },
    });
  }
  console.log('category_positions:', (catPos || []).length);

  // 11. Symptom positions
  const { data: symPos, error: symPErr } = await supabase.from('symptom_positions').select('*');
  if (symPErr) throw new Error('symptom_positions: ' + symPErr.message);
  for (const r of symPos || []) {
    await lambdaCall('PutSymptomPosition', {
      record: {
        id: r.id,
        position_key: r.position_key,
        pos_x: Number(r.pos_x),
        pos_y: Number(r.pos_y),
        width: Number(r.width),
        height: Number(r.height),
        created_at: r.created_at || now(),
      },
    });
  }
  console.log('symptom_positions:', (symPos || []).length);

  // 12. Bonus content videos
  const { data: bonusVids, error: bonusVErr } = await supabase.from('bonus_content_videos').select('*');
  if (bonusVErr) throw new Error('bonus_content_videos: ' + bonusVErr.message);
  for (const r of bonusVids || []) {
    await lambdaCall('PutBonusContentVideo', {
      record: {
        id: r.id,
        category: r.category,
        video_url: r.video_url,
        title: r.title,
        order_index: r.order_index ?? 0,
        created_at: r.created_at || now(),
      },
    });
  }
  console.log('bonus_content_videos:', (bonusVids || []).length);

  // 13. Bonus content positions
  const { data: bonusPos, error: bonusPErr } = await supabase.from('bonus_content_positions').select('*');
  if (bonusPErr) throw new Error('bonus_content_positions: ' + bonusPErr.message);
  for (const r of bonusPos || []) {
    await lambdaCall('PutBonusContentPosition', {
      record: {
        category: r.category,
        pos_x: Number(r.pos_x),
        pos_y: Number(r.pos_y),
        width: Number(r.width),
        height: Number(r.height),
        created_at: r.created_at || now(),
      },
    });
  }
  console.log('bonus_content_positions:', (bonusPos || []).length);

  // 14. Introduction tree nodes
  const { data: introNodes, error: introNErr } = await supabase.from('introduction_tree_nodes').select('*');
  if (introNErr) throw new Error('introduction_tree_nodes: ' + introNErr.message);
  for (const r of introNodes || []) {
    await lambdaCall('PutIntroTreeNode', {
      node: {
        id: r.id,
        node_key: r.node_key,
        title: r.title,
        pos_x: Number(r.pos_x ?? 0),
        pos_y: Number(r.pos_y ?? 0),
        width: Number(r.width ?? 10),
        height: Number(r.height ?? 5),
        created_at: r.created_at || now(),
        updated_at: r.updated_at || now(),
      },
    });
  }
  console.log('introduction_tree_nodes:', (introNodes || []).length);

  // 15. Introduction tree node videos
  const { data: introVids, error: introVErr } = await supabase.from('introduction_tree_node_videos').select('*');
  if (introVErr) throw new Error('introduction_tree_node_videos: ' + introVErr.message);
  for (const r of introVids || []) {
    await lambdaCall('PutIntroTreeNodeVideo', {
      nodeId: r.node_id,
      video: {
        id: r.id,
        video_url: r.video_url,
        title: r.title,
        order_index: r.order_index ?? 0,
        created_at: r.created_at || now(),
        updated_at: r.updated_at || now(),
      },
    });
  }
  console.log('introduction_tree_node_videos:', (introVids || []).length);

  console.log('\nMigration complete.');
}

migrate().catch((err) => {
  console.error(err.message);
  if (err.cause) console.error('Cause:', err.cause?.message ?? err.cause, err.cause?.code ?? '');
  process.exit(1);
});
