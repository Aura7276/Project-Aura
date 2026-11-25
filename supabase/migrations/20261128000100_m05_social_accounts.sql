-- M05 Social account management. Additive; depends on M02 (aura_identity), M03 (aura_creator.social_account) and M04.
-- Ownership: M05 is the authoritative owner of social accounts. It EXTENDS aura_creator.social_account (created by M03 as a
-- foundation) rather than adding a competing table, and adds the private schema aura_social for everything else.
-- Like M02 to M04: RLS enabled, no policies, no table grants; every operation is a SECURITY DEFINER function that re-validates
-- the session, workspace membership, ownership, workspace kind and status.
begin;
create schema aura_social;
revoke all on schema aura_social from public, anon, authenticated;

-- Configurable platform catalogue. Metrics per platform are PROPOSED and must be checked against each provider's documentation before
-- a provider integration is built (see SOCIAL_METRIC_DICTIONARY.md).
create table aura_social.platform (
 code text primary key, label text not null,
 handle_pattern text not null, hosts text[] not null default '{}', account_types text[] not null default '{}',
 supports_private boolean not null default true, integration_order integer, provider_status text not null default 'none' check (provider_status in ('none')),
 active boolean not null default true
);
insert into aura_social.platform(code,label,handle_pattern,hosts,account_types,integration_order) values
 ('instagram','Instagram','^[A-Za-z0-9._]{1,30}$','{instagram.com,www.instagram.com}','{personal,creator,business}',1),
 ('youtube','YouTube','^[A-Za-z0-9._-]{3,60}$','{youtube.com,www.youtube.com,m.youtube.com,youtu.be}','{}',2),
 ('facebook','Facebook','^[A-Za-z0-9.]{5,50}$','{facebook.com,www.facebook.com,m.facebook.com,fb.com}','{}',null),
 ('linkedin','LinkedIn','^[A-Za-z0-9-]{3,100}$','{linkedin.com,www.linkedin.com}','{}',null),
 ('threads','Threads','^[A-Za-z0-9._]{1,30}$','{threads.net,www.threads.net,threads.com,www.threads.com}','{}',null),
 ('other','Other link','^[A-Za-z0-9._-]{1,60}$','{}','{}',null);

create table aura_social.metric_def (
 code text primary key, label text not null, unit text not null check (unit in ('count','seconds')), scope text not null check (scope in ('account','content')),
 shape text not null check (shape in ('point','cumulative','window','either')), min_value numeric not null default 0, max_value numeric not null default 1000000000000,
 platforms text[] not null, fresh_days integer not null default 14 check (fresh_days between 1 and 365), active boolean not null default true
);
-- point: a value at a date. cumulative: a lifetime total as of a date. window: a total over a period. either: lifetime or window (content).
insert into aura_social.metric_def(code,label,unit,scope,shape,min_value,max_value,platforms,fresh_days) values
 ('followers','Followers or subscribers','count','account','point',0,2000000000,'{instagram,youtube,facebook,linkedin,threads,other}',14),
 ('following','Following','count','account','point',0,100000000,'{instagram,facebook,threads}',30),
 ('posts_total','Total published content','count','account','cumulative',0,100000000,'{instagram,youtube,facebook,linkedin,threads,other}',30),
 ('reach','Account reach','count','account','window',0,1000000000000,'{instagram,facebook}',30),
 ('impressions','Impressions','count','account','window',0,1000000000000,'{instagram,youtube,facebook,linkedin,threads}',30),
 ('profile_views','Profile views','count','account','window',0,1000000000000,'{instagram,facebook,linkedin,threads}',30),
 ('interactions','Account interactions','count','account','window',0,1000000000000,'{instagram,youtube,facebook,linkedin,threads}',30),
 ('audience_growth','Audience growth (net change)','count','account','window',-1000000000,1000000000,'{instagram,youtube,facebook,linkedin,threads,other}',30),
 ('views','Views','count','content','either',0,1000000000000,'{instagram,youtube,facebook,linkedin,threads}',30),
 ('c_reach','Reach','count','content','either',0,1000000000000,'{instagram,facebook}',30),
 ('c_impressions','Impressions','count','content','either',0,1000000000000,'{instagram,youtube,facebook,linkedin,threads}',30),
 ('likes','Likes','count','content','either',0,1000000000000,'{instagram,youtube,facebook,linkedin,threads}',30),
 ('comments','Comments','count','content','either',0,1000000000000,'{instagram,youtube,facebook,linkedin,threads}',30),
 ('shares','Shares','count','content','either',0,1000000000000,'{instagram,youtube,facebook,linkedin,threads}',30),
 ('saves','Saves','count','content','either',0,1000000000000,'{instagram}',30),
 ('watch_time_seconds','Watch time','seconds','content','either',0,1000000000000,'{instagram,youtube,facebook}',30);

-- Conservative NON-PRODUCTION defaults. Each needs owner approval before launch (listed in the report).
create table aura_social.setting (key text primary key, value jsonb not null);
insert into aura_social.setting(key,value) values
 ('max_active_accounts','10'),            -- M05-F01; M27 may replace aura_social.account_limit() with an entitlement lookup
 ('challenge_ttl_hours','72'),
 ('challenge_max_attempts','5'),
 ('evidence_max_bytes','5242880'),
 ('evidence_max_per_claim','5'),
 ('refresh_min_interval_minutes','360'),  -- manual refresh rate limit
 ('reminder_days','7'),                   -- weekly update reminder
 ('reminder_snooze_max_days','7');
create function aura_social.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_social.setting where key=p_key $$;
create function aura_social.account_limit(p_workspace uuid) returns integer language sql stable set search_path='' as $$ select aura_social.setting_int('max_active_accounts') $$;

