-- Executed by tests/unit/db-m19.test.ts on a disposable PostgreSQL with every migration through M19 and the auth and storage stubs (NOT Supabase).
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

-- M19 fixtures: two Creators selected through M18, agreed proposals handed off to M12, then the M12 documents are advanced by the
-- superuser to an active state with published, overdue and revised deliverables (labelled: M12 acceptance needs an approved legal template).
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
create function t.obs(k text, col uuid, del text, metric text, v numeric, obs date, src text default 'platform_insights', extra jsonb default '{}') returns uuid language plpgsql as $$ declare id uuid; begin
 if k = 'c' then perform t.mfa(k); else perform t.me(k); end if;
 id := (public.aura_monitor_record(t.ws(k), col, del, jsonb_build_object('metric', metric, 'value', v, 'observed_on', obs, 'source', src) || extra)->>'id')::uuid; reset role; return id; end $$;
do $$ declare camp uuid; ca uuid; cb uuid; begin
 perform t.mfa('c'); camp := t.campaign('c', 'ugc', 'Monitored UGC', '{"positions":2,"compensation":{"money":{"type":"fixed","currency":"INR","min":2500}}}'); insert into t.x values ('mon', camp);
 perform public.aura_market_publish(t.ws('c'), camp); reset role;
 ca := t.agree('a', t.apply('a', camp, t.g('acc_a'))); cb := t.agree('b', t.apply('b', camp, t.g('acc_b')));
 insert into t.x values ('ca', ca), ('cb', cb);
 -- fixture: advance the M12 documents (deliverable 0 published 10 days ago; deliverable 1 due 3 days ago, not delivered, two revision requests)
 update aura_collaboration.workspace set document = jsonb_set(jsonb_set(jsonb_set(jsonb_set(document, '{status}', '"Active"'),
   '{deliverables,0,fulfilment}', jsonb_build_object('url', 'https://instagram.com/p/a1', 'date', current_date - 10, 'note', 'Posted')),
   '{deliverables,1,due}', to_jsonb((current_date - 3)::text)),
   '{deliverables,1,submissions}', '[{"id":"s1","review":{"decision":"Revision requested"}},{"id":"s2","review":{"decision":"Revision requested"}}]') where id = t.m12(ca);
 update aura_collaboration.workspace set document = jsonb_set(jsonb_set(jsonb_set(document, '{status}', '"Active"'),
   '{deliverables,0,fulfilment}', jsonb_build_object('url', 'https://instagram.com/p/b1', 'date', current_date - 6, 'note', 'Posted')),
   '{disputes}', '[{"id":"d1","status":"Open","title":"Late payment"}]') where id = t.m12(cb);
 update aura_collaboration.workspace set document = jsonb_set(document, '{deliverables,1,fulfilment}', jsonb_build_object('url', 'https://instagram.com/p/b2', 'date', current_date - 4, 'note', 'Posted')) where id = t.m12(cb);
 insert into aura_commercial.payment_report(collaboration_id, actor, side, amount, currency, paid_on, reference, note, evidence, status)
  values (t.m12(ca), t.uid('c'), 'brand', 1000, 'INR', current_date - 2, 'UTR123', 'Advance', 'Bank transfer', 'Confirmed'); -- fixture: an M13 payment report
end $$;

-- 1. Access
do $$ begin
 perform t.as_anon(); assert t.denied(format('select public.aura_monitor_overview(%L, %L)', t.ws('c'), t.g('mon'))), 'anon denied';
 perform t.mfa('r3'); assert t.denied(format('select public.aura_monitor_overview(%L, %L)', t.ws('c2'), t.g('mon'))), 'another Brand cannot monitor the campaign';
 assert t.denied(format('select public.aura_monitor_record(%L, %L, %L, ''{}'')', t.ws('c2'), t.g('ca'), t.del(t.g('ca'), 0))), 'or record results';
 perform t.me('a');
 assert t.denied(format('select public.aura_monitor_overview(%L, %L)', t.ws('a'), t.g('mon'))), 'Creators do not see the campaign roll-up';
 assert t.denied(format('select public.aura_monitor_creator(%L, %L)', t.ws('a'), t.g('cb'))), 'or another Creator''s collaboration';
 assert t.denied(format('select public.aura_monitor_consent(%L, %L, false)', t.ws('a'), t.g('cb'))), 'or their sharing choice';
 perform t.mfa('c'); assert t.denied(format('select public.aura_monitor_consent(%L, %L, false)', t.ws('c'), t.g('ca'))), 'only the Creator decides about sharing';
 assert t.denied('select count(*) from aura_monitor.observation'), 'no direct table access';
 reset role; perform t.pass('access: other Brands, other Creators and anonymous callers are kept out; only Creators decide about sharing');
