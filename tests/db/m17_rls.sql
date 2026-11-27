-- Executed by tests/unit/db-m17.test.ts on a disposable PostgreSQL with every migration through M17 and the auth and storage stubs (NOT Supabase).
-- (NOT Supabase). Fixture manipulation by the superuser is labelled; every access assertion runs as `authenticated` or `anon`.
\set ON_ERROR_STOP on
create schema t;
create table t.results(name text primary key);
create function t.pass(n text) returns void language sql as $$ insert into t.results values(n) $$;
create function t.as_user(u uuid, s uuid, aal text default 'aal1') returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claims', json_build_object('sub',u,'session_id',s,'role','authenticated','aal',aal)::text, false); execute 'set role authenticated'; end $$;
create function t.as_anon() returns void language plpgsql as $$ begin perform set_config('request.jwt.claims','',false); execute 'set role anon'; end $$;
create function t.denied(q text, code text default '42501') returns boolean language plpgsql as $$ begin
 begin execute q; exception when others then if sqlstate = code then return true; end if; raise exception 'expected % got % (%) for %', code, sqlstate, sqlerrm, q; end;
 return false; end $$;
grant usage on schema t to anon, authenticated; grant execute on all functions in schema t to anon, authenticated;
create table t.ids(k text primary key, u uuid, s uuid, w uuid);
grant select on t.ids to authenticated, anon;
create function t.me(k text) returns void language sql as $$ select t.as_user((select u from t.ids where ids.k=me.k),(select s from t.ids where ids.k=me.k)) $$;
create function t.mfa(k text) returns void language sql as $$ select t.as_user((select u from t.ids where ids.k=mfa.k),(select s from t.ids where ids.k=mfa.k),'aal2') $$;
create function t.ws(k text) returns uuid language sql stable as $$ select w from t.ids where ids.k=ws.k $$;
create function t.uid(k text) returns uuid language sql stable as $$ select u from t.ids where ids.k=uid.k $$;
create function t.mkuser(email text, with_mfa boolean) returns uuid[] language plpgsql as $$ declare u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); f uuid:=gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at) values(u,email,now()); insert into auth.sessions(id,user_id) values(s,u);
 if with_mfa then insert into auth.mfa_factors(id,user_id,status) values(f,u,'verified'); update auth.sessions set factor_id=f where id=s; end if; return array[u,s]; end $$;
create function t.acct(k text, pl text, h text, extra jsonb default '{}') returns uuid language sql as $$
 select (public.aura_social_add_account(t.ws(k), gen_random_uuid(), jsonb_build_object('platform',pl,'handle',h) || extra)->>'id')::uuid $$;
create function t.acc(a uuid, k text default 'a') returns jsonb language sql as $$ select public.aura_social_account(t.ws(k), a) $$;
do $$ declare a uuid[]; kk text; wid uuid; begin
 foreach kk in array array['a','b','e','c','d','r','r2','r3'] loop a := t.mkuser(kk||'@example.test', kk not in ('a','b','e')); insert into t.ids(k,u,s) values(kk,a[1],a[2]); end loop;
 foreach kk in array array['a','b','e'] loop
  perform t.me(kk); perform public.aura_complete_identity('Test '||kk,'IN',true,''); wid := public.aura_create_workspace(gen_random_uuid(),'creator','Creator '||kk,null); reset role; update t.ids set w=wid where ids.k=kk;
 end loop;
 foreach kk in array array['c','d','r','r2','r3'] loop perform t.mfa(kk); perform public.aura_complete_identity('Test '||kk,'IN',true,''); reset role; end loop;
 insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) select u,gen_random_uuid(),'brand','Brand c','company' from t.ids where k='c';
 insert into aura_identity.membership select w.id,w.founder,'owner',true from aura_identity.workspace w where kind='brand'; update t.ids set w=(select id from aura_identity.workspace where kind='brand') where k='c';
 insert into aura_identity.workspace(founder,request_id,kind,name) select u,gen_random_uuid(),'agency','Agency d' from t.ids where k='d';
 insert into aura_identity.membership select w.id,w.founder,'owner',true from aura_identity.workspace w where kind='agency'; update t.ids set w=(select id from aura_identity.workspace where kind='agency') where k='d';
 insert into aura_identity.membership select t.ws('a'), t.uid('e'),'member',true;
 -- Fixture: r is a platform admin AND an explicitly granted reviewer; r2 is a platform admin only; r3 is a reviewer only (not a platform admin).
 insert into aura_identity.platform_admin(user_id) values (t.uid('r')),(t.uid('r2')); insert into aura_social.reviewer(user_id) values (t.uid('r')),(t.uid('r3'));
 -- r's workspace membership is needed to test self-approval: r is also an (extra) member of workspace b
 insert into aura_identity.membership select t.ws('b'), t.uid('r'),'member',true;