-- Extend the M03 foundation table. Independent status dimensions: lifecycle, verification (ownership), connection, visibility
-- (the account's PLATFORM privacy, set by the Creator), sharing_visibility (AURA-side publication). Freshness and commercial
-- eligibility are computed, never stored.
alter table aura_creator.social_account
 add column lifecycle text not null default 'active' check (lifecycle in ('active','disconnected','removed','archived')),
 add column connection text not null default 'manual' check (connection in ('manual','connected','disconnected')),
 add column display_name text check (length(display_name) <= 80),
 add column content_category text check (length(content_category) <= 60),
 add column preferred_for_platform boolean not null default false,
 add column sharing_visibility text not null default 'private' check (sharing_visibility in ('private','published')),
 add column identity_kind text not null default 'provisional_handle' check (identity_kind in ('provisional_handle','provider_id')),
 add column provider_account_id text check (length(provider_account_id) <= 120),
 add column request_id uuid,
 add column removed_at timestamptz, add column archived_at timestamptz, add column history_stale_since timestamptz;
alter table aura_creator.social_account drop constraint social_account_verification_check;
alter table aura_creator.social_account add constraint social_account_verification_check
 check (verification in ('unverified','challenge_pending','evidence_submitted','under_review','verified','rejected','disputed','revoked'));
alter table aura_creator.social_account add constraint social_account_platform_fk foreign key (platform) references aura_social.platform(code);
alter table aura_creator.social_account add constraint social_account_state_ok check (
 ((not is_primary and not preferred_for_platform) or lifecycle in ('active','disconnected')) and (sharing_visibility = 'private' or lifecycle in ('active','disconnected'))
 and (identity_kind = 'provisional_handle' or provider_account_id is not null) and (connection <> 'connected' or lifecycle = 'active'));
create unique index social_one_preferred on aura_creator.social_account(workspace_id, platform) where preferred_for_platform;
create unique index social_request on aura_creator.social_account(workspace_id, request_id) where request_id is not null;

-- Limit: active and disconnected accounts count; removed and archived do not. The per-workspace advisory lock serializes concurrent
-- inserts and reactivations, so two tabs, retries or direct writes can never both pass the count (M03's trigger was racy).
create or replace function aura_creator.limit_social() returns trigger language plpgsql set search_path='' as $$
begin
 if new.lifecycle in ('active','disconnected') and (tg_op = 'INSERT' or old.lifecycle not in ('active','disconnected')) then
  perform pg_advisory_xact_lock(hashtextextended('social_limit:' || new.workspace_id::text, 0));
  if (select count(*) from aura_creator.social_account where workspace_id=new.workspace_id and lifecycle in ('active','disconnected') and id <> new.id) >= aura_social.account_limit(new.workspace_id)
  then raise exception 'Social account limit reached' using errcode='23514'; end if;
 end if;
 return new;
end $$;
drop trigger social_limit on aura_creator.social_account;
create trigger social_limit before insert or update of lifecycle on aura_creator.social_account for each row execute function aura_creator.limit_social();

-- Accounts are never hard-deleted by application code (M03's onboarding step used to). A DELETE becomes a soft removal, so verification
-- and observation history survive. Deleting the whole workspace still cascades.
create function aura_creator.social_soft_delete() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from aura_identity.workspace where id = old.workspace_id) then return old; end if; -- workspace itself is being deleted
 update aura_creator.social_account set lifecycle='removed', removed_at=coalesce(removed_at,now()), is_primary=false, preferred_for_platform=false, sharing_visibility='private', updated_at=now() where id=old.id;
 return null;
end $$;
create trigger social_soft_delete before delete on aura_creator.social_account for each row execute function aura_creator.social_soft_delete();

-- Observations are APPEND-ONLY. A correction inserts a new row that supersedes the old one; the original is kept and labelled.
-- A missing row means unknown; a stored 0 is a real zero.
create table aura_social.account_observation (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade,
 metric text not null references aura_social.metric_def,
 value numeric not null check (value between -1000000000000 and 1000000000000),
 observed_on date not null check (observed_on <= current_date + 1),
 period_start date, period_end date,
 source text not null check (source in ('manual','screenshot_supported','ai_confirmed','provider')),
 evidence_id uuid, actor uuid references auth.users, entered_at timestamptz not null default clock_timestamp(),
 request_id uuid not null, note text check (length(note) <= 200),
 supersedes uuid references aura_social.account_observation, superseded_by uuid references aura_social.account_observation,
 unique (workspace_id, request_id),
 check ((period_start is null) = (period_end is null) and (period_end is null or period_end >= period_start))
);
create index account_obs_by_account on aura_social.account_observation(account_id, metric, observed_on desc, entered_at desc);
create table aura_social.content_ref (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade,
 external_id text not null check (length(external_id) between 1 and 200), url text check (url ~ '^https://[^/\s@]+(/[^\s]*)?$' and length(url) <= 400),
 title text check (length(title) <= 200), format text check (format in ('short_video','long_video','image','carousel','story','text','live','other')),
 published_on date check (published_on <= current_date + 1), created_at timestamptz not null default now(),
 unique (account_id, external_id)
);
create table aura_social.content_observation (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 content_id uuid not null references aura_social.content_ref on delete cascade,
 metric text not null references aura_social.metric_def,
 value numeric not null check (value between 0 and 1000000000000),
 window_kind text not null check (window_kind in ('lifetime','window')), period_start date, period_end date,
 observed_on date not null check (observed_on <= current_date + 1),
 source text not null check (source in ('manual','screenshot_supported','ai_confirmed','provider')),
 evidence_id uuid, actor uuid references auth.users, entered_at timestamptz not null default clock_timestamp(),
 request_id uuid not null, note text check (length(note) <= 200),
 supersedes uuid references aura_social.content_observation, superseded_by uuid references aura_social.content_observation,
 unique (workspace_id, request_id),
 check ((window_kind = 'window') = (period_start is not null) and (period_start is null) = (period_end is null) and (period_end is null or period_end >= period_start))
);
create index content_obs_by_content on aura_social.content_observation(content_id, metric, window_kind, observed_on desc, entered_at desc);
create function aura_social.append_only() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op = 'DELETE' then
  if not exists(select 1 from aura_identity.workspace where id = old.workspace_id) then return old; end if;
  raise exception 'Observations are append-only' using errcode='55000';
 end if;
 if new.superseded_by is not null and old.superseded_by is null and (to_jsonb(new) - 'superseded_by') = (to_jsonb(old) - 'superseded_by') then return new; end if;
 raise exception 'Observations are append-only' using errcode='55000';
end $$;
create trigger account_obs_append_only before update or delete on aura_social.account_observation for each row execute function aura_social.append_only();
create trigger content_obs_append_only before update or delete on aura_social.content_observation for each row execute function aura_social.append_only();

-- Ownership. One open claim per account; at most ONE verified claim per platform identity (enforced by the unique index, so
-- simultaneous approvals cannot both win). Handle-based identity is PROVISIONAL: a rename or reassigned handle is never proof.
create table aura_social.ownership_claim (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade,
 claimant uuid not null references auth.users, identity_key text not null,
 state text not null check (state in ('challenge_pending','evidence_submitted','under_review','verified','rejected','disputed','revoked')),
 request_id uuid not null, review_note text check (length(review_note) <= 500),
 decided_by uuid references auth.users, decided_at timestamptz, decision_reason text check (length(decision_reason) <= 500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (workspace_id, request_id)
);
create unique index one_verified_owner on aura_social.ownership_claim(identity_key) where state = 'verified';
create unique index one_open_claim_per_account on aura_social.ownership_claim(account_id) where state in ('challenge_pending','evidence_submitted','under_review','disputed');
create table aura_social.verification_challenge (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null unique references aura_social.ownership_claim on delete cascade,
 workspace_id uuid not null, account_id uuid not null, claimant uuid not null,
 purpose text not null default 'ownership' check (purpose = 'ownership'),
 code text not null unique, created_at timestamptz not null default now(), expires_at timestamptz not null,
 attempts integer not null default 0, consumed_at timestamptz
);
create table aura_social.verification_evidence (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references aura_social.ownership_claim on delete cascade,
 workspace_id uuid not null, account_id uuid not null,
 storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'),
 mime text not null check (mime in ('image/png','image/jpeg','image/webp')), size_bytes integer not null check (size_bytes between 1 and 5242880),
 kind text not null default 'screenshot' check (kind = 'screenshot'),
 scan_status text not null default 'pending_scan' check (scan_status in ('pending_scan','clean','quarantined')), -- nothing is usable until a scanner marks it clean
 uploaded_by uuid not null references auth.users, uploaded_at timestamptz not null default now()
);
create table aura_social.reviewer (user_id uuid primary key references auth.users, granted_by uuid references auth.users, granted_at timestamptz not null default now(), revoked_at timestamptz);
create table aura_social.review_decision (
 id uuid primary key default gen_random_uuid(), claim_id uuid not null references aura_social.ownership_claim on delete cascade,
 reviewer uuid not null references auth.users, decision text not null check (decision in ('approved','rejected','needs_evidence','revoked')),
 reason text not null check (length(reason) between 3 and 500), decided_at timestamptz not null default now()
);
create table aura_social.ownership_dispute (
 id uuid primary key default gen_random_uuid(), claim_id uuid not null unique references aura_social.ownership_claim on delete cascade,
 existing_claim_id uuid not null references aura_social.ownership_claim, identity_key text not null,
 status text not null default 'open' check (status in ('open','resolved')), resolution text check (resolution in ('claim_upheld','existing_upheld')),
 created_at timestamptz not null default now(), resolved_at timestamptz
);

-- Sharing (Creator-controlled). Allowlist of fields only; possession of an id grants nothing.
create table aura_social.share_grant (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade,
 recipient_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 fields text[] not null check (cardinality(fields) between 1 and 8 and fields <@ array['followers','following','posts_total','reach','impressions','profile_views','interactions','audience_growth']),
 purpose text not null check (length(purpose) between 3 and 200), valid_until timestamptz,
 status text not null default 'active' check (status in ('active','revoked')), granted_by uuid not null references auth.users,
 created_at timestamptz not null default now(), revoked_at timestamptz
);
create unique index one_active_grant on aura_social.share_grant(account_id, recipient_workspace_id) where status = 'active';

-- Provider contracts. No provider exists yet: credential_ref is only a REFERENCE (never a token), and no row can be created by a client.
create table aura_social.provider_connection (
 account_id uuid primary key references aura_creator.social_account on delete cascade, workspace_id uuid not null,
 provider text not null check (provider in ('instagram','youtube','facebook','linkedin','threads')), status text not null check (status in ('connected','revoked')),
 credential_ref text, scopes text[] not null default '{}', connected_at timestamptz not null default now(), revoked_at timestamptz,
 check (status = 'connected' or credential_ref is null)
);
create table aura_social.refresh_job (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, account_id uuid not null references aura_creator.social_account on delete cascade,
 kind text not null check (kind in ('manual','scheduled')), status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
 idempotency_key uuid not null, requested_by uuid, requested_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz,
 attempt integer not null default 0, error_code text, unique (account_id, idempotency_key)
);
create table aura_social.extraction_suggestion (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade, evidence_id uuid references aura_social.verification_evidence,
 provider text not null, fields jsonb not null, uncertainty jsonb not null default '{}'::jsonb,
 status text not null default 'suggested' check (status in ('suggested','confirmed','discarded')), created_at timestamptz not null default now(), decided_at timestamptz
);
create table aura_social.reminder_pref (workspace_id uuid not null references aura_identity.workspace on delete cascade, user_id uuid not null references auth.users on delete cascade, weekly boolean not null default true, primary key (workspace_id, user_id));
create table aura_social.reminder_snooze (workspace_id uuid not null, user_id uuid not null, account_id uuid not null references aura_creator.social_account on delete cascade, until date not null, primary key (workspace_id, user_id, account_id));
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='aura_social' loop execute format('alter table aura_social.%I enable row level security', t); end loop; end $$;

-- ===== Internal helpers (no grants) =====
create function aura_social.actor(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible(); k text; r text; st text;
begin
 select w.kind, m.role, w.status into k, r, st from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id
  where m.workspace_id = p_workspace and m.user_id = u and m.active;
 if k is null or not ((k = 'creator' and r = 'owner') or (k = 'brand' and r in ('owner','admin'))) or (case when p_write then st <> 'open' else st = 'suspended' end)
 then raise exception 'Access denied' using errcode = '42501'; end if;
 return u;
end $$;
create function aura_social.acct(p_workspace uuid, p_account uuid, p_lock boolean default false) returns aura_creator.social_account language plpgsql set search_path='' as $$
declare a aura_creator.social_account;
begin
 if p_lock then select * into a from aura_creator.social_account where id = p_account and workspace_id = p_workspace for update;
 else select * into a from aura_creator.social_account where id = p_account and workspace_id = p_workspace; end if;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return a;
end $$;
create function aura_social.norm_handle(p text) returns text language sql immutable set search_path='' as $$ select regexp_replace(trim(coalesce(p,'')), '^@+', '') $$;
create function aura_social.check_handle(p_platform text, p_handle text) returns void language plpgsql stable set search_path='' as $$
declare pat text;
begin
 select handle_pattern into pat from aura_social.platform where code = p_platform and active;
 if pat is null then raise exception 'Unsupported platform' using errcode = '22023'; end if;
 if p_handle !~ pat then raise exception 'Invalid handle for this platform' using errcode = '23514'; end if;
end $$;
-- URLs are validated, never fetched (no SSRF surface). https only, no credentials, no port, no IP literal or single-label host; known platforms must match their hosts.
create function aura_social.check_url(p_platform text, p_url text) returns void language plpgsql stable set search_path='' as $$
declare host text; allowed text[];
begin
 if p_url is null or p_url = '' then return; end if;
 host := lower((regexp_match(p_url, '^https://([^/?#]+)'))[1]);
 if host is null or host ~ '[@:]' or host ~ '^[0-9.]+$' or host = 'localhost' or host !~ '\.' then raise exception 'Invalid profile link' using errcode = '23514'; end if;
 select hosts into allowed from aura_social.platform where code = p_platform;
 if cardinality(allowed) > 0 and not host = any(allowed) then raise exception 'Link does not match the platform' using errcode = '23514'; end if;
end $$;
create function aura_social.audit(p_user uuid, p_event text) returns void language sql set search_path='' as $$ insert into aura_identity.event(user_id, event) values (p_user, p_event) $$;
create function aura_social.account_json(a aura_creator.social_account) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'platform',a.platform,'handle',a.handle,'profile_url',a.profile_url,'display_name',a.display_name,'account_type',a.account_type,
  'ownership_scope',a.ownership_scope,'visibility',a.visibility,'content_category',a.content_category,'lifecycle',a.lifecycle,'verification',a.verification,
  'connection',a.connection,'is_primary',a.is_primary,'preferred_for_platform',a.preferred_for_platform,'sharing_visibility',a.sharing_visibility,
  'identity_kind',a.identity_kind,'history_stale_since',a.history_stale_since,'created_at',a.created_at,'updated_at',a.updated_at,
  'latest',(select coalesce(jsonb_object_agg(metric, jsonb_build_object('value',value,'observed_on',observed_on,'source',source,'period_start',period_start,'period_end',period_end)),'{}'::jsonb)
    from (select distinct on (metric) metric,value,observed_on,source,period_start,period_end from aura_social.account_observation
          where account_id = a.id and superseded_by is null order by metric, observed_on desc, entered_at desc) l)) $$;
-- Keeps the M03/M04 eligibility inputs (self_reported_followers, observed_on) equal to the latest CURRENT followers observation.
create function aura_social.refresh_cache(p_account uuid) returns void language plpgsql set search_path='' as $$
declare o record;
begin
 select value, observed_on into o from aura_social.account_observation where account_id = p_account and metric = 'followers' and superseded_by is null order by observed_on desc, entered_at desc limit 1;
 if found then update aura_creator.social_account set self_reported_followers = round(o.value)::int, observed_on = least(o.observed_on, current_date) where id = p_account;
 end if;
end $$;
create function aura_social.add_observation(p_workspace uuid, p_actor uuid, p_account uuid, p_request uuid, p_metric text, p_value numeric, p_observed_on date, p_ps date, p_pe date, p_source text, p_evidence uuid, p_note text, p_supersedes uuid) returns jsonb language plpgsql set search_path='' as $$
declare a aura_creator.social_account; m aura_social.metric_def; o aura_social.account_observation;
begin
 if p_request is null or p_value is null or p_observed_on is null or p_source not in ('manual','screenshot_supported','ai_confirmed') then raise exception 'Invalid observation' using errcode = '22023'; end if;
 a := aura_social.acct(p_workspace, p_account);
 if a.lifecycle not in ('active','disconnected') then raise exception 'Account is not tracked' using errcode = '55000'; end if;
 select * into m from aura_social.metric_def where code = p_metric and active and scope = 'account';
 if m.code is null or not a.platform = any(m.platforms) then raise exception 'Metric not supported for this platform' using errcode = '22023'; end if;
 if p_value < m.min_value or p_value > m.max_value then raise exception 'Value out of range' using errcode = '23514'; end if;
 if (m.shape = 'window') <> (p_ps is not null) or (p_ps is null) <> (p_pe is null) or (p_pe is not null and (p_pe < p_ps or p_pe > p_observed_on)) then raise exception 'Measurement period does not fit this metric' using errcode = '23514'; end if;
 if p_source = 'screenshot_supported' and not exists(select 1 from aura_social.verification_evidence e where e.id = p_evidence and e.account_id = a.id and e.workspace_id = p_workspace and e.scan_status = 'clean') then
  raise exception 'Screenshot evidence is required and must be clean' using errcode = '22023'; end if;
 if p_evidence is not null and not exists(select 1 from aura_social.verification_evidence e where e.id = p_evidence and e.account_id = a.id and e.workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 insert into aura_social.account_observation(workspace_id,account_id,metric,value,observed_on,period_start,period_end,source,evidence_id,actor,request_id,note,supersedes)
  values (p_workspace,a.id,p_metric,p_value,p_observed_on,p_ps,p_pe,p_source,p_evidence,p_actor,p_request,nullif(trim(p_note),''),p_supersedes) on conflict (workspace_id, request_id) do nothing returning * into o;
 if o.id is null then select * into o from aura_social.account_observation where workspace_id = p_workspace and request_id = p_request;
 else
  if p_supersedes is not null then update aura_social.account_observation set superseded_by = o.id where id = p_supersedes; end if;
  if p_metric = 'followers' then perform aura_social.refresh_cache(a.id); end if;
  perform aura_social.audit(p_actor, case when p_supersedes is null then 'social_observation_recorded' else 'social_observation_corrected' end);
 end if;
 return to_jsonb(o) - 'workspace_id' - 'request_id' - 'actor';
end $$;
-- Retires an account (removed or archived) and applies every consequence atomically. Returns the new primary account id, if any.
create function aura_social.retire(p_account uuid, p_target text, p_replacement uuid, p_actor uuid) returns uuid language plpgsql set search_path='' as $$
declare a aura_creator.social_account; np uuid;
begin
 select * into a from aura_creator.social_account where id = p_account for update;
 if a.lifecycle = p_target then return null; end if;
 if p_target not in ('removed','archived') then raise exception 'Invalid target' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('social_primary:' || a.workspace_id::text, 0));
 update aura_creator.social_account set lifecycle = p_target, is_primary = false, preferred_for_platform = false, sharing_visibility = 'private',
  removed_at = case when p_target = 'removed' then now() else removed_at end, archived_at = case when p_target = 'archived' then now() else archived_at end, updated_at = now() where id = a.id;
 update aura_social.share_grant set status = 'revoked', revoked_at = now() where account_id = a.id and status = 'active';
 update aura_social.refresh_job set status = 'cancelled', finished_at = now() where account_id = a.id and status in ('queued','running');
 update aura_social.provider_connection set status = 'revoked', credential_ref = null, revoked_at = now() where account_id = a.id and status = 'connected';
 update aura_social.ownership_claim set state = 'revoked', decision_reason = 'account_' || p_target, decided_at = now(), updated_at = now() where account_id = a.id and state in ('challenge_pending','evidence_submitted','under_review','disputed','verified');
 update aura_social.ownership_dispute set status = 'resolved', resolved_at = now() where status = 'open' and claim_id in (select id from aura_social.ownership_claim where account_id = a.id);
 update aura_creator.social_account set verification = 'unverified', connection = case when connection = 'connected' then 'disconnected' else connection end where id = a.id and p_target = 'removed';
 delete from aura_social.reminder_snooze where account_id = a.id;
 if a.is_primary then
  select id into np from aura_creator.social_account where id = coalesce(p_replacement, '00000000-0000-0000-0000-000000000000') and workspace_id = a.workspace_id and id <> a.id and lifecycle in ('active','disconnected');
  if np is null then select id into np from aura_creator.social_account where workspace_id = a.workspace_id and id <> a.id and lifecycle in ('active','disconnected') order by created_at, id limit 1; end if; -- documented fallback: oldest remaining account
  if np is not null then update aura_creator.social_account set is_primary = true where id = np; end if;
 end if;
 perform aura_social.audit(p_actor, 'social_account_' || p_target);
 return np;
end $$;

-- ===== Account management =====
create function public.aura_social_policy() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin return jsonb_build_object('max_active_accounts', aura_social.setting_int('max_active_accounts'), 'challenge_ttl_hours', aura_social.setting_int('challenge_ttl_hours'),
  'challenge_max_attempts', aura_social.setting_int('challenge_max_attempts'), 'evidence_max_bytes', aura_social.setting_int('evidence_max_bytes'),
  'refresh_min_interval_minutes', aura_social.setting_int('refresh_min_interval_minutes'), 'reminder_days', aura_social.setting_int('reminder_days'),
  'metrics', (select jsonb_agg(to_jsonb(m) order by m.scope, m.code) from aura_social.metric_def m where active)); end $$;

create function public.aura_social_accounts(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false);
begin
 return jsonb_build_object('limit', aura_social.account_limit(p_workspace),
  'used', (select count(*) from aura_creator.social_account where workspace_id = p_workspace and lifecycle in ('active','disconnected')),
  'accounts', (select coalesce(jsonb_agg(aura_social.account_json(a) order by a.is_primary desc, a.created_at, a.id), '[]'::jsonb)
   from aura_creator.social_account a where a.workspace_id = p_workspace and a.lifecycle in ('active','disconnected','archived')));
end $$;
create function public.aura_social_account(p_workspace uuid, p_account uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); a aura_creator.social_account := aura_social.acct(p_workspace, p_account);
begin if a.lifecycle = 'removed' then raise exception 'Access denied' using errcode = '42501'; end if; return aura_social.account_json(a); end $$;

create function public.aura_social_add_account(p_workspace uuid, p_request uuid, p_account jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account; pl text := p_account->>'platform'; h text := aura_social.norm_handle(p_account->>'handle'); f numeric;
begin
 if p_request is null or jsonb_typeof(p_account) <> 'object' then raise exception 'Invalid request' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('social_request:' || p_workspace::text || p_request::text, 0)); -- identical concurrent retries queue up and then see the first one's row
 select * into a from aura_creator.social_account where workspace_id = p_workspace and request_id = p_request;
 if a.id is not null then return aura_social.account_json(a); end if; -- retried submission
 perform aura_social.check_handle(pl, h); perform aura_social.check_url(pl, nullif(p_account->>'profile_url',''));
 select * into a from aura_creator.social_account where workspace_id = p_workspace and platform = pl and lower(handle) = lower(h) for update;
 if a.id is not null and a.lifecycle <> 'removed' then raise exception 'This account is already added' using errcode = '23505'; end if;
 if a.id is not null then
  update aura_creator.social_account set lifecycle = 'active', removed_at = null, request_id = p_request, updated_at = now() where id = a.id returning * into a;
 else
  insert into aura_creator.social_account(workspace_id, platform, handle, profile_url, account_type, ownership_scope, visibility, display_name, content_category, request_id)
   values (p_workspace, pl, h, nullif(p_account->>'profile_url',''), nullif(p_account->>'account_type',''), coalesce(nullif(p_account->>'ownership_scope',''),'individual'),
    coalesce(nullif(p_account->>'visibility',''),'unknown'), nullif(trim(p_account->>'display_name'),''), nullif(trim(p_account->>'content_category'),''), p_request) returning * into a;
 end if;
 if a.profile_url is null and nullif(p_account->>'profile_url','') is not null then update aura_creator.social_account set profile_url = p_account->>'profile_url' where id = a.id; end if;
 if not exists(select 1 from aura_creator.social_account where workspace_id = p_workspace and is_primary and id <> a.id) or coalesce((p_account->>'is_primary')::boolean, false) then
  perform pg_advisory_xact_lock(hashtextextended('social_primary:' || p_workspace::text, 0));
  update aura_creator.social_account set is_primary = false where workspace_id = p_workspace and is_primary and id <> a.id;
  update aura_creator.social_account set is_primary = true where id = a.id; -- first account becomes primary by documented rule
 end if;
 if coalesce((p_account->>'preferred_for_platform')::boolean, false) then
  perform pg_advisory_xact_lock(hashtextextended('social_pref:' || p_workspace::text || pl, 0));
  update aura_creator.social_account set preferred_for_platform = false where workspace_id = p_workspace and platform = pl and preferred_for_platform and id <> a.id;
  update aura_creator.social_account set preferred_for_platform = true where id = a.id;
 end if;
 if p_account ? 'followers' and nullif(p_account->>'followers','') is not null then
  f := (p_account->>'followers')::numeric;
  perform aura_social.add_observation(p_workspace, u, a.id, md5(p_request::text || ':f')::uuid, 'followers', f, coalesce((p_account->>'observed_on')::date, current_date), null, null, 'manual', null, null, null);
 end if;
 perform aura_social.audit(u, 'social_account_added');
 select * into a from aura_creator.social_account where id = a.id;
 return aura_social.account_json(a);
end $$;

create function public.aura_social_update_account(p_workspace uuid, p_account uuid, p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account, true); nh text; reset boolean := false;
begin
 if a.lifecycle not in ('active','disconnected','archived') then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_patch ? 'profile_url' then perform aura_social.check_url(a.platform, nullif(p_patch->>'profile_url','')); end if;
 if p_patch ? 'handle' then
  nh := aura_social.norm_handle(p_patch->>'handle');
  if lower(nh) <> lower(a.handle) then
   perform aura_social.check_handle(a.platform, nh);
   if exists(select 1 from aura_creator.social_account where workspace_id = p_workspace and platform = a.platform and lower(handle) = lower(nh) and id <> a.id) then raise exception 'This account is already added' using errcode = '23505'; end if;
   reset := a.identity_kind = 'provisional_handle'; -- a renamed handle is a different provisional identity: ownership is NOT carried over
  end if;
 end if;
 update aura_creator.social_account set
  handle = case when p_patch ? 'handle' then nh else handle end,
  profile_url = case when p_patch ? 'profile_url' then nullif(p_patch->>'profile_url','') else profile_url end,
  display_name = case when p_patch ? 'display_name' then nullif(trim(p_patch->>'display_name'),'') else display_name end,
  content_category = case when p_patch ? 'content_category' then nullif(trim(p_patch->>'content_category'),'') else content_category end,
  account_type = case when p_patch ? 'account_type' then nullif(p_patch->>'account_type','') else account_type end,
  visibility = case when p_patch ? 'visibility' then p_patch->>'visibility' else visibility end,
  ownership_scope = case when p_patch ? 'ownership_scope' then p_patch->>'ownership_scope' else ownership_scope end,
  updated_at = now() where id = a.id;
 if reset then
  update aura_social.ownership_claim set state = 'revoked', decision_reason = 'handle_changed', decided_at = now(), updated_at = now() where account_id = a.id and state in ('challenge_pending','evidence_submitted','under_review','disputed','verified');
  update aura_creator.social_account set verification = 'unverified' where id = a.id;
 end if;
 perform aura_social.audit(u, 'social_account_updated');
 return aura_social.account_json(aura_social.acct(p_workspace, a.id));
end $$;

create function public.aura_social_set_primary(p_workspace uuid, p_account uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account;
begin
 perform pg_advisory_xact_lock(hashtextextended('social_primary:' || p_workspace::text, 0)); -- serializes concurrent switches
 a := aura_social.acct(p_workspace, p_account, true);
 if a.lifecycle not in ('active','disconnected') then raise exception 'Only a tracked account can be primary' using errcode = '55000'; end if;
 update aura_creator.social_account set is_primary = false where workspace_id = p_workspace and is_primary and id <> a.id;
 update aura_creator.social_account set is_primary = true, updated_at = now() where id = a.id;
 perform aura_social.audit(u, 'social_primary_changed');
 return aura_social.account_json(aura_social.acct(p_workspace, a.id));
end $$;
create function public.aura_social_set_preferred(p_workspace uuid, p_account uuid, p_preferred boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account);
begin
 perform pg_advisory_xact_lock(hashtextextended('social_pref:' || p_workspace::text || a.platform, 0));
 a := aura_social.acct(p_workspace, p_account, true);
 if a.lifecycle not in ('active','disconnected') then raise exception 'Only a tracked account can be preferred' using errcode = '55000'; end if;
 if p_preferred then update aura_creator.social_account set preferred_for_platform = false where workspace_id = p_workspace and platform = a.platform and preferred_for_platform and id <> a.id; end if;
 update aura_creator.social_account set preferred_for_platform = coalesce(p_preferred, false), updated_at = now() where id = a.id;
 perform aura_social.audit(u, 'social_preferred_changed');
 return aura_social.account_json(aura_social.acct(p_workspace, a.id));
end $$;
create function public.aura_social_remove_account(p_workspace uuid, p_account uuid, p_replacement uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account); np uuid;
begin np := aura_social.retire(a.id, 'removed', p_replacement, u); return jsonb_build_object('removed', a.id, 'new_primary', np); end $$;
create function public.aura_social_archive_account(p_workspace uuid, p_account uuid, p_archive boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account); np uuid;
begin
 if p_archive then
  if a.lifecycle = 'removed' then raise exception 'Access denied' using errcode = '42501'; end if;
  np := aura_social.retire(a.id, 'archived', null, u); return jsonb_build_object('archived', a.id, 'new_primary', np);
 end if;
 if a.lifecycle <> 'archived' then raise exception 'Only an archived account can be restored' using errcode = '55000'; end if;
 update aura_creator.social_account set lifecycle = 'active', archived_at = null, updated_at = now() where id = a.id; -- the limit trigger applies
 perform aura_social.audit(u, 'social_account_restored');
 return jsonb_build_object('restored', a.id);
end $$;
-- Disconnect applies only to a real provider connection. Manual accounts are removed or archived instead; nothing pretends to be connected.
create function public.aura_social_disconnect(p_workspace uuid, p_account uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account, true);
begin
 if a.connection <> 'connected' then raise exception 'This account has no provider connection' using errcode = '55000'; end if;
 update aura_creator.social_account set connection = 'disconnected', lifecycle = 'disconnected', history_stale_since = clock_timestamp(), updated_at = now() where id = a.id; -- visibility is left exactly as the Creator set it
 update aura_social.provider_connection set status = 'revoked', credential_ref = null, revoked_at = now() where account_id = a.id and status = 'connected';
 update aura_social.refresh_job set status = 'cancelled', finished_at = now() where account_id = a.id and status in ('queued','running');
 perform aura_social.audit(u, 'social_account_disconnected');
 return aura_social.account_json(aura_social.acct(p_workspace, a.id));
end $$;

-- ===== Observations =====
create function public.aura_social_record_observation(p_workspace uuid, p_request uuid, p_account uuid, p_metric text, p_value numeric, p_observed_on date, p_period_start date default null, p_period_end date default null, p_source text default 'manual', p_evidence uuid default null, p_note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true);
begin
 if p_source not in ('manual','screenshot_supported') then raise exception 'This source cannot be set by a client' using errcode = '22023'; end if; -- ai_confirmed only via aura_social_confirm_suggestion; provider only by a worker
 return aura_social.add_observation(p_workspace, u, p_account, p_request, p_metric, p_value, p_observed_on, p_period_start, p_period_end, p_source, p_evidence, p_note, null);
end $$;
create function public.aura_social_correct_observation(p_workspace uuid, p_request uuid, p_observation uuid, p_value numeric, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); o aura_social.account_observation;
begin
 if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'A reason is required' using errcode = '22023'; end if;
 select * into o from aura_social.account_observation where id = p_observation and workspace_id = p_workspace for update;
 if o.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if o.superseded_by is not null then raise exception 'This observation was already corrected' using errcode = '55000'; end if;
 return aura_social.add_observation(p_workspace, u, o.account_id, p_request, o.metric, p_value, o.observed_on, o.period_start, o.period_end, 'manual', null, trim(p_reason), o.id); -- the original row is kept
end $$;
create function public.aura_social_observations(p_workspace uuid, p_account uuid, p_metric text default null, p_limit integer default 25, p_cursor jsonb default null, p_include_superseded boolean default true) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); a aura_creator.social_account := aura_social.acct(p_workspace, p_account); lim int := least(greatest(coalesce(p_limit,25),1),100); rows jsonb; n int;
begin
 select coalesce(jsonb_agg(to_jsonb(x) order by x.observed_on desc, x.entered_at desc, x.id desc), '[]'::jsonb), count(*) into rows, n from (
  select o.id, o.metric, o.value, o.observed_on, o.period_start, o.period_end, o.source, o.evidence_id is not null as has_evidence, o.entered_at, o.note, o.supersedes, o.superseded_by,
   a.history_stale_since is not null and o.entered_at <= a.history_stale_since as historical
  from aura_social.account_observation o where o.account_id = a.id and (p_metric is null or o.metric = p_metric) and (p_include_superseded or o.superseded_by is null)
   and (p_cursor is null or (o.observed_on, o.entered_at, o.id) < ((p_cursor->>'o')::date, (p_cursor->>'e')::timestamptz, (p_cursor->>'i')::uuid))
  order by o.observed_on desc, o.entered_at desc, o.id desc limit lim + 1) x;
 return jsonb_build_object('items', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(rows) with ordinality t(e, i) where i <= lim order by i) q),
  'next_cursor', case when n > lim then (select jsonb_build_object('o', e->>'observed_on', 'e', e->>'entered_at', 'i', e->>'id') from jsonb_array_elements(rows) with ordinality t(e, i) where i = lim) end);
end $$;

create function public.aura_social_record_content_observation(p_workspace uuid, p_request uuid, p_account uuid, p_content jsonb, p_metric text, p_value numeric, p_window text, p_observed_on date, p_period_start date default null, p_period_end date default null, p_source text default 'manual', p_evidence uuid default null, p_note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account); m aura_social.metric_def; c aura_social.content_ref; o aura_social.content_observation; ext text; url text := nullif(p_content->>'url','');
begin
 if p_request is null or p_value is null or p_observed_on is null or p_source not in ('manual','screenshot_supported') or p_window not in ('lifetime','window') then raise exception 'Invalid observation' using errcode = '22023'; end if;
 if a.lifecycle not in ('active','disconnected') then raise exception 'Account is not tracked' using errcode = '55000'; end if;
 select * into m from aura_social.metric_def where code = p_metric and active and scope = 'content';
 if m.code is null or not a.platform = any(m.platforms) then raise exception 'Metric not supported for this platform' using errcode = '22023'; end if;
 if p_value < m.min_value or p_value > m.max_value then raise exception 'Value out of range' using errcode = '23514'; end if;
 if (p_window = 'window') <> (p_period_start is not null) or (p_period_start is null) <> (p_period_end is null) or (p_period_end is not null and (p_period_end < p_period_start or p_period_end > p_observed_on)) then raise exception 'Measurement period does not fit this observation' using errcode = '23514'; end if;
 perform aura_social.check_url(a.platform, url);
 ext := coalesce(nullif(trim(p_content->>'external_id'),''), case when url is not null then 'url:' || md5(lower(url)) end);
 if ext is null then raise exception 'A content identifier or link is required' using errcode = '22023'; end if;
 if p_source = 'screenshot_supported' and not exists(select 1 from aura_social.verification_evidence e where e.id = p_evidence and e.account_id = a.id and e.scan_status = 'clean') then raise exception 'Screenshot evidence is required and must be clean' using errcode = '22023'; end if;
 insert into aura_social.content_ref(workspace_id, account_id, external_id, url, title, format, published_on) values (p_workspace, a.id, ext, url, nullif(trim(p_content->>'title'),''), nullif(p_content->>'format',''), nullif(p_content->>'published_on','')::date)
  on conflict (account_id, external_id) do update set url = coalesce(excluded.url, aura_social.content_ref.url), title = coalesce(excluded.title, aura_social.content_ref.title), format = coalesce(excluded.format, aura_social.content_ref.format), published_on = coalesce(excluded.published_on, aura_social.content_ref.published_on)
  returning * into c;
 insert into aura_social.content_observation(workspace_id, content_id, metric, value, window_kind, period_start, period_end, observed_on, source, evidence_id, actor, request_id, note)
  values (p_workspace, c.id, p_metric, p_value, p_window, p_period_start, p_period_end, p_observed_on, p_source, p_evidence, u, p_request, nullif(trim(p_note),'')) on conflict (workspace_id, request_id) do nothing returning * into o;
 if o.id is null then select * into o from aura_social.content_observation where workspace_id = p_workspace and request_id = p_request; else perform aura_social.audit(u, 'social_content_observation_recorded'); end if;
 return jsonb_build_object('content', to_jsonb(c) - 'workspace_id', 'observation', to_jsonb(o) - 'workspace_id' - 'request_id' - 'actor');
end $$;
-- Content metrics are never summed: lifetime values are cumulative snapshots (latest wins), window values are separate period totals.
create function public.aura_social_content(p_workspace uuid, p_account uuid, p_limit integer default 25) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); a aura_creator.social_account := aura_social.acct(p_workspace, p_account);
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'external_id', c.external_id, 'url', c.url, 'title', c.title, 'format', c.format, 'published_on', c.published_on,
   'latest_lifetime', (select coalesce(jsonb_object_agg(metric, jsonb_build_object('value', value, 'observed_on', observed_on, 'source', source)), '{}'::jsonb) from (select distinct on (metric) metric, value, observed_on, source from aura_social.content_observation where content_id = c.id and window_kind = 'lifetime' and superseded_by is null order by metric, observed_on desc, entered_at desc) l),
   'window_observations', (select coalesce(jsonb_agg(jsonb_build_object('metric', metric, 'value', value, 'period_start', period_start, 'period_end', period_end, 'observed_on', observed_on, 'source', source) order by observed_on desc), '[]'::jsonb) from (select * from aura_social.content_observation where content_id = c.id and window_kind = 'window' and superseded_by is null order by observed_on desc limit 20) w),
   'observation_count', (select count(*) from aura_social.content_observation where content_id = c.id)) order by c.published_on desc nulls last, c.created_at desc)
  from (select * from aura_social.content_ref where account_id = a.id order by published_on desc nulls last, created_at desc limit least(greatest(coalesce(p_limit,25),1),100)) c), '[]'::jsonb);
