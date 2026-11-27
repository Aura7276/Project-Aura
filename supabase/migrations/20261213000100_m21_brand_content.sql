-- M21 Brand Content and Social Planning (reconstructed scope, owner reconciliation pending; see the module file).
-- Brand-owned content from idea to manual publication: pillars, ideas, a versioned editor (hook, script, caption, CTA, disclosure),
-- a production board and calendar, team review with explicit approval, a publication checklist, link-only assets with provenance,
-- reuse of Creator content only within the rights agreed in M11, and results recorded by hand with M19's metric definitions.
-- Nothing is published automatically, nothing is generated, and nothing is visible to Creators. Owner/admin with MFA writes (M26 roles pending).
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_brand_content;
revoke all on schema aura_brand_content from public, anon, authenticated;

create table aura_brand_content.setting (key text primary key, value jsonb not null);
insert into aura_brand_content.setting(key, value) values ('max_pillars', '8'), ('max_items', '2000');

create table aura_brand_content.pillar (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 name text not null check (length(trim(name)) between 2 and 60), description text check (length(description) <= 500),
 mix integer not null default 0 check (mix between 0 and 100), archived boolean not null default false,
 created_at timestamptz not null default clock_timestamp(), unique (workspace_id, name)
);
create table aura_brand_content.item (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 request_id uuid not null, title text not null check (length(trim(title)) between 3 and 140),
 format text not null default 'post' check (format in ('reel','short','carousel','story','post','video','live','article')),
 account_id uuid references aura_brand.social_account on delete set null,
 pillar_id uuid references aura_brand_content.pillar on delete set null,
 segment_id uuid references aura_brand.segment on delete set null,
 product_id uuid references aura_brand.product on delete set null,
 hook text check (length(hook) <= 300), script text check (length(script) <= 8000), caption text check (length(caption) <= 2200),
 cta text check (length(cta) <= 200), disclosure text check (length(disclosure) <= 300), notes text check (length(notes) <= 2000),
 claims text[] not null default '{}' check (cardinality(claims) <= 12),
 planned_for date,
 stage text not null default 'idea' check (stage in ('idea','drafting','production','in_review','approved','scheduled','published','archived')),
 version integer not null default 1, approved_version integer, approved_by uuid references auth.users, approved_at timestamptz,
 checklist jsonb not null default '{}' check (jsonb_typeof(checklist) = 'object'),
 published_url text check (published_url ~ '^https://[^\s]{3,}$' and length(published_url) <= 2048), published_on date, published_by uuid references auth.users,
 source text not null default 'team' check (source in ('team','ai','repurposed')),
 repurpose jsonb, -- {collaboration_id, deliverable_id, creator, url, published_on, usage_months, channels, allowed_until}
 created_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique (workspace_id, request_id),
 check ((stage = 'published') = (published_url is not null and published_on is not null))
);
create index item_by_ws on aura_brand_content.item(workspace_id, stage, planned_for);
create table aura_brand_content.revision (
 item_id uuid not null references aura_brand_content.item on delete cascade, version integer not null,
 snapshot jsonb not null, saved_by uuid not null references auth.users, saved_at timestamptz not null default clock_timestamp(),
 primary key (item_id, version)
);
create table aura_brand_content.review (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references aura_brand_content.item on delete cascade,
 version integer not null, decision text not null check (decision in ('approved','changes_requested','submitted','reopened')),
 note text check (length(note) <= 1000), unapproved_claims text[] not null default '{}',
 actor uuid not null references auth.users, created_at timestamptz not null default clock_timestamp()
);
create table aura_brand_content.asset (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 item_id uuid references aura_brand_content.item on delete set null,
 title text not null check (length(trim(title)) between 2 and 120), kind text not null check (kind in ('image','video','document','audio','link')),
 url text not null check (url ~ '^https://[^\s]{3,}$' and length(url) <= 2048),
 provenance text not null check (provenance in ('own','creator','licensed','other')), rights_note text check (length(rights_note) <= 500),
 collaboration_id uuid, added_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp()
);
create table aura_brand_content.result (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references aura_brand_content.item on delete cascade,
 metric text not null, value numeric not null check (value >= 0 and value < 1e12), observed_on date not null,
 source text not null check (source in ('platform_insights','screenshot','export','manual_count','other')), note text check (length(note) <= 300),
 entered_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(),
 voided_at timestamptz, voided_by uuid references auth.users, void_reason text
);
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname = 'aura_brand_content' loop
  execute format('alter table aura_brand_content.%I enable row level security', t);
  execute format('revoke all on aura_brand_content.%I from public, anon, authenticated', t);
 end loop;
