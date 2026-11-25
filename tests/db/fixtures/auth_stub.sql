-- TEST FIXTURE ONLY. Minimal stand-in for the Supabase `auth` schema so the real
-- M02/M03 migrations can run on plain PostgreSQL. This is NOT Supabase and NOT M02.
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb, email_confirmed_at timestamptz, banned_until timestamptz, deleted_at timestamptz, phone text, phone_confirmed_at timestamptz);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users, not_after timestamptz, factor_id uuid, created_at timestamptz default now(), user_agent text);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users, status text);
create table auth.audit_log_entries (payload jsonb, created_at timestamptz default now());
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
