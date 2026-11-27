-- M18 Creator selection and comparison (reconstructed scope, owner reconciliation pending; see the module file).
-- M11 stays the authoritative record of applications, invitations and negotiations. M18 adds:
--  * 72-hour selection holds: offering a place holds it; it becomes a selection only when the Creator accepts (eligibility re-checked);
--    unanswered holds expire and free the place. Holds count against selection capacity everywhere, including M11's own 'select'.
--  * an applicant inbox with private review notes and tags, bulk shortlisting and rejection, and a side-by-side comparison
--    built only from what each Creator shared (no score, no ranking);
--  * the hand-off from M11 "ready for agreement" to an M12 collaboration workspace (status "Agreement pending").
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_selection;
revoke all on schema aura_selection from public, anon, authenticated;

create table aura_selection.setting (key text primary key, value jsonb not null);
insert into aura_selection.setting(key, value) values ('hold_hours', '72'), ('max_compare', '4'), ('max_bulk', '50');

create table aura_selection.hold (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references aura_apply.application on delete cascade,
 campaign_id uuid not null references aura_market.campaign on delete cascade,
 brand_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 creator_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 status text not null default 'held' check (status in ('held','accepted','declined','expired','released')),
 message text check (length(message) <= 600),
 expires_at timestamptz not null, decided_at timestamptz,
 created_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp()
);
create unique index one_live_hold on aura_selection.hold(application_id) where status = 'held';
create index hold_by_campaign on aura_selection.hold(campaign_id, status);
create table aura_selection.note (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references aura_apply.application on delete cascade,
 brand_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 body text check (length(body) <= 1000), tags text[] not null default '{}' check (cardinality(tags) <= 6),
 author uuid not null references auth.users, created_at timestamptz not null default now()
);
create index note_by_app on aura_selection.note(application_id, created_at);
create table aura_selection.handoff (
 collaboration_id uuid primary key references aura_apply.collaboration on delete cascade,
 workspace_id uuid not null, created_at timestamptz not null default now()
);
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname = 'aura_selection' loop
  execute format('alter table aura_selection.%I enable row level security', t);
  execute format('revoke all on aura_selection.%I from public, anon, authenticated', t);
 end loop;
end $$;

-- ───────── helpers ─────────
create function aura_selection.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_selection.setting where key = p_key $$;
create function aura_selection.capacity(p_campaign uuid) returns integer language sql stable set search_path='' as $$
 select coalesce(r.selection_capacity, nullif((aura_market.content(c.id, c.published_version))->>'positions', '')::int)
 from aura_market.campaign c left join aura_apply.campaign_rules r on r.campaign_id = c.id where c.id = p_campaign $$;
create function aura_selection.taken(p_campaign uuid, p_except_app uuid default null) returns integer language sql stable set search_path='' as $$
 select (select count(*) from aura_apply.application where campaign_id = p_campaign and status in ('selected','converted') and id is distinct from p_except_app)::int
      + (select count(*) from aura_selection.hold where campaign_id = p_campaign and status = 'held' and expires_at > now() and application_id is distinct from p_except_app)::int $$;
-- Expire unanswered holds (evaluated on read; there is no scheduler yet). The place is freed and both sides are told.
create function aura_selection.sweep(p_campaign uuid default null) returns void language plpgsql set search_path='' as $$
declare h aura_selection.hold;
begin
 for h in update aura_selection.hold set status = 'expired', decided_at = now() where status = 'held' and expires_at <= now() and (p_campaign is null or campaign_id = p_campaign) returning * loop
  perform aura_apply.notify(h.creator_workspace_id, 'deadline', 'An offered place expired: ' || aura_apply.campaign_title(h.campaign_id), '/creator/applications/' || h.application_id);
  perform aura_apply.notify(h.brand_workspace_id, 'deadline', 'A 72-hour hold expired without an answer: ' || aura_apply.campaign_title(h.campaign_id), '/brand/applications/' || h.application_id);
  perform aura_apply.log((select collaboration_id from aura_apply.application where id = h.application_id), h.application_id, null, 'system', 'hold_expired', null, null);
 end loop;
end $$;

-- Holds count against selection capacity for every path, including M11's own 'select' (same per-campaign lock).
create function aura_selection.guard_select() returns trigger language plpgsql security definer set search_path='' as $$
declare cap int;
begin
 if new.status = 'selected' and old.status is distinct from 'selected' then
  perform pg_advisory_xact_lock(hashtextextended('apply_capacity:' || new.campaign_id::text, 0));
  cap := aura_selection.capacity(new.campaign_id);
  if cap is not null and aura_selection.taken(new.campaign_id, new.id) >= cap then
   raise exception 'All positions are filled or held' using errcode = '23514';
  end if;
  update aura_selection.hold set status = 'accepted', decided_at = now() where application_id = new.id and status = 'held';
 elsif new.status in ('rejected','withdrawn','expired','cancelled') and old.status is distinct from new.status then
  update aura_selection.hold set status = 'released', decided_at = now() where application_id = new.id and status = 'held';
 end if;
 return new;