end $$;

-- ───────── Helpers ─────────
create function aura_brand_content.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_brand_content.setting where key = p_key $$;
create function aura_brand_content.item_of(p_ws uuid, p_item uuid, p_lock boolean default false) returns aura_brand_content.item language plpgsql set search_path='' as $$
declare i aura_brand_content.item;
begin
 if p_lock then select * into i from aura_brand_content.item where id = p_item and workspace_id = p_ws for update;
 else select * into i from aura_brand_content.item where id = p_item and workspace_id = p_ws; end if;
 if i.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return i;
end $$;
-- Claims on an item that are not among this workspace's approved product claims (M14). Comparison ignores case and spacing.
create function aura_brand_content.unapproved(p_ws uuid, p_claims text[]) returns text[] language sql stable set search_path='' as $$
 select coalesce(array_agg(c order by c), '{}') from unnest(p_claims) c
 where not exists(select 1 from aura_brand.product p, unnest(p.claims) a where p.workspace_id = p_ws and lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = lower(regexp_replace(trim(c), '\s+', ' ', 'g'))) $$;
-- Agreed reuse rights (M11 proposal terms) for a published Creator deliverable, evaluated for one platform on one date.
create function aura_brand_content.rights(p_terms jsonb, p_published date, p_platform text, p_on date) returns jsonb language plpgsql immutable set search_path='' as $$
declare r jsonb := p_terms->'rights'; months int; until date; ch text[]; ok_channel boolean;
begin
 if p_published is null then return jsonb_build_object('allowed', false, 'reason', 'Not published yet'); end if;
 if r is null or r->>'usage_months' is null then return jsonb_build_object('allowed', false, 'reason', 'No usage rights were agreed'); end if;
 months := (r->>'usage_months')::int;
 if months <= 0 then return jsonb_build_object('allowed', false, 'reason', 'The agreement grants no reuse'); end if;
 until := (p_published + make_interval(months => months))::date;
 select coalesce(array_agg(lower(trim(x))), '{}') into ch from jsonb_array_elements_text(coalesce(r->'channels', '[]')) x;
 ok_channel := p_platform is not null and (lower(p_platform) = any(ch) or exists(select 1 from unnest(ch) c where c in ('all','any','all channels','all platforms') or c like '%' || lower(p_platform) || '%'));
 if not ok_channel then return jsonb_build_object('allowed', false, 'reason', 'Agreed channels do not include ' || coalesce(initcap(p_platform), 'this account'), 'until', until, 'channels', to_jsonb(ch)); end if;
 if p_on > until then return jsonb_build_object('allowed', false, 'reason', 'Usage rights ended on ' || until, 'until', until, 'channels', to_jsonb(ch)); end if;
 return jsonb_build_object('allowed', true, 'reason', 'Within agreed rights until ' || until, 'until', until, 'channels', to_jsonb(ch));
end $$;
create function aura_brand_content.platform(p_account uuid) returns text language sql stable set search_path='' as $$ select platform from aura_brand.social_account where id = p_account $$;
create function aura_brand_content.snapshot(i aura_brand_content.item) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('title', i.title, 'format', i.format, 'account_id', i.account_id, 'pillar_id', i.pillar_id, 'segment_id', i.segment_id, 'product_id', i.product_id,
  'hook', i.hook, 'script', i.script, 'caption', i.caption, 'cta', i.cta, 'disclosure', i.disclosure, 'notes', i.notes, 'claims', to_jsonb(i.claims), 'planned_for', i.planned_for) $$;
-- Publication checklist: what must be ticked before an item is marked published.
create function aura_brand_content.checklist_keys(i aura_brand_content.item) returns text[] language sql immutable set search_path='' as $$
 select array['final_copy','account','link_checked'] || case when i.source = 'repurposed' or i.disclosure is not null then array['disclosure'] else '{}'::text[] end
  || case when cardinality(i.claims) > 0 then array['claims'] else '{}'::text[] end $$;
create function aura_brand_content.json(i aura_brand_content.item) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(i) - 'workspace_id' - 'request_id' - 'created_by' - 'approved_by' - 'published_by' || jsonb_build_object(
  'account', (select jsonb_build_object('platform', s.platform, 'handle', s.handle) from aura_brand.social_account s where s.id = i.account_id),
  'pillar', (select p.name from aura_brand_content.pillar p where p.id = i.pillar_id),
  'segment', (select jsonb_build_object('name', s.name, 'basis', s.basis) from aura_brand.segment s where s.id = i.segment_id),
  'product', (select p.name from aura_brand.product p where p.id = i.product_id),
  'unapproved_claims', to_jsonb(aura_brand_content.unapproved(i.workspace_id, i.claims)),
  'checklist_required', to_jsonb(aura_brand_content.checklist_keys(i)),
  'approved_current', i.approved_version is not null and i.approved_version = i.version) $$;

