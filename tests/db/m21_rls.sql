-- Executed by tests/unit/db-m21.test.ts on a disposable PostgreSQL with every migration through M21 and the auth and storage stubs (NOT Supabase).
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
create function t.apply(k text, camp uuid, acct uuid) returns uuid language plpgsql as $$ declare id uuid; begin
 perform t.me(k); id := (public.aura_apply_save_draft(t.ws(k), gen_random_uuid(), camp, t.app_content(acct))->>'id')::uuid;
 perform public.aura_apply_submit(t.ws(k), id, true); reset role; return id; end $$;
create function t.agree(k text, app uuid) returns uuid language plpgsql as $$ declare col uuid; begin
 perform t.mfa('c'); perform public.aura_selection_hold(t.ws('c'), app); reset role;
 perform t.me(k); perform public.aura_selection_respond(t.ws(k), app, true); reset role;
 col := (select collaboration_id from aura_apply.application where id = app);
 perform t.me(k); perform public.aura_apply_propose(t.ws(k), col, '{"money":{"currency":"INR","amount":2500},"deliverables":[{"type":"video","quantity":2}],"end_on":"2026-12-31"}', null); perform public.aura_apply_confirm(t.ws(k), col, 1); reset role;
 perform t.mfa('c'); perform public.aura_apply_confirm(t.ws('c'), col, 1); reset role;
 return col; end $$;
create function t.m12(col uuid) returns uuid language sql stable security definer as $$ select workspace_id from aura_selection.handoff where collaboration_id = col $$;
create function t.del(col uuid, i int) returns text language sql stable security definer as $$ select (select document from aura_collaboration.workspace where id = t.m12(col))->'deliverables'->i->>'id' $$;
grant execute on function t.m12(uuid), t.del(uuid, int) to authenticated;
create function t.item(k text, title text) returns uuid language plpgsql as $$ declare id uuid; begin
 perform t.mfa(k); id := (public.aura_brand_content_create(t.ws(k), gen_random_uuid(), jsonb_build_object('title', title))->>'id')::uuid; reset role; return id; end $$;
