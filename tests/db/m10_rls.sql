-- Executed by tests/unit/db-m10.test.ts on a disposable PostgreSQL with the real M02-M06, M09 and M10 migrations and the auth and storage stubs (NOT Supabase).
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

-- 1. Anonymous and direct access
do $$ begin perform t.as_anon();
 assert t.denied(format('select public.aura_market_feed(%L)', t.ws('a'))), 'anon feed';
 assert t.denied('select public.aura_market_review_queue()'), 'anon review';
 assert t.denied('select * from aura_market.campaign'), 'anon table';
 assert (select count(*) from public.m01_public_campaign_previews) = 0, 'anon may read the public preview view (empty)';
 reset role; perform t.me('a');
 assert t.denied('select * from aura_market.campaign_version'), 'direct versions';
 assert t.denied('update aura_identity.workspace set verification = ''verified'''), 'self-verification';
 assert t.denied('select aura_market.eligibility(gen_random_uuid(), ''paid'', ''{}'')'), 'private helper';
 assert t.denied('select aura_market.go_live(null, gen_random_uuid())'), 'private publish helper';
 reset role; perform t.pass('anonymous and direct access denied; only the public preview view is readable without signing in'); end $$;

-- 2. Brand drafting and the verification gate (AC05)
do $$ declare id uuid; r jsonb; v text; begin perform t.me('a');
 assert t.denied(format('select public.aura_market_create_campaign(%L, gen_random_uuid(), ''paid'', ''A creator campaign'')', t.ws('a'))), 'a Creator workspace cannot create campaigns';
 perform t.mfa('d'); assert t.denied(format('select public.aura_market_create_campaign(%L, gen_random_uuid(), ''paid'', ''An agency campaign'')', t.ws('d'))), 'an Agency cannot create campaigns here';
 perform t.mfa('c');
 id := t.campaign('c', 'paid', 'Budget travel reels'); insert into t.camp values ('paid', id);
 r := public.aura_market_brand_campaign(t.ws('c'), id); assert r->>'status' = 'draft' and jsonb_array_length(r->'errors') = 0, 'an unverified Brand may prepare a complete private draft';
 foreach v in array array['public','restricted','invite_only'] loop
  perform public.aura_market_save_campaign(t.ws('c'), id, v, false, t.content('Budget travel reels'));
  assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), id), '55000'), 'an unverified Brand cannot publish at visibility ' || v;
 end loop;
 assert t.denied(format('select public.aura_market_invite(%L, %L, %L, true)', t.ws('c'), id, t.ws('a')), '55000'), 'an unverified Brand cannot send invitations';
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('Budget travel reels'));
 reset role; assert (select x.status from aura_market.campaign x where x.id = t.c('paid')) = 'draft', 'still a draft';
 perform t.pass('brand drafting: Creators and Agencies cannot create; unverified Brands draft privately but cannot publish at any visibility or invite'); end $$;

