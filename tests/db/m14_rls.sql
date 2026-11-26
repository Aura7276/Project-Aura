-- Executed by tests/unit/db-m14.test.ts on a disposable PostgreSQL with the real M02-M11 and M14 migrations and the auth and storage stubs (NOT Supabase).
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

-- M14 fixtures: r2 also becomes a granted reviewer (a second reviewer for appeals); r joins Brand c2 as an admin to test self-review.
insert into aura_social.reviewer(user_id) values (t.uid('r2'));
insert into aura_identity.membership values (t.ws('c2'), t.uid('r'), 'admin', true);
create table t.x(k text primary key, id uuid); grant all on t.x to authenticated, anon;
create function t.g(k text) returns uuid language sql stable as $$ select id from t.x where x.k = g.k $$;
create function t.case_of(k text) returns uuid language sql stable security definer as $$ select id from aura_brand.verification_case where workspace_id = t.ws(k) order by created_at desc limit 1 $$;
grant execute on function t.case_of(text) to authenticated;
create function t.evidence() returns jsonb language sql immutable as $$
 select '{"legal_name":"Hostel Co Private Limited","registration_number":"U55101 MH 2021 PTC 123456","registered_address":"12 Beach Road, Goa 403001","representative_name":"Riya Shah","representative_role":"Director","website":"https://hostelco.example","contact_email":"riya@hostelco.example"}'::jsonb $$;

-- Test-only: read fixture state with the owner's rights while a test user's role is active (access assertions still run as that user).
create function t.val(q text) returns text language plpgsql security definer as $$ declare r text; begin execute q into r; return r; end $$;
grant execute on function t.val(text) to authenticated, anon;

-- 1. Anonymous, direct and wrong-workspace access (AC02, AC05)
do $$ begin
 perform t.as_anon();
 assert t.denied('select public.aura_brand_state(''00000000-0000-0000-0000-000000000000'')'), 'anon cannot read Brand state';
 assert (public.aura_brand_public('nobody')->>'found')::boolean = false, 'anon public lookup finds nothing unpublished';
 perform t.mfa('c'); assert t.denied('select count(*) from aura_brand.profile'), 'no direct table access';
 perform t.me('a'); assert t.denied(format('select public.aura_brand_state(%L)', t.ws('c'))), 'a Creator cannot read a Brand workspace';
 assert t.denied(format('select public.aura_brand_save_profile(%L, ''{}'')', t.ws('a'))), 'a Creator workspace is not a Brand';
 perform t.mfa('d'); assert t.denied(format('select public.aura_brand_state(%L)', t.ws('d'))), 'an Agency label grants no Brand access';
 perform t.me('c'); assert t.denied(format('select public.aura_brand_save_profile(%L, ''{"public_name":"Hostel Co"}'')', t.ws('c'))), 'a Brand owner without MFA cannot write';
 reset role; perform t.pass('anonymous, direct, Creator, Agency and non-MFA access denied');
end $$;

-- 2. Onboarding: short mandatory part, progressive rest, zero social presence (F02, F03, F45, AC01)
do $$ declare s jsonb; begin
 perform t.mfa('c');
 s := public.aura_brand_save_profile(t.ws('c'), '{"public_name":"Hostel Co","business_type":"d2c","country":"in","intent":"both","objective":"awareness","unknown":"ignored"}');
 assert s->>'country' = 'IN' and s->>'business_type' = 'd2c' and not (s ? 'unknown'), 'basics saved, unknown keys ignored';
 assert t.val($q$select onboarding from aura_identity.workspace where id = t.ws('c')$q$) = 'in_progress', 'onboarding marked in progress';
 assert t.denied(format('select public.aura_brand_save_profile(%L, ''{"stage":"unicorn"}'')', t.ws('c')), '23514'), 'stages are a fixed list';
 assert t.denied(format('select public.aura_brand_save_profile(%L, ''{"website":"http://insecure.example"}'')', t.ws('c')), '23514'), 'websites must be https';
 perform public.aura_brand_save_goal(t.ws('c'), null, '{"kind":"awareness","metric":"Profile visits","target":"500","horizon_days":"30"}');
 perform public.aura_brand_complete_onboarding(t.ws('c'));
 s := public.aura_brand_state(t.ws('c'));
 assert jsonb_array_length(s->'socials') = 0 and jsonb_array_length(s->'goals') = 1, 'a Brand with no social presence can plan';
 assert s->'workspace'->>'onboarding' = 'completed' and s->'workspace'->>'verification' = 'pending', 'completed onboarding does not verify';
 assert t.val($q$select next_step from aura_identity.workspace where id = t.ws('c')$q$) = 'verification', 'next step is verification';
 perform t.mfa('r3'); perform public.aura_brand_save_profile(t.ws('c2'), '{"public_name":"Brand Two","business_type":"international","country":"GB"}');
 reset role; perform t.pass('onboarding: short mandatory step, progressive completion, zero social presence, completion is not verification');
