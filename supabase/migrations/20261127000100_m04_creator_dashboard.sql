-- M04 Creator dashboard. Additive; depends on M02 (aura_identity) and M03 (aura_creator).
-- Ownership: aura_studio.* is owned by M04. daily_action, goal_observation, idea and weekly_review are the
-- data contracts that M06 (observations), M07 (actions) and M08 (ideas) adopt rather than duplicate.
-- Like M02/M03: private schema, RLS enabled with no policies, no table grants; every operation goes through the
-- SECURITY DEFINER functions at the end, each re-validating session, owner membership, Creator workspace and activation.
begin;
create schema aura_studio;
revoke all on schema aura_studio from public, anon, authenticated;

create table aura_studio.dashboard_pref (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 hidden_widgets text[] not null default '{}' check (hidden_widgets <@ array['actions','plan','goals','content','checklist','recommendations','commercial','milestones','weekly']),
 gamification_enabled boolean not null default true,
 digest_opt_in boolean not null default false, -- a stored preference only: no email delivery exists until M25
 timezone text not null default 'Asia/Kolkata',
 walkthrough_status text not null default 'not_seen' check (walkthrough_status in ('not_seen','completed','dismissed')),
 walkthrough_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (workspace_id, user_id)
);
create table aura_studio.daily_action (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 local_date date not null,
 rule_key text not null check (rule_key ~ '^[a-z0-9_.:-]{1,60}$'),
 category text not null check (category in ('growth_plan','content','profile','observation','education','commercial','weekly')),
 title text not null check (length(title) between 1 and 120),
 detail text not null check (length(detail) <= 300),
 href text check (href ~ '^/[A-Za-z0-9/_#?=&.-]{0,150}$'),
 dependency text check (dependency ~ '^M[0-9]{2}$'),
 plan_action_id uuid references aura_creator.growth_action on delete set null,
 source text not null default 'rule_based' check (source in ('rule_based','growth_plan')),
 status text not null default 'pending' check (status in ('pending','completed','skipped','deferred')),
 status_at timestamptz, created_at timestamptz not null default now(),
 unique (workspace_id, local_date, rule_key)
);
create index daily_action_by_day on aura_studio.daily_action(workspace_id, local_date);
create table aura_studio.goal_observation (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 request_id uuid not null,
 category text not null, metric text not null, -- keyed, not FK'd: editing goals in M03 must never erase history
 value numeric not null check (value >= 0 and value <= 1000000000000),
 observed_on date not null,
 source text not null default 'self_reported' check (source = 'self_reported'), -- M05/M06 widen to provider-derived and verified
 note text check (length(note) <= 200),
 created_at timestamptz not null default now(),
 unique (workspace_id, request_id)
);
create index observation_by_goal on aura_studio.goal_observation(workspace_id, category, metric, observed_on desc);
create table aura_studio.idea (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 request_id uuid not null,
 title text not null check (length(trim(title)) between 1 and 120),
 note text check (length(note) <= 1000),
 status text not null default 'captured' check (status in ('captured')), -- M08 owns the idea lifecycle
 source text not null default 'quick_capture' check (source in ('quick_capture')),
 created_at timestamptz not null default now(),
 unique (workspace_id, request_id)
);
create table aura_studio.milestone_event (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 code text not null check (code in ('onboarding_complete','first_action_completed','first_observation_recorded','first_idea_captured')),
 achieved_at timestamptz not null, primary key (workspace_id, code)
);
create table aura_studio.weekly_review (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 week_start date not null check (extract(isodow from week_start) = 1),
 summary jsonb not null, generated_at timestamptz not null default now(),
 primary key (workspace_id, week_start)
);
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='aura_studio' loop
  execute format('alter table aura_studio.%I enable row level security', t); end loop; end $$;

-- Authorization: M03 owner check plus completed Creator activation. Raises 42501 or 55000.
create function aura_studio.own(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, p_write);
begin
 if not exists(select 1 from aura_creator.creator_profile where workspace_id=p_workspace and activated_at is not null)
 then raise exception 'Onboarding incomplete' using errcode='55000'; end if;
 return u;
end $$;
create function aura_studio.prefs(p_workspace uuid, p_user uuid) returns aura_studio.dashboard_pref language plpgsql set search_path='' as $$
declare r aura_studio.dashboard_pref;
begin
 insert into aura_studio.dashboard_pref(workspace_id,user_id) values(p_workspace,p_user) on conflict do nothing;
 select * into r from aura_studio.dashboard_pref where workspace_id=p_workspace and user_id=p_user;
 return r;