end $$;
create function t.cur() returns date language sql as $$ select current_date $$;
-- helpers
create function t.obs(k text, a uuid, m text, v numeric, d date, ps date default null, pe date default null) returns uuid language sql as $$
 select (public.aura_social_record_observation(t.ws(k), gen_random_uuid(), a, m, v, d, ps, pe, 'manual', null, null)->>'id')::uuid $$;
create function t.cobs(k text, a uuid, ext text, m text, v numeric, w text, d date, ps date default null, pe date default null, fmt text default 'short_video') returns jsonb language sql as $$
 select public.aura_social_record_content_observation(t.ws(k), gen_random_uuid(), a, jsonb_build_object('external_id', ext, 'title', ext, 'format', fmt, 'published_on', d - 3), m, v, w, d, ps, pe, 'manual', null, null) $$;
create function t.insight(fp text, hash text, rule text default 'rule.one', prio int default 50) returns jsonb language sql as $$
 select jsonb_build_object('fingerprint', fp, 'category', 'data_quality', 'rule_key', rule, 'rule_version', 1, 'priority', prio, 'title', 'Title ' || fp, 'explanation', 'Because.', 'evidence', jsonb_build_object('n', 1), 'limitations', '[]'::jsonb, 'action', 'Do it', 'link', '/creator/analytics', 'data_hash', hash) $$;
create function t.mkcreator(kk text) returns void language plpgsql as $$ declare a uuid[]; wid uuid; begin
 a := t.mkuser(kk||'@example.test', false); insert into t.ids(k,u,s) values(kk,a[1],a[2]);
 perform t.me(kk); perform public.aura_complete_identity('Test '||kk,'IN',true,''); wid := public.aura_create_workspace(gen_random_uuid(),'creator','Creator '||kk,null); reset role; update t.ids set w=wid where t.ids.k=kk; end $$;

-- M09 helpers. Fixture: activate Creator workspaces directly (onboarding itself is covered by the M03 suite).
create function t.activate(kk text) returns void language plpgsql as $$ begin
 insert into aura_creator.creator_profile(workspace_id, display_name, country, language, stage, activated_at) values (t.ws(kk), 'Creator ' || upper(kk), 'IN', 'en', 'emerging', now())
  on conflict (workspace_id) do update set display_name = 'Creator ' || upper(kk), activated_at = now(); end $$;
create function t.anon_profile(u text) returns jsonb language plpgsql as $$ declare r jsonb; begin perform t.as_anon(); r := public.aura_public_profile(u); reset role; return r; end $$;
create function t.anon_kit(tok text) returns jsonb language plpgsql as $$ declare r jsonb; begin perform t.as_anon(); r := public.aura_public_kit(tok); reset role; return r; end $$;
create table t.tok(k text primary key, v text); grant all on t.tok to authenticated, anon;
do $$ begin perform t.activate('a'); perform t.activate('b'); perform t.activate('e'); end $$;

-- M10 fixtures: a second Brand (c2, owner r3 with MFA) and helpers
do $$ declare wid uuid; begin
 insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) values (t.uid('r3'), gen_random_uuid(), 'brand', 'Brand Two', 'startup') returning id into wid;
 insert into aura_identity.membership values (wid, t.uid('r3'), 'owner', true); insert into t.ids(k,u,s,w) select 'c2', u, s, wid from t.ids where k='r3';
