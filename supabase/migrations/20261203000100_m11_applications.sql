-- M11 Applications, invitations, enquiries and negotiation.
-- From an M10 campaign to "ready for agreement" (M12). Nothing here is ever a binding agreement (M11-F31).
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_apply;
revoke all on schema aura_apply from public, anon, authenticated;

create table aura_apply.setting (key text primary key, value jsonb not null);
insert into aura_apply.setting(key, value) values
 ('applications_per_day', '20'),          -- NON-PRODUCTION defaults, owner approval pending
 ('invitations_per_day', '50'),
 ('enquiries_per_day', '30'),
 ('messages_per_hour', '30'),
 ('invitation_days', '14'),
 ('proposal_days', '7'),
 ('clarification_days', '5'),
 ('max_questions', '10'),
 ('max_answer_length', '1000');
create function aura_apply.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_apply.setting where key = p_key $$;

-- Per-campaign application rules set by the Brand.
create table aura_apply.campaign_rules (
 campaign_id uuid primary key references aura_market.campaign on delete cascade,
 quick_apply boolean not null default false, reapply boolean not null default false,
 submission_capacity integer check (submission_capacity between 1 and 100000), selection_capacity integer check (selection_capacity between 1 and 10000),
 negotiable boolean not null default false, updated_at timestamptz not null default now()
);
create table aura_apply.question (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references aura_market.campaign on delete cascade,
 position integer not null, prompt text not null check (length(trim(prompt)) between 5 and 300), required boolean not null default false,
 kind text not null default 'text' check (kind in ('text','yes_no','choice')), choices text[] not null default '{}' check (cardinality(choices) <= 10),
 max_length integer not null default 500 check (max_length between 20 and 1000)
);
-- A prospective collaboration links every journey (application, invitation, enquiry) between one Brand and one Creator for one campaign (F32).
create table aura_apply.collaboration (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references aura_market.campaign on delete cascade,
 brand_workspace_id uuid not null references aura_identity.workspace on delete cascade, creator_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 status text not null default 'prospective' check (status in ('prospective','negotiating','ready_for_agreement','cancelled')),
 ready_proposal uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_live_collaboration on aura_apply.collaboration(campaign_id, creator_workspace_id) where status <> 'cancelled';
create table aura_apply.application (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references aura_market.campaign on delete cascade,
 creator_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 status text not null default 'draft' check (status in ('draft','submitted','review','clarification','shortlisted','waitlisted','selected','rejected','withdrawn','expired','cancelled','converted')),
 version integer not null default 1, campaign_version integer, submitted_at timestamptz, locked_at timestamptz, decided_at timestamptz,
 feedback text check (length(feedback) <= 1000), previous_application uuid references aura_apply.application on delete set null,
 collaboration_id uuid references aura_apply.collaboration on delete set null, created_by uuid not null references auth.users,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), request_id uuid not null,
 unique (creator_workspace_id, request_id)
);
-- F04 / AC02: one active (or draft) application per Creator per campaign, enforced by the database.
create unique index one_active_application on aura_apply.application(campaign_id, creator_workspace_id) where status not in ('rejected','withdrawn','expired','cancelled');
create table aura_apply.application_version (
 application_id uuid not null references aura_apply.application on delete cascade, version integer not null, content jsonb not null,
 submitted boolean not null default false, created_at timestamptz not null default now(), primary key (application_id, version)
);
create table aura_apply.event (
 id bigint generated always as identity primary key, collaboration_id uuid references aura_apply.collaboration on delete cascade,
 application_id uuid references aura_apply.application on delete cascade, invitation_id uuid, side text not null check (side in ('creator','brand','system','reviewer')),
 event text not null, detail jsonb, at timestamptz not null default now(), actor uuid references auth.users
);
create index event_by_app on aura_apply.event(application_id, at);
create table aura_apply.clarification (
 id uuid primary key default gen_random_uuid(), application_id uuid references aura_apply.application on delete cascade, invitation_id uuid,
 asked_by text not null check (asked_by in ('creator','brand')), question text not null check (length(trim(question)) between 5 and 1000),
 answer text check (length(answer) <= 2000), due_at timestamptz not null, answered_at timestamptz, created_at timestamptz not null default now(),
 check ((application_id is null) <> (invitation_id is null))
);
create table aura_apply.invitation (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references aura_market.campaign on delete cascade,
 brand_workspace_id uuid not null references aura_identity.workspace on delete cascade, creator_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 message text not null check (length(trim(message)) between 10 and 2000), status text not null default 'sent' check (status in ('sent','interested','declined','expired','withdrawn')),
 expires_at timestamptz not null, responded_at timestamptz, decline_reason text check (length(decline_reason) <= 500),
 collaboration_id uuid references aura_apply.collaboration on delete set null, created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create unique index one_open_invitation on aura_apply.invitation(campaign_id, creator_workspace_id) where status in ('sent','interested');
create table aura_apply.enquiry (
 id uuid primary key default gen_random_uuid(), brand_workspace_id uuid not null references aura_identity.workspace on delete cascade,
 creator_workspace_id uuid not null references aura_identity.workspace on delete cascade, campaign_id uuid references aura_market.campaign on delete set null,
 message text not null check (length(trim(message)) between 10 and 2000), status text not null default 'sent' check (status in ('sent','interested','declined')),
 reply text check (length(reply) <= 1000), responded_at timestamptz, created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table aura_apply.proposal (
 id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references aura_apply.collaboration on delete cascade, version integer not null,
 side text not null check (side in ('creator','brand')), terms jsonb not null, note text check (length(note) <= 1000),
 status text not null default 'open' check (status in ('open','superseded','expired','withdrawn')), expires_at timestamptz not null,
 created_by uuid not null references auth.users, created_at timestamptz not null default now(), unique (collaboration_id, version)
);
create table aura_apply.confirmation (proposal_id uuid not null references aura_apply.proposal on delete cascade, side text not null check (side in ('creator','brand')), confirmed_by uuid not null references auth.users, confirmed_at timestamptz not null default now(), primary key (proposal_id, side));
create table aura_apply.message (
 id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references aura_apply.collaboration on delete cascade,
 side text not null check (side in ('creator','brand')), author uuid not null references auth.users, body text not null check (length(trim(body)) between 1 and 2000), created_at timestamptz not null default now()
);
create table aura_apply.block (creator_workspace_id uuid not null references aura_identity.workspace on delete cascade, brand_workspace_id uuid not null references aura_identity.workspace on delete cascade, created_at timestamptz not null default now(), primary key (creator_workspace_id, brand_workspace_id));
create table aura_apply.report (
 id uuid primary key default gen_random_uuid(), target_kind text not null check (target_kind in ('invitation','enquiry','message')), target_id uuid not null,
 reporter_workspace_id uuid not null references aura_identity.workspace on delete cascade, reporter uuid not null references auth.users,
 reason text not null check (reason in ('harassment','unpaid_custom_work','fee_requested','misleading','spam','other')), details text check (length(details) <= 1000),
 status text not null default 'open' check (status in ('open','actioned','dismissed')), decision_reason text, decided_by uuid references auth.users, decided_at timestamptz, created_at timestamptz not null default now()
);
create unique index one_open_apply_report on aura_apply.report(target_kind, target_id, reporter_workspace_id) where status = 'open';
create table aura_apply.notification (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 kind text not null check (kind in ('application','status','clarification','invitation','enquiry','proposal','message','deadline','change')),
 title text not null, link text check (link ~ '^/(creator|brand)/[a-z0-9/_-]*$'), created_at timestamptz not null default now(), read_at timestamptz
);
create index apply_notification_by_ws on aura_apply.notification(workspace_id, created_at desc);

do $$ declare t text; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'aura_apply' and c.relkind = 'r' loop
  execute format('alter table aura_apply.%I enable row level security', t);
 end loop; end $$;

-- ───────── helpers ─────────
create function aura_apply.audit(p_user uuid, p_event text) returns void language sql set search_path='' as $$ insert into aura_identity.event(user_id, event) values (p_user, p_event) $$;
create function aura_apply.notify(p_ws uuid, p_kind text, p_title text, p_link text) returns void language sql set search_path='' as $$ insert into aura_apply.notification(workspace_id, kind, title, link) values (p_ws, p_kind, left(p_title, 200), p_link) $$;
create function aura_apply.log(p_collab uuid, p_app uuid, p_inv uuid, p_side text, p_event text, p_detail jsonb, p_actor uuid) returns void language sql set search_path='' as $$
 insert into aura_apply.event(collaboration_id, application_id, invitation_id, side, event, detail, actor) values (p_collab, p_app, p_inv, p_side, p_event, p_detail, p_actor) $$;
create function aura_apply.campaign_title(p_campaign uuid) returns text language sql stable set search_path='' as $$
 select (aura_market.content(c.id, coalesce(c.published_version, c.draft_version)))->>'title' from aura_market.campaign c where c.id = p_campaign $$;
create function aura_apply.creator_name(p_ws uuid) returns text language sql stable set search_path='' as $$ select coalesce((select display_name from aura_creator.creator_profile where workspace_id = p_ws), 'A creator') $$;
create function aura_apply.rate(p_ws uuid, p_count bigint, p_key text) returns void language plpgsql stable set search_path='' as $$
begin if p_count >= aura_apply.setting_int(p_key) then raise exception 'Rate limit reached' using errcode = '54000'; end if; end $$;
-- The live collaboration between a Brand and a Creator for a campaign: created once, reused by every journey (F32).
create function aura_apply.collab(p_campaign uuid, p_creator uuid) returns uuid language plpgsql set search_path='' as $$
declare v_id uuid; v_brand uuid;
begin
 select c.workspace_id into v_brand from aura_market.campaign c where c.id = p_campaign;
 perform pg_advisory_xact_lock(hashtextextended('collab:' || p_campaign::text || p_creator::text, 0));
 select c.id into v_id from aura_apply.collaboration c where c.campaign_id = p_campaign and c.creator_workspace_id = p_creator and c.status <> 'cancelled';
 if v_id is null then insert into aura_apply.collaboration(campaign_id, brand_workspace_id, creator_workspace_id) values (p_campaign, v_brand, p_creator) returning collaboration.id into v_id; end if;
 return v_id;
end $$;
-- Which side of a collaboration the caller is on, enforcing membership (creator owner, or brand owner/admin).
create function aura_apply.side(p_ws uuid, p_collab uuid, p_write boolean) returns text language plpgsql stable set search_path='' as $$
declare c aura_apply.collaboration;
begin
 select * into c from aura_apply.collaboration where id = p_collab;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_ws = c.creator_workspace_id then perform aura_analytics.actor(p_ws, p_write); return 'creator'; end if;
 if p_ws = c.brand_workspace_id then perform aura_market.brand(p_ws, p_write); return 'brand'; end if;
 raise exception 'Access denied' using errcode = '42501';
end $$;
-- What a Brand may see about an applicant: only what the Creator attached (F33).
create function aura_apply.shared(a aura_apply.application) returns jsonb language plpgsql stable set search_path='' as $$
declare v jsonb := (select content from aura_apply.application_version where application_id = a.id and version = a.version); acc jsonb; kit jsonb;
begin
 select jsonb_build_object('platform', s.platform, 'handle', s.handle, 'ownership', case when s.verification = 'verified' then 'verified' else 'not verified' end,
   'followers', case when s.self_reported_followers is not null then jsonb_build_object('value', s.self_reported_followers, 'observed_on', s.observed_on, 'source', 'self-reported') end)
  into acc from aura_creator.social_account s where s.id = nullif(v->>'account_id', '')::uuid and s.workspace_id = a.creator_workspace_id and s.lifecycle in ('active','disconnected');
 if nullif(v->>'kit_id', '') is not null and exists(select 1 from aura_profile.media_kit k where k.id = (v->>'kit_id')::uuid and k.workspace_id = a.creator_workspace_id) then
  kit := aura_profile.kit_content((v->>'kit_id')::uuid, true, coalesce((v->>'kit_rates')::boolean, false));
 end if;
 return jsonb_build_object('creator', aura_apply.creator_name(a.creator_workspace_id), 'pitch', v->>'pitch', 'answers', coalesce(v->'answers', '{}'), 'quote', v->'quote', 'account', acc,
  'portfolio', (select coalesce(jsonb_agg(aura_profile.portfolio_json(i, true)), '[]'::jsonb) from aura_profile.portfolio_item i
     where i.workspace_id = a.creator_workspace_id and i.visibility in ('public','restricted') and i.id = any(coalesce(array(select jsonb_array_elements_text(v->'portfolio_ids'))::uuid[], '{}'))),
  'kit', kit);
end $$;
-- Expiry is evaluated when data is read (no scheduler yet).
create function aura_apply.sweep(p_ws uuid) returns void language plpgsql set search_path='' as $$
begin
 update aura_apply.invitation set status = 'expired' where status = 'sent' and expires_at <= now() and (creator_workspace_id = p_ws or brand_workspace_id = p_ws);
 update aura_apply.proposal p set status = 'expired' from aura_apply.collaboration c where c.id = p.collaboration_id and p.status = 'open' and p.expires_at <= now() and (c.creator_workspace_id = p_ws or c.brand_workspace_id = p_ws);
end $$;

-- ───────── Brand: application rules and screening (F02, F05, F36) ─────────
create function public.aura_apply_set_rules(p_workspace uuid, p_campaign uuid, p_rules jsonb, p_questions jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign, true); q jsonb; i int := 0; ptxt text;
begin
 if p_questions is not null then
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > aura_apply.setting_int('max_questions') then raise exception 'Too many questions' using errcode = '22023'; end if;
  if exists(select 1 from aura_apply.application a where a.campaign_id = c.id and a.status <> 'draft') then raise exception 'Questions cannot change once Creators have applied' using errcode = '55000'; end if;
  for q in select * from jsonb_array_elements(p_questions) loop
   ptxt := lower(coalesce(q->>'prompt', ''));
   -- F36: screening may ask about the Creator and existing work, never for new unpaid custom content
   if ptxt ~ '(create|film|shoot|make|produce|record|design|edit)\s+(a|an|one|two|three|some)?\s*(new\s+|sample\s+|test\s+|custom\s+)?(video|reel|post|story|stories|content|photo|ad|clip|short)s?\s+(for|about|of)\s+(us|our)' then raise exception 'Screening cannot ask for new unpaid content' using errcode = '22023'; end if;
  end loop;
  delete from aura_apply.question where campaign_id = c.id;
  for q in select * from jsonb_array_elements(p_questions) loop
   i := i + 1;
   insert into aura_apply.question(campaign_id, position, prompt, required, kind, choices, max_length) values (c.id, i, trim(q->>'prompt'), coalesce((q->>'required')::boolean, false), coalesce(q->>'kind', 'text'),
    coalesce(array(select jsonb_array_elements_text(q->'choices')), '{}'), least(coalesce((q->>'max_length')::int, 500), aura_apply.setting_int('max_answer_length')));
  end loop;
 end if;
 insert into aura_apply.campaign_rules(campaign_id, quick_apply, reapply, submission_capacity, selection_capacity, negotiable) values (c.id, coalesce((p_rules->>'quick_apply')::boolean, false), coalesce((p_rules->>'reapply')::boolean, false),
   nullif(p_rules->>'submission_capacity', '')::int, nullif(p_rules->>'selection_capacity', '')::int, coalesce((p_rules->>'negotiable')::boolean, false))
  on conflict (campaign_id) do update set quick_apply = excluded.quick_apply, reapply = excluded.reapply, submission_capacity = excluded.submission_capacity, selection_capacity = excluded.selection_capacity, negotiable = excluded.negotiable, updated_at = now();
 perform aura_apply.audit(u, 'apply_rules_saved');
 return public.aura_apply_rules(p_workspace, p_campaign);
end $$;
create function public.aura_apply_rules(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign);
begin
 return jsonb_build_object('rules', (select to_jsonb(r) - 'campaign_id' from aura_apply.campaign_rules r where r.campaign_id = c.id),
  'questions', (select coalesce(jsonb_agg(to_jsonb(q) - 'campaign_id' order by q.position), '[]'::jsonb) from aura_apply.question q where q.campaign_id = c.id),
  'locked', exists(select 1 from aura_apply.application a where a.campaign_id = c.id and a.status <> 'draft'));
end $$;

-- ───────── Creator: applying (F01–F06, F09, F12, AC01–AC03) ─────────
create function public.aura_apply_form(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); d jsonb := public.aura_market_campaign(p_workspace, p_campaign); a aura_apply.application;
begin
 select * into a from aura_apply.application where campaign_id = p_campaign and creator_workspace_id = p_workspace and status not in ('rejected','withdrawn','expired','cancelled');
 return jsonb_build_object('campaign', d, 'rules', coalesce((select to_jsonb(r) - 'campaign_id' from aura_apply.campaign_rules r where r.campaign_id = p_campaign), jsonb_build_object('quick_apply', false, 'reapply', false, 'negotiable', false)),
  'questions', (select coalesce(jsonb_agg(to_jsonb(q) - 'campaign_id' order by q.position), '[]'::jsonb) from aura_apply.question q where q.campaign_id = p_campaign),
  'application', case when a.id is not null then to_jsonb(a) - 'created_by' - 'request_id' || jsonb_build_object('content', (select content from aura_apply.application_version where application_id = a.id and version = a.version)) end,
  'previous', (select jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status, 'submitted_at', x.submitted_at)) from aura_apply.application x where x.campaign_id = p_campaign and x.creator_workspace_id = p_workspace and x.status in ('rejected','withdrawn','expired','cancelled')),
  'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'platform', s.platform, 'handle', s.handle, 'verification', s.verification, 'followers', s.self_reported_followers) order by s.is_primary desc), '[]'::jsonb) from aura_creator.social_account s where s.workspace_id = p_workspace and s.lifecycle = 'active'),
  'portfolio', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'kind', i.kind, 'visibility', i.visibility) order by i.featured desc, i.position), '[]'::jsonb) from aura_profile.portfolio_item i where i.workspace_id = p_workspace and i.visibility in ('public','restricted')),
  'kits', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name) order by k.updated_at desc), '[]'::jsonb) from aura_profile.media_kit k where k.workspace_id = p_workspace));
