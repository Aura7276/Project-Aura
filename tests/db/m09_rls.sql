-- Executed by tests/unit/db-m09.test.ts on a disposable PostgreSQL with the real M02-M06 and M09 migrations, the auth stub and the storage stub (NOT Supabase).
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

-- 1. Anonymous and direct access
do $$ begin perform t.as_anon();
 assert t.denied(format('select public.aura_profile_state(%L)', t.ws('a'))), 'anon state';
 assert t.denied(format('select public.aura_profile_save(%L, ''{}'')', t.ws('a'))), 'anon save';
 assert t.denied('select * from aura_profile.profile'), 'anon table';
 assert t.denied('select public.aura_profile_moderation_queue()'), 'anon moderation';
 assert (public.aura_public_profile('nobody-here'))->>'found' = 'false', 'anon may call the public profile projection';
 assert (public.aura_public_kit('nothex'))->>'status' = 'not_found', 'anon may call the public kit projection';
 reset role; perform t.me('a');
 assert t.denied('select * from aura_profile.portfolio_item'), 'direct table read';
 assert t.denied('update aura_profile.profile set published = true'), 'direct publish';
 assert t.denied('select aura_profile.public_json(gen_random_uuid())'), 'private projection helper';
 assert t.denied('select aura_profile.kit_content(gen_random_uuid(), true, true)'), 'private kit helper';
 assert t.denied('insert into aura_profile.enquiry(workspace_id) values (gen_random_uuid())'), 'direct enquiry';
 reset role; perform t.pass('anonymous and direct access denied; only the two public projections are callable without signing in'); end $$;

-- 2. Usernames
do $$ declare s jsonb; begin perform t.me('a');
 s := public.aura_profile_state(t.ws('a')); assert s->'profile'->>'published' = 'false' and s->'profile'->>'username' is null, 'profile starts private, with no username';
 assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"ab"}'')', t.ws('a')), '22023'), 'too short';
 assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"a..b"}'')', t.ws('a')), '22023'), 'consecutive punctuation';
 assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"-asha"}'')', t.ws('a')), '22023'), 'leading punctuation';
 assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"socials"}'')', t.ws('a')), '23505'), 'a Studio route segment is reserved';
 assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"analytics"}'')', t.ws('a')), '23505'), 'another Studio route segment is reserved';
 s := public.aura_profile_save(t.ws('a'), '{"username":"Asha.Rao","headline":"Travel stories on a budget"}');
 assert s->'profile'->>'username' = 'asha.rao', 'username is stored lower-case';
 perform t.me('b'); assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"ASHA.RAO"}'')', t.ws('b')), '23505'), 'usernames are unique regardless of case';
 perform t.me('a'); s := public.aura_profile_save(t.ws('a'), '{"username":"asha.travels"}');
 assert exists(select 1 from jsonb_array_elements(s->'aliases') x where x->>'username' = 'asha.rao'), 'the old username is kept as an alias';
 perform t.me('b'); assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"asha.rao"}'')', t.ws('b')), '23505'), 'a retired username is protected from others while it redirects';
 perform t.me('a'); perform public.aura_profile_save(t.ws('a'), '{"username":"asha.x1"}'); perform public.aura_profile_save(t.ws('a'), '{"username":"asha.x2"}');
 assert t.denied(format('select public.aura_profile_save(%L, ''{"username":"asha.x3"}'')', t.ws('a')), '54000'), 'username changes are rate limited';
 reset role; delete from aura_profile.username_change; perform t.me('a'); perform public.aura_profile_save(t.ws('a'), '{"username":"asha.travels"}');
 reset role; perform t.pass('usernames: format rules, Studio routes reserved, case-insensitive uniqueness, retired names redirect and stay protected, change limit'); end $$;