end $$;

-- 3. Catalogue, audiences, guidelines, budget, Creator preferences, competitors (F11, F15–F20, F26–F30, AC07)
do $$ declare s uuid; o uuid; p jsonb; begin
 perform t.mfa('r3'); o := (public.aura_brand_save_segment(t.ws('c2'), null, '{"name":"Other brand segment"}')->>'id')::uuid;
 perform t.mfa('c');
 s := (public.aura_brand_save_segment(t.ws('c'), null, '{"name":"Budget backpackers","countries":["in","gb","xx1"],"age_min":"18","age_max":"30","interests":["travel","hostels"]}')->>'id')::uuid;
 assert t.val(format('select basis from aura_brand.segment where id = %L', s)) = 'hypothesis', 'audiences are hypotheses until confirmed (F16)';
 assert t.val(format('select countries from aura_brand.segment where id = %L', s)) = '{IN,GB}', 'country codes cleaned';
 assert t.denied(format('select public.aura_brand_save_segment(%L, null, ''{"name":"Bad ages","age_min":"40","age_max":"20"}'')', t.ws('c')), '23514'), 'age range checked';
 p := public.aura_brand_save_product(t.ws('c'), null, jsonb_build_object('name', 'Dorm bed', 'kind', 'service', 'currency', 'INR', 'price_min', '600', 'price_max', '900', 'claims', '["Free breakfast","Rooftop cafe"]', 'segment_ids', jsonb_build_array(s, o)));
 assert (p->'segment_ids') = jsonb_build_array(s), 'only your own audiences can be linked';
 insert into t.x values ('product', (p->>'id')::uuid);
 assert t.denied(format('select public.aura_brand_save_product(%L, null, ''{"name":"Bad price","price_min":"9","price_max":"1"}'')', t.ws('c')), '23514'), 'price range checked';
 assert t.denied(format('select public.aura_brand_save_guideline(%L, ''{"colours":["red"]}'')', t.ws('c')), '22023'), 'colours must be hex';
 perform public.aura_brand_save_guideline(t.ws('c'), '{"tone":["warm","honest"],"colours":["#5b4bd6"],"dos":["Show real guests"],"donts":["No price promises"]}');
 assert t.val($q$select colours from aura_brand.guideline where workspace_id = t.ws('c')$q$) = '{#5B4BD6}', 'colours normalised';
 assert public.aura_brand_state(t.ws('c'))->'budget' = 'null'::jsonb, 'no budget is required (AC07)';
 perform public.aura_brand_save_budget(t.ws('c'), '{"currency":"INR","range_min":"20000","range_max":"50000","period":"month","creator_share":"60"}');
 assert t.denied(format('select public.aura_brand_save_budget(%L, ''{"currency":"INR","range_min":"9","range_max":"1"}'')', t.ws('c')), '23514'), 'budget range checked';
 perform public.aura_brand_save_budget(t.ws('c'), null);
 assert t.val($q$select count(*) from aura_brand.budget where workspace_id = t.ws('c')$q$) = '0', 'the budget can be cleared: it is never a commitment';
 perform public.aura_brand_save_creator_pref(t.ws('c'), '{"niches":["travel"],"experience":["emerging","legendary"],"countries":["in"],"ugc_interest":true}');
 assert t.val($q$select experience from aura_brand.creator_pref where workspace_id = t.ws('c')$q$) = '{emerging}', 'only known experience levels kept';
 perform public.aura_brand_save_competitor(t.ws('c'), '{"name":"Rival Hostels","conflict":true}');
 reset role; perform t.pass('catalogue, audiences as hypotheses, guidelines, optional budget, Creator preferences and competitors');
