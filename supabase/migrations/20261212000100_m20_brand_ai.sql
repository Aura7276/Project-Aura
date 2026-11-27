-- M20 Brand AI Growth Assistant (reconstructed scope, owner reconciliation pending; see the module file).
-- Mirrors the M07 pattern for Brand workspaces: conversations, opt-in memory, a monthly allowance and drafts. The AI may analyse,
-- recommend and draft; a person approves before anything changes, and every apply re-checks permissions (A6). The assistant has no
-- path to publish, invite, select, confirm proposals, pay or change permissions (A7). Context comes only from sources the Brand ticks,
-- is assembled here from its own workspace, and is stored with each answer (A2, A4, A8). No provider is configured by this migration.
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_brand_ai;
revoke all on schema aura_brand_ai from public, anon, authenticated;

create table aura_brand_ai.setting (key text primary key, value jsonb not null);
insert into aura_brand_ai.setting(key, value) values ('monthly_requests', '100'), ('max_turns', '60');

create table aura_brand_ai.conversation (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 task text not null check (task in ('strategy','plan','brief','results','invitation','general')),
 title text not null check (length(trim(title)) between 2 and 120), campaign_id uuid references aura_market.campaign on delete set null,
 request_id uuid not null, created_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default now(),
 unique (workspace_id, request_id)
);
create table aura_brand_ai.turn (
 id bigint generated always as identity primary key, conversation_id uuid not null references aura_brand_ai.conversation on delete cascade,
 role text not null check (role in ('user','assistant')), body text not null check (length(body) between 1 and 20000),
 status text not null default 'ok' check (status in ('ok','offline','error')), context jsonb, actor uuid references auth.users,
 created_at timestamptz not null default clock_timestamp()
);
create index turn_by_conv on aura_brand_ai.turn(conversation_id, id);
create table aura_brand_ai.draft (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 conversation_id uuid references aura_brand_ai.conversation on delete set null,
 kind text not null check (kind in ('plan_items','brief','invitation_message','strategy_note')),
 target jsonb not null default '{}', content jsonb not null, source text not null check (source in ('ai','manual')),
 status text not null default 'draft' check (status in ('draft','applied','discarded')),
 created_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(), applied_at timestamptz, applied_by uuid references auth.users
);
create table aura_brand_ai.memory (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 enabled boolean not null default false, preferences text check (length(preferences) <= 2000), updated_at timestamptz not null default now()
);
create table aura_brand_ai.context_pref (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 sources text[] not null default array['profile','products','audiences','guidelines','goals','plan'] check (sources <@ array['profile','products','audiences','guidelines','goals','plan','budget','creator_prefs','competitors'])
);
create table aura_brand_ai.usage (workspace_id uuid not null references aura_identity.workspace on delete cascade, period date not null, used integer not null default 0, primary key (workspace_id, period));
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname = 'aura_brand_ai' loop
  execute format('alter table aura_brand_ai.%I enable row level security', t);
  execute format('revoke all on aura_brand_ai.%I from public, anon, authenticated', t);
 end loop;
end $$;

create function aura_brand_ai.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_brand_ai.setting where key = p_key $$;
create function aura_brand_ai.sources(p_ws uuid) returns text[] language sql stable set search_path='' as $$
 select coalesce((select sources from aura_brand_ai.context_pref where workspace_id = p_ws), array['profile','products','audiences','guidelines','goals','plan']) $$;
create function aura_brand_ai.conv(p_ws uuid, p_conv uuid) returns aura_brand_ai.conversation language plpgsql stable set search_path='' as $$
declare c aura_brand_ai.conversation;
begin
 select * into c from aura_brand_ai.conversation where id = p_conv and workspace_id = p_ws;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return c;
end $$;

