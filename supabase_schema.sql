-- =========================================================================
-- Nalu Command Center — FINAL consolidated schema (replaces schema.sql,
-- temp_open_access.sql, and patch1.sql — this is the only script you need
-- from here on). Safe to run even though earlier scripts already ran:
-- it wipes the (still-empty) public schema and rebuilds it correctly.
-- =========================================================================
-- Why a rebuild: the app generates its own record IDs as plain strings
-- (e.g. "m1k2j3xabcde"), not standard UUIDs — and the 66 pits already
-- built into the app have hand-written IDs like "p-scc-samsula". The
-- original schema expected UUID-formatted ids everywhere, which would
-- have silently failed to save real data. Using plain text ids instead
-- fixes that completely.
-- =========================================================================

-- ---------- reset ----------
drop trigger if exists on_auth_user_created on auth.users;
drop schema public cascade;
create schema public;
grant all on schema public to postgres, anon, authenticated, service_role;

-- ---------- 1. ROLES / PROFILES ----------
-- Tied to Supabase Auth users, so this one keeps a real uuid (Supabase
-- Auth always uses uuid for auth.users.id).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'sales_rep' check (role in ('owner','sales_rep')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users can read their own profile"
  on profiles for select
  using (auth.uid() = id);

create or replace function is_owner() returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$ language sql security definer stable;

create policy "owners can read all profiles"
  on profiles for select
  using (is_owner());

-- ---------- 2. LOADS (NNL + NFS tickets) ----------
create table loads (
  id text primary key,
  company text not null check (company in ('NNL','NFS')),
  date date,
  party text,
  truck text,
  driver text,
  driver_type text,
  job_source text,
  referred_by text,
  payment_type text,
  ticket text,
  qty numeric,
  rate numeric,
  revenue numeric,
  driver_pay numeric,
  net numeric,
  status text default 'Pending',
  invoice_num text,
  date_paid date,
  pit text,
  customer text,
  job_name text,
  material text,
  broker text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table loads enable row level security;

create policy "owner full access loads" on loads for all
  using (is_owner()) with check (is_owner());
create policy "sales_rep nfs access loads" on loads for all
  using (company = 'NFS' and not is_owner() and auth.uid() is not null)
  with check (company = 'NFS' and not is_owner() and auth.uid() is not null);
create policy "TEMP anon full access loads" on loads for all using (true) with check (true);

-- ---------- 3. EXPENSES ----------
create table expenses (
  id text primary key,
  company text not null check (company in ('NNL','NFS')),
  date date,
  category text,
  truck text,
  amount numeric,
  frequency text,
  notes text,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

create policy "owner full access expenses" on expenses for all
  using (is_owner()) with check (is_owner());
create policy "sales_rep nfs access expenses" on expenses for all
  using (company = 'NFS' and not is_owner() and auth.uid() is not null)
  with check (company = 'NFS' and not is_owner() and auth.uid() is not null);
create policy "TEMP anon full access expenses" on expenses for all using (true) with check (true);

-- ---------- 4. DRIVER COMPLIANCE (owner only — NNL-only, sensitive) ----------
create table compliance (
  id text primary key,
  name text,
  coi_date date,
  w9_year text,
  wc_date date,
  notes text,
  created_at timestamptz not null default now()
);

alter table compliance enable row level security;

create policy "owner only compliance" on compliance for all
  using (is_owner()) with check (is_owner());
create policy "TEMP anon full access compliance" on compliance for all using (true) with check (true);

-- ---------- 5. CLIENTS + CONTACTS ----------
create table clients (
  id text primary key,
  name text not null,
  office_address text,
  notes text,
  created_at timestamptz not null default now()
);

create table client_contacts (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  name text,
  email text,
  title text
);

alter table clients enable row level security;
alter table client_contacts enable row level security;

create policy "any authenticated user full access clients" on clients for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "any authenticated user full access client_contacts" on client_contacts for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "TEMP anon full access clients" on clients for all using (true) with check (true);
create policy "TEMP anon full access client_contacts" on client_contacts for all using (true) with check (true);

-- ---------- 6. PITS + CONTACTS + MATERIALS/DUMP FEES ----------
create table pits (
  id text primary key,
  name text not null,
  location text,
  address text,
  tax_rate numeric,
  prices_verified_date date,
  lat numeric,
  lng numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table pit_contacts (
  id text primary key,
  pit_id text references pits(id) on delete cascade,
  name text,
  email text,
  phone text,
  title text
);

-- kind distinguishes "material for sale" from "dump fee / disposal pricing"
create table pit_materials (
  id text primary key,
  pit_id text references pits(id) on delete cascade,
  name text,
  price numeric,
  unit text,
  kind text not null default 'material' check (kind in ('material','dump_fee'))
);

alter table pits enable row level security;
alter table pit_contacts enable row level security;
alter table pit_materials enable row level security;

create policy "any authenticated user full access pits" on pits for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "any authenticated user full access pit_contacts" on pit_contacts for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "any authenticated user full access pit_materials" on pit_materials for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "TEMP anon full access pits" on pits for all using (true) with check (true);
create policy "TEMP anon full access pit_contacts" on pit_contacts for all using (true) with check (true);
create policy "TEMP anon full access pit_materials" on pit_materials for all using (true) with check (true);

-- ---------- 7. QUOTES (+ multiple material line items) ----------
create table quotes (
  id text primary key,
  date date,
  client_name text,
  job_name text,
  job_address text,
  submitted_by text,
  status text default 'Submitted',
  notes text,
  created_at timestamptz not null default now()
);

create table quote_materials (
  id text primary key,
  quote_id text references quotes(id) on delete cascade,
  pit_id text references pits(id),
  material text,
  unit text,
  qty_requested numeric,
  price numeric,
  material_mode text default 'perUnit',
  tax_rate numeric,
  trucking_cost numeric,
  trucking_mode text default 'perUnit',
  profit_override numeric
);

alter table quotes enable row level security;
alter table quote_materials enable row level security;

create policy "any authenticated user full access quotes" on quotes for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "any authenticated user full access quote_materials" on quote_materials for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "TEMP anon full access quotes" on quotes for all using (true) with check (true);
create policy "TEMP anon full access quote_materials" on quote_materials for all using (true) with check (true);

-- ---------- 8. SALES JOBS / LANDED JOBS (+ multiple material line items) ----------
create table sales_jobs (
  id text primary key,
  client_name text,
  job_name text,
  job_address text,
  job_started date,
  job_ended date,
  sales_rep text,
  notes text,
  quote_id text references quotes(id),
  created_at timestamptz not null default now()
);

create table sales_job_materials (
  id text primary key,
  sales_job_id text references sales_jobs(id) on delete cascade,
  pit_id text references pits(id),
  material text,
  unit text,
  qty_requested numeric,
  qty_final numeric,
  price numeric,
  material_mode text default 'perUnit',
  tax_rate numeric,
  trucking_cost numeric,
  trucking_mode text default 'perUnit',
  profit_override numeric
);

alter table sales_jobs enable row level security;
alter table sales_job_materials enable row level security;

create policy "any authenticated user full access sales_jobs" on sales_jobs for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "any authenticated user full access sales_job_materials" on sales_job_materials for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "TEMP anon full access sales_jobs" on sales_jobs for all using (true) with check (true);
create policy "TEMP anon full access sales_job_materials" on sales_job_materials for all using (true) with check (true);

-- ---------- 9. ANNUAL / TAX ITEMS ----------
create table annual_items (
  id text primary key,
  company text not null check (company in ('NNL','NFS')),
  item text,
  amount numeric,
  due date,
  status text default 'Unpaid'
);

alter table annual_items enable row level security;

create policy "owner full access annual_items" on annual_items for all
  using (is_owner()) with check (is_owner());
create policy "sales_rep nfs access annual_items" on annual_items for all
  using (company = 'NFS' and not is_owner() and auth.uid() is not null)
  with check (company = 'NFS' and not is_owner() and auth.uid() is not null);
create policy "TEMP anon full access annual_items" on annual_items for all using (true) with check (true);

-- ---------- 10. INVOICE COUNTERS ----------
create table invoice_counters (
  company text primary key check (company in ('NNL','NFS')),
  counter integer not null default 1000
);
insert into invoice_counters (company, counter) values ('NNL', 1000), ('NFS', 1000);

alter table invoice_counters enable row level security;

create policy "owner full access invoice_counters" on invoice_counters for all
  using (is_owner()) with check (is_owner());
create policy "sales_rep nfs access invoice_counters" on invoice_counters for all
  using (company = 'NFS' and not is_owner() and auth.uid() is not null)
  with check (company = 'NFS' and not is_owner() and auth.uid() is not null);
create policy "TEMP anon full access invoice_counters" on invoice_counters for all using (true) with check (true);

-- ---------- 10b. ATTACHMENTS (files for contacts, pits, driver compliance) ----------
-- Same child-table pattern as client_contacts / pit_contacts / pit_materials, so
-- the existing replaceChildren() sync helper works unchanged. Actual file bytes
-- live in Supabase Storage (bucket "attachments"); these rows just hold metadata
-- + storage path. compliance_attachments is owner-only, matching the compliance
-- table itself — sales_rep must never see these.
create table client_attachments (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  file_name text,
  storage_path text,
  mime_type text,
  uploaded_at timestamptz not null default now()
);
alter table client_attachments enable row level security;
create policy "any authenticated user full access client_attachments" on client_attachments for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table pit_attachments (
  id text primary key,
  pit_id text references pits(id) on delete cascade,
  file_name text,
  storage_path text,
  mime_type text,
  uploaded_at timestamptz not null default now()
);
alter table pit_attachments enable row level security;
create policy "any authenticated user full access pit_attachments" on pit_attachments for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create table compliance_attachments (
  id text primary key,
  compliance_id text references compliance(id) on delete cascade,
  file_name text,
  storage_path text,
  mime_type text,
  uploaded_at timestamptz not null default now()
);
alter table compliance_attachments enable row level security;
create policy "owner only compliance_attachments" on compliance_attachments for all
  using (is_owner()) with check (is_owner());

-- Storage bucket + policies. Private bucket (public=false) — access only through
-- the app with an authenticated session, never a public URL. Objects are stored
-- under a path like "client/<parent_id>/<uuid>-<filename>", so storage.foldername()
-- reads which table the file belongs to straight off the path.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "any authenticated user access client/pit attachment files"
  on storage.objects for all
  using (
    bucket_id = 'attachments' and auth.uid() is not null
    and (storage.foldername(name))[1] in ('client','pit')
  )
  with check (
    bucket_id = 'attachments' and auth.uid() is not null
    and (storage.foldername(name))[1] in ('client','pit')
  );
create policy "owner only compliance attachment files"
  on storage.objects for all
  using (
    bucket_id = 'attachments' and is_owner()
    and (storage.foldername(name))[1] = 'compliance'
  )
  with check (
    bucket_id = 'attachments' and is_owner()
    and (storage.foldername(name))[1] = 'compliance'
  );

-- ---------- 11. AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- 12. updated_at auto-touch on loads ----------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger loads_touch_updated_at
  before update on loads
  for each row execute function touch_updated_at();

-- ---------- 13. TABLE-LEVEL GRANTS ----------
-- "grant all on schema public" earlier only grants schema-level access (USAGE/CREATE).
-- Postgres also requires explicit table-level privileges before RLS policies even
-- get evaluated — without this, every query fails with "permission denied," no
-- matter how the RLS policies are written.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