end $$;
create function t.content(title text, extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('title', title, 'summary', 'A clear, honest summary of what we need from creators.', 'brief', repeat('Make short videos about our budget travel app. ', 3),
  'deliverables', '[{"type":"reel","platform":"instagram","quantity":2}]'::jsonb, 'compensation', '{"money":{"type":"range","currency":"INR","min":5000,"max":9000}}'::jsonb,
  'rights', '{"usage_months":6,"channels":["organic"],"exclusivity_days":0}'::jsonb, 'requirements', '{}'::jsonb, 'preferred', '{}'::jsonb, 'closes_at', (now() + interval '20 days')::text, 'remote', true) || extra $$;
create function t.campaign(k text, cat text, title text, extra jsonb default '{}', vis text default 'public') returns uuid language plpgsql as $$ declare id uuid; begin
 id := (public.aura_market_create_campaign(t.ws(k), gen_random_uuid(), cat, title)->>'id')::uuid;
 perform public.aura_market_save_campaign(t.ws(k), id, vis, false, t.content(title, extra)); return id; end $$;
create function t.feed(k text, f jsonb default '{}') returns jsonb language sql as $$ select public.aura_market_feed(t.ws(k), f) $$;
create function t.ids_in(feed jsonb) returns uuid[] language sql as $$ select coalesce(array_agg((x->>'id')::uuid), '{}') from jsonb_array_elements(feed->'items') x $$;
create function t.set_followers(k text, handle text, n int, pl text default 'instagram') returns uuid language plpgsql as $$ declare a uuid; begin
 a := t.acct(k, pl, handle); if n is not null then perform public.aura_social_record_observation(t.ws(k), gen_random_uuid(), a, 'followers', n, current_date, null, null, 'manual', null, null); end if; return a; end $$;
create table t.camp(k text primary key, id uuid); grant all on t.camp to authenticated, anon;
create function t.c(k text) returns uuid language sql stable as $$ select id from t.camp where camp.k = c.k $$;

-- M11 fixtures: verify Brand c, publish campaigns (first publication approved by reviewer r), accounts for Creators a and b.
create function t.app_content(acct uuid, extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('pitch', 'I make short travel films about getting more out of every rupee, and your hostel fits my audience.', 'account_id', acct) || extra $$;
create table t.x(k text primary key, id uuid); grant all on t.x to authenticated, anon;
create function t.g(k text) returns uuid language sql stable as $$ select id from t.x where x.k = g.k $$;
do $$ declare id uuid; begin
 perform t.mfa('r'); perform public.aura_market_verify_brand(t.ws('c'), 'verified', 'Documents checked');
 perform t.mfa('c');
 id := t.campaign('c', 'paid', 'Goa reels for M11', '{"positions":1,"requirements":{"min_followers":1000}}'); insert into t.x values ('paid', id);
 perform public.aura_market_publish(t.ws('c'), id); reset role;
 perform t.mfa('r'); perform public.aura_market_moderate(id, 'approved', 'Clear');
 perform t.mfa('c');
 id := t.campaign('c', 'ugc', 'UGC videos for M11', '{"compensation":{"money":{"type":"fixed","currency":"INR","min":3000}}}'); insert into t.x values ('ugc', id); perform public.aura_market_publish(t.ws('c'), id);
 perform t.me('a'); insert into t.x values ('acc_a', t.set_followers('a', 'asha.m11', 1500));
 perform t.me('b'); insert into t.x values ('acc_b', t.set_followers('b', 'bo.m11', 300));
 perform t.me('e'); reset role;
end $$;

-- M17 fixtures: test-only reader with the owner's rights (access assertions still run as the test user), and an applied-and-ready helper.
create function t.val(q text) returns text language plpgsql security definer as $$ declare r text; begin execute q into r; return r; end $$;
grant execute on function t.val(text) to authenticated, anon;
create function t.apply(k text, camp uuid, acct uuid) returns uuid language plpgsql as $$ declare id uuid; begin
 perform t.me(k); id := (public.aura_apply_save_draft(t.ws(k), gen_random_uuid(), camp, t.app_content(acct))->>'id')::uuid;
 perform public.aura_apply_submit(t.ws(k), id, true); reset role; return id; end $$;
create function t.notes(k text) returns int language sql security definer as $$ select count(*)::int from aura_apply.notification where workspace_id = t.ws(k) and kind = 'change' and title like 'Campaign updated:%' $$;
grant execute on function t.notes(text) to authenticated;

-- 1. Access (tenant isolation, private planning)
do $$ begin
 perform t.as_anon(); assert t.denied(format('select public.aura_campaign_overview(%L)', t.ws('c'))), 'anon denied';
 perform t.me('a'); assert t.denied(format('select public.aura_campaign_overview(%L)', t.ws('a'))), 'a Creator workspace has no campaign management';
 assert t.denied(format('select public.aura_campaign_plan(%L, %L)', t.ws('c'), t.g('ugc'))), 'a Creator cannot read a Brand plan';
 perform t.mfa('r3'); assert t.denied(format('select public.aura_campaign_plan(%L, %L)', t.ws('c2'), t.g('ugc'))), 'another Brand cannot read the plan';
 assert t.denied(format('select public.aura_campaign_duplicate(%L, %L, gen_random_uuid())', t.ws('c2'), t.g('ugc'))), 'or duplicate the campaign';
 assert t.denied(format('select public.aura_campaign_archive(%L, %L, true)', t.ws('c2'), t.g('ugc'))), 'or archive it';
 perform t.mfa('c'); assert t.denied('select count(*) from aura_campaign.plan'), 'no direct table access';
 perform t.me('c'); assert t.denied(format('select public.aura_campaign_save_plan(%L, %L, ''{}'')', t.ws('c'), t.g('ugc'))), 'writes need MFA';
 reset role; perform t.pass('access: anonymous, Creators, other Brands and non-MFA writes denied');
end $$;

-- 2. Category rollout (R2): drafts for every type, publication only for live types
do $$ declare r jsonb; id uuid; begin
 perform t.mfa('c');
 r := public.aura_campaign_rollout();
 assert r->>'paid' = 'live' and r->>'ugc' = 'live' and r->>'barter' = 'live' and r->>'event' = 'planned' and r->>'affiliate' = 'planned', 'paid, UGC and barter first';
 id := t.campaign('c', 'event', 'Opening night party', '{"compensation":{"experiences":{"description":"Entry and dinner"}}}'); insert into t.x values ('event', id);
 assert (public.aura_market_brand_campaign(t.ws('c'), id)->>'status') = 'draft', 'an event campaign can be drafted';
 assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), id), '55000'), 'but not published before events open';
 id := t.campaign('c', 'ambassador', 'Year-long ambassadors', '{"compensation":{"products":{"description":"Free stays"}}}');
 assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), id), '55000'), 'nor ambassador';
 id := t.campaign('c', 'barter', 'Weekend stay for stories', '{"compensation":{"products":{"description":"Two nights"}}}');
 r := public.aura_market_publish(t.ws('c'), id); assert r->>'status' = 'published', 'barter is live';
 reset role; update aura_campaign.setting set value = jsonb_set(value, '{event}', '"live"') where key = 'category_rollout'; -- fixture: events open
 perform t.mfa('c'); assert (public.aura_market_publish(t.ws('c'), t.g('event'))->>'status') = 'published', 'once events open, the draft publishes';
 reset role; update aura_campaign.setting set value = jsonb_set(value, '{event}', '"planned"') where key = 'category_rollout'; -- fixture: restore
 perform t.pass('rollout: every type can be drafted; only live types can be published or sent to review');