-- 3. Publication, eligibility and discovery
do $$ declare r jsonb; acc uuid; begin perform t.me('b');
 assert t.denied(format('select public.aura_profile_publish(%L, true)', t.ws('b')), '55000'), 'cannot publish without a username and headline';
 perform t.me('a');
 assert (t.anon_profile('asha.travels'))->>'found' = 'false', 'an unpublished profile is not reachable by direct URL';
 perform t.me('a'); assert t.denied(format('select public.aura_profile_publish(%L, true, true)', t.ws('a')), '55000'), 'discovery needs a qualifying account (below 100 is private to direct sharing)';
 r := public.aura_profile_publish(t.ws('a'), true, false); assert r->'state'->'profile'->>'published' = 'true' and r->'state'->'profile'->>'listed' = 'false', 'published for direct sharing only';
 assert (t.anon_profile('asha.travels'))->>'found' = 'true', 'published profile is public';
 assert (t.anon_profile('asha.rao'))->>'redirect' = 'asha.travels', 'an old username redirects to the current one';
 perform t.as_anon(); assert (select count(*) from public.m01_public_creator_previews where slug = 'asha.travels') = 0, 'not in discovery without listing'; reset role;
 perform t.me('a'); acc := t.acct('a', 'instagram', 'asha.ig', '{"followers":60}');
 assert t.denied(format('select public.aura_profile_publish(%L, true, true)', t.ws('a')), '55000'), '60 followers does not qualify';
 perform t.acct('a', 'youtube', 'ashachannel', '{"followers":70}');
 assert t.denied(format('select public.aura_profile_publish(%L, true, true)', t.ws('a')), '55000'), 'two accounts are never summed (60 + 70)';
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), acc, 'followers', 150, current_date, null, null, 'manual', null, null);
 r := public.aura_profile_publish(t.ws('a'), true, true); assert r->'state'->'profile'->>'listed' = 'true', 'a single qualifying account allows discovery';
 perform t.as_anon(); assert (select count(*) from public.m01_public_creator_previews where slug = 'asha.travels') = 1, 'listed in the M01 directory';
 assert (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'm01_public_creator_previews') = 'slug,display_name,bio', 'the directory exposes exactly three columns'; reset role;
 perform t.me('a'); perform public.aura_profile_publish(t.ws('a'), false);
 assert (t.anon_profile('asha.travels'))->>'found' = 'false', 'unpublishing removes public access immediately';
 perform t.as_anon(); assert (select count(*) from public.m01_public_creator_previews) = 0, 'and discovery'; reset role;
 perform t.me('a'); perform public.aura_profile_publish(t.ws('a'), true, true);
 reset role; update aura_identity.workspace set status = 'suspended' where id = t.ws('a');
 assert (t.anon_profile('asha.travels'))->>'found' = 'false', 'a suspended workspace disappears from public view';
 perform t.as_anon(); assert (select count(*) from public.m01_public_creator_previews) = 0, 'and from discovery'; reset role;
 update aura_identity.workspace set status = 'open' where id = t.ws('a');
 perform t.pass('publication: private by default, readiness checks, direct sharing below 100, discovery on one qualifying account (never summed), unpublish and suspension remove access'); end $$;