end $$;
create function aura_apply.clean(p_ws uuid, p_campaign uuid, v jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare q aura_apply.question; ans jsonb := '{}'; a text; out jsonb; acc uuid := nullif(v->>'account_id', '')::uuid; kit uuid := nullif(v->>'kit_id', '')::uuid; ids uuid[];
begin
 if length(coalesce(v->>'pitch', '')) > 3000 then raise exception 'Pitch too long' using errcode = '22023'; end if;
 if acc is not null and not exists(select 1 from aura_creator.social_account where id = acc and workspace_id = p_ws) then raise exception 'Access denied' using errcode = '42501'; end if;
 if kit is not null and not exists(select 1 from aura_profile.media_kit where id = kit and workspace_id = p_ws) then raise exception 'Access denied' using errcode = '42501'; end if;
 ids := coalesce(array(select jsonb_array_elements_text(coalesce(v->'portfolio_ids', '[]')))::uuid[], '{}');
 if cardinality(ids) > 12 or exists(select 1 from unnest(ids) x where not exists(select 1 from aura_profile.portfolio_item i where i.id = x and i.workspace_id = p_ws and i.visibility in ('public','restricted'))) then raise exception 'Invalid portfolio selection' using errcode = '22023'; end if;
 for q in select * from aura_apply.question where campaign_id = p_campaign order by position loop
  a := trim(coalesce(v->'answers'->>q.id::text, ''));
  if length(a) > q.max_length then raise exception 'Answer too long' using errcode = '22023'; end if;
  if q.kind = 'yes_no' and a not in ('', 'yes', 'no') then raise exception 'Invalid answer' using errcode = '22023'; end if;
  if q.kind = 'choice' and a <> '' and not (a = any(q.choices)) then raise exception 'Invalid answer' using errcode = '22023'; end if;
  if a <> '' then ans := ans || jsonb_build_object(q.id::text, a); end if;
 end loop;
 out := jsonb_build_object('pitch', nullif(trim(coalesce(v->>'pitch', '')), ''), 'account_id', acc, 'portfolio_ids', to_jsonb(ids), 'kit_id', kit, 'kit_rates', coalesce((v->>'kit_rates')::boolean, false), 'answers', ans);
 if v ? 'quote' and jsonb_typeof(v->'quote') = 'object' and coalesce((v->'quote'->>'amount')::numeric, 0) > 0 then out := out || jsonb_build_object('quote', jsonb_build_object('currency', coalesce(v->'quote'->>'currency', 'INR'), 'amount', (v->'quote'->>'amount')::numeric, 'note', left(v->'quote'->>'note', 300))); end if;
 return out;
end $$;
create function public.aura_apply_save_draft(p_workspace uuid, p_request uuid, p_campaign uuid, p_content jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_apply.application; cnt jsonb; prev uuid;
begin
 perform public.aura_market_campaign(p_workspace, p_campaign); -- must be visible to you
 cnt := aura_apply.clean(p_workspace, p_campaign, coalesce(p_content, '{}'));
 perform pg_advisory_xact_lock(hashtextextended('apply:' || p_campaign::text || p_workspace::text, 0));
 select * into a from aura_apply.application where campaign_id = p_campaign and creator_workspace_id = p_workspace and status not in ('rejected','withdrawn','expired','cancelled');
 if a.id is not null and a.status <> 'draft' then raise exception 'You already have an active application' using errcode = '23505'; end if;
 if a.id is null then
  select x.id into prev from aura_apply.application x where x.campaign_id = p_campaign and x.creator_workspace_id = p_workspace order by x.created_at desc limit 1;
  insert into aura_apply.application(campaign_id, creator_workspace_id, created_by, request_id, previous_application) values (p_campaign, p_workspace, u, p_request, prev) returning * into a;
  insert into aura_apply.application_version(application_id, version, content) values (a.id, 1, cnt);
 else update aura_apply.application_version set content = cnt, created_at = now() where application_id = a.id and version = a.version; update aura_apply.application set updated_at = now() where id = a.id; end if;
 return jsonb_build_object('id', a.id, 'status', 'draft', 'saved_at', now());
end $$;
create function public.aura_apply_delete_draft(p_workspace uuid, p_application uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 delete from aura_apply.application where id = p_application and creator_workspace_id = p_workspace and status = 'draft';
 if not found then raise exception 'Access denied' using errcode = '42501'; end if;
 return jsonb_build_object('deleted', p_application);
end $$;
create function public.aura_apply_submit(p_workspace uuid, p_application uuid, p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_apply.application; chk jsonb; r aura_apply.campaign_rules; v jsonb; q aura_apply.question; prev aura_apply.application; n int; cid uuid; brand uuid;
begin
 if p_confirm is not true then raise exception 'Confirm the application before sending' using errcode = '22023'; end if; -- F09
 select * into a from aura_apply.application where id = p_application and creator_workspace_id = p_workspace for update;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if a.status <> 'draft' then raise exception 'Already submitted' using errcode = '55000'; end if;
 perform aura_apply.rate(p_workspace, (select count(*) from aura_apply.application where creator_workspace_id = p_workspace and submitted_at > now() - interval '1 day'), 'applications_per_day');
 chk := public.aura_market_check_apply(p_workspace, a.campaign_id); -- M10-F16: re-validated at the moment of applying
 if not (chk->>'eligible')::boolean then raise exception 'Not eligible' using errcode = '55000'; end if;
 select * into r from aura_apply.campaign_rules where campaign_id = a.campaign_id;
 v := (select content from aura_apply.application_version where application_id = a.id and version = a.version);
 -- AC01: every required field, whatever the apply mode
 if not coalesce(r.quick_apply, false) and length(coalesce(v->>'pitch', '')) < 50 then raise exception 'Pitch required' using errcode = '22023'; end if;
 if nullif(v->>'account_id', '') is null then raise exception 'Choose the account you are applying with' using errcode = '22023'; end if;
 for q in select * from aura_apply.question where campaign_id = a.campaign_id and required loop
  if coalesce(v->'answers'->>q.id::text, '') = '' then raise exception 'Answer every required question' using errcode = '22023'; end if;
 end loop;
 -- F12: reapplication only when the campaign allows it, or once after your own withdrawal
 if a.previous_application is not null then
  select * into prev from aura_apply.application where id = a.previous_application;
  if not coalesce(r.reapply, false) and not (prev.status = 'withdrawn' and prev.previous_application is null) then raise exception 'Reapplication is not allowed for this campaign' using errcode = '55000'; end if;
 end if;
 -- F29 / AC07: submission capacity, serialized per campaign
 perform pg_advisory_xact_lock(hashtextextended('apply_capacity:' || a.campaign_id::text, 0));
 if r.submission_capacity is not null then
  select count(*) into n from aura_apply.application where campaign_id = a.campaign_id and status not in ('draft','withdrawn','cancelled','expired');
  if n >= r.submission_capacity then raise exception 'This campaign is not accepting more applications' using errcode = '23514'; end if;
 end if;
 cid := aura_apply.collab(a.campaign_id, p_workspace);
 update aura_apply.application set status = 'submitted', submitted_at = now(), campaign_version = (chk->>'version')::int, collaboration_id = cid, updated_at = now() where id = a.id;
 update aura_apply.application_version set submitted = true where application_id = a.id and version = a.version;
 select workspace_id into brand from aura_market.campaign where id = a.campaign_id;
 perform aura_apply.log(cid, a.id, null, 'creator', 'submitted', jsonb_build_object('version', a.version), u);
 perform aura_apply.notify(brand, 'application', 'New application: ' || aura_apply.campaign_title(a.campaign_id), '/brand/applications/' || a.id);
 perform aura_apply.audit(u, 'apply_submitted');
 return jsonb_build_object('id', a.id, 'status', 'submitted');
end $$;
-- F10 / AC03: a submitted application can be edited until the Brand starts reviewing; each edit is a new version and the Brand is told.
create function public.aura_apply_edit(p_workspace uuid, p_application uuid, p_content jsonb, p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_apply.application; cnt jsonb; brand uuid;
begin
 if p_confirm is not true then raise exception 'Confirm the change before sending' using errcode = '22023'; end if;
 select * into a from aura_apply.application where id = p_application and creator_workspace_id = p_workspace for update;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if a.status <> 'submitted' or a.locked_at is not null then raise exception 'This application is locked for review' using errcode = '55000'; end if;
 cnt := aura_apply.clean(p_workspace, a.campaign_id, coalesce(p_content, '{}'));
 insert into aura_apply.application_version(application_id, version, content, submitted) values (a.id, a.version + 1, cnt, true);
 update aura_apply.application set version = version + 1, updated_at = now() where id = a.id;
 select workspace_id into brand from aura_market.campaign where id = a.campaign_id;
 perform aura_apply.log(a.collaboration_id, a.id, null, 'creator', 'edited', jsonb_build_object('version', a.version + 1), u);
 perform aura_apply.notify(brand, 'change', 'An application was updated: ' || aura_apply.campaign_title(a.campaign_id), '/brand/applications/' || a.id);
 return jsonb_build_object('id', a.id, 'version', a.version + 1);
end $$;
-- F11: withdraw before any binding agreement, explicitly confirmed; the Brand is told.
create function public.aura_apply_withdraw(p_workspace uuid, p_application uuid, p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); a aura_apply.application; brand uuid;
begin
 if p_confirm is not true then raise exception 'Confirm the withdrawal' using errcode = '22023'; end if;
 select * into a from aura_apply.application where id = p_application and creator_workspace_id = p_workspace for update;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if a.status in ('draft','rejected','withdrawn','expired','cancelled','converted') then raise exception 'This application cannot be withdrawn' using errcode = '55000'; end if;
 update aura_apply.application set status = 'withdrawn', decided_at = now(), updated_at = now() where id = a.id;
 update aura_apply.collaboration set status = 'cancelled', updated_at = now() where id = a.collaboration_id and status <> 'ready_for_agreement'
  and not exists(select 1 from aura_apply.invitation i where i.collaboration_id = a.collaboration_id and i.status = 'interested');
 select workspace_id into brand from aura_market.campaign where id = a.campaign_id;
 perform aura_apply.log(a.collaboration_id, a.id, null, 'creator', 'withdrawn', null, u);
 perform aura_apply.notify(brand, 'status', 'An applicant withdrew: ' || aura_apply.campaign_title(a.campaign_id), '/brand/applications/' || a.id);
 return jsonb_build_object('id', a.id, 'status', 'withdrawn');
end $$;
create function public.aura_apply_answer(p_workspace uuid, p_clarification uuid, p_answer text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); c aura_apply.clarification; a aura_apply.application; brand uuid;
begin
 select * into c from aura_apply.clarification where id = p_clarification for update;
 select * into a from aura_apply.application where id = c.application_id and creator_workspace_id = p_workspace;
 if c.id is null or a.id is null or c.asked_by <> 'brand' then raise exception 'Access denied' using errcode = '42501'; end if;
 if c.answered_at is not null then raise exception 'Already answered' using errcode = '55000'; end if;
 if length(coalesce(trim(p_answer), '')) < 1 then raise exception 'Write an answer' using errcode = '22023'; end if;
 update aura_apply.clarification set answer = left(trim(p_answer), 2000), answered_at = now() where id = c.id;
 update aura_apply.application set status = 'review', updated_at = now() where id = a.id and status = 'clarification' and not exists(select 1 from aura_apply.clarification x where x.application_id = a.id and x.answered_at is null and x.id <> c.id);
 select workspace_id into brand from aura_market.campaign where id = a.campaign_id;
 perform aura_apply.log(a.collaboration_id, a.id, null, 'creator', 'clarification_answered', null, u);
 perform aura_apply.notify(brand, 'clarification', 'Clarification answered: ' || aura_apply.campaign_title(a.campaign_id), '/brand/applications/' || a.id);
 return jsonb_build_object('answered', c.id);
end $$;

-- ───────── Brand: review and selection (F13, F14, F15, F28, F29, F31) ─────────
create function aura_apply.brand_app(p_ws uuid, p_app uuid, p_lock boolean) returns aura_apply.application language plpgsql set search_path='' as $$
declare a aura_apply.application;
begin
 if p_lock then select x.* into a from aura_apply.application x join aura_market.campaign c on c.id = x.campaign_id where x.id = p_app and c.workspace_id = p_ws and x.status <> 'draft' for update of x;
 else select x.* into a from aura_apply.application x join aura_market.campaign c on c.id = x.campaign_id where x.id = p_app and c.workspace_id = p_ws and x.status <> 'draft'; end if;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if; -- drafts are never visible to a Brand
 return a;
end $$;
create function public.aura_apply_campaign_applications(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign);
begin
 return jsonb_build_object('campaign', jsonb_build_object('id', c.id, 'title', aura_apply.campaign_title(c.id), 'status', c.status),
  'rules', (select to_jsonb(r) - 'campaign_id' from aura_apply.campaign_rules r where r.campaign_id = c.id),
  'selected', (select count(*) from aura_apply.application where campaign_id = c.id and status in ('selected','converted')),
  'applications', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'creator', aura_apply.creator_name(a.creator_workspace_id), 'status', a.status, 'version', a.version, 'submitted_at', a.submitted_at, 'locked', a.locked_at is not null) order by a.submitted_at), '[]'::jsonb)
   from aura_apply.application a where a.campaign_id = c.id and a.status <> 'draft'));
end $$;
create function public.aura_apply_brand_application(p_workspace uuid, p_application uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); a aura_apply.application := aura_apply.brand_app(p_workspace, p_application, false);
begin
 return jsonb_build_object('id', a.id, 'campaign_id', a.campaign_id, 'campaign', aura_apply.campaign_title(a.campaign_id), 'status', a.status, 'version', a.version, 'submitted_at', a.submitted_at, 'locked', a.locked_at is not null, 'feedback', a.feedback, 'collaboration_id', a.collaboration_id,
  'shared', aura_apply.shared(a),
  'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt) order by q.position), '[]'::jsonb) from aura_apply.question q where q.campaign_id = a.campaign_id),
  'versions', (select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'created_at', v.created_at) order by v.version), '[]'::jsonb) from aura_apply.application_version v where v.application_id = a.id and v.submitted),
  'clarifications', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'question', c.question, 'answer', c.answer, 'due_at', c.due_at, 'answered_at', c.answered_at) order by c.created_at), '[]'::jsonb) from aura_apply.clarification c where c.application_id = a.id),
  'history', (select coalesce(jsonb_agg(jsonb_build_object('event', e.event, 'side', e.side, 'at', e.at) order by e.at), '[]'::jsonb) from aura_apply.event e where e.application_id = a.id));