-- ───────── Pillars ─────────
create function public.aura_brand_content_save_pillar(p_workspace uuid, p_id uuid, p_name text, p_description text, p_mix integer, p_archived boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); p aura_brand_content.pillar; total int;
begin
 perform pg_advisory_xact_lock(hashtextextended('brand_pillar:' || p_workspace::text, 0));
 if p_id is null then
  if (select count(*) from aura_brand_content.pillar where workspace_id = p_workspace and not archived) >= aura_brand_content.setting_int('max_pillars') then raise exception 'You can have up to % active pillars', aura_brand_content.setting_int('max_pillars') using errcode = '54000'; end if;
  insert into aura_brand_content.pillar(workspace_id, name, description, mix) values (p_workspace, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_mix, 0)) returning * into p;
 else
  update aura_brand_content.pillar set name = trim(p_name), description = nullif(trim(coalesce(p_description, '')), ''), mix = coalesce(p_mix, 0), archived = coalesce(p_archived, false)
   where id = p_id and workspace_id = p_workspace returning * into p;
  if p.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 end if;
 select coalesce(sum(mix), 0) into total from aura_brand_content.pillar where workspace_id = p_workspace and not archived;
 if total > 100 then raise exception 'The content mix adds up to more than 100%%' using errcode = '23514'; end if;
 return jsonb_build_object('id', p.id, 'mix_total', total);
end $$;