-- 4. Portfolio, services, packages, experience and the public projection
do $$ declare p jsonb; i jsonb; cr uuid; rid uuid := gen_random_uuid(); acc uuid; begin perform t.me('a');
 acc := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'handle' = 'asha.ig');
 cr := (public.aura_social_record_content_observation(t.ws('a'), gen_random_uuid(), acc, '{"external_id":"reel-1","title":"Goa reel","format":"short_video"}', 'views', 4200, 'lifetime', current_date - 1, null, null, 'manual', null, null)->'content'->>'id')::uuid;
 i := public.aura_profile_save_item(t.ws('a'), rid, null, jsonb_build_object('kind','organic','title','Goa on a budget','visibility','public','featured',true,'content_ref',cr,'show_metrics',true));
 assert public.aura_profile_save_item(t.ws('a'), rid, null, '{"kind":"organic","title":"Other"}')->>'id' = i->>'id', 'idempotent create';
 perform public.aura_profile_save_item(t.ws('a'), gen_random_uuid(), null, '{"kind":"speculative","title":"Concept ad for a tea brand","visibility":"public"}');
 perform public.aura_profile_save_item(t.ws('a'), gen_random_uuid(), null, '{"kind":"organic","title":"Private draft","visibility":"private"}');
 perform public.aura_profile_save_item(t.ws('a'), gen_random_uuid(), null, '{"kind":"ugc_sample","title":"Restricted sample","visibility":"restricted"}');
 perform public.aura_profile_save_item(t.ws('a'), gen_random_uuid(), null, '{"kind":"case_study","title":"Hostel launch","visibility":"public","objective":"Awareness","approach":"Three reels","contribution":"Concept and edit","deliverables":["3 reels"],"outcomes":[{"statement":"The client said bookings rose","source":"self_reported"}]}');
 assert t.denied(format('select public.aura_profile_save_item(%L, gen_random_uuid(), null, ''{"kind":"commercial","title":"Paid post"}'')', t.ws('a')), '23514'), 'commercial work names the brand';
 assert t.denied(format('select public.aura_profile_save_item(%L, gen_random_uuid(), null, ''{"kind":"case_study","title":"Case","outcomes":[{"statement":"Big lift","source":"observation","observation_id":"%s"}]}'')', t.ws('a'), gen_random_uuid()), '22023'), 'an outcome cited to an observation must cite a real one';
 assert t.denied(format('select public.aura_profile_save_item(%L, gen_random_uuid(), null, ''{"kind":"organic","title":"Link","link":"javascript:alert(1)"}'')', t.ws('a')), '23514'), 'only https links';
 perform public.aura_profile_save_service(t.ws('a'), null, '{"kind":"influencer","name":"Instagram reel","visibility":"public","pricing":"range","price_min":5000,"price_max":9000,"rates_visibility":"restricted"}');
 perform public.aura_profile_save_service(t.ws('a'), null, '{"kind":"ugc","name":"UGC video","visibility":"public","pricing":"fixed","price_min":4000}');
 assert t.denied(format('select public.aura_profile_save_service(%L, null, ''{"kind":"influencer","name":"Bad","pricing":"range","price_min":9000,"price_max":10}'')', t.ws('a')), '23514'), 'a range must be ordered';
 assert t.denied(format('select public.aura_profile_save_service(%L, null, ''{"kind":"influencer","name":"Open rates","rates_visibility":"public"}'')', t.ws('a')), '23514'), 'rates can never be public';
 perform public.aura_profile_save_package(t.ws('a'), null, '{"name":"Launch bundle","deliverables":[{"item":"Reel","quantity":3}],"price_min":20000,"price_max":30000,"terms":"50% upfront","visibility":"restricted"}');
 assert t.denied(format('select public.aura_profile_save_package(%L, null, ''{"name":"Public bundle","visibility":"public"}'')', t.ws('a')), '23514'), 'packages are never public';
 perform public.aura_profile_save_experience(t.ws('a'), null, '{"organisation":"Hostel Co","role":"Creator","year_from":2025,"visibility":"public"}');
 perform public.aura_profile_save(t.ws('a'), '{"show_follower_counts":true}');
 perform public.aura_social_set_sharing(t.ws('a'), acc, 'published');
 p := (t.anon_profile('asha.travels'))->'profile';
 assert jsonb_array_length(p->'portfolio') = 2 and not exists(select 1 from jsonb_array_elements(p->'portfolio') x where x->>'title' in ('Private draft','Restricted sample')), 'only public items appear';
 assert exists(select 1 from jsonb_array_elements(p->'portfolio') x where x->>'title' = 'Concept ad for a tea brand' and (x->>'speculative')::boolean), 'speculative work is labelled';
 assert (select x->'metrics'->0->>'source' from jsonb_array_elements(p->'portfolio') x where x->>'title' = 'Goa on a budget') = 'manual' and (select x->'metrics'->0->>'observed_on' from jsonb_array_elements(p->'portfolio') x where x->>'title' = 'Goa on a budget') is not null, 'portfolio metrics carry source and date';
 assert jsonb_array_length(p->'case_studies') = 1 and p->'case_studies'->0->'case_study'->'outcomes'->0->>'source' = 'self_reported', 'case study outcomes keep their source';
 assert not exists(select 1 from jsonb_array_elements(p->'services') x where x->'pricing'->>'mode' <> 'on_request'), 'the public profile never shows rates';
 assert p::text !~ '(20000|30000|5000|9000|4000|Launch bundle|50% upfront)', 'no price or package reaches the public profile';
 assert jsonb_array_length(p->'accounts') = 1 and p->'accounts'->0->>'ownership' = 'self_reported' and p->'accounts'->0->'followers'->>'source' = 'self_reported', 'accounts show specific, labelled indicators';
 assert p::text !~ '(workspace_id|@example|"email"|request_id|ashachannel)', 'no internal ids, emails or unpublished accounts';
 assert not (p ? 'score') and not (p ? 'rating') and p::text !~* 'rating', 'no composite rating';
 perform t.me('b'); assert t.denied(format('select public.aura_profile_save_item(%L, null, %L, ''{"kind":"organic","title":"Hijack"}'')', t.ws('b'), (i->>'id')::uuid), '42501'), 'another Creator cannot change this item';
 assert t.denied(format('select public.aura_profile_save_item(%L, gen_random_uuid(), null, %L)', t.ws('b'), jsonb_build_object('kind','organic','title','Borrowed','content_ref',cr)), '42501'), 'another Creator cannot attach this content reference';
 assert t.denied(format('select public.aura_profile_delete(%L, ''portfolio'', %L)', t.ws('b'), (i->>'id')::uuid), '42501'), 'another Creator cannot delete it';
 reset role; perform t.pass('portfolio and services: item-level visibility, speculative labels, sourced metrics and outcomes, rates and packages never public, specific indicators, no rating, tenant isolation'); end $$;