end $$;
create trigger m18_guard_select before update of status on aura_apply.application for each row execute function aura_selection.guard_select();

-- ───────── Hand-off to M12 (one project: an agreed M11 proposal opens an M12 collaboration workspace) ─────────
create function aura_selection.on_ready() returns trigger language plpgsql security definer set search_path='' as $$
declare p aura_apply.proposal; camp jsonb; cat text; doc jsonb; dels jsonb := '[]'; d jsonb; i int; q int; mid uuid; t jsonb; money text;
begin
 if new.status <> 'ready_for_agreement' or old.status = 'ready_for_agreement' or new.ready_proposal is null then return new; end if;
 if exists(select 1 from aura_selection.handoff where collaboration_id = new.id) then return new; end if;
 select * into p from aura_apply.proposal where id = new.ready_proposal;
 t := p.terms;
 select aura_market.content(c.id, c.published_version), c.category into camp, cat from aura_market.campaign c where c.id = new.campaign_id;
 for d in select * from jsonb_array_elements(case when jsonb_array_length(coalesce(t->'deliverables', '[]')) > 0 then t->'deliverables' else coalesce(camp->'deliverables', '[]') end) loop
  q := greatest(coalesce((d->>'quantity')::int, 1), 1);
  for i in 1..least(q, 20) loop
   dels := dels || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'title', initcap(coalesce(d->>'type', 'Deliverable')) || case when q > 1 then ' ' || i || ' of ' || q else '' end,
     'format', coalesce(d->>'type', 'content'), 'description', coalesce(d->>'platform', ''), 'due', coalesce(t->>'end_on', ''),
     'stages', '["Concept","Draft","Final","Publication"]'::jsonb, 'stage', 'Concept', 'review', null, 'submissions', '[]'::jsonb));
  end loop;
 end loop;
 if jsonb_array_length(dels) = 0 then return new; end if; -- nothing concrete to deliver: the hand-off waits (M12 requires deliverables)
 money := case when t->'money' is not null then (t->'money'->>'currency') || ' ' || (t->'money'->>'amount') else 'As set out in the campaign' end;
 doc := jsonb_build_object(
  'title', coalesce(camp->>'title', 'Collaboration'), 'brand', (select name from aura_identity.workspace where id = new.brand_workspace_id), 'creator', aura_apply.creator_name(new.creator_workspace_id),
  'category', case cat when 'paid' then 'Paid influencer' when 'ugc' then 'UGC' when 'barter' then 'Barter' when 'event' then 'Event' when 'ambassador' then 'Ambassador' else 'Affiliate' end,
  'status', 'Agreement pending',
  'agreements', jsonb_build_array(jsonb_build_object('version', 1, 'title', 'Agreement from proposal version ' || p.version, 'terms', coalesce(p.note, 'Terms as confirmed by both sides in the negotiation.'),
    'compensation', money, 'rights', coalesce((t->'rights'->>'usage_months') || ' months' || coalesce(' on ' || (select string_agg(x, ', ') from jsonb_array_elements_text(t->'rights'->'channels') x), ''), 'As set out in the campaign'),
    'exclusivity', case when coalesce((t->'rights'->>'exclusivity_days')::int, 0) > 0 then (t->'rights'->>'exclusivity_days') || ' days' else 'None' end,
    'aiPermission', 'Not granted', 'externalUrl', '',
    'templateApproved', false, -- an approved legal template is required before either side can accept (M12 rule; owner decision)
    'acceptances', '[]'::jsonb)),
  'deliverables', dels, 'changes', '[]'::jsonb, 'disputes', '[]'::jsonb, 'messages', '[]'::jsonb,
  'activity', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'action', 'Created from confirmed proposal version ' || p.version, 'side', 'brand', 'actor', 'AURA', 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
  'performance', '[]'::jsonb, 'completion', '[]'::jsonb, 'financialStatus', 'No payments recorded', 'dependencies', '[]'::jsonb);
 mid := aura_collaboration.provision(p.id, new.creator_workspace_id, new.brand_workspace_id, doc);
 insert into aura_selection.handoff(collaboration_id, workspace_id) values (new.id, mid) on conflict do nothing;
 update aura_apply.application set status = 'converted', updated_at = now() where collaboration_id = new.id and status = 'selected';
 perform aura_apply.notify(new.creator_workspace_id, 'proposal', 'Your collaboration workspace is ready (agreement pending)', '/creator/negotiations/' || new.id);
 perform aura_apply.notify(new.brand_workspace_id, 'proposal', 'Collaboration workspace created (agreement pending)', '/brand/negotiations/' || new.id);
 return new;
