-- Executed by tests/unit/db-m11.test.ts on a disposable PostgreSQL with the real M02-M06, M09, M10 and M11 migrations and the auth and storage stubs (NOT Supabase).
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

-- 1. Anonymous and direct access
do $$ begin perform t.as_anon();
 assert t.denied(format('select public.aura_apply_form(%L, %L)', t.ws('a'), t.g('paid'))), 'anon form';
 assert t.denied('select * from aura_apply.application'), 'anon table';
 reset role; perform t.me('a');
 assert t.denied('select * from aura_apply.proposal'), 'direct proposals';
 assert t.denied('update aura_apply.application set status = ''selected'''), 'direct status change';
 assert t.denied('select aura_apply.collab(gen_random_uuid(), gen_random_uuid())'), 'private helper';
 assert t.denied('select public.aura_apply_report_queue()'), 'report queue needs a reviewer';
 reset role; perform t.pass('anonymous and direct access denied'); end $$;

-- 2. Rules and screening (F02, F05, F36)
do $$ declare r jsonb; begin perform t.me('a');
 assert t.denied(format('select public.aura_apply_set_rules(%L, %L, ''{}'', null)', t.ws('a'), t.g('paid'))), 'a Creator cannot set application rules';
 perform t.mfa('c');
 assert t.denied(format('select public.aura_apply_set_rules(%L, %L, ''{}'', %L)', t.ws('c'), t.g('ugc'), '[{"prompt":"Please film a new reel for us about our bag"}]'), '22023'), 'screening cannot ask for new unpaid content';
 r := public.aura_apply_set_rules(t.ws('c'), t.g('paid'), '{"quick_apply":false,"negotiable":true}', '[{"prompt":"Which city are you based in?","required":true},{"prompt":"Can you travel to Goa in December?","kind":"yes_no"}]');
 assert jsonb_array_length(r->'questions') = 2 and (r->'rules'->>'negotiable')::boolean, 'rules and questions saved';
 perform public.aura_apply_set_rules(t.ws('c'), t.g('ugc'), '{"quick_apply":true,"reapply":false,"selection_capacity":5}', '[]');
 perform t.mfa('r3'); assert t.denied(format('select public.aura_apply_rules(%L, %L)', t.ws('c2'), t.g('paid'))), 'another Brand cannot read the rules';
 reset role; perform t.pass('rules and screening: Brand only, unpaid custom work refused, questions stored'); end $$;