end $$;
create function aura_studio.prefs_json(r aura_studio.dashboard_pref) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('hidden_widgets',r.hidden_widgets,'gamification_enabled',r.gamification_enabled,'digest_opt_in',r.digest_opt_in,
  'timezone',r.timezone,'walkthrough_status',r.walkthrough_status,'walkthrough_at',r.walkthrough_at,'updated_at',r.updated_at) $$;
create function aura_studio.actions_json(p_workspace uuid, p_from date, p_to date) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'local_date',a.local_date,'rule_key',a.rule_key,'category',a.category,'title',a.title,'detail',a.detail,
  'href',a.href,'dependency',a.dependency,'source',a.source,'status',a.status,'status_at',a.status_at,'plan_action_id',a.plan_action_id)
  order by a.local_date desc, a.created_at, a.id),'[]')
 from aura_studio.daily_action a where a.workspace_id=p_workspace and a.local_date between p_from and p_to $$;

create function public.aura_studio_context(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); r aura_studio.dashboard_pref := aura_studio.prefs(p_workspace, u);
begin return aura_studio.prefs_json(r) || jsonb_build_object('today', (now() at time zone r.timezone)::date); end $$;

create function public.aura_studio_set_prefs(p_workspace uuid, p_hidden text[], p_gamification boolean, p_digest boolean, p_timezone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); r aura_studio.dashboard_pref := aura_studio.prefs(p_workspace, u);
begin
 if not exists(select 1 from pg_timezone_names where name = p_timezone) then raise exception 'Unknown time zone' using errcode='22023'; end if;
 update aura_studio.dashboard_pref set hidden_widgets=coalesce(p_hidden,'{}'), gamification_enabled=coalesce(p_gamification,true), digest_opt_in=coalesce(p_digest,false),
  timezone=p_timezone, updated_at=now() where workspace_id=p_workspace and user_id=u returning * into r;
 insert into aura_identity.event(user_id,event) values(u,'studio_preferences_changed');
 return aura_studio.prefs_json(r);
end $$;

create function public.aura_studio_walkthrough(p_workspace uuid, p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); r aura_studio.dashboard_pref := aura_studio.prefs(p_workspace, u);
begin
 if p_status not in ('not_seen','completed','dismissed') then raise exception 'Invalid status' using errcode='22023'; end if;
 update aura_studio.dashboard_pref set walkthrough_status=p_status, walkthrough_at=case when p_status='not_seen' then null else now() end, updated_at=now()
  where workspace_id=p_workspace and user_id=u returning * into r;
 return aura_studio.prefs_json(r);
end $$;

-- Idempotent daily generation: the day is computed here from the stored time zone (never trusted from the client), and a
-- day that already has actions is returned unchanged, so re-opening the dashboard never regenerates or duplicates.
create function public.aura_studio_ensure_actions(p_workspace uuid, p_actions jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); r aura_studio.dashboard_pref := aura_studio.prefs(p_workspace, u); today date; n int;
begin
 today := (now() at time zone r.timezone)::date;
 perform pg_advisory_xact_lock(hashtextextended('studio_actions:'||p_workspace::text, 0));
 if not exists(select 1 from aura_studio.daily_action where workspace_id=p_workspace and local_date=today) then
  if jsonb_typeof(p_actions) <> 'array' then raise exception 'Invalid actions' using errcode='22023'; end if;
  n := jsonb_array_length(p_actions);
  if n not between 3 and 5 then raise exception 'Three to five actions are required' using errcode='22023'; end if;
  insert into aura_studio.daily_action(workspace_id,local_date,rule_key,category,title,detail,href,dependency,plan_action_id,source)
   select p_workspace, today, x.rule_key, x.category, trim(x.title), trim(x.detail), nullif(x.href,''), nullif(x.dependency,''),
    (select g.id from aura_creator.growth_action g where g.id = x.plan_action_id and g.workspace_id = p_workspace),
    case when x.plan_action_id is null then 'rule_based' else 'growth_plan' end
   from jsonb_to_recordset(p_actions) as x(rule_key text, category text, title text, detail text, href text, dependency text, plan_action_id uuid);
 end if;
 return aura_studio.actions_json(p_workspace, today, today);
