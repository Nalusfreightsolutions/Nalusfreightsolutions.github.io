-- Hotfix: "infinite recursion detected in policy for relation profiles" (Postgres 42P17)
-- Cause: the "owners can read all profiles" policy queried `profiles` from inside
-- a policy ON `profiles`, which Postgres RLS refuses to evaluate (self-reference).
-- Fix: use the existing security-definer is_owner() function instead (same pattern
-- already used by every other table's RLS in supabase_schema.sql) so the lookup
-- bypasses RLS instead of re-triggering it.
--
-- Safe to run as-is: does not touch any data, only replaces one policy.
-- is_owner() already exists in the live DB from the original schema run, so it's
-- not recreated here — only dropped/recreated if you want to be extra sure it
-- matches the corrected schema file.

drop policy if exists "owners can read all profiles" on profiles;

create policy "owners can read all profiles"
  on profiles for select
  using (is_owner());
