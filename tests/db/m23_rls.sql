-- Executed by tests/unit/db-m23.test.ts on a disposable PostgreSQL with every migration through M23 and the auth and storage stubs (NOT Supabase).
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
create function t.err(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return sqlstate || ': ' || sqlerrm; end $$;
grant execute on function t.err(text) to authenticated;
create table t.tk(k text primary key, v text); grant all on t.tk to authenticated;
-- M23 fixtures (superuser, labelled): Agency d gains staff d2 (MFA), d3 (MFA) and d4 (MFA, never assigned); Creator a gets an authenticator.
do $$ declare x uuid[]; kk text; f uuid := gen_random_uuid(); begin
 foreach kk in array array['d2','d3','d4'] loop x := t.mkuser(kk||'@example.test', true); insert into t.ids(k,u,s,w) values(kk,x[1],x[2],t.ws('d')); perform t.mfa(kk); perform public.aura_complete_identity('Staff '||kk,'IN',true,''); reset role;
  insert into aura_identity.membership values (t.ws('d'), x[1], 'member', true); end loop;
 insert into auth.mfa_factors(id,user_id,status) values (f, t.uid('a'), 'verified'); update auth.sessions set factor_id = f where id = (select s from t.ids where k = 'a');
 perform t.activate('a');
 perform t.mfa('c'); perform public.aura_brand_save_profile(t.ws('c'), '{"public_name":"Hostel Co"}'); reset role;
end $$;

-- 1. Foundation: Agency creation needs MFA; profile, verification and review; restricted until verified
do $$ declare tok text; begin
 perform t.me('b'); assert t.denied('select public.aura_create_workspace(gen_random_uuid(), ''agency'', ''No MFA Agency'', null)'), 'an Agency needs an authenticator';
 perform t.mfa('r3'); assert public.aura_create_workspace(gen_random_uuid(), 'agency', 'Second Agency', null) is not null, 'with MFA it can be created';
 perform t.mfa('d3'); assert t.denied(format('select public.aura_agency_save_profile(%L, ''{"legal_name":"X"}'')', t.ws('d'))), 'members cannot edit the Agency profile';
 perform t.mfa('d');
 perform public.aura_agency_save_profile(t.ws('d'), '{"legal_name":"Talent Works LLP","kind":"hybrid","website":"https://talent.example","country":"IN","services":["talent_management","campaign_management"],"team_size":"6-20"}');
 assert t.denied(format('select public.aura_agency_invite_client(%L, ''brand'', ''Hostel Co'', ''["view"]'', false, 6, null)', t.ws('d')), '55000'), 'no client invitations before verification';
 assert t.denied(format('select public.aura_agency_save_verification(%L, ''{"registration_type":"llp"}'', true)', t.ws('d')), '22023'), 'a complete case is required';
 perform public.aura_agency_save_verification(t.ws('d'), '{"registration_type":"llp","registration_number":"AAB-1234","address":"12 MG Road, Bengaluru","representative":"Test d","representative_role":"Partner","evidence":["https://docs.example/llp.pdf"],"declaration":true}', true);
 perform t.mfa('r3'); assert t.denied('select public.aura_agency_review_queue()'), 'only platform administrators review';
 perform t.mfa('r'); assert jsonb_array_length(public.aura_agency_review_queue()) = 1, 'the case is queued';
 assert t.denied(format('select public.aura_agency_review_decide(%L, ''rejected'', null)', t.ws('d')), '22023'), 'a refusal explains itself';
 perform public.aura_agency_review_decide(t.ws('d'), 'verified', null);
 reset role; assert (select verification from aura_identity.workspace where id = t.ws('d')) = 'verified', 'verified';
 perform t.pass('foundation: MFA to create, admin-only profile and verification, reviewer decision, no clients before verification');
end $$;

-- 2. Invitations and client-issued grants: the client grants what was asked for or less, never more
do $$ declare tok text; rel uuid; begin
 perform t.mfa('d');
 tok := public.aura_agency_invite_client(t.ws('d'), 'brand', 'Hostel Co', '["view","content","campaigns","applications"]', true, 6, 'We will run your content calendar.'); insert into t.tk values ('brand', tok);
 assert t.denied(format('select public.aura_agency_invite_client(%L, ''brand'', ''Too long'', ''["view"]'', false, 13, null)', t.ws('d')), '22023'), 'access lasts at most 12 months';
 perform t.mfa('c');
 assert (public.aura_agency_invite_info(tok)->'agency'->>'verified')::boolean and jsonb_array_length(public.aura_agency_invite_info(tok)->'workspaces') = 1, 'the client sees who is asking and which workspace';
 assert t.denied(format('select public.aura_agency_accept(%L, %L, ''["view","content","profile"]'', false, 6)', tok, t.ws('c')), '22023'), 'never more than requested';
 assert t.denied(format('select public.aura_agency_accept(%L, %L, ''["view"]'', false, 12)', tok, t.ws('c')), '22023'), 'never longer than requested';
 rel := (public.aura_agency_accept(tok, t.ws('c'), '["view","content"]', false, 6)->>'relationship')::uuid; insert into t.x values ('rel_c', rel);
 assert t.denied(format('select public.aura_agency_accept(%L, %L, ''["view"]'', false, 1)', tok, t.ws('c')), '55000'), 'an invitation is used once';
 perform t.mfa('d');
 tok := public.aura_agency_invite_client(t.ws('d'), 'creator', 'Creator a', '["view","applications","content","profile"]', true, 12, null);
 perform t.mfa('e'); assert public.aura_agency_invite_info(tok)->'workspaces' @> jsonb_build_array(jsonb_build_object('id', t.ws('e'))) and not (public.aura_agency_invite_info(tok)->'workspaces' @> jsonb_build_array(jsonb_build_object('id', t.ws('a')))), 'only the owner of a Creator workspace can accept for it';
 perform t.mfa('a'); rel := (public.aura_agency_accept(tok, t.ws('a'), '["view","applications","content"]', false, 12)->>'relationship')::uuid; insert into t.x values ('rel_a', rel);
 perform t.mfa('d');
 perform public.aura_agency_assign(t.ws('d'), t.g('rel_c'), t.uid('d2'), 'manager'); perform public.aura_agency_assign(t.ws('d'), t.g('rel_c'), t.uid('d3'), 'viewer');
 perform public.aura_agency_assign(t.ws('d'), t.g('rel_a'), t.uid('d2'), 'manager');
 assert t.denied(format('select public.aura_agency_assign(%L, %L, %L, ''manager'')', t.ws('d'), t.g('rel_c'), t.uid('b')), '22023'), 'only the Agency''s own team can be assigned';
 perform t.mfa('d2'); assert t.denied(format('select public.aura_agency_assign(%L, %L, %L, ''manager'')', t.ws('d'), t.g('rel_c'), t.uid('d4'))), 'members cannot assign themselves or others';
 assert t.denied(format('select public.aura_agency_client_grant(%L, %L, ''["view","content","profile"]'', false, 12)', t.ws('c'), t.g('rel_c'))), 'Agency staff cannot change their own grant';
 reset role; perform t.pass('grants: client sees the request, grants it or less, once; owner-only Creator acceptance; admin-only assignments; staff cannot widen');
end $$;

-- 3. Enforcement in the shared access checks: scope, role, MFA, assignment, expiry, revocation, nested calls, never-delegable functions
do $$ declare i uuid; n int; begin
 perform t.mfa('d2');
 assert public.aura_brand_content_overview(t.ws('c')) is not null, 'reads within the grant';
 assert public.aura_brand_state(t.ws('c'))->'profile'->>'public_name' = 'Hostel Co', '"view" lets the Agency read the business profile';
 i := (public.aura_brand_content_create(t.ws('c'), gen_random_uuid(), '{"title":"Agency drafted reel"}')->>'id')::uuid;
 assert t.val(format('select count(*) from aura_agency.activity where client_ws = %L and actor = %L and action = ''aura_brand_content_create'' and scope = ''content''', t.ws('c'), t.uid('d2'))) = '1', 'the write is logged with the person and the client';
 assert t.val(format('select created_by = %L from aura_brand_content.item where id = %L', t.uid('d2'), i)) = 'true', 'records name the real person';
 assert t.denied(format('select public.aura_brand_save_goal(%L, null, ''{"kind":"awareness","metric":"followers","target":"100","horizon_days":"30"}'')', t.ws('c'))), 'no writes outside the grant (profile)';
 assert t.denied(format('select public.aura_market_create_campaign(%L, gen_random_uuid(), ''ugc'', ''Agency campaign'')', t.ws('c'))), 'no campaign writes without campaigns';
 assert t.denied(format('select public.aura_brand_ai_state(%L)', t.ws('c'))), 'assistant data stays closed without the assistant area';
 assert t.denied(format('select public.aura_brand_delete(%L, ''Hostel Co'', gen_random_uuid())', t.ws('c'))), 'deletion is never delegable';
 assert t.denied(format('select public.aura_brand_verification_submit(%L, true)', t.ws('c'))), 'verification is never delegable';
 assert t.denied(format('select public.aura_brand_content_overview(%L)', t.ws('c2'))), 'other Brands stay closed';
 assert t.denied('select count(*) from aura_agency.grant_'), 'no direct table access';
 perform t.me('d2'); assert t.denied(format('select public.aura_brand_content_create(%L, gen_random_uuid(), ''{"title":"No MFA"}'')', t.ws('c'))), 'delegated writes need an authenticator';
 perform t.mfa('d3'); assert public.aura_brand_content_overview(t.ws('c')) is not null and t.denied(format('select public.aura_brand_content_create(%L, gen_random_uuid(), ''{"title":"Viewer"}'')', t.ws('c'))), 'viewers read only';
 perform t.mfa('d4'); assert t.denied(format('select public.aura_brand_content_overview(%L)', t.ws('c'))), 'unassigned Agency staff have no access';
 perform t.mfa('d2');
 assert public.aura_studio_capture_idea(t.ws('a'), gen_random_uuid(), 'Agency idea for Creator a', null) is not null, 'Creator clients work the same way (content)';
 assert t.denied(format('select public.aura_social_add_account(%L, gen_random_uuid(), ''{"platform":"instagram","handle":"agencyadded"}'')', t.ws('a'))), 'but not their accounts without profile';
 assert t.denied(format('select public.aura_monitor_consent(%L, gen_random_uuid(), true)', t.ws('a'))), 'consent is never delegable';
 reset role; update aura_agency.grant_ set expires_at = now() - interval '1 minute' where relationship_id = t.g('rel_c') and ended_at is null; -- fixture: expire the grant
 perform t.mfa('d2'); assert t.denied(format('select public.aura_brand_content_overview(%L)', t.ws('c'))), 'expired access fails closed';
 reset role; update aura_agency.grant_ set expires_at = now() + interval '6 months' where relationship_id = t.g('rel_c') and ended_at is null; -- fixture: restore
 perform t.mfa('c'); perform public.aura_agency_client_grant(t.ws('c'), t.g('rel_c'), '["view","content","assistant"]', false, 6);
 perform t.mfa('d2'); assert public.aura_brand_ai_context(t.ws('c'), 'strategy')->'facts'->'profile'->>'name' = 'Hostel Co', 'assistant context is the client''s own';
 perform t.mfa('c'); perform public.aura_agency_client_grant(t.ws('c'), t.g('rel_c'), '["view","assistant"]', false, 6);
 perform t.mfa('d2');
 assert t.denied(format('select public.aura_brand_content_create(%L, gen_random_uuid(), ''{"title":"Narrowed"}'')', t.ws('c'))), 'a narrowed grant applies at once';
 assert t.val(format('select count(*) from aura_agency.grant_ where relationship_id = %L', t.g('rel_c'))) = '3', 'every grant is kept as history';
 reset role; perform t.pass('enforcement: scope, viewer, MFA, assignment, expiry, narrowing, never-delegable, logged with person and client');
end $$;

-- 4. Nested calls need every area; revocation fails closed; client approval is never implied by Agency approval
do $$ declare conv uuid; d uuid; a uuid; begin
 perform t.mfa('d2');
 conv := (public.aura_brand_ai_start(t.ws('c'), gen_random_uuid(), 'content', 'Ideas')->>'id')::uuid;
 d := (public.aura_brand_ai_save_draft(t.ws('c'), conv, 'content_ideas', '{}', '{"items":[{"title":"Rooftop sunrise yoga"}]}', 'manual')->>'id')::uuid;
 assert t.denied(format('select public.aura_brand_ai_apply(%L, %L, true)', t.ws('c'), d)), 'applying ideas into Content needs the content area too';
 a := (public.aura_agency_request_approval(t.ws('d'), t.g('rel_c'), 'Approve the December content plan', 'Twelve posts across two pillars', '/brand/content/calendar')->>'id')::uuid; insert into t.x values ('appr', a);
 assert t.denied(format('select public.aura_agency_client_decide(%L, %L, ''approved'', null)', t.ws('c'), a)), 'Agency staff cannot approve for the client';
 perform t.mfa('d'); perform public.aura_agency_internal_decide(t.ws('d'), a, 'approved', 'Checked by account lead');
 assert t.val(format('select client_status from aura_agency.approval where id = %L', a)) = 'pending', 'internal approval does not approve for the client';
 perform t.mfa('c'); perform public.aura_agency_client_decide(t.ws('c'), a, 'approved', 'Go ahead');
 perform public.aura_agency_client_end(t.ws('c'), t.g('rel_c'), 'Moving in-house');
 perform t.mfa('d2'); assert t.denied(format('select public.aura_brand_ai_state(%L)', t.ws('c'))), 'revoked access fails closed at once';
 perform t.mfa('d'); assert t.denied(format('select public.aura_agency_assign(%L, %L, %L, ''manager'')', t.ws('d'), t.g('rel_c'), t.uid('d2'))), 'an ended relationship cannot be reassigned';
 reset role;
 assert t.val(format('select count(*) from aura_agency.activity where client_ws = %L', t.ws('c')))::int >= 1 and t.val(format('select count(*) from aura_agency.assignment where relationship_id = %L', t.g('rel_c'))) = '0', 'records are kept; access is removed';
 perform t.pass('approvals and revocation: nested areas required, client approval separate from internal approval, revocation immediate, records kept');
end $$;

-- 5. Dual representation: disclosure and acknowledgement by both sides; never contracting authority on both sides
do $$ declare camp uuid; tok text; rel uuid; r text; app uuid; col uuid; begin
 perform t.mfa('d'); tok := public.aura_agency_invite_client(t.ws('d'), 'brand', 'Hostel Co', '["view","applications","campaigns"]', true, 12, null);
 perform t.mfa('c'); rel := (public.aura_agency_accept(tok, t.ws('c'), '["view","applications","campaigns"]', true, 12)->>'relationship')::uuid; insert into t.x values ('rel_c2', rel);
 perform t.mfa('d'); perform public.aura_agency_assign(t.ws('d'), rel, t.uid('d2'), 'manager');
 perform t.mfa('c'); camp := t.campaign('c', 'ugc', 'Dual campaign', '{"positions":2,"compensation":{"money":{"type":"fixed","currency":"INR","min":2500}}}'); perform public.aura_market_publish(t.ws('c'), camp); reset role;
 perform t.mfa('a'); perform public.aura_apply_submit(t.ws('a'), (public.aura_apply_save_draft(t.ws('a'), gen_random_uuid(), camp, t.app_content(t.g('acc_a')))->>'id')::uuid, true); reset role;
 app := (select id from aura_apply.application where campaign_id = camp limit 1); col := (select collaboration_id from aura_apply.application where id = app);
 perform t.mfa('d');
 assert jsonb_array_length(public.aura_agency_state(t.ws('d'))->'conflicts') = 1, 'the Agency sees that it represents both sides';
 perform t.mfa('d2');
 r := t.err(format('select public.aura_selection_inbox(%L, %L)', t.ws('c'), camp));
 assert r = 'ok', 'reading is still allowed: ' || r;
 r := t.err(format('select public.aura_selection_note(%L, %L, ''Strong fit'', ''{}''::text[])', t.ws('c'), app));
 assert r like '55000: Dual representation: disclose%', 'application steps wait for disclosure: ' || r;
 perform t.mfa('d'); perform public.aura_agency_disclose(t.ws('d'), t.ws('a'), t.ws('c'), 'We represent both Creator a and Hostel Co on the Dual campaign.', 'Separate account leads; no one acts for both sides; fees disclosed to both.');
 perform t.mfa('c'); perform public.aura_agency_client_acknowledge(t.ws('c'), t.val('select id from aura_agency.disclosure limit 1')::uuid);
 perform t.mfa('d2'); assert t.err(format('select public.aura_selection_note(%L, %L, ''Strong fit'', ''{}''::text[])', t.ws('c'), app)) like '55000: Dual%', 'both clients must acknowledge';
 perform t.mfa('a'); perform public.aura_agency_client_acknowledge(t.ws('a'), t.val('select id from aura_agency.disclosure limit 1')::uuid);
 perform t.mfa('d2'); r := t.err(format('select public.aura_selection_note(%L, %L, ''Strong fit'', ''{}''::text[])', t.ws('c'), app));
 assert r not like '%Dual%' and r not like '42501%', 'after both acknowledgements the step is allowed: ' || r;
 r := t.err(format('select public.aura_apply_confirm(%L, %L, 1)', t.ws('c'), col));
 assert r not like '42501%' and r not like '%Dual%', 'contracting passes delegation for one side: ' || r;
 perform t.mfa('a'); perform public.aura_agency_client_grant(t.ws('a'), t.g('rel_a'), '["view","applications","content"]', true, 12);
 perform t.mfa('d2'); r := t.err(format('select public.aura_apply_confirm(%L, %L, 1)', t.ws('c'), col));
 assert r like '55000: Dual representation: an Agency cannot hold contracting authority for both sides%', 'never contracting for both sides: ' || r;
 reset role; perform t.pass('dual representation: detected, disclosed, acknowledged by both, never contracting on both sides');
end $$;

-- 6. Fees separate from client spend; offboarding keeps records; the client sees everything done in its name
do $$ declare before_pay int := (select count(*) from aura_commercial.payment_report); v jsonb; begin
 perform t.mfa('d');
 perform public.aura_agency_save_fee(t.ws('d'), null, jsonb_build_object('relationship_id', t.g('rel_a'), 'kind', 'commission', 'description', 'Commission on Dual campaign', 'amount', 375, 'basis', '15% of 2,500 agreed fee', 'status', 'planned'));
 assert t.denied(format('select public.aura_agency_save_fee(%L, null, %L)', t.ws('d'), jsonb_build_object('relationship_id', t.g('rel_a'), 'kind', 'retainer', 'description', 'Paid without date', 'amount', 100, 'status', 'paid')), '23514'), 'paid fees need a paid date';
 perform t.mfa('d3'); assert t.denied(format('select public.aura_agency_save_fee(%L, null, %L)', t.ws('d'), jsonb_build_object('relationship_id', t.g('rel_a'), 'kind', 'retainer', 'description', 'Member fee', 'amount', 100))), 'only admins record fees';
 reset role; assert (select count(*) from aura_commercial.payment_report) = before_pay, 'Agency fees never touch campaign payments';
 perform t.mfa('a'); v := public.aura_agency_client_view(t.ws('a'));
 assert v->'agencies'->0->'fees'->0->>'description' = 'Commission on Dual campaign' and jsonb_array_length(v->'agencies'->0->'activity') >= 1, 'the client sees the fees and the actions taken in its name';
 perform t.mfa('d2'); assert t.denied(format('select public.aura_agency_client_view(%L)', t.ws('a'))), 'the client page is the client''s own';
 perform t.mfa('d'); assert t.denied(format('select public.aura_agency_end(%L, %L, null)', t.ws('d'), t.g('rel_a')), '22023'), 'offboarding gives a reason';
 perform public.aura_agency_end(t.ws('d'), t.g('rel_a'), 'Engagement completed');
 perform t.mfa('d2'); assert t.denied(format('select public.aura_studio_ideas(%L, 5)', t.ws('a'))), 'offboarded clients are closed at once';
 perform t.mfa('a'); v := public.aura_agency_client_view(t.ws('a'));
 assert v->'agencies'->0->>'status' = 'ended' and jsonb_array_length(v->'agencies'->0->'fees') = 1 and jsonb_array_length(v->'agencies'->0->'history') >= 1, 'agreements, fees and history are kept';
 assert jsonb_array_length(public.aura_agency_delegations()) = 0, 'no delegations remain for the client''s own view';
 reset role; perform t.pass('fees and offboarding: fees separate from client spend, admin-only, visible to the client; offboarding revokes and keeps records');
end $$;
\echo ---RESULTS---
select name from t.results order by name;