-- ───────── Items: create, edit (versioned), move ─────────
create function public.aura_brand_content_create(p_workspace uuid, p_request uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_brand_content.item; v jsonb := coalesce(p_fields, '{}');
begin
 if (select count(*) from aura_brand_content.item where workspace_id = p_workspace) >= aura_brand_content.setting_int('max_items') then raise exception 'Content limit reached' using errcode = '54000'; end if;
 if (v->>'account_id') is not null and not exists(select 1 from aura_brand.social_account where id = (v->>'account_id')::uuid and workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 if (v->>'pillar_id') is not null and not exists(select 1 from aura_brand_content.pillar where id = (v->>'pillar_id')::uuid and workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 insert into aura_brand_content.item(workspace_id, request_id, title, format, account_id, pillar_id, hook, notes, planned_for, stage, source, created_by)
  values (p_workspace, p_request, trim(v->>'title'), coalesce(v->>'format', 'post'), (v->>'account_id')::uuid, (v->>'pillar_id')::uuid, nullif(trim(coalesce(v->>'hook', '')), ''),
   nullif(trim(coalesce(v->>'notes', '')), ''), (v->>'planned_for')::date, case when v->>'stage' = 'drafting' then 'drafting' else 'idea' end, case when v->>'source' = 'ai' then 'ai' else 'team' end, u)
  on conflict (workspace_id, request_id) do nothing returning * into i;
 if i.id is null then select * into i from aura_brand_content.item where workspace_id = p_workspace and request_id = p_request; return jsonb_build_object('id', i.id); end if;
 insert into aura_brand_content.revision(item_id, version, snapshot, saved_by) values (i.id, 1, aura_brand_content.snapshot(i), u);
 return jsonb_build_object('id', i.id);
end $$;
-- Saving content after approval sends the item back to review (approval is for a version, not for an item).
create function public.aura_brand_content_save(p_workspace uuid, p_item uuid, p_expected integer, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item, true); v jsonb := coalesce(p_fields, '{}'); n aura_brand_content.item; reopened boolean := false;
 cl text[];
begin
 if i.stage in ('published','archived') then raise exception 'This item can no longer be edited' using errcode = '55000'; end if;
 if i.version <> p_expected then raise exception 'Someone else saved a newer version. Reload to see it.' using errcode = '40001'; end if;
 if (v->>'account_id') is not null and not exists(select 1 from aura_brand.social_account where id = (v->>'account_id')::uuid and workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 if (v->>'pillar_id') is not null and not exists(select 1 from aura_brand_content.pillar where id = (v->>'pillar_id')::uuid and workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 if (v->>'segment_id') is not null and not exists(select 1 from aura_brand.segment where id = (v->>'segment_id')::uuid and workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 if (v->>'product_id') is not null and not exists(select 1 from aura_brand.product where id = (v->>'product_id')::uuid and workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 select coalesce(array_agg(distinct trim(x)) filter (where length(trim(x)) between 2 and 200), '{}') into cl from jsonb_array_elements_text(coalesce(v->'claims', '[]')) x;
 n := i;
 n.title := trim(v->>'title'); n.format := coalesce(v->>'format', i.format); n.account_id := (v->>'account_id')::uuid; n.pillar_id := (v->>'pillar_id')::uuid;
 n.segment_id := (v->>'segment_id')::uuid; n.product_id := (v->>'product_id')::uuid;
 n.hook := nullif(trim(coalesce(v->>'hook', '')), ''); n.script := nullif(trim(coalesce(v->>'script', '')), ''); n.caption := nullif(trim(coalesce(v->>'caption', '')), '');
 n.cta := nullif(trim(coalesce(v->>'cta', '')), ''); n.disclosure := nullif(trim(coalesce(v->>'disclosure', '')), ''); n.notes := nullif(trim(coalesce(v->>'notes', '')), '');
 n.claims := cl; n.planned_for := (v->>'planned_for')::date;
 if aura_brand_content.snapshot(n) = aura_brand_content.snapshot(i) then return jsonb_build_object('version', i.version, 'changed', false, 'reopened', false); end if;
 if i.source = 'repurposed' and n.account_id is distinct from i.account_id then
  if n.account_id is null or not (aura_brand_content.rights(jsonb_build_object('rights', jsonb_build_object('usage_months', i.repurpose->'usage_months', 'channels', i.repurpose->'channels')),
     (i.repurpose->>'published_on')::date, aura_brand_content.platform(n.account_id), coalesce(n.planned_for, current_date))->>'allowed')::boolean then
   raise exception 'The agreed rights do not cover that account' using errcode = '55000';
  end if;
 end if;
 if i.stage in ('approved','scheduled') then n.stage := 'in_review'; reopened := true; end if;
 n.version := i.version + 1; n.updated_at := clock_timestamp();
 update aura_brand_content.item set title = n.title, format = n.format, account_id = n.account_id, pillar_id = n.pillar_id, segment_id = n.segment_id, product_id = n.product_id,
  hook = n.hook, script = n.script, caption = n.caption, cta = n.cta, disclosure = n.disclosure, notes = n.notes, claims = n.claims, planned_for = n.planned_for,
  stage = n.stage, version = n.version, updated_at = n.updated_at, checklist = case when reopened then '{}'::jsonb else checklist end,
  approved_version = case when reopened then null else approved_version end, approved_by = case when reopened then null else approved_by end, approved_at = case when reopened then null else approved_at end where id = i.id;
 insert into aura_brand_content.revision(item_id, version, snapshot, saved_by) values (i.id, n.version, aura_brand_content.snapshot(n), u);
 if reopened then insert into aura_brand_content.review(item_id, version, decision, note, actor) values (i.id, n.version, 'reopened', 'Edited after approval', u); end if;
 return jsonb_build_object('version', n.version, 'changed', true, 'reopened', reopened);
end $$;
-- Stage moves. Approval and publication have their own functions; this covers the working stages, scheduling and archiving.
create function public.aura_brand_content_move(p_workspace uuid, p_item uuid, p_to text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item, true);
begin
 if p_to not in ('idea','drafting','production','in_review','scheduled','archived') then raise exception 'Use approve or publish for that step' using errcode = '22023'; end if;
 if i.stage = 'published' then raise exception 'Published items cannot be moved' using errcode = '55000'; end if;
 if p_to = i.stage then return jsonb_build_object('stage', i.stage); end if;
 if p_to = 'scheduled' then
  if i.stage <> 'approved' or i.approved_version is distinct from i.version then raise exception 'Only approved content can be scheduled' using errcode = '55000'; end if;
  if i.planned_for is null or i.account_id is null then raise exception 'Choose an account and a date before scheduling' using errcode = '22023'; end if;
 elsif p_to = 'in_review' then
  if i.stage = 'archived' then raise exception 'Restore it first' using errcode = '55000'; end if;
  if length(coalesce(i.caption, i.script, i.hook, '')) < 3 then raise exception 'Add a hook, script or caption before review' using errcode = '22023'; end if;
  insert into aura_brand_content.review(item_id, version, decision, actor) values (i.id, i.version, 'submitted', u);
 elsif i.stage in ('approved','scheduled') and p_to in ('idea','drafting','production') then
  insert into aura_brand_content.review(item_id, version, decision, note, actor) values (i.id, i.version, 'reopened', 'Moved back to ' || p_to, u);
 end if;
 update aura_brand_content.item set stage = p_to, updated_at = clock_timestamp(),
  approved_version = case when p_to in ('idea','drafting','production','archived') then null else approved_version end where id = i.id;
 return jsonb_build_object('stage', p_to);
end $$;
-- Review: approve the current version or request changes. Unapproved claims must be acknowledged with a note.
create function public.aura_brand_content_review(p_workspace uuid, p_item uuid, p_version integer, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item, true); bad text[];
begin
 if p_decision not in ('approved','changes_requested') then raise exception 'Invalid decision' using errcode = '22023'; end if;
 if i.stage <> 'in_review' then raise exception 'Send it for review first' using errcode = '55000'; end if;
 if i.version <> p_version then raise exception 'Someone else saved a newer version. Reload to see it.' using errcode = '40001'; end if;
 bad := aura_brand_content.unapproved(p_workspace, i.claims);
 if p_decision = 'approved' and cardinality(bad) > 0 and length(trim(coalesce(p_note, ''))) < 10 then
  raise exception 'Some claims are not on your approved list. Explain in the note why they are acceptable.' using errcode = '22023';
 end if;
 if p_decision = 'changes_requested' and length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Say what needs to change' using errcode = '22023'; end if;
 insert into aura_brand_content.review(item_id, version, decision, note, unapproved_claims, actor) values (i.id, i.version, p_decision, nullif(trim(coalesce(p_note, '')), ''), bad, u);
 update aura_brand_content.item set stage = case when p_decision = 'approved' then 'approved' else 'drafting' end,
  approved_version = case when p_decision = 'approved' then i.version else null end, approved_by = case when p_decision = 'approved' then u end,
  approved_at = case when p_decision = 'approved' then now() end, updated_at = clock_timestamp() where id = i.id;
 perform aura_market.audit(u, 'brand_content_' || p_decision);
 return jsonb_build_object('stage', case when p_decision = 'approved' then 'approved' else 'drafting' end);
end $$;
create function public.aura_brand_content_check(p_workspace uuid, p_item uuid, p_key text, p_done boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item, true);
begin
 if p_key not in ('final_copy','account','link_checked','disclosure','claims') then raise exception 'Invalid checklist item' using errcode = '22023'; end if;
 if i.stage not in ('approved','scheduled') then raise exception 'The checklist opens once the content is approved' using errcode = '55000'; end if;
 update aura_brand_content.item set checklist = case when p_done then checklist || jsonb_build_object(p_key, jsonb_build_object('by', u, 'at', now())) else checklist - p_key end where id = i.id returning checklist into i.checklist;
 return i.checklist;
end $$;
-- Manual publication: the team posts it themselves and records where and when. Requires the approved version and a complete checklist;
-- repurposed Creator content is re-checked against the agreed rights on the publication date.
create function public.aura_brand_content_publish(p_workspace uuid, p_item uuid, p_url text, p_on date) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item, true); missing text[]; r jsonb;
begin
 if i.stage not in ('approved','scheduled') or i.approved_version is distinct from i.version then raise exception 'Only the approved version can be published' using errcode = '55000'; end if;
 if i.account_id is null then raise exception 'Choose the account it was posted on' using errcode = '22023'; end if;
 if coalesce(p_url, '') !~ '^https://[^\s]{3,}$' or length(p_url) > 2048 then raise exception 'Add the full https:// link to the live post' using errcode = '22023'; end if;
 if p_on is null or p_on > current_date or p_on < current_date - 365 then raise exception 'Choose the date it went live' using errcode = '22023'; end if;
 select coalesce(array_agg(k), '{}') into missing from unnest(aura_brand_content.checklist_keys(i)) k where not i.checklist ? k;
 if cardinality(missing) > 0 then raise exception 'Complete the publication checklist first' using errcode = '55000'; end if;
 if i.source = 'repurposed' then
  r := aura_brand_content.rights(jsonb_build_object('rights', jsonb_build_object('usage_months', i.repurpose->'usage_months', 'channels', i.repurpose->'channels')),
    (i.repurpose->>'published_on')::date, aura_brand_content.platform(i.account_id), p_on);
  if not (r->>'allowed')::boolean then raise exception 'Not allowed: %', r->>'reason' using errcode = '55000'; end if;
 end if;
 update aura_brand_content.item set stage = 'published', published_url = p_url, published_on = p_on, published_by = u, updated_at = clock_timestamp() where id = i.id;
 perform aura_market.audit(u, 'brand_content_published');
 return jsonb_build_object('stage', 'published');
end $$;

-- ───────── Repurposing Creator content (rights from M11, delivery from M12) ─────────
create function aura_brand_content.deliverables(p_ws uuid) returns table(collab uuid, deliverable text, creator text, title text, url text, published_on date, terms jsonb, campaign text)
 language sql stable set search_path='' as $$
 select c.collab, d->>'id', c.creator_name, d->>'title', d->'fulfilment'->>'url', aura_monitor.as_date(d->'fulfilment'->>'date'), c.terms, aura_market.content(m.id, m.published_version)->>'title'
 from aura_market.campaign m cross join lateral aura_monitor.collabs(m.id) c cross join lateral jsonb_array_elements(coalesce(c.doc->'deliverables', '[]')) d
 where m.workspace_id = p_ws and aura_monitor.as_date(d->'fulfilment'->>'date') is not null $$;
create function public.aura_brand_content_sources(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false);
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('collaboration_id', d.collab, 'deliverable_id', d.deliverable, 'creator', d.creator, 'title', d.title, 'url', d.url,
   'published_on', d.published_on, 'campaign', d.campaign, 'rights', d.terms->'rights',
   'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'platform', s.platform, 'handle', s.handle,
      'check', aura_brand_content.rights(d.terms, d.published_on, s.platform, current_date)) order by s.platform, s.handle), '[]'::jsonb)
     from aura_brand.social_account s where s.workspace_id = p_workspace)) order by d.published_on desc), '[]'::jsonb)
  from aura_brand_content.deliverables(p_workspace) d);