end $$;

-- 3. Private plan with M14 audiences and products, owner and milestones (R3)
do $$ declare s1 uuid; s2 uuid; p1 uuid; r jsonb; d jsonb; begin
 perform t.mfa('r3'); perform public.aura_brand_save_profile(t.ws('c2'), '{"public_name":"Brand Two"}'); s2 := (public.aura_brand_save_segment(t.ws('c2'), null, '{"name":"Other audience"}')->>'id')::uuid;
 perform t.mfa('c'); perform public.aura_brand_save_profile(t.ws('c'), '{"public_name":"Hostel Co"}');
 s1 := (public.aura_brand_save_segment(t.ws('c'), null, '{"name":"Budget backpackers"}')->>'id')::uuid;
 p1 := (public.aura_brand_save_product(t.ws('c'), null, '{"name":"Dorm bed","claims":["Free breakfast"]}')->>'id')::uuid;
 r := public.aura_campaign_save_plan(t.ws('c'), t.g('ugc'), jsonb_build_object('objective', 'content', 'kpi_metric', 'Usable videos', 'kpi_target', '6',
   'segment_ids', jsonb_build_array(s1, s2), 'product_ids', jsonb_build_array(p1), 'owner_user', t.uid('c'), 'notes', 'Private: target 20 percent below last quarter',
   'milestones', '[{"label":"Brief approved","due_on":"2026-12-05"},{"label":"First drafts due","due_on":"2026-12-15"}]'::jsonb));
 assert r->'plan'->'segment_ids' = jsonb_build_array(s1), 'only your own audiences can be linked';
 assert jsonb_array_length(r->'plan'->'milestones') = 2 and jsonb_array_length(r->'products') = 1, 'milestones and catalogue saved';
 assert t.denied(format('select public.aura_campaign_save_plan(%L, %L, %L)', t.ws('c'), t.g('ugc'), jsonb_build_object('owner_user', t.uid('a'))), '22023'), 'the owner must be a member';
 assert t.denied(format('select public.aura_campaign_save_plan(%L, %L, ''{"milestones":[{"label":""}]}'')', t.ws('c'), t.g('ugc')), '22023'), 'milestones need labels';
 assert t.denied(format('select public.aura_campaign_save_plan(%L, %L, ''{"objective":"fame"}'')', t.ws('c'), t.g('ugc')), '23514'), 'objectives are a fixed list';
 perform t.me('a'); d := public.aura_market_campaign(t.ws('a'), t.g('ugc'));
 assert d::text !~ 'target 20 percent|Usable videos|Brief approved', 'the plan never reaches Creators';
 reset role; perform t.pass('plan: objective, KPI, own audiences and products, team owner and milestones, private to the Brand');
