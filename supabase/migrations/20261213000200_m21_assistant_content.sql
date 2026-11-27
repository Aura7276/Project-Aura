-- M21 joins the M20 assistant: a "Content ideas" task whose approved drafts become M21 ideas, and a "content plan" context source
-- (pillars, accounts, recent items). The M20 functions are replaced with the same bodies plus these additions; grants are unchanged.
begin;
alter table aura_brand_ai.conversation drop constraint conversation_task_check,
 add constraint conversation_task_check check (task in ('strategy','plan','brief','results','invitation','general','content'));
alter table aura_brand_ai.draft drop constraint draft_kind_check,
 add constraint draft_kind_check check (kind in ('plan_items','brief','invitation_message','strategy_note','content_ideas'));
alter table aura_brand_ai.context_pref drop constraint context_pref_sources_check,
 add constraint context_pref_sources_check check (sources <@ array['profile','products','audiences','guidelines','goals','plan','budget','creator_prefs','competitors','content_plan']);
alter table aura_brand_ai.context_pref alter column sources set default array['profile','products','audiences','guidelines','goals','plan','content_plan'];
create or replace function aura_brand_ai.sources(p_ws uuid) returns text[] language sql stable set search_path='' as $$
 select coalesce((select sources from aura_brand_ai.context_pref where workspace_id = p_ws), array['profile','products','audiences','guidelines','goals','plan','content_plan']) $$;
