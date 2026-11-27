-- M19 Campaign monitoring and reporting (reconstructed scope, owner reconciliation pending; see the module file).
-- One roll-up per campaign that keeps three things apart (R2): delivery (M12 collaboration documents), performance (structured,
-- source-labelled observations per published deliverable) and money (M11 agreed terms and M13 payment reports, labelled as recorded).
-- Totals follow the M06 rule: only the latest cumulative (lifetime) value per deliverable and metric counts, so repeated readings never
-- inflate them (R4). Reach summed across posts is labelled as not unique people; there is no campaign score (R5).
-- Reports are versioned snapshots; Creator-entered figures are used only while the Creator keeps sharing them, and a report that
-- contains figures a Creator later withdrew can no longer be opened or exported (R7).
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_monitor;
revoke all on schema aura_monitor from public, anon, authenticated;

create table aura_monitor.setting (key text primary key, value jsonb not null);
insert into aura_monitor.setting(key, value) values
 ('stale_days', '30'),
 ('metrics', '{
  "views":       {"label":"Views","definition":"Times the content was played or shown, as reported by the platform.","unit":"count"},
  "reach":       {"label":"Reach","definition":"Accounts that saw the post, as reported per post. Added across posts this is NOT a count of unique people.","unit":"count","not_unique":true},
  "impressions": {"label":"Impressions","definition":"Times the content was displayed, including repeat views by the same account.","unit":"count"},
  "likes":       {"label":"Likes","definition":"Likes or reactions on the post.","unit":"count"},
  "comments":    {"label":"Comments","definition":"Comments on the post.","unit":"count"},
  "shares":      {"label":"Shares","definition":"Times the post was shared or sent.","unit":"count"},
  "saves":       {"label":"Saves","definition":"Times the post was saved or bookmarked.","unit":"count"},
  "link_clicks": {"label":"Link clicks","definition":"Clicks on a link in or attached to the post, as reported by the platform.","unit":"count"},
  "conversions": {"label":"Conversions","definition":"Sales or sign-ups the Brand attributes to the post in its own records.","unit":"count"}
 }');

-- Append-only observations; a mistake is voided with a reason and a new observation is recorded.
create table aura_monitor.observation (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references aura_market.campaign on delete cascade,
 collaboration_id uuid not null references aura_apply.collaboration on delete cascade,
 deliverable_id text not null check (length(deliverable_id) between 1 and 64),
 metric text not null, value numeric not null check (value >= 0 and value < 1e13),
 window_kind text not null check (window_kind in ('lifetime','window')), period_start date, period_end date,
 observed_on date not null, source text not null check (source in ('platform_insights','screenshot','platform_export','brand_records','other')),
 source_note text check (length(source_note) <= 300),
 side text not null check (side in ('brand','creator')), entered_by uuid not null references auth.users,
 voided_at timestamptz, void_reason text check (length(void_reason) <= 300),
 created_at timestamptz not null default clock_timestamp(),
 check ((window_kind = 'window') = (period_start is not null and period_end is not null)),
 check (period_end is null or (period_end >= period_start and period_end <= observed_on))
);
create index obs_by_collab on aura_monitor.observation(collaboration_id, deliverable_id, metric, observed_on desc);
-- A Creator decides whether figures they entered may be used in the Brand's reports (default: shared).
create table aura_monitor.consent (
 collaboration_id uuid primary key references aura_apply.collaboration on delete cascade,
 shared boolean not null default true, changed_at timestamptz not null default now(), changed_by uuid references auth.users
);
create table aura_monitor.report (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references aura_market.campaign on delete cascade, brand_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 name text not null check (length(trim(name)) between 3 and 100), version integer not null,
 sections text[] not null check (sections <@ array['delivery','performance','payments','exceptions'] and cardinality(sections) > 0),
 period_start date, period_end date, snapshot jsonb not null, creator_sources uuid[] not null default '{}',
 created_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(),
 unique (campaign_id, name, version), check (period_end is null or period_start is null or period_end >= period_start)
);
create table aura_monitor.report_access (
 id bigint generated always as identity primary key, report_id uuid not null references aura_monitor.report on delete cascade,
 actor uuid not null references auth.users, action text not null check (action in ('view','export_csv','export_pdf')), allowed boolean not null, at timestamptz not null default now()
);
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname = 'aura_monitor' loop
  execute format('alter table aura_monitor.%I enable row level security', t);
  execute format('revoke all on aura_monitor.%I from public, anon, authenticated', t);
 end loop;
end $$;