end $$;
create function public.aura_brand_content_repurpose(p_workspace uuid, p_request uuid, p_collab uuid, p_deliverable text, p_account uuid, p_planned date) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); d record; r jsonb; i aura_brand_content.item; plat text;
begin
 select * into d from aura_brand_content.deliverables(p_workspace) x where x.collab = p_collab and x.deliverable = p_deliverable;
 if d.collab is null then raise exception 'Access denied' using errcode = '42501'; end if;
 plat := (select platform from aura_brand.social_account where id = p_account and workspace_id = p_workspace);
 if plat is null then raise exception 'Choose one of your accounts' using errcode = '22023'; end if;
 r := aura_brand_content.rights(d.terms, d.published_on, plat, coalesce(p_planned, current_date));
 if not (r->>'allowed')::boolean then raise exception 'Not allowed: %', r->>'reason' using errcode = '55000'; end if;
 insert into aura_brand_content.item(workspace_id, request_id, title, format, account_id, planned_for, stage, source, repurpose, disclosure, notes, created_by)
  values (p_workspace, p_request, left('Repost: ' || d.title, 140), 'post', p_account, p_planned, 'drafting', 'repurposed',
   jsonb_build_object('collaboration_id', d.collab, 'deliverable_id', d.deliverable, 'creator', d.creator, 'url', d.url, 'published_on', d.published_on,
     'usage_months', d.terms->'rights'->'usage_months', 'channels', d.terms->'rights'->'channels', 'allowed_until', r->'until'),
   'Created with ' || d.creator, 'Original: ' || coalesce(d.url, 'see the collaboration'), u)
  on conflict (workspace_id, request_id) do nothing returning * into i;
 if i.id is null then select * into i from aura_brand_content.item where workspace_id = p_workspace and request_id = p_request; return jsonb_build_object('id', i.id); end if;
 insert into aura_brand_content.revision(item_id, version, snapshot, saved_by) values (i.id, 1, aura_brand_content.snapshot(i), u);
 return jsonb_build_object('id', i.id, 'until', r->'until');