end $$;

-- 2. Recording results with source, date, window and side (R3)
do $$ declare d0 text := t.del(t.g('ca'), 0); d1 text := t.del(t.g('ca'), 1); begin
 perform t.obs('c', t.g('ca'), d0, 'views', 1000, current_date - 5);
 perform t.mfa('c');
 assert t.denied(format('select public.aura_monitor_record(%L, %L, %L, ''{"metric":"views","value":5,"source":"platform_insights"}'')', t.ws('c'), t.g('ca'), d1), '55000'), 'results only after publication';
 assert t.denied(format('select public.aura_monitor_record(%L, %L, %L, %L)', t.ws('c'), t.g('ca'), d0, jsonb_build_object('metric','views','value',5,'source','platform_insights','observed_on', current_date + 1)), '22023'), 'no future dates';
 assert t.denied(format('select public.aura_monitor_record(%L, %L, %L, %L)', t.ws('c'), t.g('ca'), d0, jsonb_build_object('metric','views','value',5,'source','platform_insights','observed_on', current_date - 20)), '22023'), 'not before publication';
 assert t.denied(format('select public.aura_monitor_record(%L, %L, %L, ''{"metric":"vibes","value":5,"source":"platform_insights"}'')', t.ws('c'), t.g('ca'), d0), '22023'), 'only defined metrics';
 assert t.denied(format('select public.aura_monitor_record(%L, %L, %L, ''{"metric":"views","value":5,"source":"platform_insights","window_kind":"window"}'')', t.ws('c'), t.g('ca'), d0), '23514'), 'a window needs its period';
 perform t.me('a');
 assert t.denied(format('select public.aura_monitor_record(%L, %L, %L, ''{"metric":"conversions","value":5,"source":"brand_records"}'')', t.ws('a'), t.g('ca'), d0), '22023'), 'Creators cannot cite the Brand''s own records';
 reset role;
 perform t.obs('a', t.g('ca'), d0, 'reach', 800, current_date - 4, 'screenshot');
 assert t.val(format('select side from aura_monitor.observation where metric = %L', 'reach')) = 'creator', 'entries are labelled by who entered them';
 reset role; perform t.pass('recording: only published deliverables, defined metrics, real dates, windows with periods, labelled by side and source');
end $$;

-- 3. Repeated cumulative readings never inflate totals; windows are not added; voids are respected (R4, R5)
do $$ declare d0 text := t.del(t.g('ca'), 0); late uuid; o jsonb; begin
 late := t.obs('c', t.g('ca'), d0, 'views', 1500, current_date - 2);
 perform t.obs('c', t.g('ca'), d0, 'views', 300, current_date - 1, 'platform_insights', jsonb_build_object('window_kind', 'window', 'period_start', current_date - 7, 'period_end', current_date - 1));
 perform t.obs('c', t.g('cb'), t.del(t.g('cb'), 0), 'views', 500, current_date - 3);
 perform t.mfa('c'); o := public.aura_monitor_overview(t.ws('c'), t.g('mon'));
 assert (o->'totals'->>'views')::numeric = 2000, 'latest lifetime per deliverable (1500 + 500), not 1000 + 1500 + 300 + 500';
 assert (o->'metrics'->'reach'->>'not_unique')::boolean and o->'metrics'->'reach'->>'definition' ~ 'NOT a count of unique people', 'reach is labelled as not unique people';
 assert o::text !~* '"score"', 'there is no campaign score';
 perform public.aura_monitor_void(t.ws('c'), late, 'Typo in the value');
 assert (public.aura_monitor_overview(t.ws('c'), t.g('mon'))->'totals'->>'views')::numeric = 1500, 'a voided reading falls back to the previous one';
 perform t.me('a'); assert t.denied(format('select public.aura_monitor_void(%L, %L, ''not mine'')', t.ws('a'), late)), 'only the entering side can void';
 reset role; perform t.pass('totals: repeated cumulative readings never inflate totals, windows are not added, voids fall back, no score');
end $$;