end $$;

-- ===== Ownership verification =====
create function aura_social.claim_view(c aura_social.ownership_claim) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('claim_id', c.id, 'state', c.state, 'disputed', c.state = 'disputed', 'review_note', c.review_note,
  'decision_reason', case when c.state in ('rejected','revoked') then c.decision_reason end, 'decided_at', c.decided_at, 'created_at', c.created_at,
  'challenge', (select jsonb_build_object('code', ch.code, 'expires_at', ch.expires_at, 'expired', ch.expires_at <= now(), 'attempts_left', greatest(aura_social.setting_int('challenge_max_attempts') - ch.attempts, 0), 'consumed', ch.consumed_at is not null)
    from aura_social.verification_challenge ch where ch.claim_id = c.id and c.state in ('challenge_pending','evidence_submitted','disputed','under_review')),
  'evidence', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'uploaded_at', e.uploaded_at, 'scan_status', e.scan_status, 'size_bytes', e.size_bytes, 'mime', e.mime) order by e.uploaded_at), '[]'::jsonb) from aura_social.verification_evidence e where e.claim_id = c.id)) $$;
create function public.aura_social_start_verification(p_workspace uuid, p_account uuid, p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account, true); c aura_social.ownership_claim; ex aura_social.ownership_claim; ch aura_social.verification_challenge; key text; dis boolean;
begin
 if p_request is null then raise exception 'Invalid request' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('social_request:' || p_workspace::text || p_request::text, 0));
 select * into c from aura_social.ownership_claim where workspace_id = p_workspace and request_id = p_request;
 if c.id is not null then return aura_social.claim_view(c); end if; -- retried submission
 if a.lifecycle not in ('active','disconnected') then raise exception 'Account is not tracked' using errcode = '55000'; end if;
 if a.verification = 'verified' then raise exception 'This account is already verified' using errcode = '55000'; end if;
 select * into c from aura_social.ownership_claim where account_id = a.id and state in ('challenge_pending','evidence_submitted','under_review','disputed');
 if c.id is not null then
  select * into ch from aura_social.verification_challenge where claim_id = c.id;
  if ch.expires_at > now() or c.state = 'under_review' then return aura_social.claim_view(c); end if;
  update aura_social.ownership_claim set state = 'revoked', decision_reason = 'challenge_expired', decided_at = now(), updated_at = now() where id = c.id;
 end if;
 if (select count(*) from aura_social.ownership_claim where account_id = a.id and created_at > now() - interval '24 hours') >= 5 then raise exception 'Too many verification attempts. Try again later.' using errcode = '54000'; end if;
 key := case when a.identity_kind = 'provider_id' then a.platform || ':id:' || a.provider_account_id else a.platform || ':h:' || lower(a.handle) end;
 select * into ex from aura_social.ownership_claim where identity_key = key and state = 'verified' and account_id <> a.id; dis := ex.id is not null;
 insert into aura_social.ownership_claim(workspace_id, account_id, claimant, identity_key, state, request_id) values (p_workspace, a.id, u, key, case when dis then 'disputed' else 'challenge_pending' end, p_request) returning * into c;
 insert into aura_social.verification_challenge(claim_id, workspace_id, account_id, claimant, code, expires_at)
  values (c.id, p_workspace, a.id, u, 'aura-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), now() + make_interval(hours => aura_social.setting_int('challenge_ttl_hours'))); -- gen_random_uuid() is cryptographically secure
 if dis then insert into aura_social.ownership_dispute(claim_id, existing_claim_id, identity_key) values (c.id, ex.id, key); end if; -- the existing owner is never revealed to the claimant
 update aura_creator.social_account set verification = case when dis then 'disputed' else 'challenge_pending' end, updated_at = now() where id = a.id;
 perform aura_social.audit(u, 'social_verification_started');
 return aura_social.claim_view(c);
end $$;
create function public.aura_social_verification(p_workspace uuid, p_account uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); a aura_creator.social_account := aura_social.acct(p_workspace, p_account); c aura_social.ownership_claim;
begin
 select * into c from aura_social.ownership_claim where account_id = a.id order by created_at desc limit 1;
 return jsonb_build_object('verification', a.verification, 'claim', case when c.id is null then null else aura_social.claim_view(c) end);
end $$;
create function public.aura_social_submit_evidence(p_workspace uuid, p_claim uuid, p_meta jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); c aura_social.ownership_claim; ch aura_social.verification_challenge; e aura_social.verification_evidence; path text := p_meta->>'storage_path';
begin
 select * into c from aura_social.ownership_claim where id = p_claim and workspace_id = p_workspace and claimant = u for update;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if c.state not in ('challenge_pending','evidence_submitted','disputed') then raise exception 'This verification is not accepting evidence' using errcode = '55000'; end if;
 select * into ch from aura_social.verification_challenge where claim_id = c.id for update;
 if ch.expires_at <= now() or ch.attempts >= aura_social.setting_int('challenge_max_attempts') then raise exception 'The verification code has expired or the attempt limit was reached' using errcode = '55000'; end if;
 if (select count(*) from aura_social.verification_evidence where claim_id = c.id) >= aura_social.setting_int('evidence_max_per_claim') then raise exception 'Too much evidence for this claim' using errcode = '54000'; end if;
 if path is null or split_part(path, '/', 1) <> p_workspace::text or split_part(path, '/', 2) <> c.id::text then raise exception 'Evidence path does not belong to this claim' using errcode = '42501'; end if; -- no reassignment across claims or workspaces
 insert into aura_social.verification_evidence(claim_id, workspace_id, account_id, storage_path, mime, size_bytes, uploaded_by) values (c.id, p_workspace, c.account_id, path, p_meta->>'mime', (p_meta->>'size')::int, u) returning * into e;
 update aura_social.verification_challenge set attempts = attempts + 1 where id = ch.id;
 if c.state = 'challenge_pending' then update aura_social.ownership_claim set state = 'evidence_submitted', updated_at = now() where id = c.id; update aura_creator.social_account set verification = 'evidence_submitted' where id = c.account_id; end if;
 perform aura_social.audit(u, 'social_evidence_added');
 return jsonb_build_object('id', e.id, 'scan_status', e.scan_status, 'uploaded_at', e.uploaded_at);
end $$;
create function public.aura_social_delete_evidence(p_workspace uuid, p_evidence uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); e aura_social.verification_evidence; c aura_social.ownership_claim;
begin
 select * into e from aura_social.verification_evidence where id = p_evidence and workspace_id = p_workspace and uploaded_by = u;
 if e.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 select * into c from aura_social.ownership_claim where id = e.claim_id;
 if c.state not in ('challenge_pending','evidence_submitted','rejected','disputed') then raise exception 'Evidence for a decided claim is retained' using errcode = '55000'; end if;
 delete from aura_social.verification_evidence where id = e.id;
 return jsonb_build_object('storage_path', e.storage_path); -- the caller removes the stored object
end $$;
create function public.aura_social_request_review(p_workspace uuid, p_claim uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); c aura_social.ownership_claim; ch aura_social.verification_challenge;
begin
 select * into c from aura_social.ownership_claim where id = p_claim and workspace_id = p_workspace and claimant = u for update;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if c.state = 'under_review' then return aura_social.claim_view(c); end if;
 if c.state not in ('challenge_pending','evidence_submitted','disputed') then raise exception 'This verification cannot be sent for review' using errcode = '55000'; end if;
 select * into ch from aura_social.verification_challenge where claim_id = c.id for update;
 if ch.expires_at <= now() then raise exception 'The verification code has expired' using errcode = '55000'; end if;
 update aura_social.verification_challenge set consumed_at = coalesce(consumed_at, now()) where id = ch.id; -- a code is used once
 if c.state <> 'disputed' then update aura_social.ownership_claim set state = 'under_review', updated_at = now() where id = c.id; update aura_creator.social_account set verification = 'under_review' where id = c.account_id; end if;
 perform aura_social.audit(u, 'social_verification_review_requested');
 return aura_social.claim_view((select x from aura_social.ownership_claim x where x.id = c.id));
end $$;
create function public.aura_social_cancel_verification(p_workspace uuid, p_claim uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); c aura_social.ownership_claim;
begin
 select * into c from aura_social.ownership_claim where id = p_claim and workspace_id = p_workspace and claimant = u for update;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if c.state not in ('challenge_pending','evidence_submitted','under_review','disputed') then raise exception 'Nothing to cancel' using errcode = '55000'; end if;
 update aura_social.ownership_claim set state = 'revoked', decision_reason = 'withdrawn', decided_at = now(), updated_at = now() where id = c.id;
 update aura_social.ownership_dispute set status = 'resolved', resolution = 'existing_upheld', resolved_at = now() where claim_id = c.id and status = 'open';
 update aura_creator.social_account set verification = 'unverified' where id = c.account_id;
 return aura_social.claim_view((select x from aura_social.ownership_claim x where x.id = c.id));
end $$;

-- ===== Restricted manual review: Platform Admin (M02) AND an explicitly granted reviewer AND MFA. No public path. =====
create function aura_social.reviewer_check() returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin
 if not exists(select 1 from aura_identity.platform_admin where user_id = u) or not exists(select 1 from aura_social.reviewer where user_id = u and revoked_at is null) or not aura_identity.strong(u)
 then raise exception 'Access denied' using errcode = '42501'; end if;
 return u;
end $$;
create function public.aura_social_review_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('claim_id', c.id, 'state', c.state, 'platform', a.platform, 'handle', a.handle, 'profile_url', a.profile_url, 'created_at', c.created_at,
   'dispute', c.state = 'disputed', 'evidence_clean', (select count(*) from aura_social.verification_evidence e where e.claim_id = c.id and e.scan_status = 'clean'),
   'evidence_pending', (select count(*) from aura_social.verification_evidence e where e.claim_id = c.id and e.scan_status = 'pending_scan')) order by c.created_at)
  from aura_social.ownership_claim c join aura_creator.social_account a on a.id = c.account_id where c.state in ('under_review','disputed')), '[]'::jsonb);