-- ───────── helpers ─────────
create function aura_monitor.metrics() returns jsonb language sql stable set search_path='' as $$ select value from aura_monitor.setting where key = 'metrics' $$;
create function aura_monitor.as_date(t text) returns date language sql immutable set search_path='' as $$ select case when t ~ '^\d{4}-\d{2}-\d{2}$' then t::date end $$;
create function aura_monitor.shared(p_collab uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce((select shared from aura_monitor.consent where collaboration_id = p_collab), true) $$;
-- The campaign's collaborations that reached M12 (via the M18 hand-off), with their M12 document.
create function aura_monitor.collabs(p_campaign uuid) returns table(collab uuid, m12 uuid, creator uuid, creator_name text, doc jsonb, terms jsonb)
 language sql stable set search_path='' as $$
 select c.id, h.workspace_id, c.creator_workspace_id, aura_apply.creator_name(c.creator_workspace_id), w.document, p.terms
 from aura_apply.collaboration c join aura_selection.handoff h on h.collaboration_id = c.id join aura_collaboration.workspace w on w.id = h.workspace_id
 left join aura_apply.proposal p on p.id = c.ready_proposal where c.campaign_id = p_campaign $$;

-- The roll-up. p_brand_view: true for the Brand (Creator-entered figures only while shared), false for a Creator viewing their own collaboration.
create function aura_monitor.rollup(p_campaign uuid, p_only_collab uuid, p_brand_view boolean, p_from date, p_to date) returns jsonb language plpgsql stable set search_path='' as $$
declare r record; d jsonb; out_delivery jsonb := '[]'; out_perf jsonb := '[]'; exc jsonb := '[]'; pay jsonb := '[]'; totals jsonb := '{}';
 published int := 0; covered int := 0; stale int := aura_monitor.setting_int('stale_days'); m text; latest record; per jsonb; dl jsonb; due date; fdate date; revs int; sources uuid[] := '{}';
begin
 for r in select * from aura_monitor.collabs(p_campaign) where p_only_collab is null or collab = p_only_collab loop
  dl := '[]';
  for d in select * from jsonb_array_elements(coalesce(r.doc->'deliverables', '[]')) loop
   due := aura_monitor.as_date(d->>'due'); fdate := aura_monitor.as_date(d->'fulfilment'->>'date');
   revs := (select count(*) from jsonb_array_elements(coalesce(d->'submissions', '[]')) s where s->'review'->>'decision' = 'Revision requested');
   per := '{}';
   if fdate is not null then
    published := published + 1;
    -- latest lifetime value per metric (M06 rule); windows are listed, never added to totals
    for m in select distinct o.metric from aura_monitor.observation o where o.collaboration_id = r.collab and o.deliverable_id = d->>'id' and o.voided_at is null
              and (not p_brand_view or o.side = 'brand' or aura_monitor.shared(r.collab)) loop
     select o.value, o.observed_on, o.source, o.side, o.window_kind into latest from aura_monitor.observation o
      where o.collaboration_id = r.collab and o.deliverable_id = d->>'id' and o.metric = m and o.window_kind = 'lifetime' and o.voided_at is null
        and (not p_brand_view or o.side = 'brand' or aura_monitor.shared(r.collab)) and (p_to is null or o.observed_on <= p_to)
      order by o.observed_on desc, o.created_at desc limit 1;
     if latest.value is not null then
      per := per || jsonb_build_object(m, jsonb_build_object('value', latest.value, 'observed_on', latest.observed_on, 'source', latest.source, 'side', latest.side, 'stale', latest.observed_on < current_date - stale));
      totals := jsonb_set(totals, array[m], to_jsonb(coalesce((totals->>m)::numeric, 0) + latest.value));
      if latest.side = 'creator' then sources := array_append(sources, r.collab); end if;
     end if;
    end loop;
    if per <> '{}' then covered := covered + 1;
    else exc := exc || jsonb_build_array(jsonb_build_object('kind', 'no_results', 'creator', r.creator_name, 'deliverable', d->>'title', 'detail', 'Published on ' || fdate || ' with no results recorded', 'm12', r.m12)); end if;
    if exists(select 1 from jsonb_each(per) e where (e.value->>'stale')::boolean) then
     exc := exc || jsonb_build_array(jsonb_build_object('kind', 'stale', 'creator', r.creator_name, 'deliverable', d->>'title', 'detail', 'Latest results are more than ' || stale || ' days old', 'm12', r.m12));
    end if;
   elsif due is not null and due < current_date and r.doc->>'status' not in ('Completed','Cancelled') then
    exc := exc || jsonb_build_array(jsonb_build_object('kind', 'overdue', 'creator', r.creator_name, 'deliverable', d->>'title', 'detail', 'Due ' || due || ', not delivered', 'm12', r.m12));
   end if;
   if revs >= 2 then exc := exc || jsonb_build_array(jsonb_build_object('kind', 'revisions', 'creator', r.creator_name, 'deliverable', d->>'title', 'detail', revs || ' revision requests', 'm12', r.m12)); end if;
   dl := dl || jsonb_build_array(jsonb_build_object('id', d->>'id', 'title', d->>'title', 'format', d->>'format', 'stage', d->>'stage', 'review', d->>'review', 'due', d->>'due',
     'overdue', fdate is null and due is not null and due < current_date and r.doc->>'status' not in ('Completed','Cancelled'),
     'published_on', fdate, 'url', d->'fulfilment'->>'url', 'revisions', revs, 'submissions', jsonb_array_length(coalesce(d->'submissions', '[]')), 'results', per,
     'windows', (select coalesce(jsonb_agg(jsonb_build_object('metric', o.metric, 'value', o.value, 'from', o.period_start, 'to', o.period_end, 'source', o.source, 'side', o.side) order by o.period_end desc), '[]'::jsonb)
        from aura_monitor.observation o where o.collaboration_id = r.collab and o.deliverable_id = d->>'id' and o.window_kind = 'window' and o.voided_at is null
          and (not p_brand_view or o.side = 'brand' or aura_monitor.shared(r.collab)) and (p_from is null or o.period_end >= p_from) and (p_to is null or o.period_start <= p_to))));
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce(r.doc->'disputes', '[]')) x where x->>'status' <> 'Resolved') then
   exc := exc || jsonb_build_array(jsonb_build_object('kind', 'dispute', 'creator', r.creator_name, 'deliverable', null, 'detail', 'Open dispute in the collaboration', 'm12', r.m12));
  end if;
  if r.doc->>'status' = 'Agreement pending' then
   exc := exc || jsonb_build_array(jsonb_build_object('kind', 'agreement', 'creator', r.creator_name, 'deliverable', null, 'detail', 'Agreement not yet accepted by both sides', 'm12', r.m12));
  end if;
  out_delivery := out_delivery || jsonb_build_array(jsonb_build_object('collaboration_id', r.collab, 'm12', r.m12, 'creator', r.creator_name, 'status', r.doc->>'status',
    'completed', r.doc->>'status' = 'Completed', 'deliverables', dl, 'open_disputes', (select count(*) from jsonb_array_elements(coalesce(r.doc->'disputes', '[]')) x where x->>'status' <> 'Resolved'),
    'shared', aura_monitor.shared(r.collab),
    'notes', (select coalesce(jsonb_agg(jsonb_build_object('metric', x->>'metric', 'value', x->>'value', 'period', x->>'period', 'source', x->>'source')), '[]'::jsonb) from jsonb_array_elements(coalesce(r.doc->'performance', '[]')) x)));
  -- money, kept separate from delivery and performance (R2, R8)
  pay := pay || jsonb_build_array(jsonb_build_object('collaboration_id', r.collab, 'creator', r.creator_name, 'agreed', r.terms->'money',
    'recorded', (select coalesce(jsonb_agg(jsonb_build_object('currency', x.currency, 'status', x.status, 'amount', trim_scale(x.total))), '[]'::jsonb)
       from (select pr.currency, pr.status, sum(pr.amount) total from aura_commercial.payment_report pr where pr.collaboration_id = r.m12 group by pr.currency, pr.status) x)));
 end loop;
 return jsonb_build_object('delivery', out_delivery, 'payments', pay, 'exceptions', exc, 'totals', totals, 'metrics', aura_monitor.metrics(),
  'coverage', jsonb_build_object('published', published, 'with_results', covered), 'creator_sources', to_jsonb(array(select distinct unnest(sources))),
  'period', jsonb_build_object('from', p_from, 'to', p_to), 'generated_at', now());
