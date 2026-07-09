// Shared between the NNL and NFS apps.
/* ============================= SUPABASE STORAGE ============================= */
// Every save/load goes to a real Postgres database instead of localStorage, so
// the whole team sees the same data from any device. Access is gated by login +
// RLS policies (see supabase_schema.sql) — there is no unauthenticated access.
const SUPABASE_URL = 'https://nujalvroqdjtbnqzxknq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qwzBj0qWSFbGm_s3U82Jgg_q8EejVIa';
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
