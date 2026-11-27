-- Executed by tests/unit/db-m20.test.ts on a disposable PostgreSQL with every migration through M20 and the auth and storage stubs (NOT Supabase).
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

create function t.val(q text) returns text language plpgsql security definer as $$ declare r text; begin execute q into r; return r; end $$;
grant execute on function t.val(text) to authenticated, anon;
-- M20 fixtures: Brand c has a business profile, a product, an audience, a budget and a competitor; Brand c2 has its own product.
do $$ begin
 perform t.mfa('c'); perform public.aura_brand_save_profile(t.ws('c'), '{"public_name":"Hostel Co","objective":"awareness","about":"Budget hostels in Goa."}');
 perform public.aura_brand_save_product(t.ws('c'), null, '{"name":"Dorm bed","claims":["Free breakfast"]}');
 perform public.aura_brand_save_segment(t.ws('c'), null, '{"name":"Backpackers"}');
 perform public.aura_brand_save_budget(t.ws('c'), '{"currency":"INR","range_min":"20000","range_max":"40000","period":"month"}');
 perform public.aura_brand_save_competitor(t.ws('c'), '{"name":"Rival Hostels"}');
 perform t.mfa('r3'); perform public.aura_brand_save_profile(t.ws('c2'), '{"public_name":"Brand Two"}');
 perform public.aura_brand_save_product(t.ws('c2'), null, '{"name":"Secret product of Brand Two"}');
 reset role;
end $$;

-- 1. Access and isolation (A8)
do $$ declare conv uuid; begin
 perform t.mfa('c'); conv := (public.aura_brand_ai_start(t.ws('c'), gen_random_uuid(), 'strategy', 'Q1 strategy')->>'id')::uuid; insert into t.x values ('conv', conv);
 perform t.as_anon(); assert t.denied(format('select public.aura_brand_ai_state(%L)', t.ws('c'))), 'anon denied';
 perform t.me('a'); assert t.denied(format('select public.aura_brand_ai_context(%L, ''strategy'')', t.ws('a'))), 'Creator workspaces have no Brand assistant';
 perform t.mfa('r3');
 assert t.denied(format('select public.aura_brand_ai_context(%L, ''strategy'')', t.ws('c'))), 'another Brand cannot read the context';
 assert t.denied(format('select public.aura_brand_ai_conversation(%L, %L)', t.ws('c2'), conv)), 'or a conversation through its own workspace';
 assert t.denied(format('select public.aura_brand_ai_context(%L, ''brief'', %L)', t.ws('c2'), t.g('ugc'))), 'or another Brand''s campaign';
 perform t.mfa('d'); assert t.denied(format('select public.aura_brand_ai_state(%L)', t.ws('d'))), 'an Agency has no access';
 perform t.me('c'); assert t.denied(format('select public.aura_brand_ai_start(%L, gen_random_uuid(), ''general'', ''Hello'')', t.ws('c'))), 'writes need MFA';
 perform t.mfa('c'); assert t.denied('select count(*) from aura_brand_ai.turn'), 'no direct table access';
 reset role; perform t.pass('access: other Brands, Creators, Agencies and anonymous callers are kept out; writes need MFA');
end $$;