end $$;

-- ───────── Assets (links only, with provenance) ─────────
create function public.aura_brand_content_add_asset(p_workspace uuid, p_item uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); a aura_brand_content.asset;
begin
 if p_item is not null then perform aura_brand_content.item_of(p_workspace, p_item); end if;
 if v->>'provenance' = 'creator' and length(trim(coalesce(v->>'rights_note', ''))) < 5 then raise exception 'Say which agreement allows this Creator asset' using errcode = '22023'; end if;
 insert into aura_brand_content.asset(workspace_id, item_id, title, kind, url, provenance, rights_note, added_by)
  values (p_workspace, p_item, trim(v->>'title'), v->>'kind', trim(v->>'url'), v->>'provenance', nullif(trim(coalesce(v->>'rights_note', '')), ''), u) returning * into a;
 return jsonb_build_object('id', a.id);
end $$;
create function public.aura_brand_content_remove_asset(p_workspace uuid, p_asset uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); n int;
begin
 delete from aura_brand_content.asset where id = p_asset and workspace_id = p_workspace; get diagnostics n = row_count;
 if n = 0 then raise exception 'Access denied' using errcode = '42501'; end if;
 return jsonb_build_object('removed', true);
end $$;

-- ───────── Results (manual, M19 metric definitions, append-only with void) ─────────
create function public.aura_brand_content_record(p_workspace uuid, p_item uuid, p_metric text, p_value numeric, p_observed date, p_source text, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item); r aura_brand_content.result;
begin
 if i.stage <> 'published' then raise exception 'Results can be recorded once it is published' using errcode = '55000'; end if;
 if not (aura_monitor.metrics() ? p_metric) then raise exception 'Unknown metric' using errcode = '22023'; end if;
 if p_observed is null or p_observed > current_date or p_observed < i.published_on then raise exception 'The reading date must be between publication and today' using errcode = '22023'; end if;
 insert into aura_brand_content.result(item_id, metric, value, observed_on, source, note, entered_by) values (i.id, p_metric, p_value, p_observed, p_source, nullif(trim(coalesce(p_note, '')), ''), u) returning * into r;
 return jsonb_build_object('id', r.id);