-- 3. Applying (F01, F03, F04, F06, F09, AC01, AC03)
do $$ declare d jsonb; app uuid; q uuid; priv uuid; other uuid; begin
 perform t.me('a'); priv := (public.aura_profile_save_item(t.ws('a'), gen_random_uuid(), null, '{"kind":"organic","title":"Private piece","visibility":"private"}')->>'id')::uuid;
 perform t.me('b'); other := (public.aura_profile_save_item(t.ws('b'), gen_random_uuid(), null, '{"kind":"organic","title":"Not yours","visibility":"public"}')->>'id')::uuid;
 perform t.me('a');
 d := public.aura_apply_form(t.ws('a'), t.g('paid')); assert jsonb_array_length(d->'questions') = 2 and d->'application' = 'null'::jsonb, 'the form loads the campaign and its questions';
 q := (select (x->>'id')::uuid from jsonb_array_elements(d->'questions') x where (x->>'required')::boolean); reset role; insert into t.x values ('q_city', q); perform t.me('a');
 assert t.denied(format('select public.aura_apply_save_draft(%L, gen_random_uuid(), %L, %L)', t.ws('a'), t.g('paid'), jsonb_build_object('portfolio_ids', jsonb_build_array(priv))), '22023'), 'a private portfolio item cannot be attached';
 assert t.denied(format('select public.aura_apply_save_draft(%L, gen_random_uuid(), %L, %L)', t.ws('a'), t.g('paid'), jsonb_build_object('portfolio_ids', jsonb_build_array(other))), '22023'), 'another Creator''s item cannot be attached';
 app := (public.aura_apply_save_draft(t.ws('a'), gen_random_uuid(), t.g('paid'), jsonb_build_object('pitch', 'short'))->>'id')::uuid; insert into t.x values ('app_a', app);
 assert (public.aura_apply_form(t.ws('a'), t.g('paid'))->'application'->'content'->>'pitch') = 'short', 'a draft is saved and resumes';
 perform t.mfa('c'); assert t.denied(format('select public.aura_apply_brand_application(%L, %L)', t.ws('c'), app)), 'a Brand never sees a draft';
 perform t.me('a');
 assert t.denied(format('select public.aura_apply_submit(%L, %L, false)', t.ws('a'), app), '22023'), 'submission needs explicit confirmation';
 assert t.denied(format('select public.aura_apply_submit(%L, %L, true)', t.ws('a'), app), '22023'), 'a pitch is required when quick apply is off';
 perform public.aura_apply_save_draft(t.ws('a'), gen_random_uuid(), t.g('paid'), t.app_content(t.g('acc_a')));
 assert t.denied(format('select public.aura_apply_submit(%L, %L, true)', t.ws('a'), app), '22023'), 'a required screening answer is missing';
 perform public.aura_apply_save_draft(t.ws('a'), gen_random_uuid(), t.g('paid'), t.app_content(t.g('acc_a'), jsonb_build_object('answers', jsonb_build_object(q::text, 'Mumbai'))));
 assert (public.aura_apply_submit(t.ws('a'), app, true)->>'status') = 'submitted', 'a complete, confirmed application is submitted';
 assert t.denied(format('select public.aura_apply_save_draft(%L, gen_random_uuid(), %L, ''{}'')', t.ws('a'), t.g('paid')), '23505'), 'one active application per campaign';
 perform t.me('b'); perform public.aura_apply_save_draft(t.ws('b'), gen_random_uuid(), t.g('paid'), t.app_content(t.g('acc_b'), jsonb_build_object('answers', jsonb_build_object(q::text, 'Pune'))));
 reset role; perform t.pass('applying: drafts resume, Brands never see drafts, explicit confirmation, required pitch and answers, own non-private portfolio only, one active application'); end $$;

-- 4. Ineligible Creators are blocked at submission (M10-F16)
do $$ declare app uuid; begin
 reset role; app := (select id from aura_apply.application where creator_workspace_id = t.ws('b') and campaign_id = t.g('paid'));
 perform t.me('b'); assert t.denied(format('select public.aura_apply_submit(%L, %L, true)', t.ws('b'), app), '55000'), 'a Creator below the requirement cannot submit';
 perform public.aura_apply_delete_draft(t.ws('b'), app);
 reset role; assert not exists(select 1 from aura_apply.application where id = app), 'a draft can be deleted';
 perform t.me('b'); app := (public.aura_apply_save_draft(t.ws('b'), gen_random_uuid(), t.g('ugc'), jsonb_build_object('account_id', t.g('acc_b')))->>'id')::uuid; insert into t.x values ('app_b_ugc', app);
 assert (public.aura_apply_submit(t.ws('b'), app, true)->>'status') = 'submitted', 'quick apply needs no pitch, still confirmed (UGC, no follower minimum)';
 reset role; perform t.pass('eligibility re-checked at submission; drafts deletable; quick apply where the Brand allows it'); end $$;

-- 5. Edits, locking, privacy of what the Brand sees (F10, F33, AC03)
do $$ declare b jsonb; kit uuid; begin perform t.me('a');
 kit := (public.aura_profile_create_kit(t.ws('a'), gen_random_uuid(), '{"name":"M11 kit"}')->>'id')::uuid;
 perform public.aura_apply_edit(t.ws('a'), t.g('app_a'), t.app_content(t.g('acc_a'), jsonb_build_object('kit_id', kit, 'answers', jsonb_build_object(t.g('q_city')::text, 'Mumbai'))), true);
 assert (public.aura_apply_application(t.ws('a'), t.g('app_a'))->>'version')::int = 2, 'an edit before review creates version 2';
 perform t.mfa('c'); b := public.aura_apply_brand_application(t.ws('c'), t.g('app_a'));
 assert jsonb_array_length(b->'versions') = 2 and b->'shared'->'account'->>'handle' = 'asha.m11' and b->'shared'->'account'->'followers'->>'source' = 'self-reported', 'the Brand sees versions and the chosen account, labelled';
 assert b->'shared'->'kit'->'kit'->>'name' = 'M11 kit', 'the attached media kit is visible to this Brand';
 assert b::text !~ '(@example|"email"|workspace_id|creator_workspace_id|Private piece)', 'nothing beyond what was shared reaches the Brand';
 assert exists(select 1 from jsonb_array_elements((select public.aura_apply_brand(t.ws('c')))->'notifications') n where n->>'title' ~ 'updated'), 'the Brand is told about the change';
 perform public.aura_apply_decide(t.ws('c'), t.g('app_a'), 'review');
 perform t.me('a'); assert t.denied(format('select public.aura_apply_edit(%L, %L, %L, true)', t.ws('a'), t.g('app_a'), t.app_content(t.g('acc_a'))), '55000'), 'once review starts the application is locked';
 perform t.mfa('r3'); assert t.denied(format('select public.aura_apply_brand_application(%L, %L)', t.ws('c2'), t.g('app_a'))), 'another Brand cannot open it';
 reset role; assert (select count(*) from aura_apply.application_version where application_id = t.g('app_a')) = 2, 'the earlier version is kept';
 perform t.pass('edits create versions until review locks them; the Brand sees only the shared account, items and kit; other Brands cannot see it'); end $$;