-- 2. Context: only this workspace, only ticked sources, facts labelled, memory off by default (A2, A4, A8)
do $$ declare c jsonb; begin
 perform t.mfa('c'); c := public.aura_brand_ai_context(t.ws('c'), 'strategy');
 assert c->'facts'->'profile'->>'name' = 'Hostel Co' and c->'facts'->'products'->0->'approved_claims' ? 'Free breakfast', 'profile and approved claims are included';
 assert c->'facts'->'audiences'->0->>'basis' = 'hypothesis' and c->'labels'->>'audiences' ~ 'unconfirmed', 'audiences carry their basis';
 assert not (c->'facts' ? 'budget') and not (c->'facts' ? 'competitors'), 'budget and competitors are left out unless ticked';
 assert c::text !~ 'Secret product of Brand Two', 'no other workspace''s data';
 assert not (c->'facts' ? 'team_preferences'), 'memory is off by default';
 perform public.aura_brand_ai_settings(t.ws('c'), true, 'Prefer short, practical steps', false, array['profile','products','budget']);
 c := public.aura_brand_ai_context(t.ws('c'), 'plan');
 assert c->'facts'->'budget'->>'note' = 'indicative, not a commitment' and not (c->'facts' ? 'audiences'), 'the ticked sources and only those';
 assert c->'facts'->>'team_preferences' = 'Prefer short, practical steps', 'memory is used once switched on';
 perform public.aura_brand_ai_settings(t.ws('c'), null, null, true, array['profile','products','audiences','guidelines','goals','plan']);
 assert not (public.aura_brand_ai_context(t.ws('c'), 'plan')->'facts' ? 'team_preferences'), 'and gone once deleted';
 c := public.aura_brand_ai_context(t.ws('c'), 'results', t.g('ugc'));
 assert c->'facts'->>'results_rule' ~ 'Do not invent numbers' and c->'facts'->'campaign'->>'category' = 'ugc', 'results questions use recorded figures only';
 assert t.denied(format('select public.aura_brand_ai_settings(%L, false, null, false, array[''everything''])', t.ws('c')), '23514'), 'only known sources';
 reset role; perform t.pass('context: own workspace only, ticked sources only, audiences labelled, memory opt-in and deletable, results rule');
end $$;

-- 3. Allowance (reserved before any provider request) and conversations
do $$ declare a uuid; b uuid; rid uuid := gen_random_uuid(); begin
 update aura_brand_ai.setting set value = '2' where key = 'monthly_requests'; -- fixture: small allowance
 perform t.mfa('c');
 assert public.aura_brand_ai_reserve(t.ws('c')) and public.aura_brand_ai_reserve(t.ws('c')) and not public.aura_brand_ai_reserve(t.ws('c')), 'two requests, then the allowance is used up';
 assert (public.aura_brand_ai_state(t.ws('c'))->'usage'->>'used')::int = 2, 'usage is shown';
 a := (public.aura_brand_ai_start(t.ws('c'), rid, 'general', 'Ideas')->>'id')::uuid; b := (public.aura_brand_ai_start(t.ws('c'), rid, 'general', 'Ideas')->>'id')::uuid;
 assert a = b, 'a repeated start request makes one conversation';
 assert t.denied(format('select public.aura_brand_ai_start(%L, gen_random_uuid(), ''brief'', ''Brief'')', t.ws('c')), '22023'), 'brief questions need a campaign';
 perform public.aura_brand_ai_record(t.ws('c'), t.g('conv'), 'What should we focus on?', 'Assistant is offline. Your question is saved.', 'offline', null);
 assert (select count(*) from jsonb_array_elements(public.aura_brand_ai_conversation(t.ws('c'), t.g('conv'))->'turns')) = 2, 'question and status kept even when offline';
 reset role; update aura_brand_ai.setting set value = '100' where key = 'monthly_requests'; -- fixture: restore
 perform t.pass('allowance and history: reserved under a lock, idempotent start, offline turns kept');
end $$;

