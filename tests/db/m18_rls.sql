-- Executed by tests/unit/db-m18.test.ts on a disposable PostgreSQL with every migration through M18 and the auth and storage stubs (NOT Supabase).
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

-- M18 fixtures: test-only owner-rights reader, apply helper, a third Creator f with an account, and a two-place UGC campaign.
create function t.val(q text) returns text language plpgsql security definer as $$ declare r text; begin execute q into r; return r; end $$;
grant execute on function t.val(text) to authenticated, anon;
create function t.apply(k text, camp uuid, acct uuid) returns uuid language plpgsql as $$ declare id uuid; begin
 perform t.me(k); id := (public.aura_apply_save_draft(t.ws(k), gen_random_uuid(), camp, t.app_content(acct))->>'id')::uuid;
 perform public.aura_apply_submit(t.ws(k), id, true); reset role; return id; end $$;
do $$ declare id uuid; begin
 perform t.mkcreator('f'); perform t.activate('f'); perform t.me('f'); insert into t.x values ('acc_f', t.set_followers('f', 'fay.m18', 2000)); reset role;
 perform t.mfa('c'); id := t.campaign('c', 'ugc', 'Two places for UGC', '{"positions":2,"compensation":{"money":{"type":"fixed","currency":"INR","min":2500}}}'); insert into t.x values ('two', id);
 perform public.aura_market_publish(t.ws('c'), id); reset role;
 insert into t.x values ('app_a2', t.apply('a', id, t.g('acc_a'))), ('app_b2', t.apply('b', id, t.g('acc_b'))), ('app_f2', t.apply('f', id, t.g('acc_f')));
end $$;

-- 1. Access: only the campaign's Brand sees the inbox, comparison, holds and notes
do $$ begin
 perform t.as_anon(); assert t.denied(format('select public.aura_selection_inbox(%L, %L)', t.ws('c'), t.g('two'))), 'anon denied';
 perform t.me('a'); assert t.denied(format('select public.aura_selection_inbox(%L, %L)', t.ws('a'), t.g('two'))), 'Creators have no inbox';
 assert t.denied(format('select public.aura_selection_offer(%L, %L)', t.ws('a'), t.g('app_b2'))), 'a Creator cannot read another Creator''s offer';
 perform t.mfa('r3');
 assert t.denied(format('select public.aura_selection_inbox(%L, %L)', t.ws('c2'), t.g('two'))), 'another Brand cannot open the inbox';
 assert t.denied(format('select public.aura_selection_hold(%L, %L)', t.ws('c2'), t.g('app_a2'))), 'or hold a place';
 assert t.denied(format('select public.aura_selection_note(%L, %L, ''note'', null)', t.ws('c2'), t.g('app_a2'))), 'or write notes';
 perform t.mfa('c');
 assert t.denied(format('select public.aura_selection_compare(%L, %L, array[%L, %L]::uuid[])', t.ws('c'), t.g('paid'), t.g('app_a2'), t.g('app_b2'))), 'comparison stays within one campaign';
 assert t.denied(format('select public.aura_selection_compare(%L, %L, array[%L]::uuid[])', t.ws('c'), t.g('two'), t.g('app_a2')), '22023'), 'at least two candidates';
 assert t.denied('select count(*) from aura_selection.hold'), 'no direct table access';
 reset role; perform t.pass('access: Creators, other Brands and anonymous callers are kept out; comparison stays within one campaign');
end $$;

-- 2. 72-hour holds count against capacity on every path (S5, S6)
do $$ declare h jsonb; i jsonb; begin
 perform t.mfa('c');
 h := public.aura_selection_hold(t.ws('c'), t.g('app_a2'), 'We loved your pitch.');
 assert (h->>'expires_at')::timestamptz between now() + interval '71 hours' and now() + interval '73 hours', 'a hold lasts 72 hours';
 perform public.aura_selection_hold(t.ws('c'), t.g('app_b2'));
 assert t.denied(format('select public.aura_selection_hold(%L, %L)', t.ws('c'), t.g('app_a2')), '23505'), 'one hold per Creator';
 assert t.denied(format('select public.aura_selection_hold(%L, %L)', t.ws('c'), t.g('app_f2')), '23514'), 'two places, two holds: no third';
 assert t.denied(format('select public.aura_apply_decide(%L, %L, ''select'')', t.ws('c'), t.g('app_f2')), '23514'), 'and M11 selection cannot bypass the holds';
 i := public.aura_selection_inbox(t.ws('c'), t.g('two'));
 assert (i->'campaign'->>'taken')::int = 2 and (i->'campaign'->>'capacity')::int = 2, 'the inbox shows places taken and held';
 assert (select count(*) from jsonb_array_elements(i->'applications') x where x->'hold' is not null and x->>'status' = 'shortlisted') = 2, 'held candidates are shortlisted with a hold';
 perform public.aura_selection_release(t.ws('c'), t.g('app_b2'));
 perform public.aura_selection_hold(t.ws('c'), t.g('app_f2'));
 perform t.me('a'); assert exists(select 1 from jsonb_array_elements(public.aura_apply_creator(t.ws('a'))->'notifications') n where n->>'title' ~ '72 hours; not an agreement'), 'the Creator is told it is not an agreement';
 reset role; perform t.pass('holds: 72 hours, one per Creator, counted against capacity everywhere, releasable');