end $$;
create function public.aura_social_review_claim(p_claim uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); c aura_social.ownership_claim; a aura_creator.social_account; d aura_social.ownership_dispute;
begin
 select * into c from aura_social.ownership_claim where id = p_claim; if c.id is null then raise exception 'Not found' using errcode = '42501'; end if;
 select * into a from aura_creator.social_account where id = c.account_id; select * into d from aura_social.ownership_dispute where claim_id = c.id;
 return jsonb_build_object('claim_id', c.id, 'state', c.state, 'platform', a.platform, 'handle', a.handle, 'profile_url', a.profile_url, 'claimant_workspace', c.workspace_id, 'created_at', c.created_at, 'review_note', c.review_note,
  'challenge_code', (select code from aura_social.verification_challenge where claim_id = c.id), 'dispute', case when d.id is null then null else jsonb_build_object('existing_claim', d.existing_claim_id, 'status', d.status) end,
  'evidence', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'storage_path', e.storage_path, 'uploaded_at', e.uploaded_at, 'mime', e.mime) order by e.uploaded_at), '[]'::jsonb) from aura_social.verification_evidence e where e.claim_id = c.id and e.scan_status = 'clean'),
  'evidence_pending_scan', (select count(*) from aura_social.verification_evidence e where e.claim_id = c.id and e.scan_status = 'pending_scan'));