end $$;
create function public.aura_apply_decide(p_workspace uuid, p_application uuid, p_action text, p_feedback text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); a aura_apply.application; cap int; n int; next text; title text;
begin
 a := aura_apply.brand_app(p_workspace, p_application, true);
 if a.status in ('withdrawn','rejected','expired','cancelled','converted') then raise exception 'This application is closed' using errcode = '55000'; end if;
 next := case p_action when 'review' then 'review' when 'shortlist' then 'shortlisted' when 'waitlist' then 'waitlisted' when 'select' then 'selected' when 'reject' then 'rejected' end;
 if next is null then raise exception 'Invalid action' using errcode = '22023'; end if;
 if next = 'selected' then
  -- F29 / AC07: selection capacity is separate from submissions and is serialized per campaign
  perform pg_advisory_xact_lock(hashtextextended('apply_capacity:' || a.campaign_id::text, 0));
  select coalesce(r.selection_capacity, nullif((aura_market.content(c.id, c.published_version))->>'positions', '')::int) into cap from aura_market.campaign c left join aura_apply.campaign_rules r on r.campaign_id = c.id where c.id = a.campaign_id;
  select count(*) into n from aura_apply.application where campaign_id = a.campaign_id and status in ('selected','converted');
  if cap is not null and n >= cap then raise exception 'All positions are filled' using errcode = '23514'; end if;
 end if;
 update aura_apply.application set status = next, locked_at = coalesce(locked_at, now()), decided_at = case when next in ('selected','rejected') then now() else decided_at end,
  feedback = case when next = 'rejected' then nullif(left(trim(coalesce(p_feedback, '')), 1000), '') else feedback end, updated_at = now() where id = a.id;
 if next = 'rejected' then update aura_apply.collaboration set status = 'cancelled', updated_at = now() where id = a.collaboration_id and status <> 'ready_for_agreement'; end if;
 title := aura_apply.campaign_title(a.campaign_id);
 perform aura_apply.log(a.collaboration_id, a.id, null, 'brand', next, case when p_feedback is not null then jsonb_build_object('feedback', true) end, u);
 perform aura_apply.notify(a.creator_workspace_id, 'status', case next when 'review' then 'Your application is being reviewed: ' when 'shortlisted' then 'You were shortlisted: ' when 'waitlisted' then 'You are on the waitlist (not a guarantee): ' when 'selected' then 'You were selected (not yet an agreement): ' else 'Not selected this time: ' end || title, '/creator/applications/' || a.id);
 perform aura_apply.audit(u, 'apply_' || next);
 return jsonb_build_object('id', a.id, 'status', next);