-- ───────── Context (A2, A4, A8): only this workspace, only the ticked sources, facts labelled ─────────
create function public.aura_brand_ai_context(p_workspace uuid, p_task text, p_campaign uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); s text[] := aura_brand_ai.sources(p_workspace); ctx jsonb := '{}'; c aura_market.campaign; mem aura_brand_ai.memory;
begin
 if p_task not in ('strategy','plan','brief','results','invitation','general') then raise exception 'Invalid task' using errcode = '22023'; end if;
 if 'profile' = any(s) then ctx := ctx || jsonb_build_object('profile', (select jsonb_build_object('name', p.public_name, 'business_type', p.business_type, 'country', p.country, 'industry', p.industry, 'stage', p.stage, 'experience', p.experience, 'intent', p.intent, 'objective', p.objective, 'team_size', p.team_size, 'resources', to_jsonb(p.resources), 'about', p.about) from aura_brand.profile p where p.workspace_id = p_workspace)); end if;
 if 'products' = any(s) then ctx := ctx || jsonb_build_object('products', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'kind', x.kind, 'description', x.description, 'approved_claims', to_jsonb(x.claims))), '[]'::jsonb) from aura_brand.product x where x.workspace_id = p_workspace and x.status = 'active')); end if;
 if 'audiences' = any(s) then ctx := ctx || jsonb_build_object('audiences', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'description', x.description, 'basis', x.basis, 'countries', to_jsonb(x.countries), 'interests', to_jsonb(x.interests))), '[]'::jsonb) from aura_brand.segment x where x.workspace_id = p_workspace)); end if;
 if 'guidelines' = any(s) then ctx := ctx || jsonb_build_object('guidelines', (select jsonb_build_object('tone', to_jsonb(g.tone), 'voice', g.voice, 'dos', to_jsonb(g.dos), 'donts', to_jsonb(g.donts), 'claims_rules', g.claims_rules, 'exclusions', g.exclusions, 'disclosures', g.disclosures) from aura_brand.guideline g where g.workspace_id = p_workspace)); end if;
 if 'goals' = any(s) then ctx := ctx || jsonb_build_object('goals', (select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'metric', x.metric, 'baseline', x.baseline, 'target', x.target, 'days', x.horizon_days)), '[]'::jsonb) from aura_brand.goal x where x.workspace_id = p_workspace)); end if;
 if 'plan' = any(s) then ctx := ctx || jsonb_build_object('plan', (select coalesce(jsonb_agg(jsonb_build_object('days', x.horizon_days, 'step', x.title, 'done', x.done_at is not null) order by x.horizon_days, x.position), '[]'::jsonb) from aura_brand.plan_item x where x.workspace_id = p_workspace)); end if;
 if 'budget' = any(s) then ctx := ctx || jsonb_build_object('budget', (select jsonb_build_object('currency', b.currency, 'from', b.range_min, 'to', b.range_max, 'per', b.period, 'note', 'indicative, not a commitment') from aura_brand.budget b where b.workspace_id = p_workspace)); end if;
 if 'creator_prefs' = any(s) then ctx := ctx || jsonb_build_object('creator_preferences', (select jsonb_build_object('niches', to_jsonb(x.niches), 'platforms', to_jsonb(x.platforms), 'ugc', x.ugc_interest, 'experience', to_jsonb(x.experience)) from aura_brand.creator_pref x where x.workspace_id = p_workspace)); end if;
 if 'competitors' = any(s) then ctx := ctx || jsonb_build_object('competitors', (select coalesce(jsonb_agg(x.name), '[]'::jsonb) from aura_brand.competitor x where x.workspace_id = p_workspace)); end if;
 if p_campaign is not null then
  c := aura_market.own(p_workspace, p_campaign);
  ctx := ctx || jsonb_build_object('campaign', jsonb_build_object('category', c.category, 'status', c.status, 'draft', aura_market.content(c.id, c.draft_version) - 'requirements',
    'plan', (select jsonb_build_object('objective', p.objective, 'kpi', p.kpi_metric, 'target', p.kpi_target) from aura_campaign.plan p where p.campaign_id = c.id)));
  if p_task = 'results' then
   ctx := ctx || jsonb_build_object('results', (select jsonb_build_object('totals', r->'totals', 'coverage', r->'coverage', 'exceptions', r->'exceptions', 'metrics', r->'metrics') from (select aura_monitor.rollup(c.id, null, true, null, null) r) q),
     'results_rule', 'Use only these recorded figures. Totals are the latest cumulative reading per deliverable; reach is not unique people. Do not invent numbers.');
  end if;
 end if;
 select * into mem from aura_brand_ai.memory where workspace_id = p_workspace;
 if mem.enabled and nullif(trim(coalesce(mem.preferences, '')), '') is not null then ctx := ctx || jsonb_build_object('team_preferences', mem.preferences); end if;
 return jsonb_build_object('task', p_task, 'sources', to_jsonb(s), 'facts', ctx,
  'labels', jsonb_build_object('audiences', 'Audiences marked hypothesis are unconfirmed guesses by the Brand.', 'budget', 'Indicative only; never a commitment.'));