end $$;
create function public.aura_brand_content_void(p_workspace uuid, p_result uuid, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); n int;
begin
 update aura_brand_content.result r set voided_at = now(), voided_by = u, void_reason = left(coalesce(nullif(trim(p_reason), ''), 'Entered by mistake'), 200)
  from aura_brand_content.item i where r.id = p_result and r.item_id = i.id and i.workspace_id = p_workspace and r.voided_at is null;
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Nothing to void' using errcode = '55000'; end if;
 return jsonb_build_object('voided', true);
end $$;
-- Latest reading per published item and metric (cumulative counts are never added up over time).
create function aura_brand_content.latest(p_ws uuid) returns table(item_id uuid, metric text, value numeric, observed_on date, source text)
 language sql stable set search_path='' as $$
 select distinct on (r.item_id, r.metric) r.item_id, r.metric, r.value, r.observed_on, r.source from aura_brand_content.result r join aura_brand_content.item i on i.id = r.item_id
 where i.workspace_id = p_ws and r.voided_at is null order by r.item_id, r.metric, r.observed_on desc, r.created_at desc $$;

-- ───────── Reads ─────────
create function public.aura_brand_content_overview(p_workspace uuid, p_from date default null, p_to date default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); f date := coalesce(p_from, date_trunc('month', current_date)::date); t date := coalesce(p_to, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
begin
 return jsonb_build_object(
  'items', (select coalesce(jsonb_agg(aura_brand_content.json(i) - 'script' - 'checklist' order by i.planned_for nulls last, i.updated_at desc), '[]'::jsonb) from aura_brand_content.item i where i.workspace_id = p_workspace and i.stage <> 'archived'),
  'archived', (select count(*) from aura_brand_content.item i where i.workspace_id = p_workspace and i.stage = 'archived'),
  'pillars', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'mix', p.mix,
     'planned', (select count(*) from aura_brand_content.item i where i.pillar_id = p.id and i.stage not in ('archived') and i.planned_for between f and t),
     'published', (select count(*) from aura_brand_content.item i where i.pillar_id = p.id and i.stage = 'published')) order by p.created_at), '[]'::jsonb)
    from aura_brand_content.pillar p where p.workspace_id = p_workspace and not p.archived),
  'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'platform', s.platform, 'handle', s.handle, 'followers', s.followers, 'observed_on', s.observed_on, 'source', s.source) order by s.platform, s.handle), '[]'::jsonb) from aura_brand.social_account s where s.workspace_id = p_workspace),
  'segments', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'basis', s.basis) order by s.name), '[]'::jsonb) from aura_brand.segment s where s.workspace_id = p_workspace),
  'products', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'claims', to_jsonb(p.claims)) order by p.name), '[]'::jsonb) from aura_brand.product p where p.workspace_id = p_workspace and p.status = 'active'),
  'guidelines', (select jsonb_build_object('tone', to_jsonb(g.tone), 'voice', g.voice, 'dos', to_jsonb(g.dos), 'donts', to_jsonb(g.donts), 'claims_rules', g.claims_rules, 'disclosures', g.disclosures) from aura_brand.guideline g where g.workspace_id = p_workspace),
  'objective', (select p.objective from aura_brand.profile p where p.workspace_id = p_workspace),
  'period', jsonb_build_object('from', f, 'to', t),
  'metrics', aura_monitor.metrics());
