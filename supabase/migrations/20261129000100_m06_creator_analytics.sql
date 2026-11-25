-- M06 Creator analytics and Growth Experiment Lab.
-- Builds on M05 (aura_social observations, content_ref, metric_def). It adds NO competing metric or observation tables: account and
-- content observations stay in aura_social. New here: versioned semantics, derived-calculation definitions, content tags and timing,
-- aggregate audience snapshots, insights, experiments, audience sharing grants, export log and cohort opt-in.
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path='' granted to authenticated.
begin;
create schema aura_analytics;
revoke all on schema aura_analytics from public, anon, authenticated;

create table aura_analytics.setting (key text primary key, value jsonb not null);
insert into aura_analytics.setting(key,value) values
 ('cohort_min_size','25'),          -- NON-PRODUCTION default; the function enforces a floor of 10 whatever this says
 ('max_active_experiments','3'),
 ('insight_open_limit','60');

-- Versioned semantics for the M05 metrics. Observations are read under the definition whose effective_from <= observed_on, so changing a definition
-- adds a version; it never rewrites history.
create table aura_analytics.metric_semantics (
 metric text not null references aura_social.metric_def, version integer not null check (version > 0), effective_from date not null,
 numerator text not null, denominator text, window_semantics text not null check (window_semantics in ('snapshot','interval','cumulative','either')),
 aggregations text[] not null, comparable_with text[] not null, source_requirement text not null, notes text not null,
 primary key (metric, version)
);
insert into aura_analytics.metric_semantics(metric, version, effective_from, numerator, denominator, window_semantics, aggregations, comparable_with, source_requirement, notes) values
 ('followers',1,'2026-01-01','Audience count shown by the platform on the observation date',null,'snapshot','{per_account,sum_with_overlap_label}','{followers}','any labelled source','Followers and subscribers are audience counts, not unique people. Summing across platforms double counts people who follow on more than one.'),
 ('following',1,'2026-01-01','Accounts followed on the observation date',null,'snapshot','{per_account}','{following}','any labelled source','Not an audience measure.'),
 ('posts_total',1,'2026-01-01','Lifetime published content count',null,'cumulative','{per_account,sum}','{posts_total}','any labelled source','A lifetime total. Differences between two dates give publications in between.'),
 ('reach',1,'2026-01-01','Unique accounts that saw content in the period',null,'interval','{per_account}','{reach}','any labelled source','Unique counts cannot be summed across accounts or periods.'),
 ('impressions',1,'2026-01-01','Times content was displayed in the period',null,'interval','{per_account,sum_same_window}','{impressions}','any labelled source','Not reach: one person can produce many impressions.'),
 ('profile_views',1,'2026-01-01','Profile visits in the period',null,'interval','{per_account,sum_same_window}','{profile_views}','any labelled source','Platform definitions of a visit differ.'),
 ('interactions',1,'2026-01-01','Platform-defined interactions in the period',null,'interval','{per_account,sum_same_window}','{interactions}','any labelled source','Which interactions are included differs by platform. Not comparable across platforms.'),
 ('audience_growth',1,'2026-01-01','Net change in audience count over the period',null,'interval','{per_account,sum_same_window}','{audience_growth}','any labelled source','Net, not gross: new minus lost.'),
 ('views',1,'2026-01-01','Platform-defined views of the content',null,'either','{per_content}','{views}','any labelled source','View definitions differ by platform and format. Not unique viewers.'),
 ('c_reach',1,'2026-01-01','Unique accounts that saw the content',null,'either','{per_content}','{c_reach}','any labelled source','Not impressions.'),
 ('c_impressions',1,'2026-01-01','Times the content was displayed',null,'either','{per_content}','{c_impressions}','any labelled source','Not reach.'),
 ('likes',1,'2026-01-01','Likes or reactions on the content',null,'either','{per_content}','{likes}','any labelled source','Reaction types differ by platform.'),
 ('comments',1,'2026-01-01','Comments on the content',null,'either','{per_content}','{comments}','any labelled source','Replies may or may not be included.'),
 ('shares',1,'2026-01-01','Shares or reposts of the content',null,'either','{per_content}','{shares}','any labelled source','Sharing options differ by platform.'),
 ('saves',1,'2026-01-01','Saves or bookmarks of the content',null,'either','{per_content}','{saves}','any labelled source','Not available on every platform.'),
 ('watch_time_seconds',1,'2026-01-01','Total seconds watched',null,'either','{per_content}','{watch_time_seconds}','any labelled source','Total, not average view duration.');

-- Explicit derived calculations. Denominators are never interchanged.
create table aura_analytics.derived_def (
 code text not null, version integer not null check (version > 0), scope text not null check (scope in ('account','content')), label text not null,
 numerator_metrics text[] not null, denominator_metric text not null, description text not null, primary key (code, version)
);
insert into aura_analytics.derived_def values
 ('engagement_by_reach',1,'content','Engagement by reach','{likes,comments,shares,saves}','c_reach','(likes + comments + shares + saves) / content reach, same window and date'),
 ('engagement_by_views',1,'content','Engagement by views','{likes,comments,shares,saves}','views','(likes + comments + shares + saves) / views, same window and date'),
 ('account_engagement_by_reach',1,'account','Account engagement by reach','{interactions}','reach','account interactions / account reach over the same period'),
 ('account_engagement_by_followers',1,'account','Account engagement by followers','{interactions}','followers','account interactions over a period / followers at the latest snapshot inside that period');

create table aura_analytics.content_timing (
 content_id uuid primary key references aura_social.content_ref on delete cascade,
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 published_at timestamptz not null check (published_at <= now() + interval '1 day'), tz text not null check (length(tz) between 3 and 64),
 updated_at timestamptz not null default now()
);
create table aura_analytics.content_tag (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 content_id uuid not null references aura_social.content_ref on delete cascade,
 kind text not null check (kind in ('topic','niche','pillar','format','hook','duration','style','time_category','sponsorship','custom')),
 value text not null check (length(trim(value)) between 1 and 60 and value ~ '^[^<>]+$'),
 source text not null default 'manual' check (source in ('manual','ai_proposed','ai_confirmed')),
 status text not null default 'confirmed' check (status in ('proposed','confirmed','rejected')),
 uncertainty jsonb, proposed_by text, created_by uuid references auth.users, created_at timestamptz not null default now(),
 check ((source = 'manual') = (status = 'confirmed' and proposed_by is null) or source <> 'manual'),
 check (kind <> 'sponsorship' or lower(value) in ('organic','sponsored'))
);
create unique index one_tag_value on aura_analytics.content_tag(content_id, kind, lower(value)) where status <> 'rejected';
create unique index one_sponsorship_tag on aura_analytics.content_tag(content_id) where kind = 'sponsorship' and status = 'confirmed';