end $$;

-- ───────── Conversations, allowance, turns ─────────
create function public.aura_brand_ai_state(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false);
begin
 return jsonb_build_object(
  'conversations', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'task', c.task, 'title', c.title, 'campaign_id', c.campaign_id, 'updated_at', c.updated_at,
     'turns', (select count(*) from aura_brand_ai.turn t where t.conversation_id = c.id)) order by c.updated_at desc), '[]'::jsonb) from aura_brand_ai.conversation c where c.workspace_id = p_workspace),
  'drafts', (select coalesce(jsonb_agg(to_jsonb(d) - 'workspace_id' - 'created_by' - 'applied_by' order by d.created_at desc), '[]'::jsonb) from aura_brand_ai.draft d where d.workspace_id = p_workspace and d.status <> 'discarded'),
  'memory', (select jsonb_build_object('enabled', m.enabled, 'preferences', m.preferences) from aura_brand_ai.memory m where m.workspace_id = p_workspace),
  'sources', to_jsonb(aura_brand_ai.sources(p_workspace)),
  'usage', jsonb_build_object('used', coalesce((select used from aura_brand_ai.usage where workspace_id = p_workspace and period = date_trunc('month', now())::date), 0), 'allowance', aura_brand_ai.setting_int('monthly_requests')),
  'campaigns', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', aura_market.content(x.id, x.draft_version)->>'title', 'status', x.status) order by x.updated_at desc), '[]'::jsonb) from aura_market.campaign x where x.workspace_id = p_workspace and x.status <> 'removed'),
  'verified', aura_market.verified(p_workspace));
end $$;
create function public.aura_brand_ai_start(p_workspace uuid, p_request uuid, p_task text, p_title text, p_campaign uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_brand_ai.conversation;
begin
 if p_task not in ('strategy','plan','brief','results','invitation','general') then raise exception 'Invalid task' using errcode = '22023'; end if;
 if p_campaign is not null then perform aura_market.own(p_workspace, p_campaign); end if;
 if p_task in ('brief','results') and p_campaign is null then raise exception 'Choose a campaign' using errcode = '22023'; end if;
 insert into aura_brand_ai.conversation(workspace_id, task, title, campaign_id, request_id, created_by) values (p_workspace, p_task, trim(p_title), p_campaign, p_request, u)
  on conflict (workspace_id, request_id) do nothing returning * into c;
 if c.id is null then select * into c from aura_brand_ai.conversation where workspace_id = p_workspace and request_id = p_request; end if;
 return jsonb_build_object('id', c.id);
end $$;
create function public.aura_brand_ai_conversation(p_workspace uuid, p_conv uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_brand_ai.conversation := aura_brand_ai.conv(p_workspace, p_conv);
begin
 return to_jsonb(c) - 'workspace_id' - 'request_id' - 'created_by' || jsonb_build_object(
  'turns', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'role', t.role, 'body', t.body, 'status', t.status, 'context', t.context, 'at', t.created_at) order by t.id), '[]'::jsonb) from aura_brand_ai.turn t where t.conversation_id = c.id),
  'drafts', (select coalesce(jsonb_agg(to_jsonb(d) - 'workspace_id' - 'created_by' - 'applied_by' order by d.created_at desc), '[]'::jsonb) from aura_brand_ai.draft d where d.conversation_id = c.id));