end $$;

-- 4. Positions (R8): availability for Creators; positions can never drop below those already selected
do $$ declare camp uuid; a1 uuid; b1 uuid; r jsonb; begin
 perform t.mfa('c');
 camp := t.campaign('c', 'ugc', 'Two UGC creators wanted', '{"positions":2,"compensation":{"money":{"type":"fixed","currency":"INR","min":2500}}}'); insert into t.x values ('two', camp);
 perform public.aura_market_publish(t.ws('c'), camp);
 a1 := t.apply('a', camp, t.g('acc_a')); b1 := t.apply('b', camp, t.g('acc_b'));
 perform t.me('e'); r := public.aura_campaign_availability(t.ws('e'), camp);
 assert (r->>'positions')::int = 2 and (r->>'remaining')::int = 2, 'two positions open';
 perform t.mfa('c'); perform public.aura_apply_decide(t.ws('c'), a1, 'select'); perform public.aura_apply_decide(t.ws('c'), b1, 'select');
 perform t.me('e'); assert (public.aura_campaign_availability(t.ws('e'), camp)->>'remaining')::int = 0, 'none left after two selections';
 perform t.mfa('c');
 perform public.aura_market_save_campaign(t.ws('c'), camp, 'public', false, t.content('Two UGC creators wanted', '{"positions":1,"compensation":{"money":{"type":"fixed","currency":"INR","min":2500}}}'));
 assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), camp), '23514'), 'positions cannot drop below the Creators already selected';
 perform public.aura_market_save_campaign(t.ws('c'), camp, 'public', false, t.content('Two UGC creators wanted', '{"positions":3,"compensation":{"money":{"type":"fixed","currency":"INR","min":2500}}}'));
 perform public.aura_market_publish(t.ws('c'), camp);
 perform t.me('e'); assert (public.aura_campaign_availability(t.ws('e'), camp)->>'remaining')::int = 1, 'adding a position reopens one';
 assert (public.aura_campaign_availability(t.ws('e'), t.g('ugc'))->>'positions') is null, 'undisclosed positions stay undisclosed';
 reset role; perform t.pass('positions: remaining places shown to Creators; never fewer than already selected');