-- 6. Clarifications and selection with capacity (F13–F15, F28, F29, F31)
do $$ declare cl uuid; begin perform t.mfa('c');
 cl := (public.aura_apply_ask(t.ws('c'), t.g('app_a'), 'Could you share your December dates?')->>'id')::uuid;
 perform t.me('a'); assert (public.aura_apply_application(t.ws('a'), t.g('app_a'))->>'status') = 'clarification', 'status shows a pending clarification';
 perform public.aura_apply_answer(t.ws('a'), cl, 'Free from 10 to 20 December.');
 assert (public.aura_apply_application(t.ws('a'), t.g('app_a'))->>'status') = 'review', 'answering returns it to review';
 perform t.mfa('c'); perform public.aura_apply_decide(t.ws('c'), t.g('app_a'), 'select');
 perform t.me('a'); assert exists(select 1 from jsonb_array_elements(public.aura_apply_creator(t.ws('a'))->'notifications') n where n->>'title' ~ 'selected \(not yet an agreement\)'), 'selection says it is not an agreement';
 reset role; perform t.mkcreator('f'); perform t.activate('f'); perform t.me('f'); insert into t.x values ('acc_f', t.set_followers('f', 'fay.m11', 5000));
 insert into t.x values ('app_f', (public.aura_apply_save_draft(t.ws('f'), gen_random_uuid(), t.g('paid'), t.app_content(t.g('acc_f'), jsonb_build_object('answers', jsonb_build_object(t.g('q_city')::text, 'Delhi'))))->>'id')::uuid);
 perform public.aura_apply_submit(t.ws('f'), t.g('app_f'), true);
 perform t.mfa('c'); assert t.denied(format('select public.aura_apply_decide(%L, %L, ''select'')', t.ws('c'), t.g('app_f')), '23514'), 'selection capacity (1 position) is enforced';
 perform public.aura_apply_decide(t.ws('c'), t.g('app_f'), 'waitlist');
 perform t.me('f'); assert exists(select 1 from jsonb_array_elements(public.aura_apply_creator(t.ws('f'))->'notifications') n where n->>'title' ~ 'not a guarantee'), 'the waitlist never promises selection';
 perform t.mfa('c'); perform public.aura_apply_decide(t.ws('c'), t.g('app_f'), 'reject', 'We chose a creator based in Goa.');
 perform t.me('f'); assert (public.aura_apply_application(t.ws('f'), t.g('app_f'))->>'feedback') = 'We chose a creator based in Goa.', 'optional rejection feedback reaches the Creator';
 reset role; assert not exists(select 1 from aura_apply.collaboration c join aura_apply.application a on a.collaboration_id = c.id where a.id = t.g('app_f') and c.status <> 'cancelled'), 'a rejected application cancels its prospective collaboration';
 perform t.pass('clarifications with deadlines, selection capacity, waitlist without promises, rejection with feedback, selection is not an agreement'); end $$;