end $$;
create function public.aura_social_decide(p_claim uuid, p_decision text, p_reason text, p_replace_existing boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); c aura_social.ownership_claim; ex aura_social.ownership_claim;
begin
 if p_decision not in ('approved','rejected','needs_evidence','revoked') or p_reason is null or length(trim(p_reason)) < 3 then raise exception 'A decision and reason are required' using errcode = '22023'; end if;
 select * into c from aura_social.ownership_claim where id = p_claim for update;
 if c.id is null then raise exception 'Not found' using errcode = '42501'; end if;
 if c.claimant = u or exists(select 1 from aura_identity.membership m where m.workspace_id = c.workspace_id and m.user_id = u and m.active) then raise exception 'A reviewer cannot decide a claim from their own workspace' using errcode = '42501'; end if; -- no self-approval
 if p_decision = 'revoked' then
  if c.state <> 'verified' then raise exception 'Only a verified claim can be revoked' using errcode = '55000'; end if;
  update aura_social.ownership_claim set state = 'revoked', decided_by = u, decided_at = now(), decision_reason = trim(p_reason), updated_at = now() where id = c.id;
  update aura_creator.social_account set verification = 'revoked' where id = c.account_id;
 elsif c.state not in ('under_review','disputed','evidence_submitted') then raise exception 'This claim is not awaiting a decision' using errcode = '55000';
 elsif p_decision = 'approved' then
  perform pg_advisory_xact_lock(hashtextextended('social_identity:' || c.identity_key, 0)); -- serializes simultaneous approvals for one identity
  select * into ex from aura_social.ownership_claim where identity_key = c.identity_key and state = 'verified' and id <> c.id for update;
  if ex.id is not null then
   if c.state <> 'disputed' or not coalesce(p_replace_existing, false) then raise exception 'This account identity is already verified' using errcode = '23505'; end if;
   update aura_social.ownership_claim set state = 'revoked', decided_by = u, decided_at = now(), decision_reason = 'dispute_resolved', updated_at = now() where id = ex.id;
   update aura_creator.social_account set verification = 'revoked' where id = ex.account_id;
   insert into aura_social.review_decision(claim_id, reviewer, decision, reason) values (ex.id, u, 'revoked', 'Dispute resolved in favour of another claim: ' || trim(p_reason));
   update aura_social.ownership_dispute set status = 'resolved', resolution = 'claim_upheld', resolved_at = now() where claim_id = c.id;
  end if;
  update aura_social.ownership_claim set state = 'verified', decided_by = u, decided_at = now(), decision_reason = trim(p_reason), updated_at = now() where id = c.id;
  update aura_creator.social_account set verification = 'verified' where id = c.account_id;
 elsif p_decision = 'rejected' then
  update aura_social.ownership_claim set state = 'rejected', decided_by = u, decided_at = now(), decision_reason = trim(p_reason), updated_at = now() where id = c.id;
  update aura_creator.social_account set verification = 'rejected' where id = c.account_id;
  update aura_social.ownership_dispute set status = 'resolved', resolution = 'existing_upheld', resolved_at = now() where claim_id = c.id and status = 'open';
 else -- needs_evidence: back to the Creator with a fresh window
  update aura_social.ownership_claim set state = case when c.state = 'disputed' then 'disputed' else 'challenge_pending' end, review_note = trim(p_reason), updated_at = now() where id = c.id;
  update aura_social.verification_challenge set expires_at = now() + make_interval(hours => aura_social.setting_int('challenge_ttl_hours')), consumed_at = null, attempts = 0 where claim_id = c.id;
  update aura_creator.social_account set verification = case when c.state = 'disputed' then 'disputed' else 'challenge_pending' end where id = c.account_id;
 end if;
 insert into aura_social.review_decision(claim_id, reviewer, decision, reason) values (c.id, u, p_decision, trim(p_reason));
 perform aura_social.audit(u, 'social_review_' || p_decision);
 perform aura_social.audit(c.claimant, 'social_ownership_' || p_decision);
 return aura_social.claim_view((select x from aura_social.ownership_claim x where x.id = c.id));