end $$;

-- 4. Brand social accounts: separate, manual, source-labelled, at most 10 (F23–F25, AC08)
do $$ declare i int; begin
 perform t.mfa('c');
 for i in 1..10 loop perform public.aura_brand_save_social(t.ws('c'), jsonb_build_object('platform', 'instagram', 'handle', '@hostelco' || i, 'followers', i * 10)); end loop;
 assert t.denied(format('select public.aura_brand_save_social(%L, ''{"platform":"youtube","handle":"eleven"}'')', t.ws('c')), '54000'), 'an 11th account is refused';
 assert t.val($q$select count(*) from aura_brand.social_account where workspace_id = t.ws('c') and source = 'self_reported' and observed_on = current_date$q$) = '10', 'counts are labelled self-reported with a date';
 assert t.val($q$select count(*) from aura_creator.social_account where workspace_id = t.ws('c')$q$) = '0', 'Brand accounts never enter the Creator account tables';
 perform public.aura_brand_delete(t.ws('c'), 'social_account', (public.aura_brand_state(t.ws('c'))->'socials'->0->>'id')::uuid);
 assert t.denied(format('select public.aura_brand_save_social(%L, ''{"platform":"instagram","handle":"hostelco2"}'')', t.ws('c')), '23505'), 'no duplicate accounts';
 assert t.denied(format('select public.aura_brand_save_social(%L, ''{"platform":"youtube","handle":"later","followers":"5","observed_on":"2999-01-01"}'')', t.ws('c')), '22023'), 'no future dates';
 reset role; perform t.pass('Brand social accounts: separate from Creators, self-reported with dates, limit of 10');
end $$;

-- 5. Maturity without a score, and growth plans that keep the Brand's own edits (F09, F44)
do $$ declare m jsonb; it uuid; begin
 perform t.mfa('c');
 m := public.aura_brand_save_maturity(t.ws('c'), '{"presence":"starting","content":"developing","score":"99","creators":"expert"}');
 assert m = '{"presence":"starting","content":"developing"}'::jsonb, 'only known questions and levels are stored; no score';
 perform public.aura_brand_save_plan(t.ws('c'), 30, '[{"rule_key":"a","title":"Write your brand voice"},{"rule_key":"b","title":"Add your first product"}]');
 it := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_brand_state(t.ws('c'))->'plan') x where x->>'rule_key' = 'a');
 perform public.aura_brand_plan_item(t.ws('c'), it, 'edit', 'Write our brand voice in 5 lines');
 perform public.aura_brand_plan_item(t.ws('c'), (select (x->>'id')::uuid from jsonb_array_elements(public.aura_brand_state(t.ws('c'))->'plan') x where x->>'rule_key' = 'b'), 'done');
 perform public.aura_brand_plan_item(t.ws('c'), null, 'add', 'Visit two local creators', null, 7);
 perform public.aura_brand_save_plan(t.ws('c'), 30, '[{"rule_key":"a","title":"Write your brand voice"},{"rule_key":"c","title":"Set a goal"}]');
 assert t.val(format('select title from aura_brand.plan_item where id = %L', it)) = 'Write our brand voice in 5 lines', 'regenerating keeps edited items';
 assert t.val($q$select count(*) from aura_brand.plan_item where workspace_id = t.ws('c') and rule_key = 'b' and done_at is not null$q$) = '1', 'and completed items';
 assert t.val($q$select count(*) from aura_brand.plan_item where workspace_id = t.ws('c') and horizon_days = 30$q$) = '3', 'new suggestions added once';
 assert t.denied(format('select public.aura_brand_save_plan(%L, 14, ''[]'')', t.ws('c')), '22023'), 'plans are 7, 30 or 90 days';
 reset role; perform t.pass('maturity has no score; 7, 30 and 90-day plans keep edits and completed steps');