create function t.ver(i uuid) returns int language sql stable security definer as $$ select version from aura_brand_content.item where id = i $$;
grant execute on function t.ver(uuid) to authenticated;
-- M21 fixtures: Brand c has a profile, a product with an approved claim, an audience and two accounts (Instagram, LinkedIn); Brand c2 has a profile.
-- Creator a agreed 6 months of reuse on Instagram (published 10 days ago); Creator b agreed no reuse rights.
do $$ declare camp uuid; ca uuid; cb uuid; begin
 perform t.mfa('c'); perform public.aura_brand_save_profile(t.ws('c'), '{"public_name":"Hostel Co","objective":"social_growth"}');
 perform public.aura_brand_save_product(t.ws('c'), null, '{"name":"Dorm bed","claims":["Free breakfast"]}');
 perform public.aura_brand_save_segment(t.ws('c'), null, '{"name":"Backpackers"}');
 perform public.aura_brand_save_social(t.ws('c'), '{"platform":"instagram","handle":"hostelco"}');
 perform public.aura_brand_save_social(t.ws('c'), '{"platform":"linkedin","handle":"hostel-co"}');
 perform t.mfa('r3'); perform public.aura_brand_save_profile(t.ws('c2'), '{"public_name":"Brand Two"}'); perform public.aura_brand_save_social(t.ws('c2'), '{"platform":"instagram","handle":"brandtwo"}');
 reset role;
 insert into t.x select 'ig', id from aura_brand.social_account where handle = 'hostelco';
 insert into t.x select 'li', id from aura_brand.social_account where handle = 'hostel-co';
 insert into t.x select 'ig2', id from aura_brand.social_account where handle = 'brandtwo';
 perform t.mfa('c'); camp := t.campaign('c', 'ugc', 'Reusable UGC', '{"positions":2,"compensation":{"money":{"type":"fixed","currency":"INR","min":2500}}}');
 perform public.aura_market_publish(t.ws('c'), camp); reset role;
 ca := t.apply('a', camp, t.g('acc_a')); cb := t.apply('b', camp, t.g('acc_b'));
 perform t.mfa('c'); perform public.aura_selection_hold(t.ws('c'), ca); perform public.aura_selection_hold(t.ws('c'), cb); reset role;
 perform t.me('a'); perform public.aura_selection_respond(t.ws('a'), ca, true); reset role;
 perform t.me('b'); perform public.aura_selection_respond(t.ws('b'), cb, true); reset role;
 ca := (select collaboration_id from aura_apply.application where id = ca); cb := (select collaboration_id from aura_apply.application where id = cb);
 perform t.me('a'); perform public.aura_apply_propose(t.ws('a'), ca, '{"money":{"currency":"INR","amount":2500},"deliverables":[{"type":"video","quantity":1}],"rights":{"usage_months":6,"channels":["Instagram"]},"end_on":"2026-12-31"}', null); perform public.aura_apply_confirm(t.ws('a'), ca, 1); reset role;
 perform t.me('b'); perform public.aura_apply_propose(t.ws('b'), cb, '{"money":{"currency":"INR","amount":2500},"deliverables":[{"type":"video","quantity":1}],"end_on":"2026-12-31"}', null); perform public.aura_apply_confirm(t.ws('b'), cb, 1); reset role;
 perform t.mfa('c'); perform public.aura_apply_confirm(t.ws('c'), ca, 1); perform public.aura_apply_confirm(t.ws('c'), cb, 1); reset role;
 insert into t.x values ('ca', ca), ('cb', cb);
 -- fixture: advance the M12 documents to active with deliverable 0 published (M12 acceptance needs an approved legal template)
 update aura_collaboration.workspace set document = jsonb_set(jsonb_set(document, '{status}', '"Active"'), '{deliverables,0,fulfilment}', jsonb_build_object('url', 'https://instagram.com/p/a1', 'date', current_date - 10)) where id = t.m12(ca);
 update aura_collaboration.workspace set document = jsonb_set(jsonb_set(document, '{status}', '"Active"'), '{deliverables,0,fulfilment}', jsonb_build_object('url', 'https://instagram.com/p/b1', 'date', current_date - 5)) where id = t.m12(cb);
end $$;

-- 1. Access and isolation (private drafts per Brand workspace)
do $$ declare i uuid := t.item('c', 'Dorm tour reel'); begin
 insert into t.x values ('i1', i);
 perform t.as_anon(); assert t.denied(format('select public.aura_brand_content_overview(%L)', t.ws('c'))), 'anon denied';
 perform t.me('a'); assert t.denied(format('select public.aura_brand_content_overview(%L)', t.ws('a'))), 'Creator workspaces have no Brand content';
 assert t.denied(format('select public.aura_brand_content_item(%L, %L)', t.ws('c'), i)), 'a Creator cannot read Brand drafts';
 perform t.mfa('r3');
 assert t.denied(format('select public.aura_brand_content_item(%L, %L)', t.ws('c'), i)), 'another Brand cannot read the draft';
 assert t.denied(format('select public.aura_brand_content_item(%L, %L)', t.ws('c2'), i)), 'or through its own workspace';
 assert t.denied(format('select public.aura_brand_content_save(%L, %L, 1, ''{"title":"Hijack"}'')', t.ws('c2'), i)), 'or edit it';
 assert public.aura_brand_content_overview(t.ws('c2'))::text !~ 'Dorm tour reel', 'nor see it in its own overview';
 assert t.denied(format('select public.aura_brand_content_create(%L, gen_random_uuid(), jsonb_build_object(''title'', ''Cross'', ''account_id'', %L))', t.ws('c2'), t.g('ig'))), 'nor post to another Brand''s account';
 perform t.mfa('d'); assert t.denied(format('select public.aura_brand_content_overview(%L)', t.ws('d'))), 'an Agency has no access';
 perform t.me('c'); assert t.denied(format('select public.aura_brand_content_create(%L, gen_random_uuid(), ''{"title":"No MFA"}'')', t.ws('c'))), 'writes need MFA';
 perform t.mfa('c'); assert t.denied('select count(*) from aura_brand_content.item'), 'no direct table access';
 reset role; perform t.pass('access: other Brands, Creators, Agencies and anonymous callers are kept out; writes need MFA');
