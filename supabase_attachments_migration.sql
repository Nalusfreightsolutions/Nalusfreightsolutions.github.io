-- Adds file attachment support for Contacts, Pits, and Driver Compliance.
-- Safe to run as-is on the live database: only creates new objects (three
-- tables, a storage bucket, and their RLS policies), does not touch or drop
-- anything that already exists.
--
-- Same child-table pattern as client_contacts / pit_contacts / pit_materials,
-- so the app's existing replaceChildren() sync helper works unchanged. Actual
-- file bytes live in Supabase Storage (bucket "attachments"); these tables
-- just hold metadata + storage path. compliance_attachments is owner-only,
-- matching the compliance table itself — sales_rep must never see these.

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

grant select, insert, update, delete on client_attachments, pit_attachments, compliance_attachments to anon, authenticated;

-- Private bucket (public=false) — files are only reachable through the app
-- with an authenticated session, never a public URL. Objects are stored under
-- a path like "client/<parent_id>/<uuid>-<filename>", so storage.foldername()
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