create table aura_analytics.audience_snapshot (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade,
 dimension text not null check (dimension in ('geography','language','age_band','activity')),
 buckets jsonb not null check (jsonb_typeof(buckets) = 'array' and jsonb_array_length(buckets) between 1 and 30),
 observed_on date not null check (observed_on <= current_date + 1), period_start date, period_end date,
 denominator_kind text not null check (denominator_kind in ('followers','engaged_audience','reached_audience','unknown')),
 denominator numeric check (denominator is null or denominator >= 0), coverage_pct numeric check (coverage_pct is null or coverage_pct between 0 and 100),
 source text not null check (source in ('manual','screenshot_supported','ai_confirmed','provider')),
 evidence_id uuid, actor uuid references auth.users, entered_at timestamptz not null default clock_timestamp(),
 request_id uuid not null, note text check (length(note) <= 200),
 supersedes uuid references aura_analytics.audience_snapshot, superseded_by uuid references aura_analytics.audience_snapshot,
 unique (workspace_id, request_id), check ((period_start is null) = (period_end is null) and (period_end is null or period_end >= period_start))
);
create index audience_by_account on aura_analytics.audience_snapshot(account_id, dimension, observed_on desc);
create trigger audience_append_only before update or delete on aura_analytics.audience_snapshot for each row execute function aura_social.append_only();

create table aura_analytics.audience_grant (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade,
 recipient_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 dimensions text[] not null check (cardinality(dimensions) between 1 and 4 and dimensions <@ array['geography','language','age_band','activity']),
 purpose text not null check (length(purpose) between 3 and 200), valid_until timestamptz,
 status text not null default 'active' check (status in ('active','revoked')), granted_by uuid not null references auth.users,
 created_at timestamptz not null default now(), revoked_at timestamptz
);
create unique index one_active_audience_grant on aura_analytics.audience_grant(account_id, recipient_workspace_id) where status = 'active';

create table aura_analytics.insight (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 fingerprint text not null check (length(fingerprint) between 3 and 200),
 category text not null check (category in ('growth_opportunity','data_quality','goal_progress','content_pattern','recommended_experiment','observation_update','measurement_inconsistency')),
 rule_key text not null check (length(rule_key) between 3 and 80), rule_version integer not null default 1,
 priority integer not null check (priority between 1 and 100),
 title text not null check (length(title) between 3 and 160), explanation text not null check (length(explanation) <= 1000),
 evidence jsonb not null, limitations jsonb not null default '[]', action text check (length(action) <= 300), link text check (link ~ '^/creator/[a-z0-9/_-]*$'),
 data_hash text not null, generated_at timestamptz not null default now(),
 status text not null default 'new' check (status in ('new','viewed','saved','dismissed','acted','stale')), status_at timestamptz not null default now(),
 unique (workspace_id, fingerprint)
);
create index insight_feed on aura_analytics.insight(workspace_id, status, priority desc, generated_at desc);

create table aura_analytics.experiment (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 account_id uuid not null references aura_creator.social_account on delete cascade,
 name text not null check (length(trim(name)) between 3 and 100), hypothesis text not null check (length(trim(hypothesis)) between 5 and 500),
 objective text check (length(objective) <= 300), metric text not null references aura_social.metric_def, metric_scope text not null check (metric_scope in ('account','content')),
 planned_change text check (length(planned_change) <= 500), measurement_method text check (length(measurement_method) <= 500), success_criterion text check (length(success_criterion) <= 300),
 confounders text check (length(confounders) <= 500), evaluation_days integer not null check (evaluation_days between 3 and 180),
 template_key text check (length(template_key) <= 60), source_insight uuid references aura_analytics.insight on delete set null,
 baseline_refs uuid[] not null default '{}', baseline_unavailable_reason text check (length(baseline_unavailable_reason) <= 300),
 status text not null default 'draft' check (status in ('draft','planned','active','completed','cancelled')),
 baseline jsonb, activated_at timestamptz, ended_at timestamptz,
 outcome text check (outcome in ('observed_improvement','no_clear_difference','observed_decline','inconclusive','insufficient_evidence')),
 interpretation text check (length(interpretation) <= 1000), next_experiment text check (length(next_experiment) <= 500), learning_tags text[] not null default '{}' check (cardinality(learning_tags) <= 8),
 created_by uuid not null references auth.users, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), request_id uuid not null,
 unique (workspace_id, request_id),
 check ((status in ('active','completed')) = (activated_at is not null) or status = 'cancelled'),
 check (outcome is null or status = 'completed')
);
create table aura_analytics.experiment_link (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 experiment_id uuid not null references aura_analytics.experiment on delete cascade,
 kind text not null check (kind in ('account','content')), ref_id uuid not null, content_id uuid references aura_social.content_ref,
 snapshot jsonb not null, linked_at timestamptz not null default now(), linked_by uuid not null references auth.users,
 unique (experiment_id, kind, ref_id)
);
create table aura_analytics.experiment_event (
 id bigint generated always as identity primary key, workspace_id uuid not null references aura_identity.workspace on delete cascade,
 experiment_id uuid not null references aura_analytics.experiment on delete cascade, event text not null, detail jsonb, at timestamptz not null default now(), actor uuid not null references auth.users
);
create table aura_analytics.cohort_optin (workspace_id uuid primary key references aura_identity.workspace on delete cascade, enabled boolean not null default false, changed_at timestamptz not null default now(), changed_by uuid not null references auth.users);
create table aura_analytics.export_log (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade, user_id uuid not null references auth.users,
 kind text not null check (kind in ('summary','observations','content','audience','experiments','shared_audience')), format text not null check (format in ('csv','pdf')),
 purpose text not null check (length(purpose) between 3 and 200), at timestamptz not null default now()
);
-- Contract tables for later modules. No client function can write them.
create table aura_analytics.competitor_ref (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade, platform text not null, public_handle text not null, basis text not null check (basis in ('public_data','authorized_data')), created_at timestamptz not null default now());

