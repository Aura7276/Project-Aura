-- TEST FIXTURE ONLY. Minimal stand-in for Supabase Storage tables so the real storage policies in the M05 migration are created and tested
-- on plain PostgreSQL. It is NOT Supabase Storage: no uploads, signed URLs, or API; only the row-level policy behaviour is exercised.
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid default auth.uid());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to authenticated;