end $$;

-- ===== Visibility and sharing =====
create function public.aura_social_set_sharing(p_workspace uuid, p_account uuid, p_visibility text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account, true);
begin
 if p_visibility not in ('private','published') then raise exception 'Invalid visibility' using errcode = '22023'; end if;
 if p_visibility = 'published' and a.lifecycle not in ('active','disconnected') then raise exception 'Only a tracked account can be published' using errcode = '55000'; end if;
 update aura_creator.social_account set sharing_visibility = p_visibility, updated_at = now() where id = a.id; -- takes effect immediately: shared views read this row live
 perform aura_social.audit(u, 'social_sharing_changed');
 return aura_social.account_json(aura_social.acct(p_workspace, a.id));
end $$;
create function public.aura_social_grant_share(p_workspace uuid, p_account uuid, p_recipient uuid, p_fields text[], p_purpose text, p_valid_until timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account, true); g aura_social.share_grant;
begin
 if a.lifecycle not in ('active','disconnected') then raise exception 'Only a tracked account can be shared' using errcode = '55000'; end if;
 if p_recipient = p_workspace or not exists(select 1 from aura_identity.workspace w where w.id = p_recipient and w.kind in ('brand','agency') and w.status = 'open') then raise exception 'Invalid recipient' using errcode = '22023'; end if;
 if p_valid_until is not null and (p_valid_until <= now() or p_valid_until > now() + interval '366 days') then raise exception 'Invalid validity period' using errcode = '22023'; end if;
 update aura_social.share_grant set status = 'revoked', revoked_at = now() where account_id = a.id and recipient_workspace_id = p_recipient and status = 'active';
 insert into aura_social.share_grant(workspace_id, account_id, recipient_workspace_id, fields, purpose, valid_until, granted_by) values (p_workspace, a.id, p_recipient, p_fields, trim(p_purpose), p_valid_until, u) returning * into g;
 perform aura_social.audit(u, 'social_grant_created');
 return to_jsonb(g) - 'workspace_id';
end $$;
create function public.aura_social_revoke_share(p_workspace uuid, p_grant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true);
begin
 update aura_social.share_grant set status = 'revoked', revoked_at = coalesce(revoked_at, now()) where id = p_grant and workspace_id = p_workspace;
 if not found then raise exception 'Access denied' using errcode = '42501'; end if;
 perform aura_social.audit(u, 'social_grant_revoked');
 return jsonb_build_object('revoked', p_grant);
end $$;
create function public.aura_social_shares(p_workspace uuid, p_account uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); a aura_creator.social_account := aura_social.acct(p_workspace, p_account);
begin return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'recipient', g.recipient_workspace_id, 'fields', g.fields, 'purpose', g.purpose, 'valid_until', g.valid_until, 'status', g.status, 'created_at', g.created_at) order by g.created_at desc) from aura_social.share_grant g where g.account_id = a.id), '[]'::jsonb); end $$;
-- What a Brand or Agency member may see. Everything is read live and filtered by an explicit allowlist: published accounts show the public card;
-- detailed metrics need an active, unexpired, purpose-bound grant. Never returned: evidence, claims, goals, other accounts, the Creator's workspace or identity.
create function public.aura_social_shared_view(p_recipient uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin
 if not exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id where m.workspace_id = p_recipient and m.user_id = u and m.active and w.kind in ('brand','agency') and w.status <> 'suspended') then raise exception 'Access denied' using errcode = '42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('ref', a.id, 'platform', a.platform, 'handle', a.handle, 'profile_url', a.profile_url, 'display_name', a.display_name, 'account_type', a.account_type,
   'ownership', case when a.verification = 'verified' then 'verified' else 'unverified' end, 'self_reported', coalesce(f.source <> 'provider', true),
   'followers', case when f.value is null then null else jsonb_build_object('value', f.value, 'observed_on', f.observed_on, 'source', f.source, 'stale', a.lifecycle = 'disconnected' or f.observed_on < current_date - (select fresh_days from aura_social.metric_def where code = 'followers')) end,
   'meets_follower_threshold', a.ownership_scope = 'individual' and coalesce(f.value, 0) >= 100, 'published', a.sharing_visibility = 'published',
   'granted', (select coalesce(jsonb_object_agg(l.metric, jsonb_build_object('value', l.value, 'observed_on', l.observed_on, 'source', l.source, 'period_start', l.period_start, 'period_end', l.period_end)), '{}'::jsonb)
      from (select distinct on (o.metric) o.* from aura_social.account_observation o where o.account_id = a.id and o.superseded_by is null and o.metric = any(coalesce(g.fields, '{}')) order by o.metric, o.observed_on desc, o.entered_at desc) l)) order by a.platform, a.handle)
  from aura_creator.social_account a
  left join lateral (select o.value, o.observed_on, o.source from aura_social.account_observation o where o.account_id = a.id and o.metric = 'followers' and o.superseded_by is null order by o.observed_on desc, o.entered_at desc limit 1) f on true
  left join aura_social.share_grant g on g.account_id = a.id and g.recipient_workspace_id = p_recipient and g.status = 'active' and (g.valid_until is null or g.valid_until > now())
  where a.lifecycle in ('active','disconnected') and (a.sharing_visibility = 'published' or g.id is not null)), '[]'::jsonb);
end $$;

-- ===== Reminders =====
create function public.aura_social_reminders(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); weekly boolean := coalesce((select weekly from aura_social.reminder_pref where workspace_id = p_workspace and user_id = u), true); days int := aura_social.setting_int('reminder_days');
begin
 return jsonb_build_object('weekly', weekly, 'reminder_days', days, 'due', case when not weekly then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('account_id', a.id, 'platform', a.platform, 'handle', a.handle, 'metric', 'followers', 'last_observed_on', f.observed_on, 'days_since', case when f.observed_on is null then null else current_date - f.observed_on end) order by f.observed_on nulls first)
   from aura_creator.social_account a
   left join lateral (select o.observed_on from aura_social.account_observation o where o.account_id = a.id and o.metric = 'followers' and o.superseded_by is null order by o.observed_on desc, o.entered_at desc limit 1) f on true
   where a.workspace_id = p_workspace and a.lifecycle in ('active','disconnected') and (f.observed_on is null or current_date - f.observed_on >= days)
    and not exists(select 1 from aura_social.reminder_snooze s where s.workspace_id = p_workspace and s.user_id = u and s.account_id = a.id and s.until >= current_date)), '[]'::jsonb) end);