end $$;
create function public.aura_apply_ask(p_workspace uuid, p_application uuid, p_question text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); a aura_apply.application := aura_apply.brand_app(p_workspace, p_application, true); c aura_apply.clarification;
begin
 if a.status not in ('submitted','review','clarification','shortlisted','waitlisted') then raise exception 'Not possible now' using errcode = '55000'; end if;
 insert into aura_apply.clarification(application_id, asked_by, question, due_at) values (a.id, 'brand', trim(p_question), now() + make_interval(days => aura_apply.setting_int('clarification_days'))) returning * into c;
 update aura_apply.application set status = 'clarification', locked_at = coalesce(locked_at, now()), updated_at = now() where id = a.id;
 perform aura_apply.log(a.collaboration_id, a.id, null, 'brand', 'clarification_requested', null, u);
 perform aura_apply.notify(a.creator_workspace_id, 'clarification', 'The Brand asked a question: ' || aura_apply.campaign_title(a.campaign_id), '/creator/applications/' || a.id);
 return jsonb_build_object('id', c.id, 'due_at', c.due_at);
end $$;

-- ───────── Invitations and enquiries (F16–F20, M14-F34/F35) ─────────
create function public.aura_apply_invite(p_workspace uuid, p_campaign uuid, p_creator uuid, p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign); i aura_apply.invitation; e jsonb;
begin
 if not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
 if c.status <> 'published' then raise exception 'Only a live campaign can be used for an invitation' using errcode = '55000'; end if;
 if not exists(select 1 from aura_identity.workspace w where w.id = p_creator and w.kind = 'creator' and w.status = 'open') then raise exception 'Invalid creator' using errcode = '22023'; end if;
 if exists(select 1 from aura_apply.block b where b.creator_workspace_id = p_creator and b.brand_workspace_id = p_workspace) then raise exception 'This Creator is not accepting invitations from you' using errcode = '42501'; end if;
 -- F16: invitations are for genuine campaigns the Creator is eligible for
 e := aura_market.eligibility(p_creator, c.category, aura_market.content(c.id, c.published_version));
 if not (e->>'eligible')::boolean then raise exception 'The Creator does not meet the campaign requirements' using errcode = '55000'; end if;
 perform aura_apply.rate(p_workspace, (select count(*) from aura_apply.invitation where brand_workspace_id = p_workspace and created_at > now() - interval '1 day'), 'invitations_per_day');
 insert into aura_apply.invitation(campaign_id, brand_workspace_id, creator_workspace_id, message, expires_at, created_by) values (c.id, p_workspace, p_creator, trim(p_message), now() + make_interval(days => aura_apply.setting_int('invitation_days')), u) returning * into i;
 insert into aura_market.invite(campaign_id, creator_workspace_id) values (c.id, p_creator) on conflict do nothing; -- lets an invitation-only campaign become visible to them
 perform aura_apply.log(null, null, i.id, 'brand', 'invited', null, u);
 perform aura_apply.notify(p_creator, 'invitation', 'Invitation from ' || (select name from aura_identity.workspace where id = p_workspace) || ': ' || aura_apply.campaign_title(c.id), '/creator/invitations/' || i.id);
 perform aura_apply.audit(u, 'apply_invitation_sent');
 return jsonb_build_object('id', i.id, 'expires_at', i.expires_at);