end $$;

-- 6. Verification: evidence by business type, declaration, information request, approval (F31–F35, AC03, AC04)
do $$ declare r jsonb; cid uuid; begin
 perform t.mfa('c');
 assert t.denied(format('select public.aura_brand_publish(%L, true, ''hostel-co'')', t.ws('c')), '55000'), 'an unverified Brand cannot publish its profile';
 assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), t.campaign('c', 'ugc', 'Before verification', '{}')), '55000'), 'nor a campaign (AC03)';
 r := public.aura_brand_verification_save(t.ws('c'), '{"legal_name":"Hostel Co Private Limited"}');
 assert r->>'kind' = 'initial' and r->'missing' ? 'registration_number', 'missing evidence listed for a D2C business';
 assert t.denied(format('select public.aura_brand_verification_submit(%L, true)', t.ws('c')), '22023'), 'incomplete evidence cannot be submitted';
 r := public.aura_brand_verification_save(t.ws('c'), t.evidence());
 assert jsonb_array_length(r->'missing') = 0 and r->>'registration_number' = 'U55101MH2021PTC123456', 'complete; numbers normalised';
 assert t.denied(format('select public.aura_brand_verification_submit(%L, false)', t.ws('c')), '22023'), 'the declaration is required';
 perform public.aura_brand_verification_submit(t.ws('c'), true);
 assert t.denied(format('select public.aura_brand_verification_save(%L, ''{}'')', t.ws('c')), '55000'), 'no edits while a reviewer has it';
 cid := t.case_of('c');
 perform t.mfa('r3'); assert t.denied('select public.aura_brand_review_queue()'), 'a reviewer who is not a platform admin is denied';
 perform t.me('r'); assert t.denied('select public.aura_brand_review_queue()'), 'reviewers need MFA';
 perform t.mfa('r');
 r := public.aura_brand_review_case(cid);
 assert (r->>'domain_match')::boolean and r->>'legal_name' = 'Hostel Co Private Limited', 'the reviewer sees evidence and a supporting domain signal';
 assert t.denied(format('select public.aura_brand_review_decide(%L, ''approved'', ''ok'')', cid), '22023'), 'a reason is required';
 perform public.aura_brand_review_decide(cid, 'info_requested', 'Please add the GST number to the note.');
 perform t.mfa('c');
 assert public.aura_brand_state(t.ws('c'))->'verification'->>'status' = 'info_requested', 'the Brand sees the request';
 perform public.aura_brand_verification_save(t.ws('c'), '{"note":"GSTIN 30ABCDE1234F1Z5"}');
 perform public.aura_brand_verification_submit(t.ws('c'), true);
 perform t.mfa('r'); perform public.aura_brand_review_decide(cid, 'approved', 'Registration and director checked.');
 assert t.denied(format('select public.aura_brand_review_decide(%L, ''rejected'', ''late change'')', cid), '55000'), 'a decided case stays decided';
 reset role;
 assert t.val($q$select verification from aura_identity.workspace where id = t.ws('c')$q$) = 'verified' and t.val($q$select aura_market.verified(t.ws('c'))$q$)::boolean, 'approval verifies the workspace for M10 and M11 gates';
 assert t.val($q$select verification from aura_identity.workspace where id = t.ws('c2')$q$) = 'pending', 'verifying one workspace does not verify another (AC04)';
 assert t.val($q$select count(*) from aura_market.verification_decision where workspace_id = t.ws('c') and decision = 'verified'$q$) = '1', 'decision kept in the shared history';
 assert aura_profile.brand_verified(t.ws('c')) and not aura_profile.brand_verified(t.ws('c2')), 'M09 enquiries now read the real verification';
 assert t.val(format('select count(*) from aura_brand.verification_event where case_id = %L', cid))::int >= 5, 'every step is recorded';
 perform t.pass('verification: evidence by business type, declaration, information request, approval, per-workspace (AC03, AC04)');