end $$;

create function public.aura_studio_actions(p_workspace uuid, p_days integer default 14) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, false); tz text; today date;
begin
 select timezone into tz from aura_studio.dashboard_pref where workspace_id=p_workspace and user_id=u;
 tz := coalesce(tz,'Asia/Kolkata'); today := (now() at time zone tz)::date;
 return aura_studio.actions_json(p_workspace, today - least(greatest(coalesce(p_days,14),1),90), today);
end $$;

create function public.aura_studio_set_action(p_workspace uuid, p_action uuid, p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); a aura_studio.daily_action;
begin
 if p_status not in ('pending','completed','skipped','deferred') then raise exception 'Invalid status' using errcode='22023'; end if;
 select * into a from aura_studio.daily_action where id=p_action and workspace_id=p_workspace for update;
 if a.id is null then raise exception 'Access denied' using errcode='42501'; end if;
 if a.status <> p_status then -- status_at changes only on a real change, so repeated submits cannot rewrite history
  update aura_studio.daily_action set status=p_status, status_at=case when p_status='pending' then null else now() end where id=a.id;
  if a.plan_action_id is not null and (p_status='completed' or a.status='completed') then
   update aura_creator.growth_action set status=case when p_status='completed' then 'done' else 'todo' end where id=a.plan_action_id and workspace_id=p_workspace;
  end if;
 end if;
 return (select aura_studio.actions_json(p_workspace, d.local_date, d.local_date) from aura_studio.daily_action d where d.id=p_action);
end $$;

create function public.aura_studio_record_observation(p_workspace uuid, p_request uuid, p_category text, p_metric text, p_value numeric, p_observed_on date, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); tz text := (aura_studio.prefs(p_workspace, u)).timezone; today date; o aura_studio.goal_observation;
begin
 today := (now() at time zone tz)::date;
 if p_request is null or p_value is null or p_observed_on is null then raise exception 'Missing field' using errcode='22023'; end if;
 if p_observed_on > today or p_observed_on < today - 3650 then raise exception 'Date out of range' using errcode='22007'; end if;
 if not exists(select 1 from aura_creator.goal g where g.workspace_id=p_workspace and g.category=p_category and g.metric=p_metric) then
  raise exception 'No such goal measure' using errcode='22023'; end if;
 insert into aura_studio.goal_observation(workspace_id,request_id,category,metric,value,observed_on,note) values(p_workspace,p_request,p_category,p_metric,p_value,p_observed_on,nullif(trim(p_note),''))
  on conflict (workspace_id, request_id) do nothing returning * into o;
 if o.id is not null then insert into aura_identity.event(user_id,event) values(u,'studio_observation_recorded');
 else select * into o from aura_studio.goal_observation where workspace_id=p_workspace and request_id=p_request; end if;
 return to_jsonb(o) - 'workspace_id' - 'request_id';
end $$;

create function public.aura_studio_observations(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, false);
begin return (select coalesce(jsonb_agg(to_jsonb(o) - 'workspace_id' - 'request_id' order by o.observed_on desc, o.created_at desc),'[]')
 from (select * from aura_studio.goal_observation where workspace_id=p_workspace order by observed_on desc, created_at desc limit 300) o); end $$;

create function public.aura_studio_capture_idea(p_workspace uuid, p_request uuid, p_title text, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); i aura_studio.idea;
begin
 if p_request is null then raise exception 'Request id required' using errcode='22023'; end if;
 insert into aura_studio.idea(workspace_id,request_id,title,note) values(p_workspace,p_request,trim(p_title),nullif(trim(p_note),'')) on conflict (workspace_id, request_id) do nothing returning * into i;
 if i.id is null then select * into i from aura_studio.idea where workspace_id=p_workspace and request_id=p_request; end if;
 return to_jsonb(i) - 'workspace_id' - 'request_id';
end $$;

create function public.aura_studio_ideas(p_workspace uuid, p_limit integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, false);
begin return (select jsonb_build_object('total',(select count(*) from aura_studio.idea where workspace_id=p_workspace),
  'items',coalesce(jsonb_agg(to_jsonb(i) - 'workspace_id' - 'request_id' order by i.created_at desc),'[]'))
  from (select * from aura_studio.idea where workspace_id=p_workspace order by created_at desc limit least(greatest(coalesce(p_limit,30),1),100)) i); end $$;