end $$;
create function public.aura_social_set_reminders(p_workspace uuid, p_weekly boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true);
begin insert into aura_social.reminder_pref(workspace_id, user_id, weekly) values (p_workspace, u, coalesce(p_weekly, true)) on conflict (workspace_id, user_id) do update set weekly = excluded.weekly; return jsonb_build_object('weekly', coalesce(p_weekly, true), 'delivery', 'in_app_only'); end $$;
create function public.aura_social_snooze_reminder(p_workspace uuid, p_account uuid, p_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account); d int := least(greatest(coalesce(p_days, 1), 1), aura_social.setting_int('reminder_snooze_max_days'));
begin insert into aura_social.reminder_snooze(workspace_id, user_id, account_id, until) values (p_workspace, u, a.id, current_date + d) on conflict (workspace_id, user_id, account_id) do update set until = excluded.until; return jsonb_build_object('snoozed_until', current_date + d); end $$;

-- ===== Refresh. No provider exists, so a manual-only account can never queue a job and nothing claims a synchronization. =====
create function public.aura_social_request_refresh(p_workspace uuid, p_account uuid, p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); a aura_creator.social_account := aura_social.acct(p_workspace, p_account, true); j aura_social.refresh_job;
begin
 if p_request is null then raise exception 'Invalid request' using errcode = '22023'; end if;
 select * into j from aura_social.refresh_job where account_id = a.id and idempotency_key = p_request; if j.id is not null then return to_jsonb(j) - 'workspace_id'; end if;
 if a.lifecycle <> 'active' or a.connection <> 'connected' or not exists(select 1 from aura_social.provider_connection c where c.account_id = a.id and c.status = 'connected') then raise exception 'A connected provider is required to refresh' using errcode = '55000'; end if;
 if exists(select 1 from aura_social.refresh_job where account_id = a.id and kind = 'manual' and requested_at > now() - make_interval(mins => aura_social.setting_int('refresh_min_interval_minutes'))) then raise exception 'Refresh was requested recently' using errcode = '54000'; end if;
 insert into aura_social.refresh_job(workspace_id, account_id, kind, idempotency_key, requested_by) values (p_workspace, a.id, 'manual', p_request, u) returning * into j;
 perform aura_social.audit(u, 'social_refresh_requested');
 return to_jsonb(j) - 'workspace_id';
end $$;
create function public.aura_social_jobs(p_workspace uuid, p_account uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); a aura_creator.social_account := aura_social.acct(p_workspace, p_account);
begin return coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'kind', j.kind, 'status', j.status, 'requested_at', j.requested_at, 'finished_at', j.finished_at, 'error_code', j.error_code) order by j.requested_at desc) from (select * from aura_social.refresh_job where account_id = a.id order by requested_at desc limit 20) j), '[]'::jsonb); end $$;
-- Worker contract (NOT exposed to clients; a service principal arrives with a provider integration). Every transition revalidates the account.
create function aura_social.job_start(p_job uuid) returns aura_social.refresh_job language plpgsql set search_path='' as $$
declare j aura_social.refresh_job; a aura_creator.social_account;
begin
 select * into j from aura_social.refresh_job where id = p_job for update; select * into a from aura_creator.social_account where id = j.account_id for update;
 if j.status <> 'queued' then return j; end if;
 if a.lifecycle <> 'active' or a.connection <> 'connected' then update aura_social.refresh_job set status = 'cancelled', finished_at = now(), error_code = 'not_connected' where id = j.id returning * into j; return j; end if;
 update aura_social.refresh_job set status = 'running', started_at = now(), attempt = attempt + 1 where id = j.id returning * into j; return j;
end $$;
create function aura_social.job_complete(p_job uuid, p_ok boolean, p_error text default null) returns aura_social.refresh_job language plpgsql set search_path='' as $$
declare j aura_social.refresh_job; a aura_creator.social_account;
begin
 select * into j from aura_social.refresh_job where id = p_job for update; select * into a from aura_creator.social_account where id = j.account_id for update;
 if j.status in ('succeeded','failed','cancelled') then return j; end if; -- idempotent
 if a.lifecycle <> 'active' or a.connection <> 'connected' then update aura_social.refresh_job set status = 'cancelled', finished_at = now(), error_code = 'disconnected_before_completion' where id = j.id returning * into j; return j; end if; -- the result is discarded; the cancellation is recorded and returned (raising would roll it back)
 update aura_social.refresh_job set status = case when p_ok then 'succeeded' else 'failed' end, finished_at = now(), error_code = case when p_ok then null else left(p_error, 60) end where id = j.id returning * into j; return j;
end $$;

-- ===== AI screenshot extraction contract. Suggestions are NOT observations; only the Creator can confirm them. =====
create function public.aura_social_suggestions(p_workspace uuid, p_account uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, false); a aura_creator.social_account := aura_social.acct(p_workspace, p_account);
begin return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'provider', s.provider, 'fields', s.fields, 'uncertainty', s.uncertainty, 'status', s.status, 'created_at', s.created_at) order by s.created_at desc) from aura_social.extraction_suggestion s where s.account_id = a.id and s.status = 'suggested'), '[]'::jsonb); end $$;
create function public.aura_social_confirm_suggestion(p_workspace uuid, p_suggestion uuid, p_request uuid, p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true); s aura_social.extraction_suggestion; v jsonb; i int := 0; out jsonb := '[]'::jsonb;
begin
 select * into s from aura_social.extraction_suggestion where id = p_suggestion and workspace_id = p_workspace for update;
 if s.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if s.status <> 'suggested' then raise exception 'This suggestion was already handled' using errcode = '55000'; end if;
 if jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) = 0 then raise exception 'Confirm at least one value' using errcode = '22023'; end if;
 for v in select * from jsonb_array_elements(p_values) loop
  i := i + 1; -- the Creator's confirmed (possibly corrected) values become observations; nothing else ever does
  out := out || aura_social.add_observation(p_workspace, u, s.account_id, md5(p_request::text || ':' || i::text)::uuid, v->>'metric', (v->>'value')::numeric, (v->>'observed_on')::date, nullif(v->>'period_start','')::date, nullif(v->>'period_end','')::date, 'ai_confirmed', s.evidence_id, null, null);
 end loop;
 update aura_social.extraction_suggestion set status = 'confirmed', decided_at = now() where id = s.id;
 perform aura_social.audit(u, 'social_suggestion_confirmed');
 return out;
end $$;
create function public.aura_social_discard_suggestion(p_workspace uuid, p_suggestion uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, true);
begin update aura_social.extraction_suggestion set status = 'discarded', decided_at = now() where id = p_suggestion and workspace_id = p_workspace and status = 'suggested'; if not found then raise exception 'Access denied' using errcode = '42501'; end if; return jsonb_build_object('discarded', p_suggestion); end $$;

-- ===== M03 / M04 integration =====
-- Onboarding's social step (M03) now NEVER hard-deletes: omitted accounts are retired (soft), re-entered ones are revived, and verification
-- and observation history survive. Follower counts become observations, so the account's latest count is always the latest observation.
create function aura_social.save_onboarding(p_workspace uuid, p_actor uuid, p_payload jsonb) returns void language plpgsql set search_path='' as $$
declare r jsonb; x record; a aura_creator.social_account; h text; flagged uuid; cur record;
begin
 if coalesce((p_payload->>'none')::boolean, false) then
  for a in select * from aura_creator.social_account where workspace_id = p_workspace and lifecycle in ('active','disconnected') loop perform aura_social.retire(a.id, 'removed', null, p_actor); end loop;
  return;
 end if;
 r := coalesce(p_payload->'accounts', '[]');
 if jsonb_array_length(r) > aura_social.account_limit(p_workspace) then raise exception 'Social account limit reached' using errcode = '23514'; end if;
 if (select count(*) from jsonb_to_recordset(r) as q(is_primary boolean) where q.is_primary) > 1 then raise exception 'Only one primary account' using errcode = '23514'; end if;
 for a in select * from aura_creator.social_account s where s.workspace_id = p_workspace and s.lifecycle in ('active','disconnected')
   and not exists(select 1 from jsonb_to_recordset(r) as q(platform text, handle text) where q.platform = s.platform and lower(aura_social.norm_handle(q.handle)) = lower(s.handle)) loop
  perform aura_social.retire(a.id, 'removed', null, p_actor);
 end loop;
 for x in select * from jsonb_to_recordset(r) as q(platform text, handle text, profile_url text, account_type text, ownership_scope text, visibility text, self_reported_followers integer, observed_on date, is_primary boolean) loop
  h := aura_social.norm_handle(x.handle); perform aura_social.check_handle(x.platform, h); perform aura_social.check_url(x.platform, nullif(x.profile_url, ''));
  select * into a from aura_creator.social_account where workspace_id = p_workspace and platform = x.platform and lower(handle) = lower(h) for update;
  if a.id is null then
   insert into aura_creator.social_account(workspace_id, platform, handle, profile_url, account_type, ownership_scope, visibility)
    values (p_workspace, x.platform, h, nullif(x.profile_url, ''), nullif(x.account_type, ''), coalesce(nullif(x.ownership_scope, ''), 'individual'), coalesce(nullif(x.visibility, ''), 'unknown')) returning * into a;
  else
   update aura_creator.social_account set profile_url = nullif(x.profile_url, ''), account_type = nullif(x.account_type, ''), ownership_scope = coalesce(nullif(x.ownership_scope, ''), 'individual'),
    visibility = coalesce(nullif(x.visibility, ''), 'unknown'), removed_at = case when lifecycle = 'removed' then null else removed_at end, archived_at = case when lifecycle = 'archived' then null else archived_at end,
    lifecycle = case when lifecycle in ('removed','archived') then 'active' else lifecycle end, updated_at = now() where id = a.id returning * into a;
  end if;
  if x.self_reported_followers is not null then
   select value, observed_on into cur from aura_social.account_observation where account_id = a.id and metric = 'followers' and superseded_by is null order by observed_on desc, entered_at desc limit 1;
   if not found or cur.value <> x.self_reported_followers or cur.observed_on <> coalesce(x.observed_on, current_date) then
    perform aura_social.add_observation(p_workspace, p_actor, a.id, gen_random_uuid(), 'followers', x.self_reported_followers, coalesce(x.observed_on, current_date), null, null, 'manual', null, null, null);
   end if;
  end if;
 end loop;
 for x in select * from jsonb_to_recordset(r) as q(platform text, handle text, is_primary boolean) where q.is_primary loop
  select id into flagged from aura_creator.social_account where workspace_id = p_workspace and platform = x.platform and lower(handle) = lower(aura_social.norm_handle(x.handle));
  perform pg_advisory_xact_lock(hashtextextended('social_primary:' || p_workspace::text, 0));
  update aura_creator.social_account set is_primary = false where workspace_id = p_workspace and is_primary and id <> flagged;
  update aura_creator.social_account set is_primary = true where id = flagged;
 end loop;
end $$;