end $$;

-- 2. Pillars, versioned editing, review with claims, approval of a version, checklist and manual publication
do $$ declare i uuid := t.g('i1'); p uuid; rid uuid := gen_random_uuid(); a uuid; b uuid; v int; begin
 perform t.mfa('c');
 p := (public.aura_brand_content_save_pillar(t.ws('c'), null, 'Behind the scenes', 'Life at the hostel', 60)->>'id')::uuid;
 assert t.denied(format('select public.aura_brand_content_save_pillar(%L, null, ''Deals'', null, 50)', t.ws('c')), '23514'), 'the mix cannot pass 100%';
 a := (public.aura_brand_content_create(t.ws('c'), rid, '{"title":"Guest stories"}')->>'id')::uuid; b := (public.aura_brand_content_create(t.ws('c'), rid, '{"title":"Guest stories"}')->>'id')::uuid;
 assert a = b, 'a repeated create makes one item';
 assert t.denied(format('select public.aura_brand_content_move(%L, %L, ''in_review'')', t.ws('c'), i), '22023'), 'review needs some copy';
 perform public.aura_brand_content_save(t.ws('c'), i, 1, jsonb_build_object('title', 'Dorm tour reel', 'format', 'reel', 'account_id', t.g('ig'), 'pillar_id', p, 'hook', 'Where would you sleep for 600?', 'caption', 'Free breakfast every day.', 'claims', jsonb_build_array('Free breakfast', 'Cures jet lag'), 'planned_for', current_date + 3));
 assert t.ver(i) = 2 and t.val(format('select count(*) from aura_brand_content.revision where item_id = %L', i)) = '2', 'every save is a version';
 assert t.denied(format('select public.aura_brand_content_save(%L, %L, 1, ''{"title":"Stale edit"}'')', t.ws('c'), i), '40001'), 'a stale editor cannot overwrite';
 assert public.aura_brand_content_item(t.ws('c'), i)->'unapproved_claims' = '["Cures jet lag"]', 'claims are compared with approved product claims';
 perform public.aura_brand_content_move(t.ws('c'), i, 'in_review');
 assert t.denied(format('select public.aura_brand_content_move(%L, %L, ''scheduled'')', t.ws('c'), i), '55000'), 'nothing is scheduled before approval';
 assert t.denied(format('select public.aura_brand_content_review(%L, %L, 2, ''changes_requested'', null)', t.ws('c'), i), '22023'), 'a change request says what to change';
 perform public.aura_brand_content_review(t.ws('c'), i, 2, 'changes_requested', 'Remove the jet lag claim');
 assert t.val(format('select stage from aura_brand_content.item where id = %L', i)) = 'drafting', 'changes send it back to drafting';
 perform public.aura_brand_content_move(t.ws('c'), i, 'in_review');
 assert t.denied(format('select public.aura_brand_content_review(%L, %L, 2, ''approved'', null)', t.ws('c'), i), '22023'), 'unapproved claims need a reason to approve';
 perform public.aura_brand_content_review(t.ws('c'), i, 2, 'approved', 'Legal confirmed the claim is fine for this post');
 assert t.val(format('select approved_version from aura_brand_content.item where id = %L', i)) = '2', 'approval is for a version';
 perform public.aura_brand_content_save(t.ws('c'), i, 2, jsonb_build_object('title', 'Dorm tour reel', 'format', 'reel', 'account_id', t.g('ig'), 'pillar_id', p, 'hook', 'Where would you sleep for 600?', 'caption', 'Free breakfast every day.', 'claims', jsonb_build_array('Free breakfast'), 'planned_for', current_date + 3));
 assert t.val(format('select stage = ''in_review'' and approved_version is null from aura_brand_content.item where id = %L', i)) = 'true', 'editing after approval sends it back to review';
 perform public.aura_brand_content_review(t.ws('c'), i, 3, 'approved', null);
 perform public.aura_brand_content_move(t.ws('c'), i, 'scheduled');
 assert t.denied(format('select public.aura_brand_content_publish(%L, %L, ''https://instagram.com/p/x'', current_date)', t.ws('c'), i), '55000'), 'the checklist comes first';
 assert (public.aura_brand_content_item(t.ws('c'), i)->'checklist_required') = '["final_copy", "account", "link_checked", "claims"]', 'claims add a checklist step';
 perform public.aura_brand_content_check(t.ws('c'), i, 'final_copy', true); perform public.aura_brand_content_check(t.ws('c'), i, 'account', true);
 perform public.aura_brand_content_check(t.ws('c'), i, 'link_checked', true); perform public.aura_brand_content_check(t.ws('c'), i, 'claims', true);
 assert t.denied(format('select public.aura_brand_content_publish(%L, %L, ''http://instagram.com/p/x'', current_date)', t.ws('c'), i), '22023'), 'a real https link';
 assert t.denied(format('select public.aura_brand_content_publish(%L, %L, ''https://instagram.com/p/x'', current_date + 1)', t.ws('c'), i), '22023'), 'not a future date';
 perform public.aura_brand_content_publish(t.ws('c'), i, 'https://instagram.com/p/x', current_date);
 assert t.denied(format('select public.aura_brand_content_save(%L, %L, 3, ''{"title":"Late edit"}'')', t.ws('c'), i), '55000'), 'published content is locked';
 assert t.denied(format('select public.aura_brand_content_move(%L, %L, ''archived'')', t.ws('c'), i), '55000'), 'and stays on the record';
 reset role; perform t.pass('workflow: pillars, versions, stale-edit guard, review with claims, version approval, checklist, manual publication');