create or replace function public.aura_brand_ai_context(p_workspace uuid, p_task text, p_campaign uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); s text[] := aura_brand_ai.sources(p_workspace); ctx jsonb := '{}'; c aura_market.campaign; mem aura_brand_ai.memory;
begin
 if p_task not in ('strategy','plan','brief','results','invitation','general','content') then raise exception 'Invalid task' using errcode = '22023'; end if;
 if 'profile' = any(s) then ctx := ctx || jsonb_build_object('profile', (select jsonb_build_object('name', p.public_name, 'business_type', p.business_type, 'country', p.country, 'industry', p.industry, 'stage', p.stage, 'experience', p.experience, 'intent', p.intent, 'objective', p.objective, 'team_size', p.team_size, 'resources', to_jsonb(p.resources), 'about', p.about) from aura_brand.profile p where p.workspace_id = p_workspace)); end if;
 if 'products' = any(s) then ctx := ctx || jsonb_build_object('products', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'kind', x.kind, 'description', x.description, 'approved_claims', to_jsonb(x.claims))), '[]'::jsonb) from aura_brand.product x where x.workspace_id = p_workspace and x.status = 'active')); end if;
 if 'audiences' = any(s) then ctx := ctx || jsonb_build_object('audiences', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'description', x.description, 'basis', x.basis, 'countries', to_jsonb(x.countries), 'interests', to_jsonb(x.interests))), '[]'::jsonb) from aura_brand.segment x where x.workspace_id = p_workspace)); end if;
 if 'guidelines' = any(s) then ctx := ctx || jsonb_build_object('guidelines', (select jsonb_build_object('tone', to_jsonb(g.tone), 'voice', g.voice, 'dos', to_jsonb(g.dos), 'donts', to_jsonb(g.donts), 'claims_rules', g.claims_rules, 'exclusions', g.exclusions, 'disclosures', g.disclosures) from aura_brand.guideline g where g.workspace_id = p_workspace)); end if;
 if 'goals' = any(s) then ctx := ctx || jsonb_build_object('goals', (select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'metric', x.metric, 'baseline', x.baseline, 'target', x.target, 'days', x.horizon_days)), '[]'::jsonb) from aura_brand.goal x where x.workspace_id = p_workspace)); end if;
 if 'plan' = any(s) then ctx := ctx || jsonb_build_object('plan', (select coalesce(jsonb_agg(jsonb_build_object('days', x.horizon_days, 'step', x.title, 'done', x.done_at is not null) order by x.horizon_days, x.position), '[]'::jsonb) from aura_brand.plan_item x where x.workspace_id = p_workspace)); end if;
 if 'budget' = any(s) then ctx := ctx || jsonb_build_object('budget', (select jsonb_build_object('currency', b.currency, 'from', b.range_min, 'to', b.range_max, 'per', b.period, 'note', 'indicative, not a commitment') from aura_brand.budget b where b.workspace_id = p_workspace)); end if;
 if 'creator_prefs' = any(s) then ctx := ctx || jsonb_build_object('creator_preferences', (select jsonb_build_object('niches', to_jsonb(x.niches), 'platforms', to_jsonb(x.platforms), 'ugc', x.ugc_interest, 'experience', to_jsonb(x.experience)) from aura_brand.creator_pref x where x.workspace_id = p_workspace)); end if;
 if 'competitors' = any(s) then ctx := ctx || jsonb_build_object('competitors', (select coalesce(jsonb_agg(x.name), '[]'::jsonb) from aura_brand.competitor x where x.workspace_id = p_workspace)); end if;
 if 'content_plan' = any(s) then ctx := ctx || jsonb_build_object('content_plan', jsonb_build_object(
   'pillars', (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'mix', p.mix, 'about', p.description)), '[]'::jsonb) from aura_brand_content.pillar p where p.workspace_id = p_workspace and not p.archived),
   'accounts', (select coalesce(jsonb_agg(jsonb_build_object('platform', a.platform, 'handle', a.handle)), '[]'::jsonb) from aura_brand.social_account a where a.workspace_id = p_workspace),
   'recent', (select coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'format', i.format, 'stage', i.stage, 'date', coalesce(i.published_on, i.planned_for))), '[]'::jsonb)
     from (select * from aura_brand_content.item i where i.workspace_id = p_workspace and i.stage <> 'archived' order by i.updated_at desc limit 20) i))); end if;
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
create or replace function public.aura_brand_ai_start(p_workspace uuid, p_request uuid, p_task text, p_title text, p_campaign uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_brand_ai.conversation;
begin
 if p_task not in ('strategy','plan','brief','results','invitation','general','content') then raise exception 'Invalid task' using errcode = '22023'; end if;
 if p_campaign is not null then perform aura_market.own(p_workspace, p_campaign); end if;
 if p_task in ('brief','results') and p_campaign is null then raise exception 'Choose a campaign' using errcode = '22023'; end if;
 insert into aura_brand_ai.conversation(workspace_id, task, title, campaign_id, request_id, created_by) values (p_workspace, p_task, trim(p_title), p_campaign, p_request, u)
  on conflict (workspace_id, request_id) do nothing returning * into c;
 if c.id is null then select * into c from aura_brand_ai.conversation where workspace_id = p_workspace and request_id = p_request; end if;
 return jsonb_build_object('id', c.id);
end $$;
create or replace function public.aura_brand_ai_save_draft(p_workspace uuid, p_conv uuid, p_kind text, p_target jsonb, p_content jsonb, p_source text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); d aura_brand_ai.draft; camp uuid := nullif(p_target->>'campaign_id', '')::uuid;
begin
 if p_conv is not null then perform aura_brand_ai.conv(p_workspace, p_conv); end if;
 if p_kind not in ('plan_items','brief','invitation_message','strategy_note','content_ideas') or p_source not in ('ai','manual') then raise exception 'Invalid draft' using errcode = '22023'; end if;
 if camp is not null then perform aura_market.own(p_workspace, camp); end if;
 if p_kind = 'brief' and camp is null then raise exception 'Choose a campaign' using errcode = '22023'; end if;
 if p_kind = 'content_ideas' and (jsonb_typeof(p_content->'items') <> 'array' or jsonb_array_length(p_content->'items') not between 1 and 12) then raise exception 'Content drafts need 1 to 12 ideas' using errcode = '22023'; end if;
 if p_kind = 'plan_items' and (jsonb_typeof(p_content->'items') <> 'array' or jsonb_array_length(p_content->'items') not between 1 and 12 or coalesce((p_content->>'horizon')::int, 0) not in (7, 30, 90)) then raise exception 'Plan drafts need 1 to 12 steps and a 7, 30 or 90-day horizon' using errcode = '22023'; end if;
 if p_kind in ('brief','invitation_message','strategy_note') and length(coalesce(trim(p_content->>'text'), '')) not between 10 and 6000 then raise exception 'Write at least 10 characters' using errcode = '22023'; end if;
 if length(p_content::text) > 20000 then raise exception 'Too long' using errcode = '22023'; end if;
 insert into aura_brand_ai.draft(workspace_id, conversation_id, kind, target, content, source, created_by) values (p_workspace, p_conv, p_kind, coalesce(p_target, '{}'), p_content, p_source, u) returning * into d;
 return jsonb_build_object('id', d.id);
end $$;
create or replace function public.aura_brand_ai_apply(p_workspace uuid, p_draft uuid, p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
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
 elsif d.kind = 'content_ideas' then
  for x in select * from jsonb_array_elements(d.content->'items') loop
   if length(coalesce(trim(x->>'title'), '')) between 3 and 140 then
    perform public.aura_brand_content_create(p_workspace, gen_random_uuid(), jsonb_build_object('title', trim(x->>'title'), 'hook', left(coalesce(x->>'detail', ''), 300), 'source', case when d.source = 'ai' then 'ai' else 'team' end,
      'notes', case when d.source = 'ai' then 'From an AI suggestion approved in the assistant' else null end));
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
commit;