-- Forward replacements of two M03 functions (same signatures and grants): the social branch of the onboarding save, and the state JSON.
create or replace function public.aura_creator_save_section(p_workspace uuid, p_section text, p_payload jsonb, p_revision integer, p_next text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, true); st aura_creator.onboarding_state; r jsonb; n int;
begin
 if p_section not in ('identity','social','niche','goals','challenges','preferences','rates','resources') or jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid section' using errcode='22023'; end if;
 select * into st from aura_creator.onboarding_state where workspace_id=p_workspace for update;
 if st.workspace_id is null then raise exception 'Onboarding not started' using errcode='55000'; end if;
 if st.revision <> p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if p_section='identity' then
  update aura_creator.creator_profile set display_name=trim(p_payload->>'display_name'), country=p_payload->>'country', city=nullif(trim(p_payload->>'city'),''),
   language=p_payload->>'language', bio=nullif(trim(p_payload->>'bio'),''), stage=p_payload->>'stage', updated_at=now() where workspace_id=p_workspace;
 elsif p_section='social' then
  perform aura_social.save_onboarding(p_workspace, u, p_payload);
 elsif p_section='niche' then
  delete from aura_creator.niche where workspace_id=p_workspace;
  update aura_creator.creator_profile set niche_exploring=coalesce((p_payload->>'exploring')::boolean,false), updated_at=now() where workspace_id=p_workspace;
  insert into aura_creator.niche(workspace_id,key,role,code,custom_label)
   select distinct on (z.key) p_workspace, z.key, z.role, z.code, z.label from (
    select x.code||':'||lower(coalesce(trim(x.custom_label),'')) as key, x.role, x.code, nullif(trim(x.custom_label),'') as label, x.o
    from (select 'primary' as role, v.code, v.custom_label, 0 as o from jsonb_to_recordset(case when jsonb_typeof(p_payload->'primary')='object' then jsonb_build_array(p_payload->'primary') else '[]'::jsonb end) as v(code text,custom_label text)
     union all select 'secondary', v.code, v.custom_label, 1 from jsonb_to_recordset(coalesce(p_payload->'secondary','[]')) as v(code text,custom_label text)
     union all select 'interest', v.code, v.custom_label, 2 from jsonb_to_recordset(coalesce(p_payload->'interests','[]')) as v(code text,custom_label text)) x) z
   order by z.key, z.o;
 elsif p_section='goals' then
  delete from aura_creator.goal where workspace_id=p_workspace;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_payload->'goals','[]')) as x(baseline_kind text) where x.baseline_kind = 'observed') then raise exception 'Observed baselines come from analytics' using errcode='22023'; end if;
  insert into aura_creator.goal(workspace_id,category,metric,baseline_kind,baseline_value,target_value,currency,timeframe_days,details)
   select p_workspace,x.category,nullif(x.metric,''),coalesce(nullif(x.baseline_kind,''),'unknown'),x.baseline_value,x.target_value,nullif(x.currency,''),x.timeframe_days,nullif(trim(x.details),'')
   from jsonb_to_recordset(coalesce(p_payload->'goals','[]')) as x(category text,metric text,baseline_kind text,baseline_value numeric,target_value numeric,currency text,timeframe_days integer,details text);
 elsif p_section='challenges' then
  delete from aura_creator.challenge where workspace_id=p_workspace;
  insert into aura_creator.challenge(workspace_id,code,detail) select p_workspace,x.code,nullif(trim(x.detail),'') from jsonb_to_recordset(coalesce(p_payload->'challenges','[]')) as x(code text,detail text);
 elsif p_section='preferences' then
  delete from aura_creator.collaboration_preference where workspace_id=p_workspace;
  delete from aura_creator.industry_preference where workspace_id=p_workspace;
  delete from aura_creator.industry_exclusion where workspace_id=p_workspace;
  insert into aura_creator.collaboration_preference(workspace_id,category,interested) select p_workspace,x.category,x.interested from jsonb_to_recordset(coalesce(p_payload->'collaborations','[]')) as x(category text,interested boolean);
  insert into aura_creator.industry_exclusion(workspace_id,industry,note) select p_workspace,x.industry,nullif(trim(x.note),'') from jsonb_to_recordset(coalesce(p_payload->'exclusions','[]')) as x(industry text,note text);
  insert into aura_creator.industry_preference(workspace_id,industry,stance) select p_workspace,x.industry,x.stance from jsonb_to_recordset(coalesce(p_payload->'industries','[]')) as x(industry text,stance text);
  update aura_creator.creator_profile set prior_collaboration=nullif(p_payload->>'prior_collaboration',''), restrictions=nullif(trim(p_payload->>'restrictions'),''), updated_at=now() where workspace_id=p_workspace;
 elsif p_section='rates' then
  delete from aura_creator.rate_preference where workspace_id=p_workspace;
  insert into aura_creator.rate_preference(workspace_id,format,amount_minor,currency,negotiable,unsure)
   select p_workspace,x.format,x.amount_minor,coalesce(nullif(x.currency,''),'INR'),coalesce(x.negotiable,true),coalesce(x.unsure,false) from jsonb_to_recordset(coalesce(p_payload->'rates','[]')) as x(format text,amount_minor bigint,currency text,negotiable boolean,unsure boolean);
 elsif p_section='resources' then
  insert into aura_creator.resource_assessment(workspace_id,hours_per_week,posts_per_week,equipment,budget_minor,budget_currency)
   select p_workspace,x.hours_per_week,x.posts_per_week,coalesce(x.equipment,'{}'),x.budget_minor,case when x.budget_minor is null then null else coalesce(nullif(x.budget_currency,''),'INR') end
   from jsonb_to_record(p_payload) as x(hours_per_week numeric,posts_per_week integer,equipment text[],budget_minor bigint,budget_currency text)
   on conflict (workspace_id) do update set hours_per_week=excluded.hours_per_week,posts_per_week=excluded.posts_per_week,equipment=excluded.equipment,budget_minor=excluded.budget_minor,budget_currency=excluded.budget_currency;
 end if;
 update aura_creator.onboarding_state set revision=revision+1, steps=steps||jsonb_build_object(p_section,'completed'),
  current_step=coalesce(p_next,current_step), updated_at=now() where workspace_id=p_workspace;
 insert into aura_identity.event(user_id,event) values(u,'creator_section_saved:'||p_section);
 return aura_creator.state_json(p_workspace);
end $$;
create or replace function aura_creator.state_json(p_workspace uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'workspace_id', p_workspace,
  'profile', (select to_jsonb(p) - 'workspace_id' from aura_creator.creator_profile p where p.workspace_id=p_workspace),
  'onboarding', (select jsonb_build_object('revision',s.revision,'current_step',s.current_step,'steps',s.steps,'ai_assisted',s.ai_assisted) from aura_creator.onboarding_state s where s.workspace_id=p_workspace),
  'niches', (select coalesce(jsonb_agg(jsonb_build_object('role',role,'code',code,'custom_label',custom_label) order by role,code),'[]') from aura_creator.niche where workspace_id=p_workspace),
  'social_accounts', (select coalesce(jsonb_agg((aura_social.account_json(a) - 'latest') || jsonb_build_object('self_reported_followers',a.self_reported_followers,'observed_on',a.observed_on,'provenance',a.provenance) order by a.created_at,a.id),'[]') from aura_creator.social_account a where a.workspace_id=p_workspace and a.lifecycle in ('active','disconnected')),
  'goals', (select coalesce(jsonb_agg(to_jsonb(g) - 'workspace_id' order by g.category,g.metric),'[]') from aura_creator.goal g where workspace_id=p_workspace),
  'challenges', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'detail',detail) order by code),'[]') from aura_creator.challenge where workspace_id=p_workspace),
  'resources', (select to_jsonb(r) - 'workspace_id' from aura_creator.resource_assessment r where workspace_id=p_workspace),
  'collaborations', (select coalesce(jsonb_agg(jsonb_build_object('category',category,'interested',interested) order by category),'[]') from aura_creator.collaboration_preference where workspace_id=p_workspace),
  'industry_preferences', (select coalesce(jsonb_agg(jsonb_build_object('industry',industry,'stance',stance) order by industry),'[]') from aura_creator.industry_preference where workspace_id=p_workspace),
  'industry_exclusions', (select coalesce(jsonb_agg(jsonb_build_object('industry',industry,'note',note) order by industry),'[]') from aura_creator.industry_exclusion where workspace_id=p_workspace),
  'rates', (select coalesce(jsonb_agg(to_jsonb(r) - 'workspace_id' order by format),'[]') from aura_creator.rate_preference r where workspace_id=p_workspace),
  'plan', (select jsonb_build_object('id',g.id,'version',g.version,'label',g.label,'basis',g.basis,'created_at',g.created_at,
     'actions',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'position',a.position,'day',a.day,'title',a.title,'detail',a.detail,'status',a.status) order by a.position),'[]') from aura_creator.growth_action a where a.plan_id=g.id))
     from aura_creator.growth_plan g where g.workspace_id=p_workspace order by g.version desc limit 1)
 ) $$;

-- M04 gains a Social accounts widget (forward change to the preference allowlist).
alter table aura_studio.dashboard_pref drop constraint dashboard_pref_hidden_widgets_check;
alter table aura_studio.dashboard_pref add constraint dashboard_pref_hidden_widgets_check
 check (hidden_widgets <@ array['actions','plan','goals','content','checklist','recommendations','commercial','milestones','weekly','social']);

-- ===== Private evidence storage: path <workspace>/<claim>/<file>. Policies call these boolean helpers; nothing is public. =====
create function public.aura_social_can_upload(p_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare u uuid := auth.uid(); ws uuid; cl uuid; c aura_social.ownership_claim;
begin
 ws := split_part(p_name, '/', 1)::uuid; cl := split_part(p_name, '/', 2)::uuid;
 perform aura_social.actor(ws, true);
 select * into c from aura_social.ownership_claim where id = cl and workspace_id = ws and claimant = u and state in ('challenge_pending','evidence_submitted','disputed');
 return c.id is not null and exists(select 1 from aura_social.verification_challenge ch where ch.claim_id = c.id and ch.expires_at > now());
exception when others then return false; end $$;
create function public.aura_social_can_read_evidence(p_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare e aura_social.verification_evidence;
begin
 select * into e from aura_social.verification_evidence where storage_path = p_name; if e.id is null then return false; end if;
 begin perform aura_social.actor(e.workspace_id, false); if e.uploaded_by = auth.uid() then return true; end if; exception when others then null; end;
 begin perform aura_social.reviewer_check(); return e.scan_status = 'clean'; exception when others then return false; end; -- reviewers see only scanned, clean evidence
end $$;
create function public.aura_social_can_delete_evidence(p_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 return exists(select 1 from aura_social.verification_evidence e join aura_social.ownership_claim c on c.id = e.claim_id where e.storage_path = p_name and e.uploaded_by = auth.uid() and c.state in ('challenge_pending','evidence_submitted','rejected','disputed'));
exception when others then return false; end $$;
do $$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
  insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values ('social-evidence', 'social-evidence', false, 5242880, array['image/png','image/jpeg','image/webp']) on conflict (id) do nothing;
  execute $p$create policy social_evidence_insert on storage.objects for insert to authenticated with check (bucket_id = 'social-evidence' and public.aura_social_can_upload(name))$p$;
  execute $p$create policy social_evidence_select on storage.objects for select to authenticated using (bucket_id = 'social-evidence' and public.aura_social_can_read_evidence(name))$p$;
  execute $p$create policy social_evidence_delete on storage.objects for delete to authenticated using (bucket_id = 'social-evidence' and public.aura_social_can_delete_evidence(name))$p$;
 end if;
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_social\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop; end $$;
revoke all on all tables in schema aura_social from public, anon, authenticated;
revoke all on all functions in schema aura_social from public, anon, authenticated;
commit;
