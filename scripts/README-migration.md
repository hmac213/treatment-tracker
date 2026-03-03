# Supabase → DynamoDB migration

This migrates **all** data from your existing Supabase (PostgreSQL) project into the DynamoDB tables used by the Lambda.

## Before you run it

1. **DynamoDB tables and GSIs** must already exist (see `db/dynamodb-schema.md` and `db/create-dynamodb-tables.sh`). All required GSIs (e.g. `gsi_email` on users, `gsi_key` on nodes, edges GSIs) must be created.

2. **Supabase**: You need the project URL and service role key (e.g. from `web/.env`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **AWS**: Credentials with permission to write to the DynamoDB tables (e.g. `dynamodb:PutItem`, `dynamodb:BatchWriteItem`). Set `AWS_REGION` if needed (e.g. `us-west-2`).

4. **Optional**: `TABLE_PREFIX` (default `treatment_tracker`) must match the prefix used when you created the tables.

## How to run

From the **repo root**:

```bash
cd scripts
npm install
node migrate-supabase-to-dynamodb.mjs
```

The script loads env from `web/.env` if it exists (so Supabase URL and key are picked up). You can also export them (and `AWS_REGION`, `TABLE_PREFIX`) in the shell before running.

## What it does

1. Reads every row from these Supabase tables:  
   `users`, `nodes`, `node_categories`, `node_videos`, `edges`, `symptoms`, `user_unlocked_nodes`, `user_events`, `category_videos`, `category_positions`, `symptom_positions`, `bonus_content_videos`, `bonus_content_positions`, `introduction_tree_nodes`, `introduction_tree_node_videos`.

2. Maps each row into the DynamoDB item shape used by the Lambda (same pk/sk and GSI keys as in `db/dynamodb-schema.md`).

3. Writes to DynamoDB in dependency order (users and nodes first, then unlocks/events, etc.). Uses batch writes (25 items per request).

IDs (user id, node id, etc.) are preserved so links between tables stay valid. Admin users keep `is_admin` and `password_hash` if those columns exist in Supabase.

## After migration

- Point the app at DynamoDB only (it already uses `LAMBDA_DATA_API_URL`).
- Optionally run the script again to “re-sync” (it overwrites existing items with the same keys).
- When you’re satisfied, you can turn off or remove Supabase.
