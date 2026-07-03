-- =========================================================================
-- Run this once the login screen + real auth is wired in (phase 2), to
-- remove the temporary open-access policies from supabase_schema.sql.
-- After this, only the real owner/sales_rep policies remain in effect.
-- =========================================================================

drop policy if exists "TEMP anon full access loads" on loads;
drop policy if exists "TEMP anon full access expenses" on expenses;
drop policy if exists "TEMP anon full access compliance" on compliance;
drop policy if exists "TEMP anon full access clients" on clients;
drop policy if exists "TEMP anon full access client_contacts" on client_contacts;
drop policy if exists "TEMP anon full access pits" on pits;
drop policy if exists "TEMP anon full access pit_contacts" on pit_contacts;
drop policy if exists "TEMP anon full access pit_materials" on pit_materials;
drop policy if exists "TEMP anon full access quotes" on quotes;
drop policy if exists "TEMP anon full access quote_materials" on quote_materials;
drop policy if exists "TEMP anon full access sales_jobs" on sales_jobs;
drop policy if exists "TEMP anon full access sales_job_materials" on sales_job_materials;
drop policy if exists "TEMP anon full access annual_items" on annual_items;
drop policy if exists "TEMP anon full access invoice_counters" on invoice_counters;