end $$;
create trigger m18_handoff after update of status on aura_apply.collaboration for each row execute function aura_selection.on_ready();

-- ───────── Brand functions ─────────
create function aura_selection.app_for_brand(p_ws uuid, p_app uuid, p_lock boolean) returns aura_apply.application language plpgsql set search_path='' as $$
declare a aura_apply.application;
begin
 if p_lock then select * into a from aura_apply.application where id = p_app and status <> 'draft' and campaign_id in (select id from aura_market.campaign where workspace_id = p_ws) for update;
 else select * into a from aura_apply.application where id = p_app and status <> 'draft' and campaign_id in (select id from aura_market.campaign where workspace_id = p_ws); end if;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return a;
end $$;

-- Applicant inbox: everything needed to triage, from shared data only.
create function public.aura_selection_inbox(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign); cont jsonb;
begin
 perform aura_selection.sweep(p_campaign);
 cont := aura_market.content(c.id, c.published_version);
 return jsonb_build_object('campaign', jsonb_build_object('id', c.id, 'title', aura_apply.campaign_title(c.id), 'status', c.status, 'category', c.category,
   'money', cont->'compensation'->'money', 'capacity', aura_selection.capacity(c.id), 'taken', aura_selection.taken(c.id), 'hold_hours', aura_selection.setting_int('hold_hours')),
  'applications', (select coalesce(jsonb_agg(x order by x->>'submitted_at'), '[]'::jsonb) from (
   select jsonb_build_object('id', a.id, 'creator', aura_apply.creator_name(a.creator_workspace_id), 'status', a.status, 'submitted_at', a.submitted_at, 'version', a.version,
    'eligible', (aura_market.eligibility(a.creator_workspace_id, c.category, cont)->>'eligible')::boolean,
    'account', aura_apply.shared(a)->'account', 'quote', aura_apply.shared(a)->'quote', 'portfolio_count', jsonb_array_length(coalesce(aura_apply.shared(a)->'portfolio', '[]')),
    'questions_open', (select count(*) from aura_apply.clarification q where q.application_id = a.id and q.answered_at is null),
    'hold', (select jsonb_build_object('id', h.id, 'expires_at', h.expires_at) from aura_selection.hold h where h.application_id = a.id and h.status = 'held' and h.expires_at > now()),
    'tags', (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from aura_selection.note n, unnest(n.tags) t where n.application_id = a.id),
    'notes', (select count(*) from aura_selection.note n where n.application_id = a.id and n.body is not null)) x
   from aura_apply.application a where a.campaign_id = c.id and a.status <> 'draft') q));
end $$;

-- Side by side: 2 to 4 candidates of one campaign, built from each candidate's shared projection. No score, no ordering by a number.
create function public.aura_selection_compare(p_workspace uuid, p_campaign uuid, p_applications uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign); cont jsonb;
begin
 if cardinality(p_applications) not between 2 and aura_selection.setting_int('max_compare') then raise exception 'Choose 2 to 4 candidates' using errcode = '22023'; end if;
 if exists(select 1 from unnest(p_applications) x where not exists(select 1 from aura_apply.application a where a.id = x and a.campaign_id = c.id and a.status <> 'draft')) then raise exception 'Access denied' using errcode = '42501'; end if;
 cont := aura_market.content(c.id, c.published_version);
 perform aura_apply.log(null, null, null, 'brand', 'compared', jsonb_build_object('count', cardinality(p_applications)), u);
 return jsonb_build_object('campaign', jsonb_build_object('title', cont->>'title', 'money', cont->'compensation'->'money', 'deliverables', cont->'deliverables', 'rights', cont->'rights'),
  'candidates', (select jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'shared', aura_apply.shared(a),
    'eligibility', aura_market.eligibility(a.creator_workspace_id, c.category, cont),
    'proposal', (select jsonb_build_object('version', p.version, 'terms', p.terms) from aura_apply.proposal p where p.collaboration_id = a.collaboration_id and p.status = 'open' order by p.version desc limit 1),
    'hold', (select jsonb_build_object('expires_at', h.expires_at) from aura_selection.hold h where h.application_id = a.id and h.status = 'held' and h.expires_at > now()),
    'tags', (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from aura_selection.note n, unnest(n.tags) t where n.application_id = a.id)) order by array_position(p_applications, a.id))
   from aura_apply.application a where a.id = any(p_applications)));