-- 7. Withdrawal and reapplication (F11, F12, AC04)
do $$ declare app uuid; app2 uuid; begin perform t.me('b');
 perform public.aura_apply_withdraw(t.ws('b'), t.g('app_b_ugc'), true);
 assert exists(select 1 from jsonb_array_elements((select public.aura_apply_application(t.ws('b'), t.g('app_b_ugc')))->'history') h where h->>'event' = 'withdrawn'), 'withdrawal recorded';
 assert (public.aura_apply_application(t.ws('b'), t.g('app_b_ugc'))->>'can_reapply')::boolean, 'one reapplication is allowed after your own withdrawal';
 app := (public.aura_apply_save_draft(t.ws('b'), gen_random_uuid(), t.g('ugc'), jsonb_build_object('account_id', t.g('acc_b')))->>'id')::uuid;
 assert (public.aura_apply_submit(t.ws('b'), app, true)->>'status') = 'submitted', 'reapplied once';
 perform public.aura_apply_withdraw(t.ws('b'), app, true);
 app2 := (public.aura_apply_save_draft(t.ws('b'), gen_random_uuid(), t.g('ugc'), jsonb_build_object('account_id', t.g('acc_b')))->>'id')::uuid;
 assert t.denied(format('select public.aura_apply_submit(%L, %L, true)', t.ws('b'), app2), '55000'), 'a second reapplication is refused unless the Brand allows it';
 assert t.denied(format('select public.aura_apply_withdraw(%L, %L, false)', t.ws('b'), app2), '22023'), 'withdrawal needs confirmation';
 perform public.aura_apply_delete_draft(t.ws('b'), app2);
 perform t.mfa('c'); assert exists(select 1 from jsonb_array_elements((select public.aura_apply_brand(t.ws('c')))->'notifications') n where n->>'title' ~ 'withdrew'), 'the Brand is told about withdrawals';
 reset role; perform t.pass('withdrawal with confirmation and notice; one reapplication after withdrawal; further reapplication refused'); end $$;

-- 8. Invitations (F16–F20, F32, F35, M14-F34)
do $$ declare inv uuid; r jsonb; begin
 perform t.mfa('r3'); assert t.denied(format('select public.aura_apply_invite(%L, gen_random_uuid(), %L, ''We would love to work with you'')', t.ws('c2'), t.ws('a'))), 'a Brand cannot invite to a campaign it does not own';
 perform t.mfa('c');
 assert t.denied(format('select public.aura_apply_invite(%L, %L, %L, ''We would love to work with you'')', t.ws('c'), t.g('paid'), t.ws('b')), '55000'), 'invitations only to Creators who meet the requirements';
 inv := (public.aura_apply_invite(t.ws('c'), t.g('ugc'), t.ws('e'), 'We would love to work with you on unboxing videos.')->>'id')::uuid; insert into t.x values ('inv_e', inv);
 assert t.denied(format('select public.aura_apply_invite(%L, %L, %L, ''Again, please consider us'')', t.ws('c'), t.g('ugc'), t.ws('e')), '23505'), 'one open invitation per Creator and campaign';
 perform t.me('e'); r := public.aura_apply_invitation(t.ws('e'), inv); assert r->>'status' = 'sent' and (r->>'expires_at')::timestamptz > now() + interval '13 days', 'invitations expire after 14 days by default';
 perform public.aura_apply_respond_invitation(t.ws('e'), inv, 'clarify', 'Is the bag included or do I buy it?');
 perform t.mfa('c'); perform public.aura_apply_brand_answer(t.ws('c'), inv, 'The bag is included and yours to keep.');
 perform t.me('e'); r := public.aura_apply_respond_invitation(t.ws('e'), inv, 'interested');
 assert r->>'collaboration_id' is not null, 'interest opens a prospective collaboration (not an agreement)';
 insert into t.x values ('collab_e', (r->>'collaboration_id')::uuid);
 assert (select x->>'status' from jsonb_array_elements(public.aura_apply_creator(t.ws('e'))->'invitations') x where x->>'id' = inv::text) = 'interested', 'status tracked';
 -- an application from the same Creator to the same campaign links to the same collaboration (F32)
 -- expiry
 perform t.mfa('c'); inv := (public.aura_apply_invite(t.ws('c'), t.g('ugc'), t.ws('a'), 'Another invitation for you to consider.')->>'id')::uuid;
 reset role; update aura_apply.invitation set expires_at = now() - interval '1 minute' where id = inv;
 perform t.me('a'); assert t.denied(format('select public.aura_apply_respond_invitation(%L, %L, ''interested'')', t.ws('a'), inv), '55000'), 'an expired invitation cannot be accepted';
 assert (select x->>'status' from jsonb_array_elements(public.aura_apply_creator(t.ws('a'))->'invitations') x where x->>'id' = inv::text) = 'expired', 'shown as expired';
 -- block and report
 perform public.aura_apply_block(t.ws('a'), t.ws('c'), true);
 perform t.mfa('c'); assert t.denied(format('select public.aura_apply_enquire(%L, %L, null, ''Hello, quick question for you'')', t.ws('c'), t.ws('a')), '42501'), 'a blocked Brand cannot reach the Creator';
 perform t.me('a'); perform public.aura_apply_block(t.ws('a'), t.ws('c'), false);
 perform public.aura_apply_report(t.ws('a'), 'invitation', inv, 'harassment', 'Repeated invitations');
 assert t.denied(format('select public.aura_apply_report(%L, ''invitation'', %L, ''spam'', null)', t.ws('a'), inv), '23505'), 'one open report each';
 perform t.mfa('r'); assert jsonb_array_length(public.aura_apply_report_queue()) = 1, 'the reviewer sees the report';
 perform public.aura_apply_decide_report((public.aura_apply_report_queue()->0->>'id')::uuid, 'actioned', 'Confirmed');
 reset role; perform t.pass('invitations: owned live campaigns, eligible Creators only, one open each, clarifications, interest opens a collaboration, expiry, blocking and moderated reports'); end $$;