exception when unique_violation then raise exception 'An invitation is already open' using errcode = '23505';
end $$;
create function public.aura_apply_respond_invitation(p_workspace uuid, p_invitation uuid, p_action text, p_text text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); i aura_apply.invitation; cid uuid;
begin
 perform aura_apply.sweep(p_workspace);
 select * into i from aura_apply.invitation where id = p_invitation and creator_workspace_id = p_workspace for update;
 if i.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if i.status = 'expired' then raise exception 'This invitation has expired' using errcode = '55000'; end if;
 if p_action = 'interested' then
  if i.status <> 'sent' then raise exception 'Already answered' using errcode = '55000'; end if;
  cid := aura_apply.collab(i.campaign_id, p_workspace); -- F31: interest is not an agreement
  update aura_apply.invitation set status = 'interested', responded_at = now(), collaboration_id = cid where id = i.id;
  perform aura_apply.notify(i.brand_workspace_id, 'invitation', 'A Creator is interested: ' || aura_apply.campaign_title(i.campaign_id), '/brand/negotiations/' || cid);
 elsif p_action = 'decline' then
  if i.status not in ('sent','interested') then raise exception 'Already answered' using errcode = '55000'; end if;
  update aura_apply.invitation set status = 'declined', responded_at = now(), decline_reason = nullif(left(trim(coalesce(p_text, '')), 500), '') where id = i.id;
  perform aura_apply.notify(i.brand_workspace_id, 'invitation', 'Invitation declined: ' || aura_apply.campaign_title(i.campaign_id), '/brand/campaigns/' || i.campaign_id);
 elsif p_action = 'clarify' then
  if length(coalesce(trim(p_text), '')) < 5 then raise exception 'Write your question' using errcode = '22023'; end if;
  insert into aura_apply.clarification(invitation_id, asked_by, question, due_at) values (i.id, 'creator', trim(p_text), now() + make_interval(days => aura_apply.setting_int('clarification_days')));
  perform aura_apply.notify(i.brand_workspace_id, 'clarification', 'A Creator asked about your invitation: ' || aura_apply.campaign_title(i.campaign_id), '/brand/campaigns/' || i.campaign_id);
 else raise exception 'Invalid action' using errcode = '22023'; end if;
 perform aura_apply.log(cid, null, i.id, 'creator', 'invitation_' || p_action, null, u);
 return jsonb_build_object('id', i.id, 'action', p_action, 'collaboration_id', cid);