do $$ declare t text; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'aura_analytics' and c.relkind = 'r' loop
  execute format('alter table aura_analytics.%I enable row level security', t);
 end loop; end $$;

-- ───────── helpers ─────────
create function aura_analytics.actor(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, p_write);
begin
 if not exists(select 1 from aura_identity.workspace where id = p_workspace and kind = 'creator') then raise exception 'Access denied' using errcode = '42501'; end if;
 return u;
end $$;
create function aura_analytics.audit(p_user uuid, p_event text) returns void language sql set search_path='' as $$ insert into aura_identity.event(user_id, event) values (p_user, p_event) $$;
create function aura_analytics.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_analytics.setting where key = p_key $$;
create function aura_analytics.tracked(p_workspace uuid, p_account uuid) returns aura_creator.social_account language plpgsql set search_path='' as $$
declare a aura_creator.social_account := aura_social.acct(p_workspace, p_account);
begin
 if a.lifecycle not in ('active','disconnected','archived') then raise exception 'Account is not tracked' using errcode = '55000'; end if;
 return a;
end $$;

-- ───────── reads ─────────
create function public.aura_analytics_semantics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform aura_identity.eligible();
 return jsonb_build_object(
  'metrics', (select coalesce(jsonb_agg(to_jsonb(s) order by s.metric, s.version), '[]'::jsonb) from aura_analytics.metric_semantics s),
  'derived', (select coalesce(jsonb_agg(to_jsonb(d) order by d.code, d.version), '[]'::jsonb) from aura_analytics.derived_def d));
end $$;

-- Current (non-superseded) account observations in [p_from - lookback, p_to] for tracked accounts. The lookback gives baseline candidates.
create function public.aura_analytics_account_series(p_workspace uuid, p_from date, p_to date, p_lookback integer default 120) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); lb int := least(greatest(coalesce(p_lookback, 120), 0), 400);
begin
 if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 800 then raise exception 'Invalid date range' using errcode = '22023'; end if;
 return jsonb_build_object(
  'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'platform', a.platform, 'handle', a.handle, 'display_name', a.display_name, 'lifecycle', a.lifecycle, 'connection', a.connection, 'history_stale_since', a.history_stale_since, 'is_primary', a.is_primary) order by a.created_at), '[]'::jsonb)
   from aura_creator.social_account a where a.workspace_id = p_workspace and a.lifecycle in ('active','disconnected','archived')),
  'observations', (select coalesce(jsonb_agg(x order by x.observed_on, x.entered_at), '[]'::jsonb) from (
   select o.id, o.account_id, o.metric, o.value, o.observed_on, o.period_start, o.period_end, o.source, o.evidence_id is not null as has_evidence, o.supersedes is not null as corrected, o.entered_at
   from aura_social.account_observation o join aura_creator.social_account a on a.id = o.account_id and a.lifecycle in ('active','disconnected','archived')
   where o.workspace_id = p_workspace and o.superseded_by is null and o.observed_on between p_from - lb and p_to order by o.observed_on desc limit 4000) x));
end $$;

create function public.aura_analytics_content(p_workspace uuid, p_account uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 return jsonb_build_object('content', (select coalesce(jsonb_agg(c order by c.published_on desc nulls last, c.created_at desc), '[]'::jsonb) from (
  select r.id, r.account_id, a.platform, a.handle, r.external_id, r.url, r.title, r.format, r.published_on, r.created_at,
   t.published_at, t.tz,
   (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'kind', g.kind, 'value', g.value, 'source', g.source, 'status', g.status, 'uncertainty', g.uncertainty) order by g.kind, g.value), '[]'::jsonb) from aura_analytics.content_tag g where g.content_id = r.id and g.status <> 'rejected') as tags,
   (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'metric', o.metric, 'value', o.value, 'window_kind', o.window_kind, 'period_start', o.period_start, 'period_end', o.period_end, 'observed_on', o.observed_on, 'source', o.source, 'corrected', o.supersedes is not null, 'has_evidence', o.evidence_id is not null) order by o.observed_on), '[]'::jsonb)
     from aura_social.content_observation o where o.content_id = r.id and o.superseded_by is null) as observations
  from aura_social.content_ref r join aura_creator.social_account a on a.id = r.account_id and a.lifecycle in ('active','disconnected','archived')
  left join aura_analytics.content_timing t on t.content_id = r.id
  where r.workspace_id = p_workspace and (p_account is null or r.account_id = p_account) order by r.published_on desc nulls last, r.created_at desc limit 300) c));
end $$;

-- ───────── tags and timing ─────────
create function aura_analytics.content_of(p_workspace uuid, p_content uuid) returns aura_social.content_ref language plpgsql set search_path='' as $$
declare c aura_social.content_ref;
begin
 select * into c from aura_social.content_ref where id = p_content and workspace_id = p_workspace;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return c;
end $$;
create function public.aura_analytics_set_tag(p_workspace uuid, p_content uuid, p_kind text, p_value text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); c aura_social.content_ref := aura_analytics.content_of(p_workspace, p_content); g aura_analytics.content_tag; v text := trim(p_value);
begin
 if p_kind = 'sponsorship' then
  v := lower(v);
  delete from aura_analytics.content_tag where content_id = c.id and kind = 'sponsorship'; -- a content item has one classification; the Creator changed it
 end if;
 insert into aura_analytics.content_tag(workspace_id, content_id, kind, value, created_by) values (p_workspace, c.id, p_kind, v, u)
  on conflict (content_id, kind, lower(value)) where status <> 'rejected' do update set status = 'confirmed' returning * into g;
 perform aura_analytics.audit(u, 'analytics_tag_set');
 return to_jsonb(g) - 'workspace_id';