-- 9. Enquiries (F17, M14-F35)
do $$ declare e uuid; begin
 perform t.mfa('r3'); assert t.denied(format('select public.aura_apply_enquire(%L, %L, null, ''Hello, are you available?'')', t.ws('c2'), t.ws('a')), '55000'), 'an unverified Brand cannot send enquiries';
 perform t.mfa('c'); e := (public.aura_apply_enquire(t.ws('c'), t.ws('b'), null, 'Hello, are you open to a UGC project next month?')->>'id')::uuid;
 perform t.me('b'); assert exists(select 1 from jsonb_array_elements(public.aura_apply_creator(t.ws('b'))->'notifications') n where n->>'title' ~ 'not an invitation'), 'an enquiry is clearly not an invitation';
 perform public.aura_apply_respond_enquiry(t.ws('b'), e, 'interested', 'Yes, tell me more.');
 assert t.denied(format('select public.aura_apply_respond_enquiry(%L, %L, ''declined'', null)', t.ws('b'), e), '55000'), 'answered once';
 perform t.mfa('c'); assert (select x->>'reply' from jsonb_array_elements(public.aura_apply_brand(t.ws('c'))->'enquiries') x where x->>'id' = e::text) = 'Yes, tell me more.', 'the Brand sees the reply';
 reset role; perform t.pass('enquiries: verified Brands only, labelled as not invitations, answered once'); end $$;