end $$;
create function public.aura_apply_enquire(p_workspace uuid, p_creator uuid, p_campaign uuid, p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); e aura_apply.enquiry;
begin
 if not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if; -- M14-F35
 if not exists(select 1 from aura_identity.workspace w where w.id = p_creator and w.kind = 'creator' and w.status = 'open') then raise exception 'Invalid creator' using errcode = '22023'; end if;
 if exists(select 1 from aura_apply.block b where b.creator_workspace_id = p_creator and b.brand_workspace_id = p_workspace) then raise exception 'This Creator is not accepting enquiries from you' using errcode = '42501'; end if;
 if p_campaign is not null then perform aura_market.own(p_workspace, p_campaign); end if;
 perform aura_apply.rate(p_workspace, (select count(*) from aura_apply.enquiry where brand_workspace_id = p_workspace and created_at > now() - interval '1 day'), 'enquiries_per_day');
 insert into aura_apply.enquiry(brand_workspace_id, creator_workspace_id, campaign_id, message, created_by) values (p_workspace, p_creator, p_campaign, trim(p_message), u) returning * into e;
 perform aura_apply.notify(p_creator, 'enquiry', 'Preliminary enquiry from ' || (select name from aura_identity.workspace where id = p_workspace) || ' (not an invitation)', '/creator/enquiries/' || e.id);
 perform aura_apply.audit(u, 'apply_enquiry_sent');
 return jsonb_build_object('id', e.id);
end $$;
create function public.aura_apply_respond_enquiry(p_workspace uuid, p_enquiry uuid, p_action text, p_reply text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); e aura_apply.enquiry;
begin
 select * into e from aura_apply.enquiry where id = p_enquiry and creator_workspace_id = p_workspace for update;
 if e.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if e.status <> 'sent' then raise exception 'Already answered' using errcode = '55000'; end if;
 if p_action not in ('interested','declined') then raise exception 'Invalid action' using errcode = '22023'; end if;
 update aura_apply.enquiry set status = p_action, reply = nullif(left(trim(coalesce(p_reply, '')), 1000), ''), responded_at = now() where id = e.id;
 perform aura_apply.notify(e.brand_workspace_id, 'enquiry', 'A Creator replied to your enquiry', '/brand/campaigns');
 return jsonb_build_object('id', e.id, 'status', p_action);
end $$;
create function public.aura_apply_block(p_workspace uuid, p_brand uuid, p_on boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 if not exists(select 1 from aura_identity.workspace where id = p_brand and kind = 'brand') then raise exception 'Invalid brand' using errcode = '22023'; end if;
 if p_on then insert into aura_apply.block(creator_workspace_id, brand_workspace_id) values (p_workspace, p_brand) on conflict do nothing;
 else delete from aura_apply.block where creator_workspace_id = p_workspace and brand_workspace_id = p_brand; end if;
 perform aura_apply.audit(u, case when p_on then 'apply_brand_blocked' else 'apply_brand_unblocked' end);
 return jsonb_build_object('blocked', p_on);
end $$;
create function public.aura_apply_report(p_workspace uuid, p_kind text, p_target uuid, p_reason text, p_details text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); ok boolean; r aura_apply.report;
begin
 ok := case p_kind when 'invitation' then exists(select 1 from aura_apply.invitation where id = p_target and creator_workspace_id = p_workspace)
  when 'enquiry' then exists(select 1 from aura_apply.enquiry where id = p_target and creator_workspace_id = p_workspace)
  when 'message' then exists(select 1 from aura_apply.message m join aura_apply.collaboration c on c.id = m.collaboration_id where m.id = p_target and c.creator_workspace_id = p_workspace and m.side = 'brand') else false end;
 if not ok then raise exception 'Access denied' using errcode = '42501'; end if;
 insert into aura_apply.report(target_kind, target_id, reporter_workspace_id, reporter, reason, details) values (p_kind, p_target, p_workspace, u, p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), '')) returning * into r;
 perform aura_apply.audit(u, 'apply_report_created');
 return jsonb_build_object('id', r.id);
exception when unique_violation then raise exception 'Already reported' using errcode = '23505';
end $$;

-- ───────── Negotiation (F22–F27, AC05) ─────────
create function aura_apply.valid_terms(t jsonb) returns void language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(t) <> 'object' or length(t::text) > 6000 then raise exception 'Invalid terms' using errcode = '22023'; end if;
 if t->'money' is not null and (coalesce((t->'money'->>'amount')::numeric, -1) < 0 or coalesce(t->'money'->>'currency', '') !~ '^[A-Z]{3}$') then raise exception 'Invalid money terms' using errcode = '22023'; end if;
 if jsonb_typeof(coalesce(t->'deliverables', '[]')) <> 'array' or jsonb_array_length(coalesce(t->'deliverables', '[]')) > 20 then raise exception 'Invalid deliverables' using errcode = '22023'; end if;
 if coalesce((t->>'revisions')::int, 0) not between 0 and 20 then raise exception 'Invalid revisions' using errcode = '22023'; end if;
 if coalesce((t->'rights'->>'exclusivity_days')::int, 0) not between 0 and 365 then raise exception 'Invalid exclusivity' using errcode = '22023'; end if;
 if t->>'start_on' is not null and t->>'end_on' is not null and (t->>'end_on')::date < (t->>'start_on')::date then raise exception 'Invalid timing' using errcode = '22023'; end if;