end $$;

-- 3. Accepting, declining and expiry (S4, S5)
do $$ declare r jsonb; begin
 perform t.me('a'); r := public.aura_selection_offer(t.ws('a'), t.g('app_a2'));
 assert r->'hold'->>'status' = 'held' and r->'hold'->>'message' = 'We loved your pitch.', 'the Creator sees the offer and message';
 r := public.aura_selection_respond(t.ws('a'), t.g('app_a2'), true);
 assert r->>'status' = 'selected', 'accepting makes it a selection';
 assert (public.aura_apply_application(t.ws('a'), t.g('app_a2'))->>'status') = 'selected' and (public.aura_selection_offer(t.ws('a'), t.g('app_a2'))->'hold'->>'status') = 'accepted', 'hold marked accepted';
 perform t.me('f'); r := public.aura_selection_respond(t.ws('f'), t.g('app_f2'), false);
 assert (public.aura_apply_application(t.ws('f'), t.g('app_f2'))->>'status') = 'withdrawn', 'declining withdraws the application';
 perform t.mfa('c'); perform public.aura_selection_hold(t.ws('c'), t.g('app_b2'));
 reset role; update aura_selection.hold set expires_at = now() - interval '1 minute' where application_id = t.g('app_b2') and status = 'held'; -- fixture: 72 hours pass
 perform t.me('b'); assert t.denied(format('select public.aura_selection_respond(%L, %L, true)', t.ws('b'), t.g('app_b2')), '55000'), 'an expired offer cannot be accepted';
 assert (public.aura_selection_offer(t.ws('b'), t.g('app_b2'))->'hold'->>'status') = 'expired', 'it shows as expired';
 assert exists(select 1 from jsonb_array_elements(public.aura_apply_creator(t.ws('b'))->'notifications') n where n->>'title' ~ 'expired'), 'the Creator is told';
 perform t.mfa('c'); assert (public.aura_selection_inbox(t.ws('c'), t.g('two'))->'campaign'->>'taken')::int = 1, 'the expired hold frees the place';
 reset role; perform t.pass('responses: accepting selects, declining withdraws, unanswered holds expire and free the place');
end $$;

-- 4. Eligibility is re-checked before a hold becomes a selection (S5)
do $$ declare app uuid; begin
 app := t.apply('a', t.g('paid'), t.g('acc_a')); insert into t.x values ('app_a_paid', app);
 perform t.mfa('c'); perform public.aura_selection_hold(t.ws('c'), app);
 perform t.me('a'); perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), t.g('acc_a'), 'followers', 400, current_date, null, null, 'manual', null, null);
 assert t.denied(format('select public.aura_selection_respond(%L, %L, true)', t.ws('a'), app), '55000'), 'a Creator who no longer meets the requirements cannot accept';
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), t.g('acc_a'), 'followers', 1600, current_date, null, null, 'manual', null, null);
 reset role; perform t.pass('revalidation: mandatory requirements are re-checked when a Creator accepts');
end $$;