end $$;

-- 7. Rejection, appeal to a different reviewer, self-review refused (F37)
do $$ declare cid uuid; a uuid; begin
 perform t.mfa('r3');
 perform public.aura_brand_verification_save(t.ws('c2'), '{"legal_name":"Brand Two Ltd","registration_country":"GB","registration_number":"09876543","registered_address":"1 High St, London","representative_name":"Sam Lee","representative_role":"Owner"}');
 perform public.aura_brand_verification_submit(t.ws('c2'), true); cid := t.case_of('c2');
 perform t.mfa('r'); assert t.denied(format('select public.aura_brand_review_decide(%L, ''approved'', ''Looks fine'')', cid)), 'no review of a workspace you belong to';
 assert (select (x->>'own')::boolean from jsonb_array_elements(public.aura_brand_review_queue()) x where (x->>'id')::uuid = cid), 'the queue flags your own workspace';
 perform t.mfa('r2'); perform public.aura_brand_review_decide(cid, 'rejected', 'The registration number does not match the name.');
 perform t.mfa('r3');
 assert t.denied(format('select public.aura_brand_verification_appeal(%L, ''short'')', t.ws('c2')), '22023'), 'an appeal needs a reason';
 a := (public.aura_brand_verification_appeal(t.ws('c2'), 'The number is for our parent company; we attach the subsidiary number in the note.')->>'id')::uuid;
 assert t.denied(format('select public.aura_brand_verification_appeal(%L, ''A second appeal with a long enough reason'')', t.ws('c2')), '55000'), 'one appeal only';
 perform t.mfa('r2'); assert t.denied(format('select public.aura_brand_review_decide(%L, ''approved'', ''Changed my mind'')', a)), 'the same reviewer cannot decide the appeal';
 reset role; delete from aura_identity.membership where workspace_id = t.ws('c2') and user_id = t.uid('r'); -- fixture: r leaves c2 so r can act as the second reviewer
 perform t.mfa('r'); perform public.aura_brand_review_decide(a, 'approved', 'Parent and subsidiary confirmed.');
 reset role; assert t.val($q$select aura_market.verified(t.ws('c2'))$q$)::boolean, 'the appeal can succeed';
 perform t.pass('rejection with reasons, one appeal decided by a different reviewer, no self-review');
end $$;

-- 8. Revalidation of a legal identity change pauses outreach until confirmed (F36)
do $$ declare r jsonb; begin
 perform t.mfa('c');
 r := public.aura_brand_verification_save(t.ws('c'), '{"legal_name":"Hostel Co Hospitality LLP","registration_number":"AAB-1234"}');
 assert r->>'kind' = 'revalidation' and r->>'representative_name' = 'Riya Shah', 'a change starts a revalidation prefilled from the approved case';
 assert t.val($q$select aura_market.verified(t.ws('c'))$q$)::boolean, 'nothing changes until it is submitted';
 r := public.aura_brand_verification_submit(t.ws('c'), true);
 assert (r->>'paused')::boolean and not t.val($q$select aura_market.verified(t.ws('c'))$q$)::boolean, 'submitting pauses commercial actions';
 assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), t.campaign('c', 'ugc', 'During revalidation', '{}')), '55000'), 'no publishing while paused';
 perform t.mfa('r'); perform public.aura_brand_review_decide(t.case_of('c'), 'approved', 'LLP registration checked.');
 reset role; assert t.val($q$select aura_market.verified(t.ws('c'))$q$)::boolean, 'approved again';
 perform t.pass('revalidation: a legal identity change pauses outreach until a reviewer confirms it');