end $$;
create function public.aura_apply_propose(p_workspace uuid, p_collab uuid, p_terms jsonb, p_note text, p_valid_days integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s text := aura_apply.side(p_workspace, p_collab, true); u uuid := aura_identity.eligible(); c aura_apply.collaboration; n int; p aura_apply.proposal; other uuid; days int := coalesce(p_valid_days, aura_apply.setting_int('proposal_days'));
begin
 select * into c from aura_apply.collaboration where id = p_collab for update;
 if c.status not in ('prospective','negotiating') then raise exception 'This collaboration is not open for negotiation' using errcode = '55000'; end if;
 if s = 'brand' and not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
 if days not between 1 and 30 then raise exception 'Invalid validity' using errcode = '22023'; end if;
 perform aura_apply.valid_terms(p_terms);
 -- a new proposal supersedes every open one: confirmations always refer to the exact current version (AC05)
 update aura_apply.proposal set status = 'superseded' where collaboration_id = c.id and status = 'open';
 select coalesce(max(version), 0) + 1 into n from aura_apply.proposal where collaboration_id = c.id;
 insert into aura_apply.proposal(collaboration_id, version, side, terms, note, expires_at, created_by) values (c.id, n, s, p_terms, nullif(left(trim(coalesce(p_note, '')), 1000), ''), now() + make_interval(days => days), u) returning * into p;
 update aura_apply.collaboration set status = 'negotiating', updated_at = now() where id = c.id;
 other := case when s = 'creator' then c.brand_workspace_id else c.creator_workspace_id end;
 perform aura_apply.log(c.id, null, null, s, 'proposal', jsonb_build_object('version', n), u);
 perform aura_apply.notify(other, 'proposal', 'New proposal (version ' || n || '): ' || aura_apply.campaign_title(c.campaign_id), case when s = 'creator' then '/brand/negotiations/' else '/creator/negotiations/' end || c.id);
 return jsonb_build_object('id', p.id, 'version', n, 'expires_at', p.expires_at);
end $$;
create function public.aura_apply_confirm(p_workspace uuid, p_collab uuid, p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s text := aura_apply.side(p_workspace, p_collab, true); u uuid := aura_identity.eligible(); c aura_apply.collaboration; p aura_apply.proposal; both_ok boolean; other uuid;
begin
 perform aura_apply.sweep(p_workspace);
 select * into c from aura_apply.collaboration where id = p_collab for update;
 if c.status <> 'negotiating' then raise exception 'Nothing to confirm' using errcode = '55000'; end if;
 select * into p from aura_apply.proposal where collaboration_id = c.id and status = 'open' order by version desc limit 1;
 -- AC05: only the exact current, unexpired version can be confirmed
 if p.id is null or p.version <> p_version then raise exception 'That proposal is no longer current' using errcode = '40001'; end if;
 if s = 'brand' and not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
 insert into aura_apply.confirmation(proposal_id, side, confirmed_by) values (p.id, s, u) on conflict do nothing;
 both_ok := (select count(*) from aura_apply.confirmation where proposal_id = p.id) = 2;
 other := case when s = 'creator' then c.brand_workspace_id else c.creator_workspace_id end;
 if both_ok then
  -- re-validate the Creator before agreement preparation (M10-F16); M12 prepares the agreement
  if not (aura_market.eligibility(c.creator_workspace_id, (select category from aura_market.campaign where id = c.campaign_id), aura_market.content(c.campaign_id, (select published_version from aura_market.campaign where id = c.campaign_id)))->>'eligible')::boolean then
   raise exception 'The Creator no longer meets the campaign requirements' using errcode = '55000'; end if;
  update aura_apply.collaboration set status = 'ready_for_agreement', ready_proposal = p.id, updated_at = now() where id = c.id;
  perform aura_apply.notify(c.creator_workspace_id, 'proposal', 'Both sides confirmed version ' || p.version || '. Ready for an agreement (not yet binding).', '/creator/negotiations/' || c.id);
  perform aura_apply.notify(c.brand_workspace_id, 'proposal', 'Both sides confirmed version ' || p.version || '. Ready for an agreement (not yet binding).', '/brand/negotiations/' || c.id);
 else
  perform aura_apply.notify(other, 'proposal', 'The other side confirmed version ' || p.version || ': ' || aura_apply.campaign_title(c.campaign_id), case when s = 'creator' then '/brand/negotiations/' else '/creator/negotiations/' end || c.id);
 end if;
 perform aura_apply.log(c.id, null, null, s, 'confirmed', jsonb_build_object('version', p.version), u);
 return jsonb_build_object('version', p.version, 'both_confirmed', both_ok, 'status', case when both_ok then 'ready_for_agreement' else 'negotiating' end);
end $$;
create function public.aura_apply_message(p_workspace uuid, p_collab uuid, p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s text := aura_apply.side(p_workspace, p_collab, true); u uuid := aura_identity.eligible(); c aura_apply.collaboration; m aura_apply.message;
begin
 select * into c from aura_apply.collaboration where id = p_collab;
 if c.status = 'cancelled' then raise exception 'This collaboration is closed' using errcode = '55000'; end if;
 if s = 'brand' and not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
 perform aura_apply.rate(p_workspace, (select count(*) from aura_apply.message where collaboration_id = c.id and side = s and created_at > now() - interval '1 hour'), 'messages_per_hour');
 insert into aura_apply.message(collaboration_id, side, author, body) values (c.id, s, u, trim(p_body)) returning * into m;
 perform aura_apply.notify(case when s = 'creator' then c.brand_workspace_id else c.creator_workspace_id end, 'message', 'New message: ' || aura_apply.campaign_title(c.campaign_id), case when s = 'creator' then '/brand/negotiations/' else '/creator/negotiations/' end || c.id);
 return jsonb_build_object('id', m.id);
end $$;
create function public.aura_apply_negotiation(p_workspace uuid, p_collab uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s text := aura_apply.side(p_workspace, p_collab, false); c aura_apply.collaboration; cur aura_apply.proposal;
begin
 perform aura_apply.sweep(p_workspace);
 select * into c from aura_apply.collaboration where id = p_collab;
 select * into cur from aura_apply.proposal where collaboration_id = c.id and status = 'open' order by version desc limit 1;
 return jsonb_build_object('id', c.id, 'side', s, 'status', c.status, 'campaign_id', c.campaign_id, 'campaign', aura_apply.campaign_title(c.campaign_id),
  'brand', (select name from aura_identity.workspace where id = c.brand_workspace_id), 'creator', aura_apply.creator_name(c.creator_workspace_id),
  'campaign_terms', (select jsonb_build_object('compensation', v->'compensation', 'deliverables', v->'deliverables', 'rights', v->'rights') from (select aura_market.content(x.id, x.published_version) v from aura_market.campaign x where x.id = c.campaign_id) q),
  'negotiable', coalesce((select negotiable from aura_apply.campaign_rules where campaign_id = c.campaign_id), false),
  'current', case when cur.id is not null then jsonb_build_object('version', cur.version, 'side', cur.side, 'terms', cur.terms, 'note', cur.note, 'expires_at', cur.expires_at,
     'confirmed_by', (select coalesce(jsonb_agg(f.side), '[]'::jsonb) from aura_apply.confirmation f where f.proposal_id = cur.id)) end,
  'proposals', (select coalesce(jsonb_agg(jsonb_build_object('version', p.version, 'side', p.side, 'status', p.status, 'terms', p.terms, 'note', p.note, 'created_at', p.created_at, 'expires_at', p.expires_at,
     'confirmed_by', (select coalesce(jsonb_agg(f.side), '[]'::jsonb) from aura_apply.confirmation f where f.proposal_id = p.id)) order by p.version desc), '[]'::jsonb) from aura_apply.proposal p where p.collaboration_id = c.id),
  'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'side', m.side, 'body', m.body, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb) from aura_apply.message m where m.collaboration_id = c.id),
  -- F30: warn about overlapping dates with the Creator's other live negotiations; never reject automatically
  'conflicts', case when s = 'creator' and cur.terms ? 'start_on' and cur.terms ? 'end_on' then (select coalesce(jsonb_agg(jsonb_build_object('campaign', aura_apply.campaign_title(o.campaign_id), 'start_on', op.terms->>'start_on', 'end_on', op.terms->>'end_on')), '[]'::jsonb)
     from aura_apply.collaboration o join aura_apply.proposal op on op.collaboration_id = o.id and op.status = 'open' where o.creator_workspace_id = c.creator_workspace_id and o.id <> c.id and o.status in ('negotiating','ready_for_agreement')
      and op.terms ? 'start_on' and op.terms ? 'end_on' and (op.terms->>'start_on')::date <= (cur.terms->>'end_on')::date and (op.terms->>'end_on')::date >= (cur.terms->>'start_on')::date) else '[]'::jsonb end);
end $$;

-- ───────── Overviews and notifications ─────────
create function public.aura_apply_creator(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 perform aura_apply.sweep(p_workspace);
 return jsonb_build_object(
  'applications', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'campaign_id', a.campaign_id, 'campaign', aura_apply.campaign_title(a.campaign_id), 'status', a.status, 'version', a.version, 'submitted_at', a.submitted_at, 'updated_at', a.updated_at, 'locked', a.locked_at is not null,
     'pending', (select count(*) from aura_apply.clarification c where c.application_id = a.id and c.answered_at is null), 'collaboration_id', a.collaboration_id) order by a.updated_at desc), '[]'::jsonb) from aura_apply.application a where a.creator_workspace_id = p_workspace),
  'invitations', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'campaign_id', i.campaign_id, 'campaign', aura_apply.campaign_title(i.campaign_id), 'brand', w.name, 'brand_id', w.id, 'status', i.status, 'expires_at', i.expires_at, 'created_at', i.created_at, 'collaboration_id', i.collaboration_id) order by i.created_at desc), '[]'::jsonb)
     from aura_apply.invitation i join aura_identity.workspace w on w.id = i.brand_workspace_id where i.creator_workspace_id = p_workspace),
  'enquiries', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'brand', w.name, 'brand_id', w.id, 'status', e.status, 'created_at', e.created_at, 'campaign', case when e.campaign_id is not null then aura_apply.campaign_title(e.campaign_id) end) order by e.created_at desc), '[]'::jsonb)
     from aura_apply.enquiry e join aura_identity.workspace w on w.id = e.brand_workspace_id where e.creator_workspace_id = p_workspace),
  'negotiations', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'campaign', aura_apply.campaign_title(c.campaign_id), 'brand', w.name, 'status', c.status, 'updated_at', c.updated_at) order by c.updated_at desc), '[]'::jsonb)
     from aura_apply.collaboration c join aura_identity.workspace w on w.id = c.brand_workspace_id where c.creator_workspace_id = p_workspace and c.status <> 'cancelled' and (c.status <> 'prospective' or exists(select 1 from aura_apply.invitation i where i.collaboration_id = c.id and i.status = 'interested') or exists(select 1 from aura_apply.application a where a.collaboration_id = c.id and a.status in ('shortlisted','selected')))),
  'blocked', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name)), '[]'::jsonb) from aura_apply.block b join aura_identity.workspace w on w.id = b.brand_workspace_id where b.creator_workspace_id = p_workspace),
  'notifications', (select coalesce(jsonb_agg(to_jsonb(n) - 'workspace_id' order by n.created_at desc), '[]'::jsonb) from (select * from aura_apply.notification where workspace_id = p_workspace order by created_at desc limit 50) n));