-- 5. Testimonials
do $$ declare inv jsonb; tid uuid; begin perform t.me('a');
 inv := public.aura_profile_create_invite(t.ws('a'), 'Hostel Co'); insert into t.tok values ('inv1', inv->>'token');
 reset role; assert not exists(select 1 from aura_profile.testimonial_invite where token_hash = inv->>'token'), 'only the hash of the token is stored';
 perform t.me('e'); assert t.denied(format('select public.aura_profile_submit_testimonial(%L, ''Self'', null, ''other'', ''I am writing my own glowing review here'')', inv->>'token'), '42501'), 'a member of the Creator workspace cannot write one';
 perform t.mfa('c'); assert (public.aura_profile_invite_info(inv->>'token'))->>'display_name' = 'Creator A', 'the invited person sees only whose profile it is';
 tid := (public.aura_profile_submit_testimonial(inv->>'token', 'Priya at Hostel Co', 'Marketing lead', 'brand_client', 'Asha delivered three reels on time and the brief was followed closely.')->>'id')::uuid;
 assert t.denied(format('select public.aura_profile_submit_testimonial(%L, ''Again'', null, ''other'', ''Trying to use the same invitation twice here'')', inv->>'token'), '42501'), 'an invitation is single use';
 perform t.me('a'); assert t.denied(format('select public.aura_profile_testimonial_action(%L, %L, ''show'')', t.ws('a'), tid), '55000'), 'a pending testimonial cannot be shown';
 assert jsonb_array_length((t.anon_profile('asha.travels'))->'profile'->'testimonials') = 0, 'nothing is public before moderation';
 perform t.me('r2'); assert t.denied('select public.aura_profile_moderation_queue()'), 'a Platform Admin without the reviewer grant cannot moderate';
 perform t.me('r'); assert t.denied('select public.aura_profile_moderation_queue()'), 'a reviewer without MFA cannot moderate';
 perform t.mfa('r'); assert jsonb_array_length(public.aura_profile_moderation_queue()) = 1, 'the queue shows it';
 assert t.denied(format('select public.aura_profile_moderate(%L, ''approved'', '''')', tid), '22023'), 'a reason is required';
 perform public.aura_profile_moderate(tid, 'approved', 'Attributable and specific');
 perform t.me('a'); perform public.aura_profile_testimonial_action(t.ws('a'), tid, 'show');
 assert (t.anon_profile('asha.travels'))->'profile'->'testimonials'->0->>'author_name' = 'Priya at Hostel Co', 'an approved testimonial the Creator chose to show is public, attributed';
 perform t.me('a'); perform public.aura_profile_testimonial_action(t.ws('a'), tid, 'dispute', 'Wrong project named');
 assert jsonb_array_length((t.anon_profile('asha.travels'))->'profile'->'testimonials') = 0, 'a disputed testimonial is hidden';
 perform t.me('a'); assert t.denied('update aura_profile.testimonial set body = ''edited'''), 'testimonials cannot be edited directly';
 perform t.me('a'); inv := public.aura_profile_create_invite(t.ws('a'), 'Expired'); reset role; update aura_profile.testimonial_invite set expires_at = now() - interval '1 minute' where token_hash = aura_profile.hash(inv->>'token');
 perform t.mfa('c'); assert (public.aura_profile_invite_info(inv->>'token'))->>'valid' = 'false', 'an expired invitation is invalid';
 reset role; perform t.pass('testimonials: invitation only, never by the Creator workspace, single use, moderated by an MFA reviewer with a reason, shown only by choice, disputes hide, expiry enforced'); end $$;

-- 6. Media kits and share links
do $$ declare k uuid; pub jsonb; res jsonb; v jsonb; rq uuid := gen_random_uuid(); priv uuid; c jsonb; begin perform t.me('a');
 k := (public.aura_profile_create_kit(t.ws('a'), rq, '{"name":"Travel brands 2026","audience":"Travel and hospitality","contact_note":"Reach me through AURA"}')->>'id')::uuid;
 assert public.aura_profile_create_kit(t.ws('a'), rq, '{"name":"dup"}')->>'id' = k::text, 'idempotent kit creation';
 perform public.aura_profile_save_kit(t.ws('a'), k, '{}', '[{"key":"packages","enabled":true},{"key":"audience","enabled":true}]');
 pub := public.aura_profile_create_share(t.ws('a'), k, 'public', null, null, true, 'Open link', null);
 assert pub->>'token' ~ '^[0-9a-f]{64}$' and (pub->>'expires_at') is null, 'a public link has a strong token and no default expiry';
 res := t.anon_kit(pub->>'token'); assert res->>'status' = 'ok', 'anyone with a public link can view';
 c := res->'content';
 assert (c->>'rates_included')::boolean = false and c::text !~ '(20000|30000|5000|9000|Launch bundle)', 'a public link never carries rates or packages, even if asked';
 assert not exists(select 1 from jsonb_array_elements(c->'sections') s, jsonb_array_elements(s->'items') x where x->>'title' in ('Restricted sample','Private draft')), 'restricted and private items stay out of a public link';
 assert not exists(select 1 from jsonb_array_elements(c->'sections') s where s->>'key' = 'audience' and jsonb_array_length(s->'items') > 0), 'audience data never goes into a public link';
 perform t.me('a'); -- restricted link for Brand c, with rates
 assert t.denied(format('select public.aura_profile_create_share(%L, %L, ''restricted'', null, null, true, null, null)', t.ws('a'), k), '22023'), 'a restricted link needs a Brand or Agency recipient';
 assert t.denied(format('select public.aura_profile_create_share(%L, %L, ''restricted'', %L, null, true, null, null)', t.ws('a'), k, t.ws('b')), '22023'), 'a Creator workspace cannot be the recipient';
 perform t.me('a'); res := public.aura_profile_create_share(t.ws('a'), k, 'restricted', t.ws('c'), null, true, 'For Brand C', null); insert into t.tok values ('restricted', res->>'token');
 assert (res->>'expires_at')::timestamptz between now() + interval '29 days' and now() + interval '31 days', 'restricted links expire after 30 days by default';
 assert (t.anon_kit(res->>'token'))->>'status' = 'sign_in_required', 'a restricted link needs sign-in';
 perform t.me('b'); assert public.aura_public_kit(res->>'token')->>'status' = 'not_permitted', 'another signed-in user is refused';
 perform t.mfa('c'); v := public.aura_public_kit(res->>'token'); assert v->>'status' = 'ok', 'the recipient Brand can view';
 assert v::text ~ 'Restricted sample' and v::text ~ 'Launch bundle' and v::text ~ '20000', 'the recipient sees restricted items, packages and rates';
 perform public.aura_public_kit(res->>'token', t.ws('c')); reset role;
 assert (select count(*) from aura_profile.brand_visit) = 1, 'a Brand is identified only when its member chooses to share it';
 perform t.mfa('c'); perform public.aura_public_kit(res->>'token', t.ws('b')); reset role;
 assert (select count(*) from aura_profile.brand_visit) = 1, 'a viewer cannot attribute a visit to a workspace they do not belong to';
 -- snapshot then make an item private: the snapshot link must drop it
 perform t.me('a'); v := public.aura_profile_snapshot_kit(t.ws('a'), k, 'Version for April'); assert (v->>'version')::int = 1, 'first snapshot';
 res := public.aura_profile_create_share(t.ws('a'), k, 'public', null, (v->>'id')::uuid, false, 'Snapshot', 7);
 assert ((t.anon_kit(res->>'token'))->'content')::text ~ 'Goa on a budget', 'the snapshot shows the item';
 perform t.me('a'); priv := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_profile_state(t.ws('a'))->'portfolio') x where x->>'title' = 'Goa on a budget');
 perform public.aura_profile_save_item(t.ws('a'), null, priv, '{"kind":"organic","title":"Goa on a budget","visibility":"private"}');
 assert ((t.anon_kit(res->>'token'))->'content')::text !~ 'Goa on a budget', 'a hosted snapshot enforces the current privacy of each item';
 -- revoke and expiry
 perform t.me('a'); perform public.aura_profile_revoke_share(t.ws('a'), (res->>'id')::uuid);
 assert (t.anon_kit(res->>'token'))->>'status' = 'revoked', 'a revoked link denies access';
 reset role; update aura_profile.kit_share set expires_at = now() - interval '1 minute' where token_hash = aura_profile.hash(pub->>'token');
 assert (t.anon_kit(pub->>'token'))->>'status' = 'expired', 'an expired link denies access';
 assert (t.anon_kit(repeat('0', 64)))->>'status' = 'not_found', 'an unknown token reveals nothing';
 assert (select coalesce(sum(views), 0) from aura_profile.kit_view) >= 2, 'views are counted';
 assert not exists(select 1 from information_schema.columns where table_schema = 'aura_profile' and table_name in ('profile_view','kit_view') and column_name ~ '(ip|agent|user|viewer|email)'), 'view analytics store no visitor identity';
 perform t.me('b'); assert t.denied(format('select public.aura_profile_kits(%L, %L)', t.ws('b'), k)) or jsonb_array_length(public.aura_profile_kits(t.ws('b'), k)) = 0, 'another Creator cannot list this kit';
 assert t.denied(format('select public.aura_profile_revoke_share(%L, %L)', t.ws('b'), (res->>'id')::uuid), '42501'), 'another Creator cannot revoke this link';
 assert t.denied(format('select public.aura_profile_kit_preview(%L, %L, true, true)', t.ws('b'), k), '42501'), 'another Creator cannot preview this kit';
 reset role; perform t.pass('media kits: public links never carry rates, packages, audience or restricted items; restricted links need the recipient signed in; snapshots re-filter by current privacy; revoke and expiry deny; aggregate views; Brand identity only by consent'); end $$;