-- Milestones are first-time events derived from real persisted activity, recorded at the genuine event time. The streak is the
-- count of consecutive local days (in the stored time zone) with at least one completed action, ending today or yesterday.
create function public.aura_studio_milestones(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); r aura_studio.dashboard_pref := aura_studio.prefs(p_workspace, u); today date; cur int; best int;
begin
 if not r.gamification_enabled then return jsonb_build_object('enabled', false, 'milestones', '[]'::jsonb, 'streak', null); end if;
 today := (now() at time zone r.timezone)::date;
 insert into aura_studio.milestone_event(workspace_id,code,achieved_at)
  select p_workspace,'onboarding_complete',activated_at from aura_creator.creator_profile where workspace_id=p_workspace and activated_at is not null
  union all select p_workspace,'first_action_completed',min(status_at) from aura_studio.daily_action where workspace_id=p_workspace and status='completed' having min(status_at) is not null
  union all select p_workspace,'first_observation_recorded',min(created_at) from aura_studio.goal_observation where workspace_id=p_workspace having min(created_at) is not null
  union all select p_workspace,'first_idea_captured',min(created_at) from aura_studio.idea where workspace_id=p_workspace having min(created_at) is not null
  on conflict do nothing;
 with d as (select distinct (status_at at time zone r.timezone)::date as day from aura_studio.daily_action where workspace_id=p_workspace and status='completed'),
  g as (select day, day - (row_number() over (order by day))::int as grp from d),
  runs as (select grp, count(*)::int n, max(day) last_day from g group by grp)
 select coalesce((select n from runs where last_day >= today - 1 order by last_day desc limit 1),0), coalesce(max(n),0) into cur, best from runs;
 return jsonb_build_object('enabled', true, 'streak', jsonb_build_object('current',cur,'longest',best),
  'milestones', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'achieved_at',achieved_at) order by achieved_at),'[]') from aura_studio.milestone_event where workspace_id=p_workspace));
end $$;

create function aura_studio.week_summary(p_workspace uuid, p_user uuid, p_start date, p_tz text) returns jsonb language sql stable set search_path='' as $$
 with b as (select p_start as s, p_start + 6 as e),
 a as (select
        (select count(*) from aura_studio.daily_action d where d.workspace_id=p_workspace and d.local_date between (select s from b) and (select e from b)) as assigned,
        -- completions are counted once, in the week they actually happened, whichever day the action was assigned
        (select count(*) from aura_studio.daily_action d where d.workspace_id=p_workspace and d.status='completed' and (d.status_at at time zone p_tz)::date between (select s from b) and (select e from b)) as completed,
        (select count(*) from aura_studio.daily_action d where d.workspace_id=p_workspace and d.status='skipped' and d.local_date between (select s from b) and (select e from b)) as skipped,
        (select count(*) from aura_studio.daily_action d where d.workspace_id=p_workspace and d.status='deferred' and d.local_date between (select s from b) and (select e from b)) as deferred),
 o as (select count(*) as n from aura_studio.goal_observation where workspace_id=p_workspace and (created_at at time zone p_tz)::date between (select s from b) and (select e from b)),
 i as (select count(*) as n from aura_studio.idea where workspace_id=p_workspace and (created_at at time zone p_tz)::date between (select s from b) and (select e from b)),
 pu as (select count(*) as n from aura_identity.event where user_id=p_user and event like 'creator_section_saved:%' and (at at time zone p_tz)::date between (select s from b) and (select e from b)),
 gs as (select coalesce(jsonb_agg(jsonb_build_object('category',category,'metric',metric,'first',first_v,'last',last_v,'count',n)),'[]') as j from (
   select category, metric, count(*) n, (array_agg(value order by observed_on, created_at))[1] first_v, (array_agg(value order by observed_on desc, created_at desc))[1] last_v
   from aura_studio.goal_observation where workspace_id=p_workspace and (created_at at time zone p_tz)::date between (select s from b) and (select e from b) group by category, metric) q)
 select jsonb_build_object('week_start',p_start,'week_end',p_start+6,
  'actions',jsonb_build_object('assigned',a.assigned,'completed',a.completed,'skipped',a.skipped,'deferred',a.deferred),
  'observations',o.n,'ideas',i.n,'profile_updates',pu.n,'goals_observed',gs.j,
  'evidence_sufficient',(a.completed + o.n + i.n + pu.n) > 0)
 from a,o,i,pu,gs $$;