end $$;

-- 5. Material changes reach applicants and Creators in negotiation; agreed proposals are untouched (R8, R10)
do $$ declare camp uuid := t.g('two'); na int; nb int; a jsonb; logged int; begin
 na := t.notes('a'); nb := t.notes('b');
 perform t.mfa('c');
 perform public.aura_market_save_campaign(t.ws('c'), camp, 'public', false, t.content('Two UGC creators wanted', '{"positions":3,"compensation":{"money":{"type":"fixed","currency":"INR","min":3200}}}'));
 perform public.aura_market_publish(t.ws('c'), camp);
 assert t.notes('a') = na + 1 and t.notes('b') = nb + 1, 'applicants and selected Creators are told about a material change';
 a := public.aura_campaign_plan(t.ws('c'), camp)->'amendments'->0;
 assert (a->>'participants')::int = 2 and a->'changes' ? 'compensation', 'the amendment log records what changed and who was told';
 logged := jsonb_array_length(public.aura_campaign_plan(t.ws('c'), camp)->'amendments');
 perform public.aura_market_save_campaign(t.ws('c'), camp, 'public', false, t.content('Two UGC creators wanted', '{"positions":3,"summary":"A slightly clearer summary for creators who are reading this campaign.","compensation":{"money":{"type":"fixed","currency":"INR","min":3200}}}'));
 perform public.aura_market_publish(t.ws('c'), camp);
 assert t.notes('a') = na + 1, 'non-material wording changes do not notify';
 assert jsonb_array_length(public.aura_campaign_plan(t.ws('c'), camp)->'amendments') = logged, 'and are not logged as amendments';
 reset role; perform t.pass('changes: material edits notify applicants and negotiators, are logged, and never alter agreed proposals');
end $$;

-- 6. Overview, duplicate and archive
do $$ declare o jsonb; x jsonb; dup uuid; dup2 uuid; rid uuid := gen_random_uuid(); begin
 perform t.mfa('c');
 o := public.aura_campaign_overview(t.ws('c'));
 x := (select e from jsonb_array_elements(o->'campaigns') e where (e->>'id')::uuid = t.g('two'));
 assert (x->>'applications')::int = 2 and (x->>'selected')::int = 2 and (x->>'positions')::int = 3, 'overview shows applications, selections and positions';
 assert (select bool_and((e->>'live_type')::boolean = (e->>'category' in ('paid','ugc','barter'))) from jsonb_array_elements(o->'campaigns') e), 'overview labels which types are live';
 dup := (public.aura_campaign_duplicate(t.ws('c'), t.g('ugc'), rid)->>'id')::uuid;
 dup2 := (public.aura_campaign_duplicate(t.ws('c'), t.g('ugc'), rid)->>'id')::uuid;
 assert dup = dup2, 'a repeated duplicate request makes one copy';
 x := public.aura_market_brand_campaign(t.ws('c'), dup);
 assert x->>'status' = 'draft' and x->'draft'->>'title' like 'Copy of %' and x->'draft'->'compensation' = public.aura_market_brand_campaign(t.ws('c'), t.g('ugc'))->'draft'->'compensation', 'a private draft with the same terms';
 assert (public.aura_campaign_plan(t.ws('c'), dup)->'plan'->>'objective') = 'content', 'and the same plan';
 assert t.val(format('select count(*) from aura_apply.application where campaign_id = %L', dup)) = '0', 'without applications';
 assert t.denied(format('select public.aura_campaign_archive(%L, %L, true)', t.ws('c'), t.g('two')), '55000'), 'live campaigns cannot be archived';
 perform public.aura_campaign_archive(t.ws('c'), dup, true);
 assert (select (e->>'archived')::boolean from jsonb_array_elements(public.aura_campaign_overview(t.ws('c'))->'campaigns') e where (e->>'id')::uuid = dup), 'drafts can be archived';
 perform public.aura_campaign_archive(t.ws('c'), dup, false);
 reset role; perform t.pass('management: overview numbers, idempotent duplicate with plan, archive only drafts and closed campaigns');
end $$;
\echo ---RESULTS---
select name from t.results order by name;