end $$;
create function public.aura_apply_application(p_workspace uuid, p_application uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); a aura_apply.application; r aura_apply.campaign_rules;
begin
 select * into a from aura_apply.application where id = p_application and creator_workspace_id = p_workspace;
 if a.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 select * into r from aura_apply.campaign_rules where campaign_id = a.campaign_id;
 return to_jsonb(a) - 'created_by' - 'request_id' || jsonb_build_object('campaign', aura_apply.campaign_title(a.campaign_id),
  'content', (select content from aura_apply.application_version where application_id = a.id and version = a.version), 'shared_preview', aura_apply.shared(a),
  'versions', (select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'created_at', v.created_at, 'submitted', v.submitted) order by v.version), '[]'::jsonb) from aura_apply.application_version v where v.application_id = a.id),
  'clarifications', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'question', c.question, 'answer', c.answer, 'due_at', c.due_at, 'answered_at', c.answered_at) order by c.created_at), '[]'::jsonb) from aura_apply.clarification c where c.application_id = a.id),
  'history', (select coalesce(jsonb_agg(jsonb_build_object('event', e.event, 'side', e.side, 'at', e.at) order by e.at), '[]'::jsonb) from aura_apply.event e where e.application_id = a.id),
  'can_reapply', a.status in ('withdrawn','rejected','expired') and (coalesce(r.reapply, false) or (a.status = 'withdrawn' and a.previous_application is null))
    and not exists(select 1 from aura_apply.application x where x.campaign_id = a.campaign_id and x.creator_workspace_id = p_workspace and x.status not in ('rejected','withdrawn','expired','cancelled')));
end $$;
create function public.aura_apply_invitation(p_workspace uuid, p_invitation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); i aura_apply.invitation;
begin
 perform aura_apply.sweep(p_workspace);
 select * into i from aura_apply.invitation where id = p_invitation and creator_workspace_id = p_workspace;
 if i.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return to_jsonb(i) - 'created_by' || jsonb_build_object('campaign', aura_apply.campaign_title(i.campaign_id), 'brand', (select name from aura_identity.workspace where id = i.brand_workspace_id),
  'clarifications', (select coalesce(jsonb_agg(jsonb_build_object('question', c.question, 'answer', c.answer, 'created_at', c.created_at) order by c.created_at), '[]'::jsonb) from aura_apply.clarification c where c.invitation_id = i.id),
  'blocked', exists(select 1 from aura_apply.block b where b.creator_workspace_id = p_workspace and b.brand_workspace_id = i.brand_workspace_id));
end $$;
create function public.aura_apply_enquiry(p_workspace uuid, p_enquiry uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); e aura_apply.enquiry;
begin
 select * into e from aura_apply.enquiry where id = p_enquiry and creator_workspace_id = p_workspace;
 if e.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return to_jsonb(e) - 'created_by' || jsonb_build_object('brand', (select name from aura_identity.workspace where id = e.brand_workspace_id), 'campaign', case when e.campaign_id is not null then aura_apply.campaign_title(e.campaign_id) end,
  'blocked', exists(select 1 from aura_apply.block b where b.creator_workspace_id = p_workspace and b.brand_workspace_id = e.brand_workspace_id));
end $$;
create function public.aura_apply_brand(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false);
begin
 perform aura_apply.sweep(p_workspace);
 return jsonb_build_object(
  'invitations', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'campaign', aura_apply.campaign_title(i.campaign_id), 'creator', aura_apply.creator_name(i.creator_workspace_id), 'status', i.status, 'expires_at', i.expires_at, 'decline_reason', i.decline_reason, 'collaboration_id', i.collaboration_id,
     'questions', (select coalesce(jsonb_agg(c.question), '[]'::jsonb) from aura_apply.clarification c where c.invitation_id = i.id and c.answered_at is null)) order by i.created_at desc), '[]'::jsonb) from aura_apply.invitation i where i.brand_workspace_id = p_workspace),
  'enquiries', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'creator', aura_apply.creator_name(e.creator_workspace_id), 'status', e.status, 'reply', e.reply, 'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb) from aura_apply.enquiry e where e.brand_workspace_id = p_workspace),
  'negotiations', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'campaign', aura_apply.campaign_title(c.campaign_id), 'creator', aura_apply.creator_name(c.creator_workspace_id), 'status', c.status, 'updated_at', c.updated_at) order by c.updated_at desc), '[]'::jsonb) from aura_apply.collaboration c where c.brand_workspace_id = p_workspace and c.status <> 'cancelled'),
  'notifications', (select coalesce(jsonb_agg(to_jsonb(n) - 'workspace_id' order by n.created_at desc), '[]'::jsonb) from (select * from aura_apply.notification where workspace_id = p_workspace order by created_at desc limit 50) n));
end $$;
create function public.aura_apply_brand_answer(p_workspace uuid, p_invitation uuid, p_answer text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); i aura_apply.invitation;
begin
 select * into i from aura_apply.invitation where id = p_invitation and brand_workspace_id = p_workspace;
 if i.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 update aura_apply.clarification set answer = left(trim(p_answer), 2000), answered_at = now() where invitation_id = i.id and answered_at is null;
 perform aura_apply.notify(i.creator_workspace_id, 'clarification', 'The Brand answered your question', '/creator/invitations/' || i.id);
 return jsonb_build_object('answered', true);
end $$;
create function public.aura_apply_read(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from aura_identity.workspace where id = p_workspace and kind = 'brand') then perform aura_market.brand(p_workspace, true); else perform aura_analytics.actor(p_workspace, true); end if;
 update aura_apply.notification set read_at = now() where workspace_id = p_workspace and read_at is null;
 return jsonb_build_object('ok', true);
end $$;
-- Moderation of reported invitations, enquiries and messages (F35), by the restricted reviewer (MFA).
create function public.aura_apply_report_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check();
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.target_kind, 'reason', r.reason, 'details', r.details, 'created_at', r.created_at,
   'text', case r.target_kind when 'invitation' then (select message from aura_apply.invitation where id = r.target_id) when 'enquiry' then (select message from aura_apply.enquiry where id = r.target_id) else (select body from aura_apply.message where id = r.target_id) end) order by r.created_at), '[]'::jsonb)
  from aura_apply.report r where r.status = 'open');
end $$;
create function public.aura_apply_decide_report(p_report uuid, p_decision text, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); r aura_apply.report;
begin
 if p_decision not in ('actioned','dismissed') or length(coalesce(trim(p_reason), '')) < 3 then raise exception 'A decision and reason are required' using errcode = '22023'; end if;
 update aura_apply.report set status = p_decision, decision_reason = trim(p_reason), decided_by = u, decided_at = now() where id = p_report and status = 'open' returning * into r;
 if r.id is null then raise exception 'Nothing to decide' using errcode = '55000'; end if;
 if p_decision = 'actioned' and r.target_kind = 'invitation' then update aura_apply.invitation set status = 'withdrawn' where id = r.target_id and status in ('sent','interested'); end if;
 perform aura_apply.audit(u, 'apply_report_' || p_decision);
 return jsonb_build_object('id', r.id, 'status', r.status);
end $$;

-- A Brand finds a Creator by their PUBLISHED username only (no search of private workspaces, no enumeration of ids).
create function public.aura_apply_find_creator(p_workspace uuid, p_username text) returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); ws uuid;
begin
 select p.workspace_id into ws from aura_profile.profile p join aura_identity.workspace w on w.id = p.workspace_id where p.username = lower(trim(coalesce(p_username, ''))) and p.published and w.status = 'open';
 return ws;
end $$;

-- Applications and invitations route under /creator/ must stay unclaimable as usernames (M09 rule).
insert into aura_profile.reserved_username(word) values ('applications'), ('invitations'), ('enquiries'), ('negotiations') on conflict do nothing;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_apply\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop; end $$;
revoke all on all tables in schema aura_apply from public, anon, authenticated;
revoke all on all functions in schema aura_apply from public, anon, authenticated;
commit;