end $$;

-- 3. Reusing Creator content only within the rights agreed in M11 (re-checked at publication)
do $$ declare s jsonb; x jsonb; i uuid; begin
 perform t.mfa('c'); s := public.aura_brand_content_sources(t.ws('c'));
 assert jsonb_array_length(s) = 2, 'published Creator deliverables are listed';
 select e into x from jsonb_array_elements(s) e where e->>'collaboration_id' = t.g('ca')::text;
 assert (select bool_and(case when a->>'platform' = 'instagram' then (a->'check'->>'allowed')::boolean else not (a->'check'->>'allowed')::boolean end) from jsonb_array_elements(x->'accounts') a), 'Instagram allowed, LinkedIn not';
 select e into x from jsonb_array_elements(s) e where e->>'collaboration_id' = t.g('cb')::text;
 assert (select bool_and(not (a->'check'->>'allowed')::boolean and a->'check'->>'reason' = 'No usage rights were agreed') from jsonb_array_elements(x->'accounts') a), 'no agreed rights, no reuse';
 assert t.denied(format('select public.aura_brand_content_repurpose(%L, gen_random_uuid(), %L, %L, %L, null)', t.ws('c'), t.g('ca'), t.del(t.g('ca'), 0), t.g('li')), '55000'), 'blocked outside the agreed channels';
 assert t.denied(format('select public.aura_brand_content_repurpose(%L, gen_random_uuid(), %L, %L, %L, null)', t.ws('c'), t.g('cb'), t.del(t.g('cb'), 0), t.g('ig')), '55000'), 'blocked without rights';
 assert t.denied(format('select public.aura_brand_content_repurpose(%L, gen_random_uuid(), %L, %L, %L, current_date + 200)', t.ws('c'), t.g('ca'), t.del(t.g('ca'), 0), t.g('ig')), '55000'), 'blocked after the rights end';
 i := (public.aura_brand_content_repurpose(t.ws('c'), gen_random_uuid(), t.g('ca'), t.del(t.g('ca'), 0), t.g('ig'), current_date + 7)->>'id')::uuid;
 insert into t.x values ('rp', i);
 assert t.val(format('select source = ''repurposed'' and repurpose->>''creator'' is not null and disclosure is not null from aura_brand_content.item where id = %L', i)) = 'true', 'the source and a disclosure are kept';
 assert t.denied(format('select public.aura_brand_content_save(%L, %L, 1, jsonb_build_object(''title'', ''Repost'', ''account_id'', %L, ''caption'', ''Look''))', t.ws('c'), i, t.g('li')), '55000'), 'cannot move to an account outside the rights';
 perform t.mfa('r3');
 assert t.denied(format('select public.aura_brand_content_repurpose(%L, gen_random_uuid(), %L, %L, %L, null)', t.ws('c2'), t.g('ca'), t.del(t.g('ca'), 0), t.g('ig2'))), 'another Brand cannot reuse this Creator''s work';
 perform t.mfa('c');
 perform public.aura_brand_content_save(t.ws('c'), i, 1, jsonb_build_object('title', 'Repost: guest film', 'account_id', t.g('ig'), 'caption', 'Made with a guest Creator', 'disclosure', 'Created with @asha', 'planned_for', current_date));
 perform public.aura_brand_content_move(t.ws('c'), i, 'in_review'); perform public.aura_brand_content_review(t.ws('c'), i, 2, 'approved', null);
 perform public.aura_brand_content_check(t.ws('c'), i, 'final_copy', true); perform public.aura_brand_content_check(t.ws('c'), i, 'account', true); perform public.aura_brand_content_check(t.ws('c'), i, 'link_checked', true);
 assert t.denied(format('select public.aura_brand_content_publish(%L, %L, ''https://instagram.com/p/r'', current_date)', t.ws('c'), i), '55000'), 'repurposed content needs the disclosure step';
 perform public.aura_brand_content_check(t.ws('c'), i, 'disclosure', true);
 reset role; update aura_brand_content.item set repurpose = jsonb_set(repurpose, '{published_on}', to_jsonb((current_date - 400)::text)) where id = i; -- fixture: pretend the Creator posted 400 days ago
 perform t.mfa('c');
 assert t.denied(format('select public.aura_brand_content_publish(%L, %L, ''https://instagram.com/p/r'', current_date)', t.ws('c'), i), '55000'), 'rights are re-checked on the publication date';
 reset role; update aura_brand_content.item set repurpose = jsonb_set(repurpose, '{published_on}', to_jsonb((current_date - 10)::text)) where id = i; -- fixture: restore
 perform t.mfa('c'); perform public.aura_brand_content_publish(t.ws('c'), i, 'https://instagram.com/p/r', current_date);
 reset role; perform t.pass('repurposing: agreed channels and period only, disclosure required, re-checked at publication, other Brands kept out');