-- 7. Enquiries, analytics, owner views and audit
do $$ declare r jsonb; begin perform t.mfa('c');
 assert t.denied(format('select public.aura_profile_enquire(''asha.travels'', %L, ''We would like to discuss a campaign'')', t.ws('c')), '55000'), 'enquiries need Brand verification (M14), which does not exist';
 perform t.me('b'); assert t.denied(format('select public.aura_profile_enquire(''asha.travels'', %L, ''We would like to discuss a campaign'')', t.ws('c')), '42501'), 'only a member of the Brand may send';
 reset role; delete from aura_profile.profile_view;
 perform t.me('a'); perform public.aura_public_profile('asha.travels'); reset role;
 assert (select count(*) from aura_profile.profile_view) = 0, 'the Creator''s own visits are not counted';
 perform t.anon_profile('asha.travels'); perform t.anon_profile('asha.travels');
 perform t.me('a'); r := public.aura_profile_analytics(t.ws('a'), 30);
 assert (r->'profile_views'->0->>'views')::int = 2 and jsonb_array_length(r->'brand_visits') = 1 and (r->>'enquiries')::int = 0, 'aggregate analytics';
 perform t.me('b'); assert t.denied(format('select public.aura_profile_analytics(%L)', t.ws('a'))), 'another Creator cannot read them';
 reset role;
 assert (select count(distinct event) from aura_identity.event where event like 'profile\_%') >= 12, 'material profile events are audited';
 assert not exists(select 1 from aura_identity.event where event like 'profile%' and event ~ '(http|@|[0-9a-f]{32})'), 'audit events carry no content or tokens';
 perform t.pass('enquiries blocked until Brand verification exists; owner visits not counted; aggregate analytics are private; audit trail without content'); end $$;