end $$;
create function public.aura_analytics_remove_tag(p_workspace uuid, p_tag uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 delete from aura_analytics.content_tag where id = p_tag and workspace_id = p_workspace;
 if not found then raise exception 'Access denied' using errcode = '42501'; end if;
 return jsonb_build_object('removed', p_tag);
end $$;
-- Reviewing a PROPOSED tag. Proposals can only come from a future authorized provider (no client function creates one).
create function public.aura_analytics_review_tag(p_workspace uuid, p_tag uuid, p_action text, p_value text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); g aura_analytics.content_tag;
begin
 select * into g from aura_analytics.content_tag where id = p_tag and workspace_id = p_workspace and status = 'proposed' for update;
 if g.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_action = 'confirm' then update aura_analytics.content_tag set status = 'confirmed', source = 'ai_confirmed', value = coalesce(nullif(trim(p_value), ''), value), created_by = u where id = g.id returning * into g;
 elsif p_action = 'reject' then update aura_analytics.content_tag set status = 'rejected' where id = g.id returning * into g;
 else raise exception 'Invalid action' using errcode = '22023'; end if;
 perform aura_analytics.audit(u, 'analytics_tag_reviewed');
 return to_jsonb(g) - 'workspace_id';
end $$;
create function public.aura_analytics_set_timing(p_workspace uuid, p_content uuid, p_published_at timestamptz, p_tz text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); c aura_social.content_ref := aura_analytics.content_of(p_workspace, p_content);
begin
 if p_tz is null or not exists(select 1 from pg_timezone_names where name = p_tz) then raise exception 'Unknown time zone' using errcode = '22023'; end if;
 insert into aura_analytics.content_timing(content_id, workspace_id, published_at, tz) values (c.id, p_workspace, p_published_at, p_tz)
  on conflict (content_id) do update set published_at = excluded.published_at, tz = excluded.tz, updated_at = now();
 return jsonb_build_object('content_id', c.id, 'published_at', p_published_at, 'tz', p_tz);
end $$;

-- ───────── audience snapshots ─────────
create function public.aura_analytics_record_audience(p_workspace uuid, p_request uuid, p_account uuid, p_dimension text, p_buckets jsonb, p_observed_on date, p_period_start date, p_period_end date,
  p_denominator_kind text, p_denominator numeric, p_coverage numeric, p_note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_creator.social_account; s aura_analytics.audience_snapshot; total numeric := 0; b jsonb; seen text[] := '{}'; lbl text; share numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended('analytics_req:' || p_workspace::text || p_request::text, 0));
 select * into s from aura_analytics.audience_snapshot where workspace_id = p_workspace and request_id = p_request;
 if s.id is not null then return to_jsonb(s) - 'workspace_id'; end if;
 a := aura_analytics.tracked(p_workspace, p_account);
 if p_buckets is null or jsonb_typeof(p_buckets) <> 'array' or jsonb_array_length(p_buckets) not between 1 and 30 then raise exception 'Invalid buckets' using errcode = '22023'; end if;
 for b in select * from jsonb_array_elements(p_buckets) loop
  lbl := trim(b->>'bucket'); share := (b->>'share')::numeric;
  if lbl is null or length(lbl) not between 1 and 60 or lbl !~ '^[A-Za-z0-9 ,.+&''/()-]+$' or share is null or share < 0 or share > 100 or lower(lbl) = any(seen) then raise exception 'Invalid bucket' using errcode = '22023'; end if;
  seen := seen || lower(lbl); total := total + share;
 end loop;
 if total > 100.5 then raise exception 'Shares exceed 100 percent' using errcode = '22023'; end if;
 insert into aura_analytics.audience_snapshot(workspace_id, account_id, dimension, buckets, observed_on, period_start, period_end, denominator_kind, denominator, coverage_pct, source, actor, request_id, note, supersedes)
  values (p_workspace, a.id, p_dimension, p_buckets, p_observed_on, p_period_start, p_period_end, p_denominator_kind, p_denominator, p_coverage, 'manual', u, p_request, p_note,
   (select x.id from aura_analytics.audience_snapshot x where x.account_id = a.id and x.dimension = p_dimension and x.superseded_by is null and x.observed_on = p_observed_on order by x.entered_at desc limit 1))
  returning * into s;
 if s.supersedes is not null then update aura_analytics.audience_snapshot set superseded_by = s.id where id = s.supersedes; end if;
 perform aura_analytics.audit(u, 'analytics_audience_recorded');
 return to_jsonb(s) - 'workspace_id';
end $$;
create function public.aura_analytics_audience(p_workspace uuid, p_account uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 return jsonb_build_object('snapshots', (select coalesce(jsonb_agg(to_jsonb(s) - 'workspace_id' - 'actor' - 'evidence_id' order by s.observed_on desc, s.entered_at desc), '[]'::jsonb)
  from aura_analytics.audience_snapshot s where s.workspace_id = p_workspace and s.superseded_by is null and (p_account is null or s.account_id = p_account)));
end $$;

-- ───────── insights ─────────
create function public.aura_analytics_sync_insights(p_workspace uuid, p_items jsonb, p_rules text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); it jsonb; e aura_analytics.insight; created int := 0; changed int := 0; marked int := 0; fps text[] := '{}'; cap int := aura_analytics.setting_int('insight_open_limit');
begin
 perform pg_advisory_xact_lock(hashtextextended('analytics_insights:' || p_workspace::text, 0));
 if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then raise exception 'Invalid insights' using errcode = '22023'; end if;
 for it in select * from jsonb_array_elements(p_items) loop
  fps := fps || (it->>'fingerprint');
  select * into e from aura_analytics.insight where workspace_id = p_workspace and fingerprint = it->>'fingerprint' for update;
  if e.id is null then
   insert into aura_analytics.insight(workspace_id, fingerprint, category, rule_key, rule_version, priority, title, explanation, evidence, limitations, action, link, data_hash)
    values (p_workspace, it->>'fingerprint', it->>'category', it->>'rule_key', coalesce((it->>'rule_version')::int, 1), (it->>'priority')::int, it->>'title', it->>'explanation', it->'evidence', coalesce(it->'limitations', '[]'), it->>'action', it->>'link', it->>'data_hash');
   created := created + 1;
  elsif e.data_hash <> it->>'data_hash' or e.status = 'stale' then
   -- the underlying data changed: regenerate in place. A dismissal applied to the OLD evidence, so the new finding reappears; saved items stay saved.
   update aura_analytics.insight set category = it->>'category', rule_key = it->>'rule_key', rule_version = coalesce((it->>'rule_version')::int, 1), priority = (it->>'priority')::int, title = it->>'title', explanation = it->>'explanation',
    evidence = it->'evidence', limitations = coalesce(it->'limitations', '[]'), action = it->>'action', link = it->>'link', data_hash = it->>'data_hash', generated_at = now(),
    status = case when e.status = 'saved' then 'saved' else 'new' end, status_at = now() where id = e.id;
   changed := changed + 1;
  end if;
 end loop;
 -- Findings from rules that were evaluated but no longer fire are kept, labelled stale, never shown as current.
 update aura_analytics.insight set status = 'stale', status_at = now() where workspace_id = p_workspace and rule_key = any(p_rules) and not (fingerprint = any(fps)) and status <> 'stale';
 get diagnostics marked = row_count;
 delete from aura_analytics.insight where workspace_id = p_workspace and status = 'stale' and status_at < now() - interval '60 days';
 return jsonb_build_object('created', created, 'regenerated', changed, 'marked_stale', marked);
end $$;
create function public.aura_analytics_insights(p_workspace uuid, p_include_stale boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 return coalesce((select jsonb_agg(to_jsonb(i) - 'workspace_id' order by (i.status = 'stale'), (i.status = 'dismissed'), i.priority desc, i.generated_at desc)
  from aura_analytics.insight i where i.workspace_id = p_workspace and (p_include_stale or i.status <> 'stale')), '[]'::jsonb);
end $$;
create function public.aura_analytics_insight_status(p_workspace uuid, p_insight uuid, p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); i aura_analytics.insight;
begin
 if p_status not in ('viewed','saved','dismissed','acted') then raise exception 'Invalid status' using errcode = '22023'; end if;
 select * into i from aura_analytics.insight where id = p_insight and workspace_id = p_workspace for update;
 if i.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if i.status = 'stale' then raise exception 'This finding is outdated' using errcode = '55000'; end if;
 if p_status = 'viewed' and i.status <> 'new' then return to_jsonb(i) - 'workspace_id'; end if;
 update aura_analytics.insight set status = p_status, status_at = now() where id = i.id returning * into i;
 return to_jsonb(i) - 'workspace_id';
end $$;

-- ───────── experiments ─────────
create function aura_analytics.exp(p_workspace uuid, p_id uuid, p_lock boolean default false) returns aura_analytics.experiment language plpgsql set search_path='' as $$
declare x aura_analytics.experiment;
begin
 if p_lock then select * into x from aura_analytics.experiment where id = p_id and workspace_id = p_workspace for update;
 else select * into x from aura_analytics.experiment where id = p_id and workspace_id = p_workspace; end if;
 if x.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return x;
end $$;
create function aura_analytics.exp_event(p_exp uuid, p_ws uuid, p_user uuid, p_event text, p_detail jsonb default null) returns void language sql set search_path='' as $$
 insert into aura_analytics.experiment_event(workspace_id, experiment_id, event, detail, actor) values (p_ws, p_exp, p_event, p_detail, p_user) $$;
-- A baseline reference is an observation for THIS account and THIS metric.
create function aura_analytics.obs_snapshot(p_workspace uuid, p_account uuid, p_metric text, p_scope text, p_ref uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare o aura_social.account_observation; c aura_social.content_observation; r aura_social.content_ref;
begin
 if p_scope = 'account' then
  select * into o from aura_social.account_observation where id = p_ref and workspace_id = p_workspace and account_id = p_account and metric = p_metric;
  if o.id is null then raise exception 'That observation does not match this experiment' using errcode = '22023'; end if;
  return jsonb_build_object('kind','account','ref',o.id,'metric',o.metric,'value',o.value,'observed_on',o.observed_on,'period_start',o.period_start,'period_end',o.period_end,'window_days', case when o.period_start is null then null else o.period_end - o.period_start + 1 end,'source',o.source,'corrected',o.supersedes is not null);
 end if;
 select * into c from aura_social.content_observation where id = p_ref and workspace_id = p_workspace and metric = p_metric;
 if c.id is null then raise exception 'That observation does not match this experiment' using errcode = '22023'; end if;
 select * into r from aura_social.content_ref where id = c.content_id and account_id = p_account;
 if r.id is null then raise exception 'That observation does not match this experiment' using errcode = '22023'; end if;
 return jsonb_build_object('kind','content','ref',c.id,'content_id',c.content_id,'metric',c.metric,'value',c.value,'observed_on',c.observed_on,'window_kind',c.window_kind,'period_start',c.period_start,'period_end',c.period_end,'window_days', case when c.period_start is null then null else c.period_end - c.period_start + 1 end,'source',c.source,'corrected',c.supersedes is not null);
end $$;
create function public.aura_analytics_create_experiment(p_workspace uuid, p_request uuid, p_account uuid, p_exp jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_creator.social_account; x aura_analytics.experiment; m aura_social.metric_def; refs uuid[]; r uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('analytics_req:' || p_workspace::text || p_request::text, 0));
 select * into x from aura_analytics.experiment where workspace_id = p_workspace and request_id = p_request;
 if x.id is not null then return to_jsonb(x) - 'workspace_id'; end if;
 a := aura_analytics.tracked(p_workspace, p_account);
 select * into m from aura_social.metric_def where code = p_exp->>'metric' and active;
 if m.code is null or not (a.platform = any(m.platforms)) then raise exception 'That metric is not available for this platform' using errcode = '22023'; end if;
 refs := coalesce(array(select jsonb_array_elements_text(coalesce(p_exp->'baseline_refs', '[]'))::uuid), '{}');
 foreach r in array refs loop perform aura_analytics.obs_snapshot(p_workspace, a.id, m.code, m.scope, r); end loop;
 insert into aura_analytics.experiment(workspace_id, account_id, name, hypothesis, objective, metric, metric_scope, planned_change, measurement_method, success_criterion, confounders, evaluation_days, template_key, source_insight, baseline_refs, baseline_unavailable_reason, created_by, request_id)
  values (p_workspace, a.id, p_exp->>'name', p_exp->>'hypothesis', p_exp->>'objective', m.code, m.scope, p_exp->>'planned_change', p_exp->>'measurement_method', p_exp->>'success_criterion', p_exp->>'confounders', (p_exp->>'evaluation_days')::int, p_exp->>'template_key',
   (select i.id from aura_analytics.insight i where i.id = nullif(p_exp->>'source_insight','')::uuid and i.workspace_id = p_workspace), refs, p_exp->>'baseline_unavailable_reason', u, p_request) returning * into x;
 perform aura_analytics.exp_event(x.id, p_workspace, u, 'created');
 perform aura_analytics.audit(u, 'analytics_experiment_created');
 return to_jsonb(x) - 'workspace_id';
end $$;
create function public.aura_analytics_update_experiment(p_workspace uuid, p_id uuid, p_exp jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); x aura_analytics.experiment := aura_analytics.exp(p_workspace, p_id, true); refs uuid[]; r uuid;
begin
 if x.status not in ('draft','planned') then raise exception 'A started experiment cannot be edited' using errcode = '55000'; end if;
 refs := case when p_exp ? 'baseline_refs' then coalesce(array(select jsonb_array_elements_text(p_exp->'baseline_refs')::uuid), '{}') else x.baseline_refs end;
 foreach r in array refs loop perform aura_analytics.obs_snapshot(p_workspace, x.account_id, x.metric, x.metric_scope, r); end loop;
 update aura_analytics.experiment set name = coalesce(p_exp->>'name', name), hypothesis = coalesce(p_exp->>'hypothesis', hypothesis), objective = coalesce(p_exp->>'objective', objective),
  planned_change = coalesce(p_exp->>'planned_change', planned_change), measurement_method = coalesce(p_exp->>'measurement_method', measurement_method), success_criterion = coalesce(p_exp->>'success_criterion', success_criterion),
  confounders = coalesce(p_exp->>'confounders', confounders), evaluation_days = coalesce((p_exp->>'evaluation_days')::int, evaluation_days), baseline_refs = refs,
  baseline_unavailable_reason = coalesce(p_exp->>'baseline_unavailable_reason', baseline_unavailable_reason), updated_at = now() where id = x.id returning * into x;
 return to_jsonb(x) - 'workspace_id';
end $$;
create function public.aura_analytics_plan_experiment(p_workspace uuid, p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); x aura_analytics.experiment := aura_analytics.exp(p_workspace, p_id, true);
begin
 if x.status <> 'draft' then raise exception 'Only a draft can be planned' using errcode = '55000'; end if;
 update aura_analytics.experiment set status = 'planned', updated_at = now() where id = x.id returning * into x;
 perform aura_analytics.exp_event(x.id, p_workspace, u, 'planned');
 return to_jsonb(x) - 'workspace_id';
end $$;
-- Activation freezes the baseline. Explicit, once, and never overwritten afterwards.
create function public.aura_analytics_activate_experiment(p_workspace uuid, p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); x aura_analytics.experiment; r uuid; snaps jsonb := '[]'::jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('analytics_active:' || p_workspace::text, 0));
 x := aura_analytics.exp(p_workspace, p_id, true);
 if x.status = 'active' then raise exception 'Already active' using errcode = '55000'; end if;
 if x.status not in ('draft','planned') then raise exception 'This experiment cannot be started' using errcode = '55000'; end if;
 if cardinality(x.baseline_refs) = 0 and coalesce(trim(x.baseline_unavailable_reason), '') = '' then raise exception 'Add a baseline, or say why none exists' using errcode = '22023'; end if;
 if (select count(*) from aura_analytics.experiment where workspace_id = p_workspace and status = 'active') >= aura_analytics.setting_int('max_active_experiments') then raise exception 'Too many active experiments' using errcode = '23514'; end if;
 foreach r in array x.baseline_refs loop snaps := snaps || jsonb_build_array(aura_analytics.obs_snapshot(p_workspace, x.account_id, x.metric, x.metric_scope, r)); end loop;
 update aura_analytics.experiment set status = 'active', activated_at = clock_timestamp(), baseline = jsonb_build_object('observations', snaps, 'unavailable_reason', x.baseline_unavailable_reason, 'frozen_at', clock_timestamp()), updated_at = now() where id = x.id returning * into x;
 perform aura_analytics.exp_event(x.id, p_workspace, u, 'activated');
 perform aura_analytics.audit(u, 'analytics_experiment_activated');
 return to_jsonb(x) - 'workspace_id';
end $$;
create function public.aura_analytics_link_observation(p_workspace uuid, p_id uuid, p_ref uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); x aura_analytics.experiment := aura_analytics.exp(p_workspace, p_id, true); s jsonb; b jsonb; l aura_analytics.experiment_link;
begin
 if x.status <> 'active' then raise exception 'Observations can only be added to an active experiment' using errcode = '55000'; end if;
 s := aura_analytics.obs_snapshot(p_workspace, x.account_id, x.metric, x.metric_scope, p_ref);
 if (s->>'observed_on')::date < x.activated_at::date then raise exception 'That observation is from before the experiment started' using errcode = '22023'; end if;
 for b in select * from jsonb_array_elements(coalesce(x.baseline->'observations', '[]'::jsonb)) loop
  if (b->>'ref') = p_ref::text then raise exception 'That observation is already the baseline' using errcode = '22023'; end if;
  if (b->>'window_days') is distinct from (s->>'window_days') or (b->>'window_kind') is distinct from (s->>'window_kind') then raise exception 'Measurement window does not match the baseline' using errcode = '22023'; end if;
 end loop;
 insert into aura_analytics.experiment_link(workspace_id, experiment_id, kind, ref_id, content_id, snapshot, linked_by) values (p_workspace, x.id, s->>'kind', p_ref, nullif(s->>'content_id','')::uuid, s, u)
  on conflict (experiment_id, kind, ref_id) do nothing returning * into l;
 if l.id is null then raise exception 'Already added' using errcode = '23505'; end if;
 perform aura_analytics.exp_event(x.id, p_workspace, u, 'observation_linked');
 return to_jsonb(l) - 'workspace_id';
end $$;
create function public.aura_analytics_unlink_observation(p_workspace uuid, p_link uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); l aura_analytics.experiment_link; x aura_analytics.experiment;
begin
 select * into l from aura_analytics.experiment_link where id = p_link and workspace_id = p_workspace;
 if l.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 x := aura_analytics.exp(p_workspace, l.experiment_id, true);
 if x.status <> 'active' then raise exception 'Only an active experiment can change' using errcode = '55000'; end if;
 delete from aura_analytics.experiment_link where id = l.id;
 perform aura_analytics.exp_event(x.id, p_workspace, u, 'observation_unlinked', jsonb_build_object('ref', l.ref_id));
 return jsonb_build_object('removed', p_link);
end $$;
create function public.aura_analytics_finish_experiment(p_workspace uuid, p_id uuid, p_action text, p_outcome text default null, p_interpretation text default null, p_next text default null, p_tags text[] default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); x aura_analytics.experiment := aura_analytics.exp(p_workspace, p_id, true);
begin
 if p_action = 'cancel' then
  if x.status not in ('draft','planned','active') then raise exception 'Already finished' using errcode = '55000'; end if;
  update aura_analytics.experiment set status = 'cancelled', ended_at = clock_timestamp(), updated_at = now() where id = x.id returning * into x; -- no outcome is invented
  perform aura_analytics.exp_event(x.id, p_workspace, u, 'cancelled');
 elsif p_action = 'complete' then
  if x.status <> 'active' then raise exception 'Only an active experiment can be completed' using errcode = '55000'; end if;
  if p_outcome is null or p_outcome not in ('observed_improvement','no_clear_difference','observed_decline','inconclusive','insufficient_evidence') then raise exception 'Choose an outcome' using errcode = '22023'; end if;
  update aura_analytics.experiment set status = 'completed', ended_at = clock_timestamp(), outcome = p_outcome, interpretation = left(p_interpretation, 1000), next_experiment = left(p_next, 500), learning_tags = coalesce(p_tags, '{}'), updated_at = now() where id = x.id returning * into x;
  perform aura_analytics.exp_event(x.id, p_workspace, u, 'completed', jsonb_build_object('outcome', p_outcome));
 else raise exception 'Invalid action' using errcode = '22023'; end if;
 perform aura_analytics.audit(u, 'analytics_experiment_' || p_action);
 return to_jsonb(x) - 'workspace_id';
end $$;
create function public.aura_analytics_experiments(p_workspace uuid, p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 return coalesce((select jsonb_agg(q.e order by q.created_at desc) from (
  select to_jsonb(x) - 'workspace_id' - 'created_by' - 'request_id'
   || jsonb_build_object('platform', a.platform, 'handle', a.handle,
    'links', (select coalesce(jsonb_agg(to_jsonb(l) - 'workspace_id' - 'linked_by'
       || jsonb_build_object('current', (select jsonb_build_object('value', t.value, 'corrected_since', t.id <> l.ref_id) from (
          select o.id, o.value from aura_social.account_observation o where l.kind = 'account' and o.superseded_by is null and o.id = (with recursive ch(id, nxt) as (select id, superseded_by from aura_social.account_observation where id = l.ref_id union all select o2.id, o2.superseded_by from aura_social.account_observation o2 join ch on o2.id = ch.nxt) select id from ch where nxt is null limit 1)
          union all
          select o.id, o.value from aura_social.content_observation o where l.kind = 'content' and o.superseded_by is null and o.id = (with recursive ch(id, nxt) as (select id, superseded_by from aura_social.content_observation where id = l.ref_id union all select o2.id, o2.superseded_by from aura_social.content_observation o2 join ch on o2.id = ch.nxt) select id from ch where nxt is null limit 1)) t limit 1))
       order by l.linked_at), '[]'::jsonb) from aura_analytics.experiment_link l where l.experiment_id = x.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('event', v.event, 'at', v.at, 'detail', v.detail) order by v.id), '[]'::jsonb) from aura_analytics.experiment_event v where v.experiment_id = x.id)) as e, x.created_at
  from aura_analytics.experiment x join aura_creator.social_account a on a.id = x.account_id where x.workspace_id = p_workspace and (p_id is null or x.id = p_id) limit 100) q), '[]'::jsonb);
end $$;

-- ───────── cohort benchmarking (architecture; suppressed unless the cohort is large enough) ─────────
create function public.aura_analytics_cohort_optin(p_workspace uuid, p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 insert into aura_analytics.cohort_optin(workspace_id, enabled, changed_by) values (p_workspace, coalesce(p_enabled, false), u)
  on conflict (workspace_id) do update set enabled = excluded.enabled, changed_at = now(), changed_by = u;
 perform aura_analytics.audit(u, case when p_enabled then 'analytics_cohort_optin' else 'analytics_cohort_optout' end);
 return jsonb_build_object('enabled', coalesce(p_enabled, false));
end $$;
create function aura_analytics.band(n numeric) returns text language sql immutable set search_path='' as $$ select case when n < 1000 then 'under_1k' when n < 10000 then '1k_10k' when n < 100000 then '10k_100k' else '100k_plus' end $$;
create function public.aura_analytics_cohort_benchmark(p_workspace uuid, p_platform text, p_today date default current_date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); mine numeric; my_band text; minsize int := greatest(aura_analytics.setting_int('cohort_min_size'), 10); n int; res jsonb;
begin
 if not coalesce((select enabled from aura_analytics.cohort_optin where workspace_id = p_workspace), false) then return jsonb_build_object('available', false, 'reason', 'not_opted_in'); end if;
 select o.value into mine from aura_social.account_observation o join aura_creator.social_account a on a.id = o.account_id and a.platform = p_platform and a.lifecycle = 'active'
  where o.workspace_id = p_workspace and o.metric = 'followers' and o.superseded_by is null order by o.observed_on desc, o.entered_at desc limit 1;
 if mine is null then return jsonb_build_object('available', false, 'reason', 'no_own_data'); end if;
 my_band := aura_analytics.band(mine);
 -- one value per OTHER opted-in workspace: follower growth % between the first and latest observation (at least 28 days apart, within 90 days) on one account for the platform
 with per_account as (
   select o.workspace_id as ws, o.account_id, a.is_primary,
    (array_agg(o.value order by o.observed_on, o.entered_at))[1] as first_v,
    (array_agg(o.value order by o.observed_on desc, o.entered_at desc))[1] as last_v,
    max(o.observed_on) - min(o.observed_on) as span
   from aura_social.account_observation o join aura_creator.social_account a on a.id = o.account_id and a.platform = p_platform and a.lifecycle = 'active'
   join aura_analytics.cohort_optin c on c.workspace_id = o.workspace_id and c.enabled
   where o.metric = 'followers' and o.superseded_by is null and o.observed_on between p_today - 90 and p_today and o.workspace_id <> p_workspace
   group by o.workspace_id, o.account_id, a.is_primary),
  one as (select distinct on (ws) ws, first_v, last_v from per_account where first_v > 0 and span >= 28 order by ws, is_primary desc, last_v desc),
  peers as (select (last_v - first_v) / first_v * 100 as pct from one where aura_analytics.band(last_v) = my_band)
 select count(*), case when count(*) >= minsize then jsonb_build_object('available', true, 'cohort_size_at_least', minsize, 'band', my_band, 'platform', p_platform, 'metric', 'follower growth percent over a window of about 90 days',
   'p25', round(percentile_cont(0.25) within group (order by pct)::numeric, 1), 'median', round(percentile_cont(0.5) within group (order by pct)::numeric, 1), 'p75', round(percentile_cont(0.75) within group (order by pct)::numeric, 1),
   'limits', jsonb_build_array('Self-reported contributors', 'Not a ranking', 'Different content niches are mixed')) end into n, res from peers;
 -- Below the minimum nothing is returned that depends on the cohort, including its size.
 if res is null then return jsonb_build_object('available', false, 'reason', 'cohort_too_small', 'minimum', minsize); end if;
 return res;
end $$;

-- ───────── audience sharing (F17/F18) ─────────
create function public.aura_analytics_grant_audience(p_workspace uuid, p_account uuid, p_recipient uuid, p_dimensions text[], p_purpose text, p_valid_until timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_creator.social_account := aura_analytics.tracked(p_workspace, p_account); g aura_analytics.audience_grant;
begin
 if p_recipient = p_workspace or not exists(select 1 from aura_identity.workspace w where w.id = p_recipient and w.kind = 'brand' and w.status = 'open') then raise exception 'Invalid recipient' using errcode = '22023'; end if;
 if p_valid_until is not null and (p_valid_until <= now() or p_valid_until > now() + interval '366 days') then raise exception 'Invalid validity period' using errcode = '22023'; end if;
 update aura_analytics.audience_grant set status = 'revoked', revoked_at = now() where account_id = a.id and recipient_workspace_id = p_recipient and status = 'active';
 insert into aura_analytics.audience_grant(workspace_id, account_id, recipient_workspace_id, dimensions, purpose, valid_until, granted_by) values (p_workspace, a.id, p_recipient, p_dimensions, trim(p_purpose), p_valid_until, u) returning * into g;
 perform aura_analytics.audit(u, 'analytics_audience_grant_created');
 return to_jsonb(g) - 'workspace_id';
end $$;
create function public.aura_analytics_revoke_audience(p_workspace uuid, p_grant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 update aura_analytics.audience_grant set status = 'revoked', revoked_at = coalesce(revoked_at, now()) where id = p_grant and workspace_id = p_workspace;
 if not found then raise exception 'Access denied' using errcode = '42501'; end if;
 perform aura_analytics.audit(u, 'analytics_audience_grant_revoked');
 return jsonb_build_object('revoked', p_grant);
end $$;
create function public.aura_analytics_audience_grants(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'account_id', g.account_id, 'recipient', g.recipient_workspace_id, 'dimensions', g.dimensions, 'purpose', g.purpose, 'valid_until', g.valid_until, 'status', g.status, 'created_at', g.created_at) order by g.created_at desc)
  from aura_analytics.audience_grant g where g.workspace_id = p_workspace), '[]'::jsonb);
end $$;
-- What a Brand member may read: ONLY aggregate buckets for granted dimensions, from active, unexpired grants, re-checked on every call.
-- Never returned: insights, experiments, diagnostics, evidence, goals, the Creator workspace or identity, unpublished handles.
create function public.aura_analytics_shared_audience(p_recipient uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.actor(p_recipient, false);
begin
 if not exists(select 1 from aura_identity.workspace where id = p_recipient and kind = 'brand') then raise exception 'Access denied' using errcode = '42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('grant', g.id, 'purpose', g.purpose, 'valid_until', g.valid_until, 'platform', a.platform,
    'account', case when a.sharing_visibility = 'published' then '@' || a.handle else 'A private ' || a.platform || ' account' end,
    'audience', (select coalesce(jsonb_agg(jsonb_build_object('dimension', s.dimension, 'buckets', s.buckets, 'observed_on', s.observed_on, 'source', s.source, 'denominator_kind', s.denominator_kind, 'coverage_pct', s.coverage_pct) order by s.dimension), '[]'::jsonb)
      from aura_analytics.audience_snapshot s where s.account_id = g.account_id and s.superseded_by is null and s.dimension = any(g.dimensions))))
  from aura_analytics.audience_grant g join aura_creator.social_account a on a.id = g.account_id and a.lifecycle in ('active','disconnected')
  join aura_identity.workspace cw on cw.id = g.workspace_id and cw.status = 'open'
  where g.recipient_workspace_id = p_recipient and g.status = 'active' and (g.valid_until is null or g.valid_until > now())), '[]'::jsonb);