-- 5. Inbox, comparison, private notes and bulk actions (S2, S3, S4, S8)
do $$ declare cmp jsonb; c1 jsonb; begin
 perform t.mfa('c');
 perform public.aura_selection_note(t.ws('c'), t.g('app_a2'), 'Strong portfolio, check dates', array['Strong fit', 'check dates']);
 assert t.denied(format('select public.aura_selection_note(%L, %L, '''', null)', t.ws('c'), t.g('app_a2')), '22023'), 'an empty note is refused';
 cmp := public.aura_selection_compare(t.ws('c'), t.g('two'), array[t.g('app_a2'), t.g('app_b2')]);
 assert jsonb_array_length(cmp->'candidates') = 2 and (cmp->'candidates'->0->>'id')::uuid = t.g('app_a2'), 'candidates in the order chosen';
 c1 := cmp->'candidates'->0;
 assert c1->'shared' ? 'pitch' and c1->'eligibility' ? 'hard' and c1->'eligibility' ? 'preferred', 'shared application, requirements and preferences side by side';
 assert cmp::text !~* '"score"|ranking' and cmp::text !~ 'Strong portfolio', 'no score, and private notes stay out of the comparison';
 assert c1->'tags' ? 'strong fit', 'tags are shown to the Brand';
 perform t.me('a'); assert public.aura_apply_application(t.ws('a'), t.g('app_a2'))::text !~ 'Strong portfolio|strong fit', 'notes never reach the Creator';
 reset role;
end $$;
do $$ declare r jsonb; begin
 perform t.mkcreator('g'); perform t.activate('g'); perform t.me('g'); insert into t.x values ('acc_g', t.set_followers('g', 'gia.m18', 900)); reset role;
 insert into t.x values ('app_g2', t.apply('g', t.g('two'), t.g('acc_g')));
 perform t.mfa('c');
 r := public.aura_selection_bulk(t.ws('c'), t.g('two'), array[t.g('app_g2'), t.g('app_f2')], 'reject', 'We chose other creators this time.');
 assert (r->>'done')::int = 1 and (r->>'skipped')::int = 1, 'bulk actions skip candidates who already left';
 assert t.denied(format('select public.aura_selection_bulk(%L, %L, array[%L]::uuid[], ''select'')', t.ws('c'), t.g('two'), t.g('app_b2')), '22023'), 'selection is never a bulk action';
 perform t.me('g'); assert (public.aura_apply_application(t.ws('g'), t.g('app_g2'))->>'feedback') = 'We chose other creators this time.', 'bulk rejection carries the feedback';
 reset role; perform t.pass('inbox: private notes and tags, side-by-side comparison from shared data only, bulk review, shortlist and reject');
end $$;

-- 6. Hand-off to M12: both sides confirm the same version, an M12 workspace opens with the agreed terms (S7)
do $$ declare collab uuid; r jsonb; m12 uuid; doc jsonb; begin
 collab := t.val(format('select collaboration_id from aura_apply.application where id = %L', t.g('app_a2')))::uuid;
 perform t.me('a'); perform public.aura_apply_propose(t.ws('a'), collab, '{"money":{"currency":"INR","amount":2500},"deliverables":[{"type":"video","quantity":2}],"revisions":1,"end_on":"2026-12-20","rights":{"usage_months":6,"channels":["organic"],"exclusivity_days":0}}', 'Two videos');
 perform public.aura_apply_confirm(t.ws('a'), collab, 1);
 assert public.aura_selection_handoff(t.ws('a'), collab) is null, 'no workspace before both confirm';
 perform t.mfa('c'); r := public.aura_apply_confirm(t.ws('c'), collab, 1);
 assert r->>'status' = 'ready_for_agreement', 'both confirmed the same version';
 m12 := public.aura_selection_handoff(t.ws('c'), collab);
 assert m12 is not null and public.aura_selection_handoff(t.ws('c'), collab) = m12, 'an M12 collaboration workspace was opened once';
 doc := public.aura_collaboration_read(m12)->'collaboration';
 assert doc->>'status' = 'Agreement pending' and jsonb_array_length(doc->'deliverables') = 2 and doc->'agreements'->0->>'compensation' = 'INR 2500', 'with the agreed terms and one deliverable per item';
 assert (doc->'agreements'->0->>'templateApproved')::boolean = false, 'acceptance waits for an approved legal template';
 assert (public.aura_apply_brand_application(t.ws('c'), t.g('app_a2'))->>'status') = 'converted', 'the application moved to the agreement step';
 perform t.me('a'); assert public.aura_selection_handoff(t.ws('a'), collab) = m12 and (public.aura_collaboration_read(m12)->'access'->>'side') = 'creator', 'the Creator can open the same workspace';
 perform t.me('b'); assert t.denied(format('select public.aura_collaboration_read(%L)', m12)), 'nobody else can';
 reset role; perform t.pass('hand-off: an agreed M11 proposal opens one M12 workspace with the same terms; agreement still needs both acceptances');
end $$;
\echo ---RESULTS---
select name from t.results order by name;