-- 3. Interim verification and first-publication review
do $$ declare r jsonb; begin
 perform t.me('r'); assert t.denied(format('select public.aura_market_verify_brand(%L, ''verified'', ''Checked'')', t.ws('c'))), 'a reviewer without MFA cannot verify';
 perform t.mfa('r2'); assert t.denied(format('select public.aura_market_verify_brand(%L, ''verified'', ''Checked'')', t.ws('c'))), 'a Platform Admin without the reviewer grant cannot verify';
 perform t.mfa('r'); assert t.denied(format('select public.aura_market_verify_brand(%L, ''verified'', '''')', t.ws('c')), '22023'), 'a reason is required';
 perform public.aura_market_verify_brand(t.ws('c'), 'verified', 'Registration documents checked');
 reset role; assert (select verification from aura_identity.workspace where id = t.ws('c')) = 'verified' and (select count(*) from aura_market.verification_decision) = 1, 'decision recorded in the M02 field with an audit row';
 -- r3 owns Brand Two, so r3 cannot verify it
 update aura_identity.platform_admin set user_id = user_id; insert into aura_identity.platform_admin(user_id) values (t.uid('r3')) on conflict do nothing;
 perform t.mfa('r3'); assert t.denied(format('select public.aura_market_verify_brand(%L, ''verified'', ''Own brand'')', t.ws('c2'))), 'a reviewer cannot verify their own Brand';
 perform t.mfa('c'); r := public.aura_market_publish(t.ws('c'), t.c('paid'));
 assert r->>'status' = 'in_review' and r->'flags' ? 'first_publication', 'a Brand''s first publication goes to human review';
 perform t.me('a'); assert not (t.c('paid') = any(t.ids_in(t.feed('a')))), 'not visible while in review';
 perform t.mfa('r'); assert jsonb_array_length(public.aura_market_review_queue()->'campaigns') = 1, 'in the review queue';
 perform public.aura_market_moderate(t.c('paid'), 'approved', 'Terms are clear');
 perform t.me('a'); assert t.c('paid') = any(t.ids_in(t.feed('a'))), 'visible once approved';
 perform t.as_anon(); assert (select count(*) from public.m01_public_campaign_previews where title = 'Budget travel reels') = 1, 'public preview lists it';
 assert (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_name = 'm01_public_campaign_previews') = 'slug,title,summary', 'the preview exposes three columns'; reset role;
 -- fee language is held for review even after the first publication
 perform t.mfa('c'); insert into t.camp values ('fee', t.campaign('c', 'ugc', 'UGC with a joining fee', jsonb_build_object('brief', 'Please pay a registration fee of 500 before we send the product. ' || repeat('More details here. ', 3))));
 r := public.aura_market_publish(t.ws('c'), t.c('fee')); assert r->>'status' = 'in_review' and r->'flags' ? 'fee_language', 'fee language is flagged for review, never published directly';
 reset role; perform t.pass('interim verification by an MFA reviewer with a reason; no self-review; first publication and fee language go to human review; approval publishes'); end $$;

-- 4. Disclosure rules (F17 to F20, AC02)
do $$ declare id uuid; begin perform t.mfa('c');
 id := (public.aura_market_create_campaign(t.ws('c'), gen_random_uuid(), 'paid', 'Validation probe')->>'id')::uuid;
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('Validation probe', '{"compensation":{"products":{"description":"A free hoodie"}}}'));
 assert (public.aura_market_brand_campaign(t.ws('c'), id)->'errors') ? 'paid_needs_money', 'a paid campaign states money as an amount or a range';
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('Validation probe', '{"rights":{}}'));
 assert (public.aura_market_brand_campaign(t.ws('c'), id)->'errors') ? 'rights', 'rights are disclosed or marked negotiable';
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('Validation probe', '{"rights":{"negotiable":true}}'));
 assert not ((public.aura_market_brand_campaign(t.ws('c'), id)->'errors') ? 'rights'), 'negotiable rights are accepted, labelled';
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('Validation probe', '{"compensation":{"money":{"type":"range","currency":"INR","min":9000,"max":10}}}'));
 assert (public.aura_market_brand_campaign(t.ws('c'), id)->'errors') ? 'money', 'a range must be ordered';
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('Validation probe', '{"rights":{"usage_months":6,"channels":[],"exclusivity_days":900}}'));
 assert (public.aura_market_brand_campaign(t.ws('c'), id)->'errors') ? 'exclusivity', 'exclusivity is capped';
 assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), id), '22023'), 'an incomplete campaign cannot be published';
 id := (public.aura_market_create_campaign(t.ws('c'), gen_random_uuid(), 'ugc', 'UGC probe')->>'id')::uuid;
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('UGC probe', '{"requirements":{"min_followers":1000}}'));
 assert (public.aura_market_brand_campaign(t.ws('c'), id)->'errors') ? 'ugc_no_follower_minimum', 'UGC campaigns cannot set a follower minimum';
 id := (public.aura_market_create_campaign(t.ws('c'), gen_random_uuid(), 'affiliate', 'Affiliate probe')->>'id')::uuid;
 perform public.aura_market_save_campaign(t.ws('c'), id, 'public', false, t.content('Affiliate probe', '{"compensation":{}}'));
 assert (public.aura_market_brand_campaign(t.ws('c'), id)->'errors') ? 'affiliate_needs_commission', 'affiliate campaigns state the commission';
 assert t.denied(format('select public.aura_market_save_campaign(%L, %L, ''public'', false, ''{"application_fee":500}'')', t.ws('c'), id), '22023'), 'there is no field for application fees';
 reset role; perform t.pass('disclosure: money amount or range for paid work, commission for affiliate, rights disclosed or negotiable, exclusivity capped, no fee field, UGC never gated by followers'); end $$;

-- 5. Eligibility and visibility (AC01, AC02)
do $$ declare e jsonb; d jsonb; begin
 perform t.me('a'); perform t.set_followers('a', 'asha.big', 1500); perform t.set_followers('a', 'asha.nocount', null, 'youtube');
 perform t.me('b'); perform t.set_followers('b', 'bo.one', 600); perform t.set_followers('b', 'bo.two', 600, 'threads');
 perform t.mfa('c');
 insert into t.camp values ('restricted', t.campaign('c', 'paid', 'Restricted for 1000 plus', '{"requirements":{"min_followers":1000}}', 'restricted'));
 insert into t.camp values ('invite', t.campaign('c', 'barter', 'Invite only hamper', '{"compensation":{"products":{"description":"A travel hamper"}}}', 'invite_only'));
 insert into t.camp values ('ugc', t.campaign('c', 'ugc', 'UGC unboxing videos', '{"compensation":{"money":{"type":"fixed","currency":"INR","min":3000}}}'));
 insert into t.camp values ('open1000', t.campaign('c', 'paid', 'Public paid for 1000 plus', '{"requirements":{"min_followers":1000}}'));
 perform public.aura_market_publish(t.ws('c'), t.c('restricted')); perform public.aura_market_publish(t.ws('c'), t.c('invite')); perform public.aura_market_publish(t.ws('c'), t.c('ugc')); perform public.aura_market_publish(t.ws('c'), t.c('open1000'));
 perform t.me('a'); assert t.c('restricted') = any(t.ids_in(t.feed('a'))), 'a restricted campaign is visible to a Creator who meets every requirement';
 perform t.me('b'); assert not (t.c('restricted') = any(t.ids_in(t.feed('b')))), 'and hidden from one who does not';
 assert t.denied(format('select public.aura_market_campaign(%L, %L)', t.ws('b'), t.c('restricted'))), 'its direct URL cannot bypass the restriction';
 assert not (t.c('invite') = any(t.ids_in(t.feed('b')))) and t.denied(format('select public.aura_market_campaign(%L, %L)', t.ws('b'), t.c('invite'))), 'invitation-only is hidden without an invitation';
 perform t.mfa('c'); perform public.aura_market_invite(t.ws('c'), t.c('invite'), t.ws('b'), true);
 perform t.me('b'); assert t.c('invite') = any(t.ids_in(t.feed('b'))), 'visible once invited';
 d := public.aura_market_campaign(t.ws('b'), t.c('open1000')); e := d->'eligibility';
 assert (e->>'eligible')::boolean = false and e->'hard'->0->>'status' = 'not_met' and e->'hard'->0->>'detail' ~ 'never added together', 'two accounts of 600 never add up to 1000';
 assert (public.aura_market_check_apply(t.ws('b'), t.c('open1000'))->>'eligible')::boolean = false, 'an ineligible Creator cannot apply (re-checked at apply)';
 perform t.me('a'); assert (public.aura_market_check_apply(t.ws('a'), t.c('open1000'))->>'eligible')::boolean = true, 'an eligible Creator passes the apply check';
 reset role; perform t.mkcreator('z'); perform t.activate('z'); perform t.me('z');
 e := public.aura_market_campaign(t.ws('z'), t.c('ugc'))->'eligibility';
 assert (e->>'eligible')::boolean and e->'notes' ? 'UGC is assessed without a follower minimum.', 'a Creator with no account at all qualifies for UGC (AC02)';
 e := public.aura_market_campaign(t.ws('z'), t.c('open1000'))->'eligibility';
 assert e->'hard'->0->>'status' = 'unknown' and e->'hard'->0->>'detail' = 'No matching account is added.', 'missing data is unknown with a reason, never assumed';
 assert (public.aura_market_feed(t.ws('z'))->>'below_threshold')::boolean and exists(select 1 from jsonb_array_elements(public.aura_market_feed(t.ws('z'))->'items') x where x->>'id' = t.c('ugc')::text and x->'factors' ? 'Suited to creators still building an audience'), 'below 100, UGC is prioritised and the reason is shown';
 reset role; perform t.pass('eligibility: restricted needs every requirement, invite-only needs an invitation, direct URLs cannot bypass, accounts never summed, unknown is explained, UGC qualifies without followers, apply re-checks'); end $$;

-- 6. Feed filters, explanations and hiding
do $$ declare f jsonb; begin perform t.me('a');
 f := t.feed('a');
 assert not exists(select 1 from jsonb_array_elements(f->'items') x where not (x ? 'factors')) and not exists(select 1 from jsonb_array_elements(f->'items') x where x ? 'score' or x ? 'rating'), 'every card explains its factors; there is no score';
 assert jsonb_array_length(t.feed('a', '{"category":"ugc"}')->'items') = 1, 'category filter';
 assert not (t.c('ugc') = any(t.ids_in(t.feed('a', '{"min_money":8000}')))) and t.c('open1000') = any(t.ids_in(t.feed('a', '{"min_money":8000}'))), 'compensation filter';
 assert t.c('paid') = any(t.ids_in(t.feed('a', '{"q":"budget travel"}'))), 'text search';
 perform t.me('b'); assert not (t.c('open1000') = any(t.ids_in(t.feed('b', '{"eligible_only":true}')))) and t.c('open1000') = any(t.ids_in(t.feed('b'))), 'ineligible campaigns can be browsed, or filtered out';
 perform t.me('a'); perform public.aura_market_hide(t.ws('a'), 'category', 'ugc', true);
 assert not (t.c('ugc') = any(t.ids_in(t.feed('a')))) and (t.feed('a')->>'hidden_count')::int >= 1, 'a hidden category disappears and is counted';
 perform public.aura_market_hide(t.ws('a'), 'category', 'ugc', false); assert t.c('ugc') = any(t.ids_in(t.feed('a'))), 'hiding is reversible';
 perform public.aura_market_hide(t.ws('a'), 'brand', t.ws('c')::text, true); assert jsonb_array_length(t.feed('a')->'items') = 0, 'hiding a Brand hides its campaigns';
 perform public.aura_market_hide(t.ws('a'), 'brand', t.ws('c')::text, false);
 assert t.denied(format('select public.aura_market_hide(%L, ''category'', ''crypto'', true)', t.ws('a')), '22023'), 'unknown category';
 assert t.denied(format('select public.aura_market_feed(%L, %L)', t.ws('a'), jsonb_build_object('q', repeat('x', 100))), '22023'), 'search length bounded';
 reset role; perform t.pass('feed: factors explained and no score, commercial and text filters, ineligible browsable, reversible hiding of categories and Brands'); end $$;

-- 7. Versions, material changes and notifications (F22, AC04)
do $$ declare d jsonb; live jsonb; begin perform t.me('a'); perform public.aura_market_bookmark(t.ws('a'), t.c('paid'), true);
 perform t.mfa('c'); perform public.aura_market_save_campaign(t.ws('c'), t.c('paid'), 'public', false, t.content('Budget travel reels', '{"compensation":{"money":{"type":"range","currency":"INR","min":4000,"max":6000}}}'));
 perform t.me('a'); assert (public.aura_market_campaign(t.ws('a'), t.c('paid'))->'compensation'->'money'->>'min')::int = 5000, 'a saved edit does not change the live campaign';
 perform t.mfa('c'); d := public.aura_market_brand_campaign(t.ws('c'), t.c('paid')); assert d->'pending_changes' ? 'compensation', 'the Brand sees which material fields will change';
 perform public.aura_market_publish(t.ws('c'), t.c('paid'));
 perform t.me('a'); d := public.aura_market_campaign(t.ws('a'), t.c('paid'));
 assert (d->'compensation'->'money'->>'min')::int = 4000 and (d->>'version')::int = 2 and d->'updates'->0->'changes' ? 'compensation' and (d->'updates'->0->>'material')::boolean, 'the new version is live with its change history';
 assert exists(select 1 from jsonb_array_elements(public.aura_market_lists(t.ws('a'))->'notifications') n where n->>'kind' = 'material_change' and n->>'detail' ~ 'compensation'), 'the Creator who saved it is notified of the material change';
 perform t.mfa('c'); perform public.aura_market_save_campaign(t.ws('c'), t.c('paid'), 'public', false, t.content('Budget travel reels', '{"summary":"A clearer, honest summary of what we need from creators.","compensation":{"money":{"type":"range","currency":"INR","min":4000,"max":6000}}}'));
 perform public.aura_market_publish(t.ws('c'), t.c('paid'));
 perform t.me('a'); assert (select count(*) from jsonb_array_elements(public.aura_market_lists(t.ws('a'))->'notifications') n where n->>'kind' = 'material_change') = 1, 'a wording-only change is versioned but not notified as material';
 reset role; assert (select count(*) from aura_market.campaign_version where campaign_id = t.c('paid')) = 3 and (select content->'compensation'->'money'->>'min' from aura_market.campaign_version where campaign_id = t.c('paid') and version = 1) = '5000', 'every published version is kept unchanged';
 perform t.pass('versions: edits stay private until republished, material changes are listed and notified to savers, wording changes are not, old versions are kept'); end $$;

-- 8. Saved searches, alerts and deadlines
do $$ declare l jsonb; begin perform t.me('b');
 perform public.aura_market_save_search(t.ws('b'), 'Paid travel', '{"category":"paid","q":"travel","money_only":true}', true);
 assert t.denied(format('select public.aura_market_save_search(%L, ''Bad'', ''{"sql":"drop"}'', true)', t.ws('b')), '22023'), 'only known filter keys';
 perform t.mfa('c'); insert into t.camp values ('alert', t.campaign('c', 'paid', 'Travel vlog series', jsonb_build_object('closes_at', (now() + interval '2 days')::text))); perform public.aura_market_publish(t.ws('c'), t.c('alert'));
 perform t.me('b'); l := public.aura_market_lists(t.ws('b'));
 assert exists(select 1 from jsonb_array_elements(l->'notifications') n where n->>'kind' = 'new_match' and n->>'title' ~ 'Travel vlog series'), 'a matching new campaign triggers an alert';
 perform public.aura_market_bookmark(t.ws('b'), t.c('alert'), true);
 assert exists(select 1 from jsonb_array_elements(public.aura_market_lists(t.ws('b'))->'deadlines') x where x->>'id' = t.c('alert')::text), 'a saved campaign closing soon appears in deadlines';
 perform public.aura_market_read_notifications(t.ws('b'));
 assert not exists(select 1 from jsonb_array_elements(public.aura_market_lists(t.ws('b'))->'notifications') n where not (n->>'read')::boolean), 'notifications can be marked read';
 reset role; perform t.pass('saved searches validate filters and alert on matching new campaigns; deadlines for saved campaigns; notifications marked read'); end $$;

-- 9. Reports, moderation and revocation
do $$ declare r jsonb; begin
 perform t.me('b'); assert t.denied(format('select public.aura_market_report(%L, %L, ''misleading_terms'', null)', t.ws('b'), t.c('restricted'))), 'you can only report a campaign you can see';
 r := public.aura_market_report(t.ws('b'), t.c('ugc'), 'misleading_terms', 'The fee is not mentioned');
 assert t.denied(format('select public.aura_market_report(%L, %L, ''spam'', null)', t.ws('b'), t.c('ugc')), '23505'), 'one open report per Creator per campaign';
 perform t.mfa('r'); assert jsonb_array_length(public.aura_market_review_queue()->'reports') = 1, 'the report is in the queue';
 perform public.aura_market_moderate(t.c('ugc'), 'removed', 'Misleading terms confirmed'); perform public.aura_market_decide_report((r->>'id')::uuid, 'actioned', 'Removed the campaign');
 perform t.me('a'); assert not (t.c('ugc') = any(t.ids_in(t.feed('a')))), 'a removed campaign disappears';
 perform t.mfa('c'); assert t.denied(format('select public.aura_market_publish(%L, %L)', t.ws('c'), t.c('ugc')), '55000'), 'the Brand cannot republish a removed campaign';
 perform t.mfa('r'); perform public.aura_market_verify_brand(t.ws('c'), 'revoked', 'Documents expired');
 perform t.me('a'); assert jsonb_array_length(t.feed('a')->'items') = 0, 'revoking verification takes every campaign out of the marketplace at once';
 perform t.as_anon(); assert (select count(*) from public.m01_public_campaign_previews) = 0, 'and out of the public preview'; reset role;
 perform t.mfa('r'); perform public.aura_market_verify_brand(t.ws('c'), 'verified', 'Documents renewed');
 perform t.me('a'); assert jsonb_array_length(t.feed('a')->'items') > 0, 'restored when verified again';
 perform t.mfa('c'); perform public.aura_market_set_status(t.ws('c'), t.c('paid'), 'pause');
 perform t.me('a'); assert not (t.c('paid') = any(t.ids_in(t.feed('a')))), 'a paused campaign is hidden';
 perform t.mfa('c'); perform public.aura_market_set_status(t.ws('c'), t.c('paid'), 'close');
 perform t.me('a'); assert exists(select 1 from jsonb_array_elements(public.aura_market_lists(t.ws('a'))->'notifications') n where n->>'kind' = 'campaign_closed'), 'closing notifies those who saved it';
 assert exists(select 1 from jsonb_array_elements(public.aura_market_lists(t.ws('a'))->'saved') x where (x->>'unavailable')::boolean), 'a saved campaign that closed is shown as unavailable';
 reset role; perform t.pass('reports need visibility, one open report each, reviewer removal and decisions, revocation hides everything at once, pause and close'); end $$;

-- 10. Tenant isolation and audit
do $$ declare n int := 0; f text; begin
 perform t.mfa('r3'); foreach f in array array['select public.aura_market_brand_campaign(%L, %L)','select public.aura_market_save_campaign(%L, %L, ''public'', false, ''{}'')','select public.aura_market_publish(%L, %L)','select public.aura_market_set_status(%L, %L, ''pause'')'] loop
  assert t.denied(format(f, t.ws('c2'), t.c('open1000'))), 'another Brand denied: ' || f; n := n + 1; end loop;
 assert t.denied(format('select public.aura_market_brand_state(%L)', t.ws('c'))), 'another Brand cannot list this Brand''s campaigns'; n := n + 1;
 perform t.me('a'); assert t.denied(format('select public.aura_market_brand_state(%L)', t.ws('a'))), 'a Creator workspace has no Brand state'; n := n + 1;
 perform t.mfa('c'); assert t.denied(format('select public.aura_market_feed(%L)', t.ws('c'))), 'a Brand workspace has no Creator feed'; n := n + 1;
 perform t.me('b'); assert t.denied(format('select public.aura_market_bookmark(%L, %L, true)', t.ws('a'), t.c('open1000'))), 'another Creator cannot bookmark for you'; n := n + 1;
 assert t.denied(format('select public.aura_market_lists(%L)', t.ws('a'))), 'or read your lists'; n := n + 1;
 reset role;
 assert not exists(select 1 from information_schema.columns where table_schema = 'aura_market' and column_name ~* '(score|rating|rank|fee)'), 'no score, rating or fee column exists';
 assert (select count(distinct event) from aura_identity.event where event like 'market\_%') >= 10, 'material marketplace events are audited';
 perform t.pass('tenant isolation: ' || n || ' checks across Brands and Creators; no score or fee columns; audit trail'); end $$;
\echo ---RESULTS---
select name from t.results order by name;