end $$;

-- 9. Public profile: private by default, explicit publication, public projection only (F10, F46, F47, AC08)
do $$ declare r jsonb; begin
 perform t.as_anon(); assert (public.aura_brand_public('hostel-co')->>'found')::boolean = false, 'private by default';
 perform t.mfa('c');
 assert t.denied(format('select public.aura_brand_publish(%L, true, ''hostel-co'')', t.ws('c')), '22023'), 'an about text is needed';
 perform public.aura_brand_save_profile(t.ws('c'), '{"about":"Hostels for budget travellers across Goa and Kerala, with rooftop cafes.","tagline":"Stay more, spend less","website":"https://hostelco.example"}');
 assert (public.aura_brand_check_slug(t.ws('c'), 'campaigns')->>'reason') = 'reserved', 'Brand area routes are reserved';
 assert t.denied(format('select public.aura_brand_publish(%L, true, ''Bad Slug'')', t.ws('c')), '22023'), 'slug format checked';
 perform public.aura_brand_publish(t.ws('c'), true, 'hostel-co');
 perform t.mfa('r3'); perform public.aura_brand_save_profile(t.ws('c2'), '{"about":"A second brand used to test that addresses stay unique across workspaces."}');
 assert (public.aura_brand_check_slug(t.ws('c2'), 'hostel-co')->>'reason') = 'taken', 'addresses are unique';
 assert t.denied(format('select public.aura_brand_publish(%L, true, ''hostel-co'')', t.ws('c2')), '23505'), 'and enforced';
 perform t.as_anon(); r := public.aura_brand_public('hostel-co');
 assert (r->>'found')::boolean and r->'profile'->>'name' = 'Hostel Co' and jsonb_array_length(r->'profile'->'products') = 1, 'the published profile is public';
 assert r::text !~ 'Hostel Co Private|Hospitality LLP|Riya|U55101|AAB-1234|20000|Budget backpackers|Rival|Director', 'no legal identity, representative, budget, audiences or competitors';
 perform t.me('a'); assert (public.aura_brand_public_for(t.ws('a'), t.ws('c'))->>'found')::boolean, 'Creators see the same projection';
 perform t.mfa('c'); perform public.aura_brand_publish(t.ws('c'), false);
 perform t.as_anon(); assert (public.aura_brand_public('hostel-co')->>'found')::boolean = false, 'unpublishing hides it at once';
 reset role; perform t.pass('public profile: private by default, verified Brands only, unique address, public fields only');
end $$;

-- 10. Tenant isolation and audit (AC02)
do $$ declare n int := 0; begin
 perform t.mfa('r3');
 assert t.denied(format('select public.aura_brand_state(%L)', t.ws('c'))), 'another Brand cannot read'; n := n + 1;
 assert t.denied(format('select public.aura_brand_delete(%L, ''product'', %L)', t.ws('c2'), t.g('product'))), 'or delete another Brand''s product through its own workspace'; n := n + 1;
 assert t.denied(format('select public.aura_brand_save_product(%L, %L, ''{"name":"Hijack"}'')', t.ws('c2'), t.g('product'))), 'or edit it'; n := n + 1;
 assert t.denied(format('select public.aura_brand_verification_withdraw(%L)', t.ws('c'))), 'or touch its verification'; n := n + 1;
 perform t.me('e'); assert t.denied(format('select public.aura_brand_public_for(%L, %L)', t.ws('a'), t.ws('c'))), 'a Creator workspace member who is not the owner is denied'; n := n + 1;
 reset role;
 assert t.val($q$select count(distinct event) from aura_identity.event where event like 'brand\_%'$q$)::int >= 6, 'material events are audited';
 assert not exists(select 1 from information_schema.role_table_grants where table_schema = 'aura_brand' and grantee in ('anon','authenticated','PUBLIC')), 'no table grants';
 perform t.pass('tenant isolation: ' || n || ' checks; audit trail; no table grants');
end $$;
\echo ---RESULTS---
select name from t.results order by name;