end $$;

-- 4. Results with provenance; latest reading per metric; assets with provenance
do $$ declare i uuid := t.g('i1'); r uuid; l jsonb; begin
 perform t.mfa('c');
 assert t.denied(format('select public.aura_brand_content_record(%L, %L, ''views'', 10, current_date, ''platform_insights'', null)', t.ws('c'), t.item('c', 'Not posted')), '55000'), 'no results before publication';
 perform t.mfa('c');
 assert t.denied(format('select public.aura_brand_content_record(%L, %L, ''happiness'', 10, current_date, ''platform_insights'', null)', t.ws('c'), i), '22023'), 'only defined metrics';
 assert t.denied(format('select public.aura_brand_content_record(%L, %L, ''views'', 10, current_date - 1, ''platform_insights'', null)', t.ws('c'), i), '22023'), 'not before it went live';
 perform public.aura_brand_content_record(t.ws('c'), i, 'views', 500, current_date, 'platform_insights', 'Day 1');
 r := (public.aura_brand_content_record(t.ws('c'), i, 'views', 900, current_date, 'screenshot', 'Re-read')->>'id')::uuid;
 l := public.aura_brand_content_learning(t.ws('c'));
 assert (l->'by_metric'->'views'->>'total')::numeric = 900 and (l->>'published')::int = 2 and (l->>'with_results')::int = 1, 'latest reading only, coverage stated';
 perform public.aura_brand_content_void(t.ws('c'), r, 'Typo');
 assert (public.aura_brand_content_learning(t.ws('c'))->'by_metric'->'views'->>'total')::numeric = 500, 'voided readings fall back';
 assert t.val(format('select count(*) from aura_brand_content.result where item_id = %L', i)) = '2', 'nothing is deleted';
 assert t.denied(format('select public.aura_brand_content_add_asset(%L, %L, ''{"title":"Guest clip","kind":"video","url":"https://drive.example/clip","provenance":"creator"}'')', t.ws('c'), i), '22023'), 'Creator assets need their agreement';
 perform public.aura_brand_content_add_asset(t.ws('c'), i, '{"title":"Dorm photos","kind":"image","url":"https://drive.example/photos","provenance":"own"}');
 assert t.denied(format('select public.aura_brand_content_add_asset(%L, null, ''{"title":"Loose","kind":"image","url":"http://x.example/p","provenance":"own"}'')', t.ws('c')), '23514'), 'https links only';
 reset role; perform t.pass('results and assets: published only, defined metrics, latest reading, voids kept, provenance on assets');
