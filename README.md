# Treatment Tracker - Database Bootstrap

This folder contains SQL to provision the initial database schema and seed data for the decision-tree app.

## What this sets up
- Core tables: `users`, `nodes`, `edges`, `symptoms`, `user_unlocked_nodes`, `user_events`
- A seed of the head & neck radiation treatment decision tree (simplified)
- Demo users: `admin@example.org`, `demo@example.org` (root node unlocked for demo)

## Apply on Supabase
1. Open the Supabase project and go to SQL Editor.
2. Paste and run the contents of `db/schema.sql`.
3. Then paste and run `db/seed.sql` (safe to re-run in dev; it truncates related tables).

## MVP Auth (email match only)
For the initial prototype, the app will treat a user as authenticated if they enter an email that exists in the `users` table. No magic links or passwords. We can layer in Supabase Auth later without changing the data model.

## Next steps
- Scaffold the Next.js app and simple API endpoints to read the tree and store unlocks.
- Build a minimal UI: enter email → show unlocked nodes → play videos → symptom-based unlock. 