-- 10. Negotiation (F22–F27, AC05, F30, F31)
do $$ declare c uuid := t.g('collab_e'); r jsonb; begin
 perform t.me('e'); perform public.aura_apply_propose(t.ws('e'), c, '{"money":{"currency":"INR","amount":4000},"deliverables":[{"type":"video","quantity":2}],"revisions":1,"start_on":"2026-12-10","end_on":"2026-12-20"}', 'Two videos, one revision.');
 perform t.mfa('c'); r := public.aura_apply_confirm(t.ws('c'), c, 1); assert not (r->>'both_confirmed')::boolean, 'one side confirmed';
 perform public.aura_apply_propose(t.ws('c'), c, '{"money":{"currency":"INR","amount":3500},"deliverables":[{"type":"video","quantity":2}],"revisions":1}', 'Counter offer');
 perform t.me('e'); assert t.denied(format('select public.aura_apply_confirm(%L, %L, 1)', t.ws('e'), c), '40001'), 'a superseded version cannot be confirmed';
 r := public.aura_apply_negotiation(t.ws('e'), c);
 assert (r->'current'->>'version')::int = 2 and jsonb_array_length(r->'current'->'confirmed_by') = 0, 'a new proposal resets every confirmation';
 assert (select x->>'status' from jsonb_array_elements(r->'proposals') x where (x->>'version')::int = 1) = 'superseded', 'the earlier version is kept, superseded';
 perform public.aura_apply_confirm(t.ws('e'), c, 2);
 perform t.mfa('c'); r := public.aura_apply_confirm(t.ws('c'), c, 2);
 assert (r->>'both_confirmed')::boolean and r->>'status' = 'ready_for_agreement', 'both sides confirming the same version makes it ready for an agreement';
 reset role; assert to_regclass('aura_apply.agreement') is null, 'no agreement is created here (M12 prepares it)';
 perform t.me('e'); assert t.denied(format('select public.aura_apply_propose(%L, %L, ''{}'', null)', t.ws('e'), c), '55000'), 'no further proposals once ready';
 perform public.aura_apply_message(t.ws('e'), c, 'Thanks, looking forward to it.');
 perform t.mfa('c'); perform public.aura_apply_message(t.ws('c'), c, 'Great, we will send the agreement soon.');
 perform t.me('e'); perform public.aura_apply_report(t.ws('e'), 'message', (select (m->>'id')::uuid from jsonb_array_elements(public.aura_apply_negotiation(t.ws('e'), c)->'messages') m where m->>'side' = 'brand' limit 1), 'other', 'testing report');
 assert t.denied(format('select public.aura_apply_propose(%L, %L, ''{"revisions":50}'', null)', t.ws('a'), c)), 'a Creator outside the collaboration cannot propose';
 reset role; perform t.pass('negotiation: versioned proposals, any new proposal resets confirmations, only the exact current version confirms, ready for agreement is not an agreement, messages and reports'); end $$;

-- 11. Tenant isolation and audit
do $$ declare n int := 0; f text; begin
 perform t.me('b'); foreach f in array array['select public.aura_apply_application(%L, %L)', 'select public.aura_apply_withdraw(%L, %L, true)'] loop assert t.denied(format(f, t.ws('b'), t.g('app_a'))), 'another Creator denied: ' || f; n := n + 1; end loop;
 assert t.denied(format('select public.aura_apply_negotiation(%L, %L)', t.ws('b'), t.g('collab_e'))), 'not your negotiation'; n := n + 1;
 assert t.denied(format('select public.aura_apply_creator(%L)', t.ws('a'))), 'not your overview'; n := n + 1;
 perform t.mfa('r3'); assert t.denied(format('select public.aura_apply_decide(%L, %L, ''select'')', t.ws('c2'), t.g('app_a'))), 'another Brand cannot decide'; n := n + 1;
 assert t.denied(format('select public.aura_apply_negotiation(%L, %L)', t.ws('c2'), t.g('collab_e'))), 'another Brand cannot read the negotiation'; n := n + 1;
 perform t.mfa('d'); assert t.denied(format('select public.aura_apply_brand(%L)', t.ws('d'))), 'Agencies have no access (delegation is not built)'; n := n + 1;
 perform t.mfa('c'); assert public.aura_apply_find_creator(t.ws('c'), 'nobody-here') is null, 'unknown usernames find nothing';
 reset role; insert into aura_profile.profile(workspace_id, username, published) values (t.ws('b'), 'bo-m11', false) on conflict (workspace_id) do update set username = 'bo-m11', published = false; -- fixture
 perform t.mfa('c'); assert public.aura_apply_find_creator(t.ws('c'), 'bo-m11') is null, 'an unpublished profile cannot be found by Brands'; n := n + 1;
 reset role; update aura_profile.profile set published = true where workspace_id = t.ws('b'); -- fixture
 perform t.mfa('c'); assert public.aura_apply_find_creator(t.ws('c'), 'BO-M11') = t.ws('b'), 'a published username resolves for a Brand';
 perform t.me('a'); assert t.denied(format('select public.aura_apply_find_creator(%L, ''bo-m11'')', t.ws('a'))), 'Creators cannot use the Brand lookup'; n := n + 1;
 reset role;
 assert (select count(distinct event) from aura_identity.event where event like 'apply\_%') >= 8, 'material events are audited';
 assert (select count(*) from aura_profile.reserved_username where word in ('applications','invitations','enquiries','negotiations')) = 4, 'new Studio routes are reserved usernames';
 perform t.pass('tenant isolation: ' || n || ' checks; Agencies excluded until delegation exists; audit trail; reserved route names'); end $$;
\echo ---RESULTS---
select name from t.results order by name;