end $$;

-- 5. One product: the M20 assistant drafts content ideas, a person approves, they land in M21 as ideas
do $$ declare conv uuid; d uuid; c jsonb; n int; begin
 perform t.mfa('c');
 conv := (public.aura_brand_ai_start(t.ws('c'), gen_random_uuid(), 'content', 'Content ideas')->>'id')::uuid;
 c := public.aura_brand_ai_context(t.ws('c'), 'content');
 assert c->'facts'->'content_plan'->'pillars'->0->>'name' = 'Behind the scenes', 'the assistant sees the content plan';
 assert c::text !~ 'brandtwo', 'and only this workspace';
 assert t.denied(format('select public.aura_brand_ai_save_draft(%L, %L, ''content_ideas'', ''{}'', ''{"items":[]}'', ''ai'')', t.ws('c'), conv), '22023'), 'a content draft needs ideas';
 d := (public.aura_brand_ai_save_draft(t.ws('c'), conv, 'content_ideas', '{}', '{"items":[{"title":"Night market walk with guests","detail":"Hook: 3 dishes under 100"},{"title":"Bunk bed makeover"}]}', 'ai')->>'id')::uuid;
 n := t.val(format('select count(*) from aura_brand_content.item where workspace_id = %L', t.ws('c')))::int;
 assert t.denied(format('select public.aura_brand_ai_apply(%L, %L, false)', t.ws('c'), d), '22023'), 'nothing lands without approval';
 perform public.aura_brand_ai_apply(t.ws('c'), d, true);
 assert t.val(format('select count(*) from aura_brand_content.item where workspace_id = %L', t.ws('c')))::int = n + 2, 'approved ideas join the content plan';
 assert t.val('select stage = ''idea'' and source = ''ai'' from aura_brand_content.item where title = ''Night market walk with guests''') = 'true', 'as ideas, labelled as AI, never approved or published';
 reset role; perform t.pass('one product: assistant content ideas need approval and arrive as labelled ideas');
end $$;
\echo ---RESULTS---
select name from t.results order by name;