-- 4. Delivery, performance and money kept apart; exceptions and coverage (R1, R2, R6, R8)
do $$ declare o jsonb; k text[]; a jsonb; begin
 perform t.mfa('c'); o := public.aura_monitor_overview(t.ws('c'), t.g('mon'));
 k := array(select e->>'kind' from jsonb_array_elements(o->'exceptions') e);
 assert 'overdue' = any(k) and 'revisions' = any(k) and 'dispute' = any(k) and 'no_results' = any(k), 'overdue, revision loops, disputes and missing results are listed';
 assert (o->'coverage'->>'published')::int = 3 and (o->'coverage'->>'with_results')::int = 2, 'coverage: three published, two with results';
 a := (select e from jsonb_array_elements(o->'payments') e where (e->>'collaboration_id')::uuid = t.g('ca'));
 assert a->'agreed'->>'amount' = '2500' and a->'recorded'->0->>'amount' = '1000' and a->'recorded'->0->>'status' = 'Confirmed', 'agreed value and recorded payments come from M11 and M13';
 assert (select e->'recorded' from jsonb_array_elements(o->'payments') e where (e->>'collaboration_id')::uuid = t.g('cb')) = '[]'::jsonb, 'delivery never implies payment';
 assert jsonb_array_length(o->'delivery') = 2 and (select bool_and(e ? 'deliverables') from jsonb_array_elements(o->'delivery') e), 'delivery comes from the M12 documents';
 reset role; perform t.pass('separation: delivery, performance and money apart; exceptions and coverage reported; delivery does not imply payment');
end $$;

-- 5. Versioned reports; a Creator withdrawing their figures blocks old reports (R7)
do $$ declare r1 jsonb; r2 jsonb; o jsonb; begin
 perform t.mfa('c');
 r1 := public.aura_monitor_create_report(t.ws('c'), t.g('mon'), 'Weekly results', array['delivery','performance'], null, null);
 assert (r1->>'version')::int = 1 and (public.aura_monitor_report(t.ws('c'), (r1->>'id')::uuid)->'snapshot'->'totals'->>'reach')::numeric = 800, 'report v1 includes the Creator''s shared reach';
 perform t.me('a'); perform public.aura_monitor_consent(t.ws('a'), t.g('ca'), false);
 perform t.mfa('c'); o := public.aura_monitor_overview(t.ws('c'), t.g('mon'));
 assert (o->'totals'->>'reach') is null, 'withdrawn Creator figures leave the live roll-up';
 assert (public.aura_monitor_report(t.ws('c'), (r1->>'id')::uuid, 'export_csv')->>'blocked')::boolean and not (public.aura_monitor_report(t.ws('c'), (r1->>'id')::uuid, 'export_csv') ? 'snapshot'), 'and old reports with them can no longer be opened or exported';
 assert (select (e->>'withdrawn')::boolean from jsonb_array_elements(public.aura_monitor_reports(t.ws('c'), t.g('mon'))) e where (e->>'id') = r1->>'id'), 'the history marks it';
 r2 := public.aura_monitor_create_report(t.ws('c'), t.g('mon'), 'weekly results', array['delivery','performance','payments','exceptions'], current_date - 30, current_date);
 assert (r2->>'version')::int = 2 and (public.aura_monitor_report(t.ws('c'), (r2->>'id')::uuid)->'snapshot'->'totals'->>'reach') is null, 'a new version excludes the withdrawn figures';
 assert t.val(format('select count(*) from aura_monitor.report_access where report_id = %L and not allowed', r1->>'id'))::int = 2, 'refused access is logged';
 assert t.denied(format('select public.aura_monitor_create_report(%L, %L, ''x'', array[''delivery''], null, null)', t.ws('c'), t.g('mon')), '22023'), 'reports need a name';
 perform t.mfa('r3'); assert t.denied(format('select public.aura_monitor_report(%L, %L)', t.ws('c2'), r2->>'id')), 'other Brands cannot open it';
 reset role; perform t.pass('reports: versioned snapshots; a Creator withdrawing their figures blocks retrieval and export of old versions');
end $$;

-- 6. The Creator's own view
do $$ declare v jsonb; begin
 perform t.me('a'); v := public.aura_monitor_creator(t.ws('a'), t.g('ca'));
 assert jsonb_array_length(v->'delivery') = 1 and v->'delivery'->0->>'creator' is not null and not (v->>'shared')::boolean, 'the Creator sees only their collaboration and their sharing choice';
 assert (v->'totals'->>'reach')::numeric = 800 and (v->'totals'->>'views')::numeric = 1000, 'and every figure for it, from both sides';
 assert jsonb_array_length(v->'observations') >= 3, 'with the full log';
 perform public.aura_monitor_consent(t.ws('a'), t.g('ca'), true);
 reset role; perform t.pass('creator view: own collaboration only, figures from both sides, sharing can be turned back on');
end $$;
\echo ---RESULTS---
select name from t.results order by name;