end $$;
create function aura_monitor.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_monitor.setting where key = p_key $$;

-- Who may record for a collaboration: the campaign's Brand (owner/admin) or the Creator of that collaboration.
create function aura_monitor.side_of(p_workspace uuid, p_collab uuid, p_write boolean) returns text language plpgsql stable set search_path='' as $$
declare c aura_apply.collaboration;
begin
 select * into c from aura_apply.collaboration where id = p_collab;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if c.brand_workspace_id = p_workspace then perform aura_market.brand(p_workspace, p_write); return 'brand'; end if;
 if c.creator_workspace_id = p_workspace then perform aura_analytics.actor(p_workspace, p_write); return 'creator'; end if;
 raise exception 'Access denied' using errcode = '42501';
end $$;

-- ───────── public functions ─────────
create function public.aura_monitor_overview(p_workspace uuid, p_campaign uuid, p_from date default null, p_to date default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign);
begin
 return aura_monitor.rollup(c.id, null, true, p_from, p_to) || jsonb_build_object('campaign', jsonb_build_object('id', c.id, 'title', aura_apply.campaign_title(c.id), 'status', c.status));
end $$;
create function public.aura_monitor_record(p_workspace uuid, p_collab uuid, p_deliverable text, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s text := aura_monitor.side_of(p_workspace, p_collab, true); u uuid := aura_identity.eligible(); c aura_apply.collaboration; d jsonb; v jsonb := coalesce(p_fields, '{}'); o aura_monitor.observation; obs date;
begin
 select * into c from aura_apply.collaboration where id = p_collab;
 select x into d from aura_monitor.collabs(c.campaign_id) q, jsonb_array_elements(q.doc->'deliverables') x where q.collab = p_collab and x->>'id' = p_deliverable;
 if d is null then raise exception 'Unknown deliverable' using errcode = '22023'; end if;
 if aura_monitor.as_date(d->'fulfilment'->>'date') is null then raise exception 'Record results once the deliverable is published' using errcode = '55000'; end if;
 if not (aura_monitor.metrics() ? (v->>'metric')) then raise exception 'Unknown metric' using errcode = '22023'; end if;
 obs := coalesce(nullif(v->>'observed_on', '')::date, current_date);
 if obs > current_date then raise exception 'A date in the future' using errcode = '22023'; end if;
 if obs < aura_monitor.as_date(d->'fulfilment'->>'date') then raise exception 'Results cannot predate publication' using errcode = '22023'; end if;
 if s = 'creator' and v->>'source' = 'brand_records' then raise exception 'Only the Brand can use its own records as a source' using errcode = '22023'; end if;
 insert into aura_monitor.observation(campaign_id, collaboration_id, deliverable_id, metric, value, window_kind, period_start, period_end, observed_on, source, source_note, side, entered_by)
  values (c.campaign_id, c.id, p_deliverable, v->>'metric', (v->>'value')::numeric, coalesce(v->>'window_kind', 'lifetime'), nullif(v->>'period_start', '')::date, nullif(v->>'period_end', '')::date,
   obs, v->>'source', nullif(left(trim(coalesce(v->>'source_note', '')), 300), ''), s, u) returning * into o;
 perform aura_apply.log(c.id, null, null, s, 'result_recorded', jsonb_build_object('metric', o.metric), u);
 return to_jsonb(o) - 'entered_by';
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
 raise exception 'Invalid value' using errcode = '22023';
end $$;
create function public.aura_monitor_void(p_workspace uuid, p_observation uuid, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o aura_monitor.observation; s text;
begin
 select * into o from aura_monitor.observation where id = p_observation for update;
 if o.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 s := aura_monitor.side_of(p_workspace, o.collaboration_id, true);
 if s <> o.side then raise exception 'Only the side that entered it can void it' using errcode = '42501'; end if;
 if o.voided_at is not null then raise exception 'Already voided' using errcode = '55000'; end if;
 if length(coalesce(trim(p_reason), '')) < 3 then raise exception 'Give a reason' using errcode = '22023'; end if;
 update aura_monitor.observation set voided_at = now(), void_reason = trim(p_reason) where id = o.id;
 return jsonb_build_object('voided', true);
end $$;
-- Observation log for one collaboration (either side), with who entered what.
create function public.aura_monitor_observations(p_workspace uuid, p_collab uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s text := aura_monitor.side_of(p_workspace, p_collab, false);
begin
 return (select coalesce(jsonb_agg(to_jsonb(o) - 'entered_by' || jsonb_build_object('mine', o.side = s) order by o.observed_on desc, o.created_at desc), '[]'::jsonb)
  from aura_monitor.observation o where o.collaboration_id = p_collab and (s = 'creator' or o.side = 'brand' or aura_monitor.shared(p_collab)));
end $$;
-- A Creator's own collaboration: their deliverables and figures (both sides), and whether they share their figures with the Brand.
create function public.aura_monitor_creator(p_workspace uuid, p_collab uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s text := aura_monitor.side_of(p_workspace, p_collab, false); c aura_apply.collaboration;
begin
 if s <> 'creator' then raise exception 'Access denied' using errcode = '42501'; end if;
 select * into c from aura_apply.collaboration where id = p_collab;
 return aura_monitor.rollup(c.campaign_id, c.id, false, null, null) || jsonb_build_object('shared', aura_monitor.shared(c.id), 'observations', public.aura_monitor_observations(p_workspace, p_collab));
end $$;
create function public.aura_monitor_consent(p_workspace uuid, p_collab uuid, p_shared boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare s text := aura_monitor.side_of(p_workspace, p_collab, true); u uuid := aura_identity.eligible(); c aura_apply.collaboration;
begin
 if s <> 'creator' then raise exception 'Only the Creator decides' using errcode = '42501'; end if;
 insert into aura_monitor.consent(collaboration_id, shared, changed_at, changed_by) values (p_collab, p_shared, now(), u)
  on conflict (collaboration_id) do update set shared = excluded.shared, changed_at = now(), changed_by = u;
 select * into c from aura_apply.collaboration where id = p_collab;
 perform aura_apply.notify(c.brand_workspace_id, 'change', case when p_shared then 'A Creator shared their results again: ' else 'A Creator stopped sharing their own results: ' end || aura_apply.campaign_title(c.campaign_id), '/brand/campaigns/' || c.campaign_id || '/monitor');
 return jsonb_build_object('shared', p_shared);
end $$;

-- Reports: versioned snapshots of the roll-up (R7).
create function public.aura_monitor_create_report(p_workspace uuid, p_campaign uuid, p_name text, p_sections text[], p_from date, p_to date) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign); snap jsonb; v int; r aura_monitor.report;
begin
 if length(coalesce(trim(p_name), '')) not between 3 and 100 then raise exception 'Name the report (3 to 100 characters)' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('report:' || c.id::text || lower(trim(p_name)), 0));
 snap := aura_monitor.rollup(c.id, null, true, p_from, p_to) || jsonb_build_object('campaign', jsonb_build_object('title', aura_apply.campaign_title(c.id), 'category', c.category));
 select coalesce(max(version), 0) + 1 into v from aura_monitor.report where campaign_id = c.id and lower(name) = lower(trim(p_name));
 insert into aura_monitor.report(campaign_id, brand_workspace_id, name, version, sections, period_start, period_end, snapshot, creator_sources, created_by)
  values (c.id, p_workspace, trim(p_name), v, p_sections, p_from, p_to, snap, coalesce(array(select jsonb_array_elements_text(snap->'creator_sources'))::uuid[], '{}'), u) returning * into r;
 perform aura_market.audit(u, 'monitor_report_created');
 return jsonb_build_object('id', r.id, 'version', r.version);
end $$;
create function public.aura_monitor_reports(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign);
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'version', r.version, 'sections', to_jsonb(r.sections), 'from', r.period_start, 'to', r.period_end, 'created_at', r.created_at,
   'author', coalesce((select full_name from aura_identity.profile where user_id = r.created_by), 'Team member'),
   'withdrawn', exists(select 1 from unnest(r.creator_sources) x where not aura_monitor.shared(x))) order by r.created_at desc), '[]'::jsonb)
  from aura_monitor.report r where r.campaign_id = c.id);