end $$;
-- Allowance: reserved before a provider request, under a lock (no overspending by parallel requests).
create function public.aura_brand_ai_reserve(p_workspace uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); per date := date_trunc('month', now())::date; n int;
begin
 perform pg_advisory_xact_lock(hashtextextended('brand_ai:' || p_workspace::text, 0));
 insert into aura_brand_ai.usage(workspace_id, period, used) values (p_workspace, per, 0) on conflict do nothing;
 select used into n from aura_brand_ai.usage where workspace_id = p_workspace and period = per for update;
 if n >= aura_brand_ai.setting_int('monthly_requests') then return false; end if;
 update aura_brand_ai.usage set used = used + 1 where workspace_id = p_workspace and period = per;
 return true;
end $$;
create function public.aura_brand_ai_record(p_workspace uuid, p_conv uuid, p_prompt text, p_reply text, p_status text, p_context jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_brand_ai.conversation := aura_brand_ai.conv(p_workspace, p_conv);
begin
 if p_status not in ('ok','offline','error') then raise exception 'Invalid status' using errcode = '22023'; end if;
 if (select count(*) from aura_brand_ai.turn where conversation_id = c.id) >= aura_brand_ai.setting_int('max_turns') then raise exception 'This conversation is full. Start a new one.' using errcode = '54000'; end if;
 insert into aura_brand_ai.turn(conversation_id, role, body, status, actor) values (c.id, 'user', left(trim(p_prompt), 20000), 'ok', u);
 if nullif(trim(coalesce(p_reply, '')), '') is not null then
  insert into aura_brand_ai.turn(conversation_id, role, body, status, context) values (c.id, 'assistant', left(p_reply, 20000), p_status, p_context);
 end if;
 update aura_brand_ai.conversation set updated_at = now() where id = c.id;
 return jsonb_build_object('ok', true);
end $$;

-- ───────── Drafts and approval (A3, A5, A6, A7) ─────────
create function public.aura_brand_ai_save_draft(p_workspace uuid, p_conv uuid, p_kind text, p_target jsonb, p_content jsonb, p_source text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); d aura_brand_ai.draft; camp uuid := nullif(p_target->>'campaign_id', '')::uuid;
begin
 if p_conv is not null then perform aura_brand_ai.conv(p_workspace, p_conv); end if;
 if p_kind not in ('plan_items','brief','invitation_message','strategy_note') or p_source not in ('ai','manual') then raise exception 'Invalid draft' using errcode = '22023'; end if;
 if camp is not null then perform aura_market.own(p_workspace, camp); end if;
 if p_kind = 'brief' and camp is null then raise exception 'Choose a campaign' using errcode = '22023'; end if;
 if p_kind = 'plan_items' and (jsonb_typeof(p_content->'items') <> 'array' or jsonb_array_length(p_content->'items') not between 1 and 12 or coalesce((p_content->>'horizon')::int, 0) not in (7, 30, 90)) then raise exception 'Plan drafts need 1 to 12 steps and a 7, 30 or 90-day horizon' using errcode = '22023'; end if;
 if p_kind in ('brief','invitation_message','strategy_note') and length(coalesce(trim(p_content->>'text'), '')) not between 10 and 6000 then raise exception 'Write at least 10 characters' using errcode = '22023'; end if;
 if length(p_content::text) > 20000 then raise exception 'Too long' using errcode = '22023'; end if;
 insert into aura_brand_ai.draft(workspace_id, conversation_id, kind, target, content, source, created_by) values (p_workspace, p_conv, p_kind, coalesce(p_target, '{}'), p_content, p_source, u) returning * into d;
 return jsonb_build_object('id', d.id);
end $$;
-- Apply needs explicit confirmation and re-checks permission now. It only ever writes private records:
-- plan steps (M14), the campaign's draft brief (M10/M17 draft; never published), or marks a message as ready for the person to send.
create function public.aura_brand_ai_apply(p_workspace uuid, p_draft uuid, p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); d aura_brand_ai.draft; c aura_market.campaign; cont jsonb; x jsonb; i int := 0;
begin
 if p_confirm is not true then raise exception 'Confirm before applying' using errcode = '22023'; end if;
 select * into d from aura_brand_ai.draft where id = p_draft and workspace_id = p_workspace for update;
 if d.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if d.status <> 'draft' then raise exception 'Already handled' using errcode = '55000'; end if;
 if d.kind = 'plan_items' then
  perform aura_brand.prof(p_workspace);
  for x in select * from jsonb_array_elements(d.content->'items') loop
   if length(coalesce(trim(x->>'title'), '')) between 3 and 140 then
    insert into aura_brand.plan_item(workspace_id, horizon_days, title, detail, edited, position) values (p_workspace, (d.content->>'horizon')::int, trim(x->>'title'), nullif(left(trim(coalesce(x->>'detail', '')), 500), ''), true, 900 + i);
    i := i + 1;
   end if;
  end loop;
 elsif d.kind = 'brief' then
  c := aura_market.own(p_workspace, (d.target->>'campaign_id')::uuid, true);
  if c.status in ('closed','removed') then raise exception 'This campaign can no longer be edited' using errcode = '55000'; end if;
  cont := aura_market.content(c.id, c.draft_version) || jsonb_build_object('brief', left(trim(d.content->>'text'), 6000));
  perform public.aura_market_save_campaign(p_workspace, c.id, c.visibility, c.show_applicant_count, cont); -- a draft change only; publishing stays a separate, gated step
 end if;
 update aura_brand_ai.draft set status = 'applied', applied_at = now(), applied_by = u where id = d.id;
 perform aura_market.audit(u, 'brand_ai_draft_applied');
 return jsonb_build_object('id', d.id, 'kind', d.kind, 'applied_steps', i, 'campaign_id', d.target->>'campaign_id', 'text', d.content->>'text');
end $$;
create function public.aura_brand_ai_discard(p_workspace uuid, p_draft uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); n int;
begin
 update aura_brand_ai.draft set status = 'discarded' where id = p_draft and workspace_id = p_workspace and status = 'draft';
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Nothing to discard' using errcode = '55000'; end if;
 return jsonb_build_object('discarded', true);
end $$;

-- ───────── Settings (A8): memory off by default, deletable; sources the Brand allows ─────────
create function public.aura_brand_ai_settings(p_workspace uuid, p_memory boolean, p_preferences text, p_delete boolean, p_sources text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true);
begin
 if p_delete then delete from aura_brand_ai.memory where workspace_id = p_workspace;
 else
  insert into aura_brand_ai.memory(workspace_id, enabled, preferences) values (p_workspace, coalesce(p_memory, false), nullif(left(trim(coalesce(p_preferences, '')), 2000), ''))
   on conflict (workspace_id) do update set enabled = excluded.enabled, preferences = excluded.preferences, updated_at = now();
 end if;
 if p_sources is not null then
  insert into aura_brand_ai.context_pref(workspace_id, sources) values (p_workspace, p_sources) on conflict (workspace_id) do update set sources = excluded.sources;
 end if;
 perform aura_market.audit(u, case when p_delete then 'brand_ai_memory_deleted' else 'brand_ai_settings_saved' end);
 return public.aura_brand_ai_state(p_workspace) - 'conversations' - 'drafts' - 'campaigns';
end $$;
create function public.aura_brand_ai_delete_conversation(p_workspace uuid, p_conv uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_brand_ai.conversation := aura_brand_ai.conv(p_workspace, p_conv);
begin
 delete from aura_brand_ai.draft where conversation_id = c.id and status = 'draft';
 delete from aura_brand_ai.conversation where id = c.id;
 return jsonb_build_object('deleted', true);
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_brand\_ai\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'aura_brand_ai' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
 end loop;
end $$;
commit;