end $$;

-- Offer a place: a 72-hour hold that counts against capacity at once (same lock as every selection path).
create function public.aura_selection_hold(p_workspace uuid, p_application uuid, p_message text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); a aura_apply.application; cap int; h aura_selection.hold;
begin
 a := aura_selection.app_for_brand(p_workspace, p_application, true);
 if a.status not in ('submitted','review','clarification','shortlisted','waitlisted') then raise exception 'This application cannot be offered a place now' using errcode = '55000'; end if;
 if not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
 perform pg_advisory_xact_lock(hashtextextended('apply_capacity:' || a.campaign_id::text, 0));
 perform aura_selection.sweep(a.campaign_id);
 if exists(select 1 from aura_selection.hold where application_id = a.id and status = 'held' and expires_at > now()) then raise exception 'A place is already held for this Creator' using errcode = '23505'; end if;
 cap := aura_selection.capacity(a.campaign_id);
 if cap is not null and aura_selection.taken(a.campaign_id) >= cap then raise exception 'All positions are filled or held' using errcode = '23514'; end if;
 insert into aura_selection.hold(application_id, campaign_id, brand_workspace_id, creator_workspace_id, message, expires_at, created_by)
  values (a.id, a.campaign_id, p_workspace, a.creator_workspace_id, nullif(left(trim(coalesce(p_message, '')), 600), ''), now() + make_interval(hours => aura_selection.setting_int('hold_hours')), u) returning * into h;
 update aura_apply.application set status = case when status in ('submitted','review','clarification','waitlisted') then 'shortlisted' else status end, locked_at = coalesce(locked_at, now()), updated_at = now() where id = a.id;
 perform aura_apply.log(a.collaboration_id, a.id, null, 'brand', 'place_offered', jsonb_build_object('expires_at', h.expires_at), u);
 perform aura_apply.notify(a.creator_workspace_id, 'status', 'You are offered a place (answer within 72 hours; not an agreement): ' || aura_apply.campaign_title(a.campaign_id), '/creator/applications/' || a.id);
 return jsonb_build_object('id', h.id, 'expires_at', h.expires_at);
end $$;
create function public.aura_selection_release(p_workspace uuid, p_application uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); a aura_apply.application := aura_selection.app_for_brand(p_workspace, p_application, true); n int;
begin
 update aura_selection.hold set status = 'released', decided_at = now() where application_id = a.id and status = 'held';
 get diagnostics n = row_count;
 if n = 0 then raise exception 'No place is held' using errcode = '55000'; end if;
 perform aura_apply.log(a.collaboration_id, a.id, null, 'brand', 'place_released', null, u);
 perform aura_apply.notify(a.creator_workspace_id, 'status', 'The offered place was withdrawn: ' || aura_apply.campaign_title(a.campaign_id), '/creator/applications/' || a.id);
 return jsonb_build_object('released', true);
end $$;
create function public.aura_selection_bulk(p_workspace uuid, p_campaign uuid, p_applications uuid[], p_action text, p_feedback text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign); x uuid; done int := 0; skipped int := 0;
begin
 if p_action not in ('review','shortlist','reject') then raise exception 'Invalid action' using errcode = '22023'; end if;
 if cardinality(p_applications) not between 1 and aura_selection.setting_int('max_bulk') then raise exception 'Choose 1 to 50 applications' using errcode = '22023'; end if;
 foreach x in array p_applications loop
  if not exists(select 1 from aura_apply.application a where a.id = x and a.campaign_id = c.id and a.status <> 'draft') then raise exception 'Access denied' using errcode = '42501'; end if;
  begin
   perform public.aura_apply_decide(p_workspace, x, p_action, p_feedback); done := done + 1;
  exception when sqlstate '55000' then skipped := skipped + 1; end;
 end loop;
 return jsonb_build_object('done', done, 'skipped', skipped);
end $$;
-- Private review notes and tags (never shown to Creators or other Brands).
create function public.aura_selection_note(p_workspace uuid, p_application uuid, p_body text, p_tags text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); a aura_apply.application := aura_selection.app_for_brand(p_workspace, p_application, false); n aura_selection.note;
 tags text[] := coalesce(array(select distinct lower(left(trim(t), 24)) from unnest(coalesce(p_tags, '{}')) t where trim(t) <> '' limit 6), '{}');