-- 4. Drafts need explicit approval; apply re-checks and writes only private records (A3, A5, A6, A7)
do $$ declare d uuid; r jsonb; before_inv int; live jsonb; begin
 perform t.mfa('c');
 d := (public.aura_brand_ai_save_draft(t.ws('c'), t.g('conv'), 'plan_items', '{}', '{"horizon":30,"items":[{"title":"Run a two-Creator UGC pilot","detail":"One product, one deliverable each"},{"title":"Record baseline numbers"}]}', 'ai')->>'id')::uuid;
 assert t.denied(format('select public.aura_brand_ai_apply(%L, %L, false)', t.ws('c'), d), '22023'), 'nothing is applied without confirmation';
 r := public.aura_brand_ai_apply(t.ws('c'), d, true);
 assert (r->>'applied_steps')::int = 2 and exists(select 1 from jsonb_array_elements(public.aura_brand_state(t.ws('c'))->'plan') p where p->>'title' = 'Run a two-Creator UGC pilot' and (p->>'edited')::boolean), 'approved steps join the M14 plan as the Brand''s own';
 assert t.denied(format('select public.aura_brand_ai_apply(%L, %L, true)', t.ws('c'), d), '55000'), 'a draft applies once';
 live := public.aura_market_brand_campaign(t.ws('c'), t.g('ugc'));
 d := (public.aura_brand_ai_save_draft(t.ws('c'), t.g('conv'), 'brief', jsonb_build_object('campaign_id', t.g('ugc')), '{"text":"Show what is inside our compact travel kit and how you would use it on a weekend trip."}', 'ai')->>'id')::uuid;
 perform public.aura_brand_ai_apply(t.ws('c'), d, true);
 r := public.aura_market_brand_campaign(t.ws('c'), t.g('ugc'));
 assert r->'draft'->>'brief' ~ 'compact travel kit' and r->>'status' = live->>'status' and r->>'published_version' = live->>'published_version', 'a brief lands in the draft only; the live campaign is unchanged';
 before_inv := t.val('select count(*) from aura_apply.invitation')::int;
 d := (public.aura_brand_ai_save_draft(t.ws('c'), t.g('conv'), 'invitation_message', '{}', '{"text":"We love your budget travel films and would like to invite you."}', 'ai')->>'id')::uuid;
 perform public.aura_brand_ai_apply(t.ws('c'), d, true);
 assert t.val('select count(*) from aura_apply.invitation')::int = before_inv, 'an approved message is not sent by the assistant';
 d := (public.aura_brand_ai_save_draft(t.ws('c'), t.g('conv'), 'strategy_note', '{}', '{"text":"Focus on UGC for the first month."}', 'manual')->>'id')::uuid;
 perform public.aura_brand_ai_discard(t.ws('c'), d);
 assert t.denied(format('select public.aura_brand_ai_save_draft(%L, null, ''plan_items'', ''{}'', ''{"horizon":14,"items":[{"title":"x"}]}'', ''ai'')', t.ws('c')), '22023'), 'plan drafts use 7, 30 or 90 days';
 perform t.mfa('r3'); assert t.denied(format('select public.aura_brand_ai_apply(%L, %L, true)', t.ws('c2'), d)), 'another Brand cannot apply it';
 reset role; perform t.pass('drafts: explicit confirmation, applied once, plan steps and draft briefs only, messages never sent, discardable');
end $$;

-- 5. Unverified Brands cannot bypass commercial gates through the assistant
do $$ declare camp uuid; d uuid; begin
 perform t.mfa('r3');
 camp := t.campaign('c2', 'ugc', 'Unverified brand campaign', '{}');
 d := (public.aura_brand_ai_save_draft(t.ws('c2'), null, 'brief', jsonb_build_object('campaign_id', camp), '{"text":"A brief drafted with the assistant for an unverified Brand."}', 'ai')->>'id')::uuid;
 perform public.aura_brand_ai_apply(t.ws('c2'), d, true);
 assert (public.aura_market_brand_campaign(t.ws('c2'), camp)->>'status') = 'draft', 'still a private draft';
 assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c2'), camp), '55000'), 'and still cannot be published without verification';
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_brand\_ai\_%' and pg_get_functiondef(p.oid) ~* 'aura_market_publish|aura_apply_invite|aura_apply_enquire|aura_selection_hold|aura_apply_confirm|payment'), 'no assistant function can publish, invite, select, confirm or pay';
 reset role; perform t.pass('gates: the assistant writes drafts only; publication, outreach, selection and payments keep their own gates');
end $$;
\echo ---RESULTS---
select name from t.results order by name;