-- 8. Cross-tenant sweep
do $$ declare n int := 0; f text; begin perform t.me('b');
 foreach f in array array['select public.aura_profile_state(%L)','select public.aura_profile_save(%L, ''{}'')','select public.aura_profile_publish(%L, false)','select public.aura_profile_preview(%L)','select public.aura_profile_create_invite(%L, null)','select public.aura_profile_create_kit(%L, gen_random_uuid(), ''{"name":"Kit"}'')','select public.aura_profile_analytics(%L)'] loop
  assert t.denied(format(f, t.ws('a'))), 'another Creator denied: ' || f; n := n + 1; end loop;
 perform t.mfa('c'); foreach f in array array['select public.aura_profile_state(%L)','select public.aura_profile_save(%L, ''{}'')','select public.aura_profile_create_kit(%L, gen_random_uuid(), ''{"name":"Kit"}'')'] loop
  assert t.denied(format(f, t.ws('c'))), 'a Brand workspace has no Creator profile: ' || f; n := n + 1; end loop;
 perform t.me('e'); assert t.denied(format('select public.aura_profile_save(%L, ''{}'')', t.ws('a'))), 'a non-owner member cannot edit'; n := n + 1;
 reset role; perform t.pass('cross-tenant: ' || n || ' function checks denied (another Creator, a Brand, a non-owner member)'); end $$;
\echo ---RESULTS---
select name from t.results order by name;