end $$;

-- ───────── exports (F20) ─────────
-- Called by the export route BEFORE any file is produced. It re-checks the live session and permission and records purpose and time (never the content).
create function public.aura_analytics_authorize_export(p_workspace uuid, p_kind text, p_format text, p_purpose text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; id uuid;
begin
 if p_purpose is null or length(trim(p_purpose)) not between 3 and 200 or p_format not in ('csv','pdf') or p_kind not in ('summary','observations','content','audience','experiments','shared_audience') then raise exception 'Invalid export request' using errcode = '22023'; end if;
 if p_kind = 'shared_audience' then
  u := aura_social.actor(p_workspace, false);
  if not exists(select 1 from aura_analytics.audience_grant g where g.recipient_workspace_id = p_workspace and g.status = 'active' and (g.valid_until is null or g.valid_until > now())) then raise exception 'Access denied' using errcode = '42501'; end if;
 else u := aura_analytics.actor(p_workspace, false); end if;
 insert into aura_analytics.export_log(workspace_id, user_id, kind, format, purpose) values (p_workspace, u, p_kind, p_format, trim(p_purpose)) returning export_log.id into id;
 perform aura_analytics.audit(u, 'analytics_export_' || p_kind);
 return jsonb_build_object('id', id, 'authorized_at', now());
end $$;
create function public.aura_analytics_exports(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'format', l.format, 'purpose', l.purpose, 'at', l.at) order by l.at desc) from (select * from aura_analytics.export_log where workspace_id = p_workspace order by at desc limit 50) l), '[]'::jsonb); end $$;

-- search entries for M04: own experiments only
create function public.aura_analytics_overview(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 return jsonb_build_object(
  'open_insights', (select count(*) from aura_analytics.insight where workspace_id = p_workspace and status in ('new','viewed','saved')),
  'new_insights', (select count(*) from aura_analytics.insight where workspace_id = p_workspace and status = 'new'),
  'active_experiments', (select count(*) from aura_analytics.experiment where workspace_id = p_workspace and status = 'active'),
  'experiments', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'status', status)), '[]'::jsonb) from (select id, name, status from aura_analytics.experiment where workspace_id = p_workspace order by updated_at desc limit 20) e));
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_analytics\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop; end $$;
revoke all on all tables in schema aura_analytics from public, anon, authenticated;
revoke all on all functions in schema aura_analytics from public, anon, authenticated;
commit;