end $$;
-- Opening or exporting re-checks permissions every time; figures a Creator withdrew block the old snapshot (R7 check 4).
create function public.aura_monitor_report(p_workspace uuid, p_report uuid, p_action text default 'view') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); r aura_monitor.report; blocked boolean;
begin
 if p_action not in ('view','export_csv','export_pdf') then raise exception 'Invalid action' using errcode = '22023'; end if;
 select * into r from aura_monitor.report where id = p_report and brand_workspace_id = p_workspace;
 if r.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 blocked := exists(select 1 from unnest(r.creator_sources) x where not aura_monitor.shared(x));
 insert into aura_monitor.report_access(report_id, actor, action, allowed) values (r.id, u, p_action, not blocked);
 -- refusal is returned, not raised, so the refused attempt stays in the access log
 if blocked then return jsonb_build_object('id', r.id, 'blocked', true, 'reason', 'A Creator withdrew permission for figures in this report. Create a new version.'); end if;
 return jsonb_build_object('id', r.id, 'blocked', false, 'name', r.name, 'version', r.version, 'sections', to_jsonb(r.sections), 'from', r.period_start, 'to', r.period_end, 'created_at', r.created_at, 'snapshot', r.snapshot);
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_monitor\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'aura_monitor' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
 end loop;
end $$;
commit;