end $$;
create function public.aura_brand_content_item(p_workspace uuid, p_item uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item);
begin
 return aura_brand_content.json(i) || jsonb_build_object(
  'reviews', (select coalesce(jsonb_agg(jsonb_build_object('version', r.version, 'decision', r.decision, 'note', r.note, 'unapproved_claims', to_jsonb(r.unapproved_claims), 'by', aura_brand_content.who(r.actor), 'at', r.created_at) order by r.created_at desc), '[]'::jsonb) from aura_brand_content.review r where r.item_id = i.id),
  'revisions', (select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'by', aura_brand_content.who(v.saved_by), 'at', v.saved_at) order by v.version desc), '[]'::jsonb) from aura_brand_content.revision v where v.item_id = i.id),
  'assets', (select coalesce(jsonb_agg(to_jsonb(a) - 'workspace_id' - 'added_by' order by a.created_at), '[]'::jsonb) from aura_brand_content.asset a where a.item_id = i.id),
  'results', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'metric', r.metric, 'value', trim_scale(r.value), 'observed_on', r.observed_on, 'source', r.source, 'note', r.note, 'by', aura_brand_content.who(r.entered_by), 'voided', r.voided_at is not null, 'void_reason', r.void_reason) order by r.observed_on desc, r.created_at desc), '[]'::jsonb) from aura_brand_content.result r where r.item_id = i.id),
  'rights_now', case when i.source = 'repurposed' then aura_brand_content.rights(jsonb_build_object('rights', jsonb_build_object('usage_months', i.repurpose->'usage_months', 'channels', i.repurpose->'channels')), (i.repurpose->>'published_on')::date, aura_brand_content.platform(i.account_id), coalesce(i.planned_for, current_date)) end);
end $$;
create function aura_brand_content.who(p_user uuid) returns text language sql stable set search_path='' as $$
 select coalesce((select nullif(trim(p.full_name), '') from aura_identity.profile p where p.user_id = p_user), 'A team member') $$;
create function public.aura_brand_content_revision(p_workspace uuid, p_item uuid, p_version integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); i aura_brand_content.item := aura_brand_content.item_of(p_workspace, p_item);
begin
 return (select v.snapshot || jsonb_build_object('version', v.version, 'at', v.saved_at) from aura_brand_content.revision v where v.item_id = i.id and v.version = p_version);
end $$;
-- Performance and learning: only published items with recorded results; coverage is always stated.
create function public.aura_brand_content_learning(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false);
begin
 return jsonb_build_object(
  'published', (select count(*) from aura_brand_content.item where workspace_id = p_workspace and stage = 'published'),
  'with_results', (select count(distinct item_id) from aura_brand_content.latest(p_workspace)),
  'by_metric', (select coalesce(jsonb_object_agg(metric, jsonb_build_object('total', trim_scale(total), 'items', n)), '{}'::jsonb) from (select metric, sum(value) total, count(*) n from aura_brand_content.latest(p_workspace) group by metric) q),
  'by_pillar', (select coalesce(jsonb_agg(q), '[]'::jsonb) from (select coalesce(p.name, 'No pillar') pillar, count(distinct i.id) published, count(distinct l.item_id) with_results,
     (select coalesce(jsonb_object_agg(metric, trim_scale(v)), '{}'::jsonb) from (select l2.metric, round(avg(l2.value), 1) v from aura_brand_content.latest(p_workspace) l2 join aura_brand_content.item i2 on i2.id = l2.item_id where i2.pillar_id is not distinct from p.id group by l2.metric) a) average
    from aura_brand_content.item i left join aura_brand_content.pillar p on p.id = i.pillar_id left join aura_brand_content.latest(p_workspace) l on l.item_id = i.id
    where i.workspace_id = p_workspace and i.stage = 'published' group by p.id, p.name order by count(distinct i.id) desc) q),
  'by_format', (select coalesce(jsonb_agg(q), '[]'::jsonb) from (select i.format, count(distinct i.id) published, count(distinct l.item_id) with_results,
     (select coalesce(jsonb_object_agg(metric, trim_scale(v)), '{}'::jsonb) from (select l2.metric, round(avg(l2.value), 1) v from aura_brand_content.latest(p_workspace) l2 join aura_brand_content.item i2 on i2.id = l2.item_id where i2.format = i.format and i2.workspace_id = p_workspace group by l2.metric) a) average
    from aura_brand_content.item i left join aura_brand_content.latest(p_workspace) l on l.item_id = i.id
    where i.workspace_id = p_workspace and i.stage = 'published' group by i.format order by count(distinct i.id) desc) q),
  'top', (select coalesce(jsonb_agg(q), '[]'::jsonb) from (select i.id, i.title, i.format, i.published_on, i.published_url, trim_scale(l.value) value, l.metric, l.observed_on, l.source
    from aura_brand_content.latest(p_workspace) l join aura_brand_content.item i on i.id = l.item_id where l.metric = 'views' order by l.value desc limit 5) q),
  'metrics', aura_monitor.metrics());
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_brand\_content\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'aura_brand_content' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
 end loop;
end $$;
commit;