begin
 if nullif(trim(coalesce(p_body, '')), '') is null and cardinality(tags) = 0 then raise exception 'Write a note or add a tag' using errcode = '22023'; end if;
 insert into aura_selection.note(application_id, brand_workspace_id, body, tags, author) values (a.id, p_workspace, nullif(left(trim(coalesce(p_body, '')), 1000), ''), tags, u) returning * into n;
 return jsonb_build_object('id', n.id);
end $$;
create function public.aura_selection_candidate(p_workspace uuid, p_application uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); a aura_apply.application := aura_selection.app_for_brand(p_workspace, p_application, false);
begin
 perform aura_selection.sweep(a.campaign_id);
 return jsonb_build_object(
  'hold', (select jsonb_build_object('id', h.id, 'status', h.status, 'expires_at', h.expires_at, 'message', h.message) from aura_selection.hold h where h.application_id = a.id order by h.created_at desc limit 1),
  'capacity', aura_selection.capacity(a.campaign_id), 'taken', aura_selection.taken(a.campaign_id),
  'notes', (select coalesce(jsonb_agg(jsonb_build_object('body', n.body, 'tags', to_jsonb(n.tags), 'at', n.created_at, 'author', coalesce((select full_name from aura_identity.profile where user_id = n.author), 'Team member')) order by n.created_at desc), '[]'::jsonb)
     from aura_selection.note n where n.application_id = a.id and n.brand_workspace_id = p_workspace),
  'handoff', (select workspace_id from aura_selection.handoff where collaboration_id = a.collaboration_id));
end $$;

-- ───────── Creator functions ─────────
create function public.aura_selection_offer(p_workspace uuid, p_application uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); a aura_apply.application;
begin
 select * into a from aura_apply.application where id = p_application and creator_workspace_id = p_workspace;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 perform aura_selection.sweep(a.campaign_id);
 return jsonb_build_object('hold', (select jsonb_build_object('id', h.id, 'status', h.status, 'expires_at', h.expires_at, 'message', h.message) from aura_selection.hold h where h.application_id = a.id order by h.created_at desc limit 1),
  'handoff', (select workspace_id from aura_selection.handoff where collaboration_id = a.collaboration_id));
end $$;
-- Accepting re-checks eligibility, then turns the hold into a selection (not an agreement). Declining withdraws the application.
create function public.aura_selection_respond(p_workspace uuid, p_application uuid, p_accept boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_apply.application; h aura_selection.hold; c aura_market.campaign;
begin
 select * into a from aura_apply.application where id = p_application and creator_workspace_id = p_workspace for update;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('apply_capacity:' || a.campaign_id::text, 0));
 perform aura_selection.sweep(a.campaign_id);
 select * into h from aura_selection.hold where application_id = a.id and status = 'held' for update;
 if h.id is null then raise exception 'There is no open offer (it may have expired)' using errcode = '55000'; end if;
 if p_accept then
  select * into c from aura_market.campaign where id = a.campaign_id;
  if not (aura_market.eligibility(p_workspace, c.category, aura_market.content(c.id, c.published_version))->>'eligible')::boolean then
   raise exception 'You no longer meet the mandatory requirements' using errcode = '55000';
  end if;
  update aura_apply.application set status = 'selected', decided_at = now(), updated_at = now() where id = a.id; -- the guard marks the hold accepted
  perform aura_apply.log(a.collaboration_id, a.id, null, 'creator', 'place_accepted', null, u);
  perform aura_apply.notify(h.brand_workspace_id, 'status', 'A Creator accepted the place (not yet an agreement): ' || aura_apply.campaign_title(a.campaign_id), '/brand/applications/' || a.id);
 else
  update aura_selection.hold set status = 'declined', decided_at = now() where id = h.id;
  update aura_apply.application set status = 'withdrawn', updated_at = now() where id = a.id;
  update aura_apply.collaboration set status = 'cancelled', updated_at = now() where id = a.collaboration_id and status <> 'ready_for_agreement';
  perform aura_apply.log(a.collaboration_id, a.id, null, 'creator', 'place_declined', null, u);
  perform aura_apply.notify(h.brand_workspace_id, 'status', 'A Creator declined the offered place: ' || aura_apply.campaign_title(a.campaign_id), '/brand/applications/' || a.id);
 end if;
 return jsonb_build_object('status', case when p_accept then 'selected' else 'withdrawn' end, 'collaboration_id', a.collaboration_id);
end $$;
-- Both sides: the M12 workspace an agreed negotiation handed off to, if any.
create function public.aura_selection_handoff(p_workspace uuid, p_collab uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare s text := aura_apply.side(p_workspace, p_collab, false);
begin return (select workspace_id from aura_selection.handoff where collaboration_id = p_collab); end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_selection\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'aura_selection' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
 end loop;
end $$;
commit;