-- Stable, idempotent weeks (Monday to Sunday in the stored time zone). Only closed weeks are stored; the current week is live.
create function public.aura_studio_weekly(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, true); r aura_studio.dashboard_pref := aura_studio.prefs(p_workspace, u); today date; cur date; first_w date; w date;
begin
 today := (now() at time zone r.timezone)::date; cur := date_trunc('week', today)::date;
 select date_trunc('week', (activated_at at time zone r.timezone)::date)::date into first_w from aura_creator.creator_profile where workspace_id=p_workspace;
 perform pg_advisory_xact_lock(hashtextextended('studio_weekly:'||p_workspace::text, 0));
 for w in select generate_series(greatest(first_w, cur - 84), cur - 7, interval '7 days')::date loop
  if not exists(select 1 from aura_studio.weekly_review where workspace_id=p_workspace and week_start=w) then -- only compute weeks not yet stored
   insert into aura_studio.weekly_review(workspace_id,week_start,summary) values(p_workspace,w,aura_studio.week_summary(p_workspace,u,w,r.timezone)) on conflict do nothing;
  end if;
 end loop;
 return jsonb_build_object('current', aura_studio.week_summary(p_workspace,u,cur,r.timezone),
  'reviews', (select coalesce(jsonb_agg(jsonb_build_object('week_start',week_start,'summary',summary,'generated_at',generated_at) order by week_start desc),'[]') from aura_studio.weekly_review where workspace_id=p_workspace),
  'digest_opt_in', r.digest_opt_in, 'digest_delivery', 'unavailable');
end $$;

-- Search reads only the caller's own records; the workspace is re-authorized here, not in the browser.
create function public.aura_studio_search(p_workspace uuid, p_query text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, false); q text := trim(coalesce(p_query,'')); pat text;
begin
 if length(q) < 2 or length(q) > 60 then raise exception 'Query length' using errcode='22023'; end if;
 pat := '%' || replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_') || '%';
 return coalesce((select jsonb_agg(x) from (
  select * from (
   select jsonb_build_object('type','idea','id',i.id,'title',i.title,'snippet',left(coalesce(i.note,''),120),'href','/creator/create') as x, i.created_at as at
    from aura_studio.idea i where i.workspace_id=p_workspace and (i.title ilike pat or coalesce(i.note,'') ilike pat)
   union all
   select jsonb_build_object('type','action','id',a.id,'title',a.title,'snippet',left(a.detail,120),'href','/creator/actions'), a.created_at
    from aura_studio.daily_action a where a.workspace_id=p_workspace and (a.title ilike pat or a.detail ilike pat)
   union all
   select jsonb_build_object('type','plan','id',g.id,'title',g.title,'snippet',left(g.detail,120),'href','/creator/dashboard'), p.created_at
    from aura_creator.growth_action g join aura_creator.growth_plan p on p.id=g.plan_id where g.workspace_id=p_workspace and (g.title ilike pat or g.detail ilike pat)
   union all
   select jsonb_build_object('type','goal','id',g.id,'title',g.category,'snippet',left(coalesce(g.details,''),120),'href','/creator/progress'), now()
    from aura_creator.goal g where g.workspace_id=p_workspace and coalesce(g.details,'') ilike pat
   union all
   select jsonb_build_object('type','observation','id',o.id,'title',o.category,'snippet',left(coalesce(o.note,''),120),'href','/creator/progress'), o.created_at
    from aura_studio.goal_observation o where o.workspace_id=p_workspace and coalesce(o.note,'') ilike pat
  ) s order by at desc limit 40) t), '[]'::jsonb);
end $$;

-- Real, whitelisted-by-the-app account events for the caller only. There is no unread state, so no count is ever shown.
create function public.aura_studio_events(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_studio.own(p_workspace, false);
begin return (select coalesce(jsonb_agg(jsonb_build_object('event',event,'at',at) order by at desc),'[]') from (select event, at from aura_identity.event where user_id=u order by at desc limit 15) e); end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura\_studio\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop; end $$;
revoke all on all tables in schema aura_studio from public,anon,authenticated;
revoke all on all functions in schema aura_studio from public,anon,authenticated;
commit;
