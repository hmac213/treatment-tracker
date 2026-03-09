# Supabase → DynamoDB migration

This migrates **all** data from your existing Supabase (PostgreSQL) project into DynamoDB. The script **pulls** from Supabase on your machine and **pushes** by calling your existing Lambda API — **no AWS credentials** are needed locally.

## Before you run it

1. **DynamoDB tables and GSIs** must already exist (see `db/dynamodb-schema.md` and `db/create-dynamodb-tables.sh`). Your Lambda must have IAM access to those tables.

2. **Supabase** (e.g. in `web/.env`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Lambda** (e.g. in `web/.env`):
   - `LAMBDA_DATA_API_URL` — the HTTPS URL of your data Lambda (same as the app uses).

## How to run

From the **repo root** (not from `web/`):

```bash
cd scripts
npm install
node migrate-supabase-to-dynamodb.mjs
```

Or from repo root in one go: `node scripts/migrate-supabase-to-dynamodb.mjs` (run `npm install` in `scripts/` first if needed).

The script loads `web/.env` if it exists. You can also export the variables in the shell before running.

## What it does

1. Reads every row from these Supabase tables:  
   `users` (or Auth users if `public.users` is missing), `nodes`, `node_categories`, `node_videos`, `edges`, `symptoms`, `user_unlocked_nodes`, `user_events`, `category_videos`, `category_positions`, `symptom_positions`, `bonus_content_videos`, `bonus_content_positions`, `introduction_tree_nodes`, `introduction_tree_node_videos`.

2. Calls your Lambda for each entity (e.g. `PutUser`, `PutNode`, `InsertUnlocks`, `InsertUserEvents`) so the Lambda writes to DynamoDB. No local AWS credentials required.

IDs (user id, node id, etc.) are preserved. Admin users keep `is_admin` and `password_hash` when migrating from `public.users`.

## After migration

- Point the app at DynamoDB only (it already uses `LAMBDA_DATA_API_URL`).
- Optionally run the script again to “re-sync” (it overwrites existing items with the same keys).
- When you’re satisfied, you can turn off or remove Supabase.
