-- Executed by tests/unit/db-m05.test.ts on a disposable PostgreSQL with the real M02, M03, M04 and M05 migrations, the auth stub and the storage stub
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

-- 1. Anonymous and direct access
do $$ begin perform t.as_anon();
 assert t.denied('select public.aura_social_accounts(gen_random_uuid())'), 'anon accounts';
 assert t.denied('select public.aura_social_shared_view(gen_random_uuid())'), 'anon shared view';
 assert t.denied('select public.aura_social_review_queue()'), 'anon review';
 assert t.denied('select * from aura_social.account_observation'), 'anon table';
 reset role; perform t.me('a');
 assert t.denied('select * from aura_social.ownership_claim'), 'direct claims';
 assert t.denied('select * from aura_social.verification_evidence'), 'direct evidence';
 assert t.denied('update aura_creator.social_account set verification=''verified'''), 'direct verification update';
 assert t.denied('insert into aura_social.reviewer(user_id) values (gen_random_uuid())'), 'self-grant reviewer';
 assert t.denied('select aura_social.actor(gen_random_uuid())'), 'private helper';
 assert t.denied('select aura_social.job_complete(gen_random_uuid(), true)'), 'worker function not exposed';
 reset role; perform t.pass('anonymous and direct table, evidence, reviewer-table and worker-function access denied'); end $$;

-- 2. Account CRUD, normalization, validation
do $$ declare a1 uuid; a2 uuid; a3 uuid; rid uuid := gen_random_uuid(); j jsonb; j2 jsonb; q text; begin perform t.me('a');
 j := public.aura_social_add_account(t.ws('a'), rid, '{"platform":"instagram","handle":"@asha.main","account_type":"personal","visibility":"private","display_name":"Asha","followers":60}');
 a1 := (j->>'id')::uuid;
 assert j->>'handle' = 'asha.main' and j->>'lifecycle' = 'active' and j->>'verification' = 'unverified' and j->>'connection' = 'manual' and j->>'account_type' = 'personal' and j->>'visibility' = 'private', 'created and normalized';
 assert (j->>'is_primary')::boolean, 'the first account is primary by documented rule';
 assert (j->'latest'->'followers'->>'value')::numeric = 60 and j->'latest'->'followers'->>'source' = 'manual', 'initial observation is manual and labelled';
 j2 := public.aura_social_add_account(t.ws('a'), rid, '{"platform":"instagram","handle":"different"}');
 assert j2->>'id' = j->>'id', 'a retried submission returns the same account'; assert (select count(*) from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts')) = 1, 'one row after a retry';
 a2 := t.acct('a','instagram','asha.work',jsonb_build_object('account_type','creator')); a3 := t.acct('a','youtube','ashachannel');
 assert not (t.acc(a2)->>'is_primary')::boolean and (t.acc(a1)->>'is_primary')::boolean, 'later accounts are not primary';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), '{"platform":"instagram","handle":"ASHA.MAIN"}'), '23505'), 'duplicate identity, case-insensitive';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), '{"platform":"instagram","handle":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'), '23514'), 'handle too long for Instagram';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), '{"platform":"youtube","handle":"bo"}'), '23514'), 'handle too short for YouTube';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), '{"platform":"instagram","handle":"a b"}'), '23514'), 'spaces';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), '{"platform":"myspace","handle":"abcde"}'), '22023'), 'unsupported platform';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), '{"platform":"youtube","handle":"valid_one","account_type":"personal"}'), '23514'), 'account type is Instagram only';
 for q in select unnest(array['http://www.instagram.com/x','https://www.instagram.com:8080/x','https://127.0.0.1/x','https://localhost/x','https://evil.example/x','https://user:pw@www.instagram.com/x','javascript:alert(1)','https://instagram/x']) loop
  assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), jsonb_build_object('platform','instagram','handle','urlcheck','profile_url',q)::text), '23514'), 'unsafe url ' || q;
 end loop;
 j := public.aura_social_update_account(t.ws('a'), a2, '{"display_name":"Work","content_category":"food","profile_url":"https://www.instagram.com/asha.work"}');
 assert j->>'display_name' = 'Work' and j->>'content_category' = 'food', 'edit';
 assert t.denied(format('select public.aura_social_update_account(%L,%L,%L)', t.ws('a'), a2, '{"profile_url":"https://evil.example/x"}'), '23514'), 'edit rejects unsafe url';
 reset role; perform t.pass('accounts: create, normalize, retry-safe, edit, duplicates, per-platform handle and URL validation (personal and private Instagram, multiple per platform)'); end $$;

-- 3. Limit
do $$ declare ids uuid[] := '{}'; i int; x uuid; before int; begin perform t.me('b');
 for i in 1..10 loop ids := ids || t.acct('b','other','acct'||i); end loop;
 assert (public.aura_social_accounts(t.ws('b'))->>'used')::int = 10 and (public.aura_social_accounts(t.ws('b'))->>'limit')::int = 10, 'ten used';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('b'), '{"platform":"other","handle":"acct11"}'), '23514'), 'the 11th is refused';
 perform public.aura_social_archive_account(t.ws('b'), ids[10], true);
 assert (public.aura_social_accounts(t.ws('b'))->>'used')::int = 9, 'archived accounts do not count'; x := t.acct('b','other','acct11');
 assert t.denied(format('select public.aura_social_archive_account(%L,%L,false)', t.ws('b'), ids[10]), '23514'), 'restore into a full workspace is refused';
 perform public.aura_social_remove_account(t.ws('b'), x); assert (public.aura_social_accounts(t.ws('b'))->>'used')::int = 9, 'removed accounts do not count';
 perform public.aura_social_archive_account(t.ws('b'), ids[10], false); assert (public.aura_social_accounts(t.ws('b'))->>'used')::int = 10, 'restore uses a slot';
 reset role; perform t.pass('limit of 10 enforced at the database; archived and removed accounts free their slot; restore respects the limit'); end $$;

-- 4. Primary and preferred uniqueness, removal fallback
do $$ declare ids uuid[]; p int; begin perform t.me('a');
 select array_agg((x->>'id')::uuid order by x->>'handle') into ids from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x; -- asha.main, asha.work, ashachannel
 perform public.aura_social_set_primary(t.ws('a'), ids[2]);
 select count(*) into p from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where (x->>'is_primary')::boolean; assert p = 1 and (t.acc(ids[2])->>'is_primary')::boolean, 'exactly one primary after a switch';
 reset role; assert t.denied(format('update aura_creator.social_account set is_primary=true where workspace_id=%L and lifecycle=''active''', t.ws('a')), '23505'), 'the database itself refuses two primary accounts'; perform t.me('a');
 perform public.aura_social_set_preferred(t.ws('a'), ids[1], true); perform public.aura_social_set_preferred(t.ws('a'), ids[2], true);
 assert not (t.acc(ids[1])->>'preferred_for_platform')::boolean and (t.acc(ids[2])->>'preferred_for_platform')::boolean, 'one preferred per platform';
 perform public.aura_social_set_preferred(t.ws('a'), ids[3], true); assert (t.acc(ids[3])->>'preferred_for_platform')::boolean and (t.acc(ids[2])->>'preferred_for_platform')::boolean, 'preferred is per platform';
 reset role; assert t.denied(format('update aura_creator.social_account set preferred_for_platform=true where id in (%L,%L)', ids[1], ids[2]), '23505'), 'database refuses two preferred on a platform'; perform t.me('a');
 assert (public.aura_social_remove_account(t.ws('a'), ids[2], ids[3])->>'new_primary')::uuid = ids[3], 'removal promotes the chosen replacement';
 perform public.aura_social_set_primary(t.ws('a'), ids[1]); assert (public.aura_social_remove_account(t.ws('a'), ids[1])->>'new_primary')::uuid = ids[3], 'without a choice the oldest remaining account becomes primary (documented fallback)';
 assert t.denied(format('select public.aura_social_set_primary(%L,%L)', t.ws('a'), ids[2]), '55000'), 'a removed account cannot be primary';
 reset role; perform t.pass('primary and preferred uniqueness, deterministic and chosen primary fallback on removal'); end $$;

-- 5. M03 compatibility: onboarding edits never destroy history
do $$ declare a uuid; rev int; n int; begin perform t.me('a'); a := t.acct('a','threads','asha.threads');
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), a, 'followers', 120, t.cur()-2);
 perform public.aura_creator_begin(t.ws('a')); rev := (public.aura_creator_state(t.ws('a'))->'onboarding'->>'revision')::int;
 perform public.aura_creator_save_section(t.ws('a'),'social','{"accounts":[{"platform":"youtube","handle":"ashachannel","self_reported_followers":80,"observed_on":"2026-11-01"}]}',rev);
 assert (select count(*) from jsonb_array_elements(public.aura_creator_state(t.ws('a'))->'social_accounts') x) = 1, 'M03 state lists only tracked accounts';
 reset role; assert (select lifecycle from aura_creator.social_account where id = a) = 'removed', 'omitted from the onboarding step means soft removal, not deletion';
 select count(*) into n from aura_social.account_observation where account_id = a; assert n = 1, 'the observation history of a removed account is retained'; perform t.me('a');
 rev := (public.aura_creator_state(t.ws('a'))->'onboarding'->>'revision')::int;
 perform public.aura_creator_save_section(t.ws('a'),'social','{"accounts":[{"platform":"threads","handle":"asha.threads","self_reported_followers":130,"observed_on":"2026-11-02"}]}',rev);
 assert (t.acc(a)->>'lifecycle') = 'active', 're-adding in onboarding revives the same record'; assert (select count(*) from jsonb_array_elements(public.aura_social_observations(t.ws('a'), a)->'items')) = 2, 'history is kept and extended';
 rev := (public.aura_creator_state(t.ws('a'))->'onboarding'->>'revision')::int;
 perform public.aura_creator_save_section(t.ws('a'),'social','{"none":true}',rev);
 assert jsonb_array_length(public.aura_creator_state(t.ws('a'))->'social_accounts') = 0, 'the no-account path soft-removes everything';
 reset role; perform t.pass('M03 onboarding social step is non-destructive: removal is soft, history survives, re-adding revives the record'); end $$;

-- 6. Account observations
do $$ declare a uuid; o jsonb; o2 jsonb; rid uuid := gen_random_uuid(); first uuid; begin perform t.me('a'); a := t.acct('a','instagram','metrics.one');
 assert t.acc(a)->'latest' = '{}'::jsonb, 'no observation means unknown, not zero';
 o := public.aura_social_record_observation(t.ws('a'), rid, a, 'followers', 0, t.cur()-3, null, null, 'manual', null, 'start');
 assert (o->>'value')::numeric = 0 and o->>'source' = 'manual', 'a recorded zero is a value'; assert (t.acc(a)->'latest'->'followers'->>'value')::numeric = 0, 'zero is shown as zero';
 o2 := public.aura_social_record_observation(t.ws('a'), rid, a, 'followers', 999, t.cur(), null, null); assert o2->>'id' = o->>'id', 'retry returns the original';
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), a, 'followers', 150, t.cur()-1);
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), a, 'following', 20, t.cur()-1);
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), a, 'reach', 5000, t.cur()-1, t.cur()-8, t.cur()-1);
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), a, 'audience_growth', -12, t.cur()-1, t.cur()-8, t.cur()-1);
 assert (t.acc(a)->'latest'->'reach'->>'period_start')::date = t.cur()-8, 'window metrics keep their measurement period';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''reach'',5,%L)', t.ws('a'), a, t.cur()-1), '23514'), 'a window metric needs a period';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''followers'',5,%L,%L,%L)', t.ws('a'), a, t.cur()-1, t.cur()-8, t.cur()-1), '23514'), 'a point metric forbids a period';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''followers'',-5,%L)', t.ws('a'), a, t.cur()-1), '23514'), 'negative followers';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''followers'',5,%L)', t.ws('a'), a, t.cur()+5), '23514'), 'future date';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''nonsense'',5,%L)', t.ws('a'), a, t.cur()-1), '22023'), 'unknown metric';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''saves'',5,%L)', t.ws('a'), a, t.cur()-1), '22023'), 'content metric on an account';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''followers'',5,%L,null,null,''provider'')', t.ws('a'), a, t.cur()-1), '22023'), 'a client can never write provider-sourced data';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''followers'',5,%L,null,null,''ai_confirmed'')', t.ws('a'), a, t.cur()-1), '22023'), 'ai_confirmed only through the confirmation function';
 assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''followers'',5,%L,null,null,''screenshot_supported'',gen_random_uuid())', t.ws('a'), a, t.cur()-1), '22023'), 'screenshot source needs real clean evidence';
 reset role; assert (select self_reported_followers from aura_creator.social_account where id = a) = 150, 'the M03/M04 eligibility input follows the latest observation'; perform t.me('a');
 first := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_observations(t.ws('a'), a, 'followers')->'items') x where (x->>'value')::numeric = 150);
 o := public.aura_social_correct_observation(t.ws('a'), gen_random_uuid(), first, 160, 'Typo in the first entry');
 assert (o->>'supersedes')::uuid = first and (o->>'value')::numeric = 160 and o->>'source' = 'manual', 'a correction is a new row';
 assert (select count(*) from jsonb_array_elements(public.aura_social_observations(t.ws('a'), a, 'followers')->'items') x) = 3, 'the original stays in history';
 assert exists(select 1 from jsonb_array_elements(public.aura_social_observations(t.ws('a'), a, 'followers')->'items') x where x->>'id' = first::text and x->>'superseded_by' is not null), 'the original is labelled as corrected';
 assert (t.acc(a)->'latest'->'followers'->>'value')::numeric = 160, 'latest reflects the correction';
 assert t.denied(format('select public.aura_social_correct_observation(%L,gen_random_uuid(),%L,170,''again'')', t.ws('a'), first), '55000'), 'an observation is corrected once; correct the correction instead';
 assert t.denied(format('select public.aura_social_correct_observation(%L,gen_random_uuid(),%L,1,''x'')', t.ws('a'), first), '22023'), 'a reason is required';
 reset role; assert t.denied(format('update aura_social.account_observation set value = 1 where id = %L', first), '55000'), 'append-only: no edits';
 assert t.denied(format('delete from aura_social.account_observation where id = %L', first), '55000'), 'append-only: no deletes';
 perform t.pass('observations: zero vs unknown, source labels, windows, ranges, retry-safe, corrections keep the original, append-only, cache follows the latest'); end $$;
do $$ declare a uuid; p jsonb; c jsonb; n int := 0; seen uuid[] := '{}'; i int; begin perform t.me('a'); a := t.acct('a','instagram','paged.account');
 for i in 1..7 loop perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), a, 'followers', 100 + i, t.cur() - i); end loop;
 p := public.aura_social_observations(t.ws('a'), a, 'followers', 3); c := p->'next_cursor'; n := jsonb_array_length(p->'items'); assert n = 3 and c is not null, 'first page';
 select array_agg((x->>'id')::uuid) into seen from jsonb_array_elements(p->'items') x;
 p := public.aura_social_observations(t.ws('a'), a, 'followers', 3, c); assert jsonb_array_length(p->'items') = 3, 'second page'; select seen || array_agg((x->>'id')::uuid) into seen from jsonb_array_elements(p->'items') x;
 p := public.aura_social_observations(t.ws('a'), a, 'followers', 3, p->'next_cursor'); assert jsonb_array_length(p->'items') = 1 and p->'next_cursor' = 'null'::jsonb, 'last page'; select seen || array_agg((x->>'id')::uuid) into seen from jsonb_array_elements(p->'items') x;
 assert cardinality(seen) = 7 and (select count(distinct s) from unnest(seen) s) = 7, 'keyset pagination returns every row once';
 reset role; perform t.pass('history pagination is stable and complete'); end $$;

-- 7. Content-level observations
do $$ declare a uuid; r1 jsonb; r2 jsonb; l jsonb; begin perform t.me('a'); a := t.acct('a','youtube','content.chan');
 r1 := public.aura_social_record_content_observation(t.ws('a'), gen_random_uuid(), a, '{"url":"https://www.youtube.com/watch?v=abc123","title":"First video","format":"long_video","published_on":"2026-10-01"}', 'views', 1000, 'lifetime', t.cur()-7);
 r2 := public.aura_social_record_content_observation(t.ws('a'), gen_random_uuid(), a, '{"url":"https://www.youtube.com/watch?v=abc123"}', 'views', 1800, 'lifetime', t.cur()-1);
 assert r1->'content'->>'id' = r2->'content'->>'id', 'the same link is the same content item';
 perform public.aura_social_record_content_observation(t.ws('a'), gen_random_uuid(), a, '{"url":"https://www.youtube.com/watch?v=abc123"}', 'views', 300, 'window', t.cur()-1, t.cur()-3, t.cur()-1);
 l := public.aura_social_content(t.ws('a'), a);
 assert jsonb_array_length(l) = 1 and (l->0->'latest_lifetime'->'views'->>'value')::numeric = 1800, 'repeated cumulative observations are never summed: the latest lifetime value wins';
 assert jsonb_array_length(l->0->'window_observations') = 1 and (l->0->'window_observations'->0->>'value')::numeric = 300, 'window totals stay separate from lifetime totals';
 assert (l->0->>'observation_count')::int = 3, 'every snapshot is kept';
 assert t.denied(format('select public.aura_social_record_content_observation(%L,gen_random_uuid(),%L,%L,''views'',5,''lifetime'',%L,%L,%L)', t.ws('a'), a, '{"external_id":"x1"}', t.cur()-1, t.cur()-3, t.cur()-1), '23514'), 'lifetime forbids a period';
 assert t.denied(format('select public.aura_social_record_content_observation(%L,gen_random_uuid(),%L,%L,''views'',5,''window'',%L)', t.ws('a'), a, '{"external_id":"x1"}', t.cur()-1), '23514'), 'window needs a period';
 assert t.denied(format('select public.aura_social_record_content_observation(%L,gen_random_uuid(),%L,%L,''followers'',5,''lifetime'',%L)', t.ws('a'), a, '{"external_id":"x1"}', t.cur()-1), '22023'), 'an account metric is not a content metric';
 assert t.denied(format('select public.aura_social_record_content_observation(%L,gen_random_uuid(),%L,%L,''views'',5,''lifetime'',%L)', t.ws('a'), a, '{"url":"https://evil.example/v"}', t.cur()-1), '23514'), 'unsafe content link';
 assert t.denied(format('select public.aura_social_record_content_observation(%L,gen_random_uuid(),%L,%L,''views'',5,''lifetime'',%L)', t.ws('a'), a, '{"title":"no id"}', t.cur()-1), '22023'), 'an identifier or link is required';
 assert t.denied(format('select public.aura_social_record_content_observation(%L,gen_random_uuid(),%L,%L,''saves'',5,''lifetime'',%L)', t.ws('a'), a, '{"external_id":"x2"}', t.cur()-1), '22023'), 'saves are not supported on YouTube';
 reset role; perform t.pass('content observations: stable references, lifetime vs window kept apart, never summed, validated, links untrusted and never fetched'); end $$;

-- 8. Ownership verification state machine
do $$ declare a uuid; v jsonb; v2 jsonb; rid uuid := gen_random_uuid(); cl uuid; begin perform t.me('a'); a := t.acct('a','instagram','verify.me');
 v := public.aura_social_start_verification(t.ws('a'), a, rid); cl := (v->>'claim_id')::uuid;
 assert v->>'state' = 'challenge_pending' and v->'challenge'->>'code' ~ '^aura-[0-9a-f]{12}$' and (v->'challenge'->>'expired')::boolean = false, 'challenge generated';
 assert (v->'challenge'->>'expires_at')::timestamptz between now() + interval '71 hours' and now() + interval '73 hours', 'validity window';
 assert t.acc(a)->>'verification' = 'challenge_pending', 'account status follows';
 v2 := public.aura_social_start_verification(t.ws('a'), a, rid); assert v2->>'claim_id' = v->>'claim_id', 'idempotent start';
 v2 := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); assert v2->>'claim_id' = v->>'claim_id', 'one open claim per account';

 reset role; assert (select count(*) from aura_social.verification_challenge) = 1, 'a single challenge exists'; perform t.me('a');
 assert t.denied(format('select public.aura_social_submit_evidence(%L,%L,%L)', t.ws('a'), cl, jsonb_build_object('storage_path', t.ws('b')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.png','mime','image/png','size',100)), '42501'), 'evidence cannot be pointed at another workspace path';
 assert t.denied(format('select public.aura_social_submit_evidence(%L,%L,%L)', t.ws('a'), cl, jsonb_build_object('storage_path', t.ws('a')::text || '/' || gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.png','mime','image/png','size',100)), '42501'), 'nor at another claim path';
 assert t.denied(format('select public.aura_social_submit_evidence(%L,%L,%L)', t.ws('a'), cl, jsonb_build_object('storage_path', t.ws('a')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.exe','mime','image/png','size',100)), '23514'), 'path must be a safe generated name with an image extension';
 assert t.denied(format('select public.aura_social_submit_evidence(%L,%L,%L)', t.ws('a'), cl, jsonb_build_object('storage_path', t.ws('a')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.svg','mime','image/svg+xml','size',100)), '23514'), 'active content types are refused';
 v := public.aura_social_submit_evidence(t.ws('a'), cl, jsonb_build_object('storage_path', t.ws('a')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.png','mime','image/png','size',1000));
 assert v->>'scan_status' = 'pending_scan', 'new evidence is pending a scan'; assert t.acc(a)->>'verification' = 'evidence_submitted', 'state follows the evidence';
 v := public.aura_social_request_review(t.ws('a'), cl); assert v->>'state' = 'under_review' and (v->'challenge'->>'consumed')::boolean, 'review requested; the challenge is consumed';
 assert t.denied(format('select public.aura_social_submit_evidence(%L,%L,%L)', t.ws('a'), cl, jsonb_build_object('storage_path', t.ws('a')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.png','mime','image/png','size',1000)), '55000'), 'no evidence after review is requested (replay)';
 assert (public.aura_social_request_review(t.ws('a'), cl)->>'state') = 'under_review', 'requesting twice is safe';
 reset role; perform t.pass('challenge: cryptographic code, validity, one open claim, retry-safe, evidence bound to the claim, replay refused after review request'); end $$;
do $$ declare a uuid; v jsonb; cl uuid; q jsonb; begin
 -- Fixture: expire a challenge and a separate account to test expiry and retry limits.
 perform t.me('a'); a := t.acct('a','threads','expiry.test'); v := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); cl := (v->>'claim_id')::uuid; reset role;
 update aura_social.verification_challenge set expires_at = now() - interval '1 minute' where claim_id = cl; perform t.me('a');
 assert t.denied(format('select public.aura_social_request_review(%L,%L)', t.ws('a'), cl), '55000'), 'an expired challenge cannot be sent for review';
 assert t.denied(format('select public.aura_social_submit_evidence(%L,%L,%L)', t.ws('a'), cl, jsonb_build_object('storage_path', t.ws('a')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.png','mime','image/png','size',10)), '55000'), 'nor accept evidence';
 v := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); assert (v->>'claim_id')::uuid <> cl and v->>'state' = 'challenge_pending', 'a fresh claim and code replace the expired one';
 reset role; assert (select state from aura_social.ownership_claim where id = cl) = 'revoked', 'the expired claim is closed'; perform t.me('a');
 assert t.denied(format('select public.aura_social_start_verification(%L,%L,gen_random_uuid())', t.ws('b'), a), '42501'), 'another workspace cannot start verification';
 reset role; perform t.pass('expired challenges are refused and replaced with a new code; cross-workspace start denied'); end $$;

-- 9. Restricted review, MFA, self-approval, duplicates and disputes, revocation
create table t.cl(k text primary key, claim uuid, account uuid); grant select, insert on t.cl to authenticated, anon;
create function t.claim(k text, pl text, h text) returns uuid language plpgsql as $$ declare a uuid; v jsonb; begin
 a := t.acct(k, pl, h); v := public.aura_social_start_verification(t.ws(k), a, gen_random_uuid());
 perform public.aura_social_request_review(t.ws(k), (v->>'claim_id')::uuid); insert into t.cl values (k || ':' || h, (v->>'claim_id')::uuid, a); return (v->>'claim_id')::uuid; end $$;
create function t.cid(key text) returns uuid language sql as $$ select claim from t.cl where k = cid.key $$;
do $$ declare c1 uuid; begin perform t.me('a'); c1 := t.claim('a','instagram','owner.one'); reset role;
 -- not a reviewer at all, creators, brand, agency
 foreach c1 in array array[t.cid('a:owner.one')] loop
  perform t.me('a'); assert t.denied(format('select public.aura_social_review_queue()'), '42501'), 'creator cannot read the queue';
  assert t.denied(format('select public.aura_social_decide(%L,''approved'',''looks fine'')', c1), '42501'), 'creator cannot approve their own claim';
  reset role; perform t.mfa('c'); assert t.denied(format('select public.aura_social_decide(%L,''approved'',''looks fine'')', c1), '42501'), 'a Brand cannot verify a Creator';
  reset role; perform t.mfa('d'); assert t.denied(format('select public.aura_social_review_claim(%L)', c1), '42501'), 'an Agency cannot read a claim';
  reset role; perform t.mfa('r2'); assert t.denied('select public.aura_social_review_queue()', '42501'), 'a platform admin who is not a granted reviewer is refused';
  reset role; perform t.mfa('r3'); assert t.denied('select public.aura_social_review_queue()', '42501'), 'a granted reviewer who is not a platform admin is refused';
  reset role; perform t.me('r'); assert t.denied('select public.aura_social_review_queue()', '42501'), 'the reviewer without MFA (aal1) is refused';
  assert t.denied(format('select public.aura_social_decide(%L,''approved'',''ok ok'')', c1), '42501'), 'and cannot decide';
  reset role;
 end loop;
 perform t.mfa('r'); assert exists(select 1 from jsonb_array_elements(public.aura_social_review_queue()) x where x->>'claim_id' = t.cid('a:owner.one')::text), 'the authorized reviewer with MFA sees the claim in the queue'; assert public.aura_social_review_claim(t.cid('a:owner.one'))->>'challenge_code' ~ '^aura-', 'and the claim';
 reset role; perform t.pass('review is restricted to a Platform Admin who is a granted reviewer with MFA; creators, Brands, Agencies and unqualified staff are refused'); end $$;
do $$ declare c uuid; i int; begin
 -- self-approval: reviewer r is also a member of workspace b, so b's claims are a conflict of interest
 perform t.me('b');
 for i in 1..4 loop perform public.aura_social_remove_account(t.ws('b'), (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('b'))->'accounts') x where x->>'lifecycle' = 'active' and not (x->>'is_primary')::boolean limit 1)); end loop; -- free slots left full by the limit test
 c := t.claim('b','instagram','conflict.claim'); reset role; perform t.mfa('r');
 assert t.denied(format('select public.aura_social_decide(%L,''approved'',''self approve'')', c), '42501'), 'a reviewer cannot decide a claim from their own workspace';
 assert t.denied(format('select public.aura_social_decide(%L,''bogus'',''reason'')', t.cid('a:owner.one')), '22023'), 'unknown decision';
 assert t.denied(format('select public.aura_social_decide(%L,''approved'','' '')', t.cid('a:owner.one')), '22023'), 'a reason is mandatory';
 reset role; perform t.pass('self-approval prevented; decisions need a valid outcome and a reason'); end $$;
do $$ declare v jsonb; d jsonb; begin perform t.mfa('r');
 d := public.aura_social_decide(t.cid('a:owner.one'), 'approved', 'Code found on the profile bio'); assert d->>'state' = 'verified', 'approved'; reset role;
 assert (select verification from aura_creator.social_account where id = (select account from t.cl where k = 'a:owner.one')) = 'verified', 'account is verified';
 assert (select decided_by from aura_social.ownership_claim where id = t.cid('a:owner.one')) = t.uid('r') and (select decided_at from aura_social.ownership_claim where id = t.cid('a:owner.one')) is not null, 'reviewer attribution and timestamp are recorded';
 assert (select count(*) from aura_social.review_decision where claim_id = t.cid('a:owner.one') and reviewer = t.uid('r')) = 1, 'decision record';
 assert exists(select 1 from aura_identity.event where event = 'social_review_approved' and user_id = t.uid('r')), 'audit event for the reviewer'; perform t.mfa('r');
 assert t.denied(format('select public.aura_social_decide(%L,''approved'',''again again'')', t.cid('a:owner.one')), '55000'), 'a decided claim cannot be decided twice';
 reset role; perform t.pass('approval: verified, attributed to the reviewer, timestamped, recorded and audited, not repeatable'); end $$;
do $$ declare a2 uuid; v jsonb; cl uuid; old_state text; begin
 -- A different Creator (workspace e) claims the SAME already-verified identity: instagram owner.one.
 perform t.me('e'); a2 := t.acct('e','instagram','owner.one'); v := public.aura_social_start_verification(t.ws('e'), a2, gen_random_uuid()); cl := (v->>'claim_id')::uuid; insert into t.cl values ('e:owner.one', cl, a2);
 assert v->>'state' = 'disputed' and (v->>'disputed')::boolean, 'the competing claim is routed to review as disputed'; assert t.acc(a2,'e')->>'verification' = 'disputed', 'the competing account is marked disputed, never verified';
 assert not (v::text ~* 'existing|owner|workspace|claimant'), 'nothing about the existing owner is revealed to the claimant';
 reset role; assert (select verification from aura_creator.social_account where id = (select account from t.cl where k = 'a:owner.one')) = 'verified', 'the existing verified owner is untouched (no takeover)';
 assert (select count(*) from aura_social.ownership_claim where identity_key = 'instagram:h:owner.one' and state = 'verified') = 1, 'exactly one verified owner'; perform t.me('e');
 perform public.aura_social_request_review(t.ws('e'), cl); reset role; perform t.mfa('r');
 assert exists(select 1 from jsonb_array_elements(public.aura_social_review_queue()) x where x->>'claim_id' = cl::text and (x->>'dispute')::boolean), 'the dispute is in the queue';
 assert public.aura_social_review_claim(cl)->'dispute'->>'existing_claim' = t.cid('a:owner.one')::text, 'the reviewer (only) sees the existing claim';
 assert t.denied(format('select public.aura_social_decide(%L,''approved'',''try take over'')', cl), '23505'), 'approval of a competing claim cannot silently take over';
 reset role;
 -- A direct database attempt to create a second verified claim for one identity is refused by the unique index.
 assert t.denied(format('update aura_social.ownership_claim set state = ''verified'' where id = %L', cl), '23505'), 'the unique index is the last line of defence for verified uniqueness';
 perform t.pass('duplicate ownership: competing claim is disputed, existing owner unchanged and not revealed, takeover impossible even directly'); end $$;
do $$ declare cl uuid := (select claim from t.cl where k = 'e:owner.one'); d jsonb; begin perform t.mfa('r');
 d := public.aura_social_decide(cl, 'rejected', 'Code not found on the profile'); assert d->>'state' = 'rejected', 'rejected'; reset role;
 assert (select verification from aura_creator.social_account where id = (select account from t.cl where k = 'a:owner.one')) = 'verified' and (select status from aura_social.ownership_dispute where claim_id = cl) = 'resolved', 'the existing owner is upheld and the dispute resolved';
 perform t.me('e'); assert public.aura_social_verification(t.ws('e'), (select account from t.cl where k = 'e:owner.one'))->'claim'->>'decision_reason' = 'Code not found on the profile', 'the claimant sees the rejection reason'; assert public.aura_social_verification(t.ws('e'), (select account from t.cl where k = 'e:owner.one'))->>'verification' = 'rejected', 'status is rejected';
 reset role; perform t.pass('rejected dispute: existing verified owner preserved, reason visible to the claimant'); end $$;
do $$ declare a2 uuid; v jsonb; cl uuid; d jsonb; begin
 -- Resolve a dispute in favour of the competing claim: only with an explicit replace flag.
 perform t.me('e'); a2 := (select account from t.cl where k = 'e:owner.one'); v := public.aura_social_start_verification(t.ws('e'), a2, gen_random_uuid()); cl := (v->>'claim_id')::uuid; perform public.aura_social_request_review(t.ws('e'), cl); reset role;
 perform t.mfa('r'); assert v->>'state' = 'disputed', 'new claim is disputed again';
 d := public.aura_social_decide(cl, 'approved', 'Evidence shows the competing claimant controls the account', true); assert d->>'state' = 'verified', 'dispute resolved for the competing claim'; reset role;
 assert (select verification from aura_creator.social_account where id = a2) = 'verified' and (select verification from aura_creator.social_account where id = (select account from t.cl where k = 'a:owner.one')) = 'revoked', 'the previous owner is revoked in the same transaction';
 assert (select count(*) from aura_social.ownership_claim where identity_key = 'instagram:h:owner.one' and state = 'verified') = 1, 'still exactly one verified owner';
 assert exists(select 1 from aura_social.review_decision where claim_id = t.cid('a:owner.one') and decision = 'revoked'), 'the revocation is recorded';
 perform t.pass('dispute resolved for the competing claim: atomic hand-over with an explicit flag, one verified owner, recorded'); end $$;
do $$ declare a uuid; v jsonb; cl uuid; begin
 perform t.me('a'); a := (select account from t.cl where k = 'a:owner.one'); v := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); assert v->>'state' = 'disputed', 'after revocation the old owner re-claiming is a dispute (the identity is verified elsewhere)'; reset role;
 -- needs_evidence: back to the Creator with a fresh window and a note
 perform t.me('a'); a := t.acct('a','instagram','more.evidence'); v := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); cl := (v->>'claim_id')::uuid; perform public.aura_social_request_review(t.ws('a'), cl); reset role; perform t.mfa('r');
 v := public.aura_social_decide(cl, 'needs_evidence', 'Please add a screenshot of the bio'); assert v->>'state' = 'challenge_pending' and v->>'review_note' = 'Please add a screenshot of the bio' and not (v->'challenge'->>'consumed')::boolean, 'additional evidence requested with a fresh window'; reset role;
 perform t.me('a'); v := public.aura_social_request_review(t.ws('a'), cl); assert v->>'state' = 'under_review', 'resubmission works'; reset role; perform t.mfa('r');
 v := public.aura_social_decide(cl, 'approved', 'Resubmission accepted'); reset role; perform t.mfa('r'); v := public.aura_social_decide(cl, 'revoked', 'Account was transferred'); assert v->>'state' = 'revoked', 'a verified claim can be revoked'; reset role;
 assert (select verification from aura_creator.social_account where id = a) = 'revoked', 'account shows revoked';
 perform t.me('a'); v := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); assert v->>'state' = 'challenge_pending', 'a revoked account can start again; the identity is free';
 -- A handle change must not carry ownership over.
 perform t.mfa('r'); reset role; perform t.me('a'); perform public.aura_social_cancel_verification(t.ws('a'), (v->>'claim_id')::uuid); v := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); perform public.aura_social_request_review(t.ws('a'), (v->>'claim_id')::uuid); reset role; perform t.mfa('r'); perform public.aura_social_decide((v->>'claim_id')::uuid, 'approved', 'Verified again here'); reset role; perform t.me('a');
 assert t.acc(a)->>'verification' = 'verified', 'verified before the rename'; perform public.aura_social_update_account(t.ws('a'), a, '{"handle":"renamed.handle"}'); assert t.acc(a)->>'verification' = 'unverified', 'a renamed handle is a different provisional identity: ownership is not transferred'; reset role;
 assert (select state from aura_social.ownership_claim where id = (v->>'claim_id')::uuid) = 'revoked', 'the claim for the old handle is revoked';
 perform t.pass('needs-evidence and resubmission, revocation, re-claiming after revocation, and handle changes never transfer verified ownership'); end $$;

-- 10. Evidence and storage policies (policies are created only because the storage stub exists)
do $$ declare a uuid; v jsonb; cl uuid; pth text; eid uuid; begin
 perform t.me('a'); a := t.acct('a','facebook','evidence.fb'); v := public.aura_social_start_verification(t.ws('a'), a, gen_random_uuid()); cl := (v->>'claim_id')::uuid;
 pth := t.ws('a')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.png';
 insert into storage.objects(bucket_id, name) values ('social-evidence', pth); -- allowed: owner, open claim, unexpired challenge
 assert t.denied(format('insert into storage.objects(bucket_id,name) values (''social-evidence'',%L)', t.ws('b')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.png'), '42501'), 'upload to another workspace path denied';
 reset role; insert into storage.buckets(id,name) values ('other-bucket','other-bucket') on conflict do nothing; perform t.me('a'); -- Fixture: a second bucket exists, but no policy covers it
 assert t.denied(format('insert into storage.objects(bucket_id,name) values (''other-bucket'',%L)', pth), '42501'), 'only the evidence bucket accepts these paths';
 assert t.denied(format('insert into storage.objects(bucket_id,name) values (''social-evidence'',%L)', t.ws('a')::text || '/' || gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.png'), '42501'), 'upload under a claim that does not exist denied';
 perform public.aura_social_submit_evidence(t.ws('a'), cl, jsonb_build_object('storage_path', pth, 'mime', 'image/png', 'size', 500)); assert (select count(*) from storage.objects where name = pth) = 1, 'the owner can read their own evidence';
 reset role; perform t.me('b'); assert (select count(*) from storage.objects where name = pth) = 0, 'another Creator cannot read it'; delete from storage.objects where name = pth; reset role; assert (select count(*) from storage.objects where name = pth) = 1, 'nor delete it (RLS filters the row, so nothing is removed)';
 perform t.as_anon(); assert t.denied('select count(*) from storage.objects', '42501'), 'anonymous has no access to storage objects at all'; reset role;
 perform t.mfa('r'); assert (select count(*) from storage.objects where name = pth) = 0, 'a reviewer cannot read evidence that has not been scanned'; reset role;
 update aura_social.verification_evidence set scan_status = 'clean' where storage_path = pth; -- Fixture: stands in for a malware scanner marking the file clean
 perform t.mfa('r'); assert (select count(*) from storage.objects where name = pth) = 1, 'a reviewer can read evidence once it is clean'; reset role;
 perform t.mfa('r3'); assert (select count(*) from storage.objects where name = pth) = 0, 'a reviewer who is not a platform admin cannot'; reset role;
 update aura_social.verification_evidence set scan_status = 'quarantined' where storage_path = pth; perform t.mfa('r'); assert (select count(*) from storage.objects where name = pth) = 0, 'quarantined evidence is unreadable to reviewers'; reset role;
 eid := (select id from aura_social.verification_evidence where storage_path = pth); perform t.me('a'); assert public.aura_social_delete_evidence(t.ws('a'), eid)->>'storage_path' = pth, 'the owner can delete evidence before a decision'; delete from storage.objects where name = pth; reset role;
 perform t.pass('evidence storage: bound to workspace and claim, private from other Creators and anonymous, reviewers only see clean files, quarantine honoured, owner deletion before a decision'); end $$;

create function t.free(k text, n int) returns void language plpgsql as $$ declare i int; x uuid; begin
 for i in 1..n loop
  select (a->>'id')::uuid into x from jsonb_array_elements(public.aura_social_accounts(t.ws(k))->'accounts') a where a->>'lifecycle' in ('active','disconnected') and not (a->>'is_primary')::boolean order by a->>'created_at' limit 1;
  exit when x is null; perform public.aura_social_remove_account(t.ws(k), x);
 end loop; end $$;
grant execute on function t.free(text,int) to authenticated;

-- 11. Visibility, sharing grants and what a Brand may see
do $$ declare s uuid; priv uuid; v jsonb; card jsonb; g jsonb; bad text; begin
 perform t.me('a'); perform t.free('a', 6); s := t.acct('a','instagram','share.me',jsonb_build_object('followers',150)); priv := t.acct('a','instagram','private.one',jsonb_build_object('followers',500));
 perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), s, 'reach', 9000, t.cur()-1, t.cur()-8, t.cur()-1); perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), s, 'following', 77, t.cur()-1);
 assert t.acc(s)->>'sharing_visibility' = 'private', 'adding an account never publishes it'; reset role; perform t.mfa('c');
 assert public.aura_social_shared_view(t.ws('c')) = '[]'::jsonb, 'a Brand sees nothing before anything is published'; reset role;
 perform t.me('a'); perform public.aura_social_set_sharing(t.ws('a'), s, 'published'); reset role; perform t.mfa('c'); v := public.aura_social_shared_view(t.ws('c'));
 assert jsonb_array_length(v) = 1 and v->0->>'handle' = 'share.me', 'only the published account appears; the private one never does'; card := v->0;
 assert card->>'ownership' = 'unverified' and (card->>'self_reported')::boolean and (card->>'meets_follower_threshold')::boolean and (card->'followers'->>'value')::numeric = 150 and card->'followers'->>'source' = 'manual', 'eligible unverified accounts carry clear self-reported and unverified labels';
 select string_agg(k, ',') into bad from jsonb_object_keys(card) k where k not in ('ref','platform','handle','profile_url','display_name','account_type','ownership','self_reported','followers','meets_follower_threshold','published','granted'); assert bad is null, 'only allowlisted fields are returned (' || coalesce(bad,'') || ')';
 assert card->'granted' = '{}'::jsonb, 'detailed metrics are not shared without a grant'; assert position(t.ws('a')::text in v::text) = 0 and position(t.uid('a')::text in v::text) = 0, 'the Creator workspace and user are never revealed';
 reset role; perform t.me('a');
 assert t.denied(format('select public.aura_social_grant_share(%L,%L,%L,%L,''Campaign review'')', t.ws('a'), s, t.ws('b'), '{reach}'), '22023'), 'a grant can only go to a Brand or Agency workspace';
 assert t.denied(format('select public.aura_social_grant_share(%L,%L,%L,%L,''Campaign review'')', t.ws('a'), s, t.ws('c'), '{evidence}'), '23514'), 'fields outside the allowlist are refused';
 assert t.denied(format('select public.aura_social_grant_share(%L,%L,%L,%L,''Campaign review'')', t.ws('a'), s, t.ws('c'), '{}'), '23514'), 'a grant needs at least one field';
 g := public.aura_social_grant_share(t.ws('a'), s, t.ws('c'), array['reach','impressions'], 'Campaign review'); reset role; perform t.mfa('c'); v := public.aura_social_shared_view(t.ws('c'));
 assert (v->0->'granted'->'reach'->>'value')::numeric = 9000 and v->0->'granted' ? 'following' = false, 'only the granted fields are returned';
 reset role; perform t.me('b'); assert t.denied(format('select public.aura_social_revoke_share(%L,%L)', t.ws('b'), g->>'id'), '42501'), 'another Creator cannot revoke it'; assert t.denied(format('select public.aura_social_grant_share(%L,%L,%L,%L,''x y z'')', t.ws('b'), s, t.ws('c'), '{reach}'), '42501'), 'nor grant on someone else''s account';
 reset role; perform t.me('a'); perform public.aura_social_revoke_share(t.ws('a'), (g->>'id')::uuid); reset role; perform t.mfa('c'); assert v->0->'granted' <> '{}'::jsonb and public.aura_social_shared_view(t.ws('c'))->0->'granted' = '{}'::jsonb, 'revocation takes effect immediately';
 reset role; perform t.me('a'); g := public.aura_social_grant_share(t.ws('a'), s, t.ws('c'), array['reach'], 'Campaign review', now() + interval '1 day'); reset role;
 update aura_social.share_grant set valid_until = now() - interval '1 minute' where id = (g->>'id')::uuid; -- Fixture: the grant lapses
 perform t.mfa('c'); assert public.aura_social_shared_view(t.ws('c'))->0->'granted' = '{}'::jsonb, 'an expired grant shares nothing'; reset role;
 perform t.me('a'); perform public.aura_social_set_sharing(t.ws('a'), s, 'private'); reset role; perform t.mfa('c'); assert public.aura_social_shared_view(t.ws('c')) = '[]'::jsonb, 'unpublishing hides the account immediately'; reset role;
 perform t.me('a'); perform public.aura_social_set_sharing(t.ws('a'), s, 'published'); g := public.aura_social_grant_share(t.ws('a'), s, t.ws('c'), array['reach'], 'Campaign review'); perform public.aura_social_remove_account(t.ws('a'), s); reset role; perform t.mfa('c');
 assert public.aura_social_shared_view(t.ws('c')) = '[]'::jsonb, 'removal immediately removes discovery exposure'; reset role;
 assert (select status from aura_social.share_grant where id = (g->>'id')::uuid) = 'revoked' and (select sharing_visibility from aura_creator.social_account where id = s) = 'private', 'removal revokes grants and unpublishes';
 perform t.me('a'); assert t.denied(format('select public.aura_social_set_sharing(%L,%L,''published'')', t.ws('a'), s), '55000'), 'a removed account cannot be republished';
 reset role; perform t.me('b'); assert t.denied(format('select public.aura_social_shared_view(%L)', t.ws('c')), '42501'), 'a Creator cannot read a Brand''s view'; reset role; perform t.mfa('c'); assert t.denied(format('select public.aura_social_shared_view(%L)', t.ws('a')), '42501'), 'a Brand cannot use a Creator workspace id'; assert t.denied(format('select public.aura_social_shared_view(%L)', t.ws('d')), '42501'), 'nor another Brand or Agency workspace'; reset role;
 perform t.pass('sharing: private by default, publication and grants are explicit, allowlisted, purpose-bound, revocable and expiring; removal and unpublishing are immediate; no identity leaks; id possession grants nothing'); end $$;

-- 12. Disconnect, refresh and provider safety
do $$ declare x uuid; y uuid; j jsonb; j2 jsonb; jid uuid; rid uuid := gen_random_uuid(); r aura_social.refresh_job; l jsonb; begin
 perform t.me('a'); perform t.free('a', 4); x := t.acct('a','instagram','connected.one'); y := t.acct('a','instagram','connected.two');
 assert t.denied(format('select public.aura_social_disconnect(%L,%L)', t.ws('a'), x), '55000'), 'a manual account has no connection to disconnect';
 assert t.denied(format('select public.aura_social_request_refresh(%L,%L,gen_random_uuid())', t.ws('a'), x), '55000'), 'a manual account can never queue a refresh';
 assert t.acc(x)->>'connection' = 'manual', 'a manual account is never presented as connected'; perform public.aura_social_set_sharing(t.ws('a'), x, 'published'); perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), x, 'followers', 300, t.cur()-3);
 reset role;
 -- Fixture: stands in for a future provider authorization. No client function can create this.
 update aura_creator.social_account set connection = 'connected' where id in (x, y); insert into aura_social.provider_connection(account_id, workspace_id, provider, status, credential_ref, scopes) select id, workspace_id, 'instagram', 'connected', 'ref:test-fixture-only', '{read}' from aura_creator.social_account where id in (x, y);
 perform t.me('a'); j := public.aura_social_request_refresh(t.ws('a'), x, rid); jid := (j->>'id')::uuid; assert j->>'status' = 'queued', 'a connected account queues a job'; j2 := public.aura_social_request_refresh(t.ws('a'), x, rid); assert j2->>'id' = j->>'id', 'retrying the same request is idempotent';
 assert t.denied(format('select public.aura_social_request_refresh(%L,%L,gen_random_uuid())', t.ws('a'), x), '54000'), 'manual refresh is rate limited';
 j2 := public.aura_social_request_refresh(t.ws('a'), y, gen_random_uuid()); reset role;
 r := aura_social.job_start(jid); assert r.status = 'running' and r.attempt = 1, 'the worker starts a job after revalidating the account'; perform t.me('a');
 j := public.aura_social_disconnect(t.ws('a'), x); assert j->>'lifecycle' = 'disconnected' and j->>'connection' = 'disconnected', 'disconnected';
 assert j->>'sharing_visibility' = 'published', 'provider disconnection never overrides the Creator''s visibility choice'; assert j->>'history_stale_since' is not null, 'history is marked stale'; reset role;
 assert (select status from aura_social.refresh_job where id = jid) = 'cancelled', 'the running job was cancelled by the disconnection';
 assert (select status from aura_social.provider_connection where account_id = x) = 'revoked' and (select credential_ref from aura_social.provider_connection where account_id = x) is null, 'provider access is revoked and the credential reference cleared';
 assert (select status from aura_social.refresh_job where account_id = y) = 'queued', 'another account''s job is untouched';
 -- Race: a job is running while the account stops being connected by some route that did not cancel jobs (fixture). Completion must revalidate and discard.
 declare yj uuid; begin
  yj := (select id from aura_social.refresh_job where account_id = y); perform aura_social.job_start(yj);
  update aura_creator.social_account set connection = 'disconnected', lifecycle = 'disconnected' where id = y;
  assert (aura_social.job_complete(yj, true)).status = 'cancelled', 'the late completion returns the cancelled job instead of applying anything';
  assert (select status from aura_social.refresh_job where id = yj) = 'cancelled' and (select error_code from aura_social.refresh_job where id = yj) = 'disconnected_before_completion', 'a refresh that completes after disconnection is discarded and recorded as such';
 end;
 assert (select status from aura_social.refresh_job where id = jid) = 'cancelled', 'a refresh that finishes after disconnection is discarded, not applied';
 assert (aura_social.job_complete(jid, true)).status = 'cancelled', 'completion is idempotent';
 assert (select count(*) from aura_social.account_observation where source = 'provider') = 0, 'no provider-derived observation exists: nothing was synchronized';
 perform t.me('a'); perform public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), x, 'followers', 310, t.cur()-1); assert (t.acc(x)->'latest'->'followers'->>'value')::numeric = 310, 'manual entry stays fully usable after disconnection';
 l := public.aura_social_observations(t.ws('a'), x, 'followers'); assert exists(select 1 from jsonb_array_elements(l->'items') i where (i->>'value')::numeric = 300 and (i->>'historical')::boolean), 'earlier history is flagged historical';
 assert t.denied(format('select public.aura_social_request_refresh(%L,%L,gen_random_uuid())', t.ws('a'), x), '55000'), 'no refresh for a disconnected account';
 assert (public.aura_social_jobs(t.ws('a'), x)->0->>'status') = 'cancelled', 'job history is honest';
 perform public.aura_social_remove_account(t.ws('a'), y); reset role; assert (select status from aura_social.refresh_job where account_id = y) = 'cancelled' and (select status from aura_social.provider_connection where account_id = y) = 'revoked', 'removing a connected account also cancels jobs and revokes access';
 perform t.pass('disconnect and refresh: manual accounts never look connected, jobs revalidated and cancelled, late completion discarded, visibility untouched, history flagged, manual entry still works, nothing synchronized'); end $$;

-- 13. Reminders
do $$ declare r1 uuid; r2 uuid; r3 uuid; d jsonb; begin perform t.me('b'); r1 := t.acct('b','threads','remind.one'); d := public.aura_social_reminders(t.ws('b'));
 assert exists(select 1 from jsonb_array_elements(d->'due') x where x->>'account_id' = r1::text and x->'days_since' = 'null'::jsonb), 'an account with no observation is due (unknown, not zero)';
 perform public.aura_social_record_observation(t.ws('b'), gen_random_uuid(), r1, 'followers', 12, t.cur()); d := public.aura_social_reminders(t.ws('b')); assert not exists(select 1 from jsonb_array_elements(d->'due') x where x->>'account_id' = r1::text), 'a fresh observation clears the reminder';
 reset role; set session_replication_role = replica; update aura_social.account_observation set observed_on = t.cur() - 9 where account_id = r1; set session_replication_role = origin; perform t.me('b'); -- Fixture: age the observation (bypasses the append-only trigger, which is otherwise enforced even for the superuser)
 d := public.aura_social_reminders(t.ws('b')); assert exists(select 1 from jsonb_array_elements(d->'due') x where x->>'account_id' = r1::text and (x->>'days_since')::int = 9), 'after a week the reminder returns'; assert (select count(*) from jsonb_array_elements(d->'due') x where x->>'account_id' = r1::text) = 1, 'once per account';
 perform public.aura_social_snooze_reminder(t.ws('b'), r1, 30); assert (select (snoozed_until)::date from (select public.aura_social_snooze_reminder(t.ws('b'), r1, 30)->>'snoozed_until' as snoozed_until) q) = t.cur() + 7, 'snooze is capped at 7 days';
 assert not exists(select 1 from jsonb_array_elements(public.aura_social_reminders(t.ws('b'))->'due') x where x->>'account_id' = r1::text), 'a snoozed account is not repeated';
 perform public.aura_social_set_reminders(t.ws('b'), false); assert public.aura_social_reminders(t.ws('b'))->'due' = '[]'::jsonb and not (public.aura_social_reminders(t.ws('b'))->>'weekly')::boolean, 'reminders can be switched off';
 assert public.aura_social_set_reminders(t.ws('b'), true)->>'delivery' = 'in_app_only', 'delivery is honestly in-app only'; perform public.aura_social_snooze_reminder(t.ws('b'), r1, 1);
 r2 := t.acct('b','threads','remind.two'); r3 := t.acct('b','threads','remind.three'); perform public.aura_social_remove_account(t.ws('b'), r2); perform public.aura_social_archive_account(t.ws('b'), r3, true);
 d := public.aura_social_reminders(t.ws('b')); assert not exists(select 1 from jsonb_array_elements(d->'due') x where x->>'account_id' in (r2::text, r3::text)), 'removed and archived accounts get no reminders';
 reset role; perform t.pass('reminders: in-app only, unknown handled, no duplicates, snooze capped, switchable, none for removed or archived accounts'); end $$;

-- 14. AI screenshot extraction contract: suggestions are not observations until the Creator confirms
do $$ declare s uuid; ev uuid; sg uuid; sg2 uuid; cl uuid; o jsonb; before_n int; begin perform t.me('a'); perform t.free('a', 4); s := t.acct('a','instagram','extract.me',jsonb_build_object('followers',100)); reset role;
 -- Fixture: stands in for a future extraction provider. No client function can create a suggestion.
 insert into aura_social.ownership_claim(workspace_id, account_id, claimant, identity_key, state, request_id) values (t.ws('a'), s, t.uid('a'), 'instagram:h:extract.me', 'revoked', gen_random_uuid()) returning id into cl;
 insert into aura_social.verification_evidence(claim_id, workspace_id, account_id, storage_path, mime, size_bytes, scan_status, uploaded_by) values (cl, t.ws('a'), s, t.ws('a')::text || '/' || cl::text || '/' || gen_random_uuid()::text || '.png', 'image/png', 900, 'clean', t.uid('a')) returning id into ev;
 insert into aura_social.extraction_suggestion(workspace_id, account_id, evidence_id, provider, fields, uncertainty) values (t.ws('a'), s, ev, 'fixture-provider', '[{"metric":"followers","value":2500,"observed_on":"2026-11-20"}]', '{"followers":"unclear digits"}') returning id into sg;
 insert into aura_social.extraction_suggestion(workspace_id, account_id, evidence_id, provider, fields) values (t.ws('a'), s, ev, 'fixture-provider', '[{"metric":"following","value":10,"observed_on":"2026-11-20"}]') returning id into sg2;
 select count(*) into before_n from aura_social.account_observation where account_id = s; perform t.me('a');
 assert jsonb_array_length(public.aura_social_suggestions(t.ws('a'), s)) = 2 and public.aura_social_suggestions(t.ws('a'), s)->0->>'status' = 'suggested', 'suggestions are listed as suggestions';
 assert (t.acc(s)->'latest'->'followers'->>'value')::numeric = 100 and t.acc(s)->'latest' ? 'following' = false, 'an unconfirmed suggestion changes nothing the Creator or Brands can see'; reset role;
 assert (select count(*) from aura_social.account_observation where account_id = s) = before_n and (select self_reported_followers from aura_creator.social_account where id = s) = 100, 'no observation exists and the eligibility input is unchanged (AC03)'; perform t.me('b');
 assert t.denied(format('select public.aura_social_confirm_suggestion(%L,%L,gen_random_uuid(),%L)', t.ws('b'), sg, '[{"metric":"followers","value":1,"observed_on":"2026-11-20"}]'), '42501'), 'another Creator cannot confirm it'; reset role; perform t.me('a');
 assert t.denied(format('select public.aura_social_confirm_suggestion(%L,%L,gen_random_uuid(),%L)', t.ws('a'), sg, '[{"metric":"followers","value":-5,"observed_on":"2026-11-20"}]'), '23514'), 'invalid confirmed values are refused';
 reset role; assert (select status from aura_social.extraction_suggestion where id = sg) = 'suggested', 'a failed confirmation leaves the suggestion untouched'; perform t.me('a');
 o := public.aura_social_confirm_suggestion(t.ws('a'), sg, gen_random_uuid(), format('[{"metric":"followers","value":2400,"observed_on":"%s"}]', t.cur())::jsonb); assert o->0->>'source' = 'ai_confirmed' and (o->0->>'value')::numeric = 2400 and o->0->>'evidence_id' = ev::text, 'the Creator''s corrected value becomes an ai_confirmed observation tied to the evidence';
 assert (t.acc(s)->'latest'->'followers'->>'value')::numeric = 2400 and t.acc(s)->'latest'->'followers'->>'source' = 'ai_confirmed', 'it is labelled ai_confirmed, not provider-verified';
 assert t.denied(format('select public.aura_social_confirm_suggestion(%L,%L,gen_random_uuid(),%L)', t.ws('a'), sg, '[{"metric":"followers","value":1,"observed_on":"2026-11-20"}]'), '55000'), 'a suggestion is confirmed once';
 perform public.aura_social_discard_suggestion(t.ws('a'), sg2); reset role; assert (select status from aura_social.extraction_suggestion where id = sg2) = 'discarded' and (select count(*) from aura_social.account_observation where account_id = s and metric = 'following') = 0, 'a discarded suggestion creates nothing';
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ~ 'suggest' and p.proname not in ('aura_social_suggestions','aura_social_confirm_suggestion','aura_social_discard_suggestion')), 'no client function can create a suggestion';
 perform t.pass('extraction contract: suggestions are inert until the Creator confirms; confirmed values are labelled ai_confirmed; nothing can create a suggestion from the client'); end $$;

-- 15. Cross-tenant access and shared Brand infrastructure
do $$ declare ws_a uuid := t.ws('a'); acc uuid; q text; n int := 0; begin perform t.me('a'); perform t.free('a', 4); acc := t.acct('a','youtube','crosstenant.a'); reset role;
 foreach q in array array[
  'select public.aura_social_accounts(%L)', 'select public.aura_social_account(%L, %L)', 'select public.aura_social_update_account(%L, %L, ''{"display_name":"x"}'')', 'select public.aura_social_set_primary(%L, %L)',
  'select public.aura_social_set_preferred(%L, %L, true)', 'select public.aura_social_remove_account(%L, %L)', 'select public.aura_social_archive_account(%L, %L, true)', 'select public.aura_social_disconnect(%L, %L)',
  'select public.aura_social_observations(%L, %L)', 'select public.aura_social_content(%L, %L)', 'select public.aura_social_verification(%L, %L)', 'select public.aura_social_set_sharing(%L, %L, ''published'')',
  'select public.aura_social_shares(%L, %L)', 'select public.aura_social_jobs(%L, %L)', 'select public.aura_social_suggestions(%L, %L)', 'select public.aura_social_reminders(%L)'] loop
  foreach q in array array[q] loop
   perform t.me('b'); assert t.denied(case when q like '%L, %L%' then format(q, ws_a, acc) else format(q, ws_a) end), 'Creator b denied: ' || q; reset role;
   perform t.me('e'); assert t.denied(case when q like '%L, %L%' then format(q, ws_a, acc) else format(q, ws_a) end), 'non-owner member denied: ' || q; reset role;
   perform t.mfa('c'); assert t.denied(case when q like '%L, %L%' then format(q, ws_a, acc) else format(q, ws_a) end), 'Brand denied: ' || q; reset role; n := n + 1;
  end loop;
 end loop;
 perform t.me('b'); assert t.denied(format('select public.aura_social_account(%L,%L)', t.ws('b'), acc), '42501'), 'a correct own workspace id with another workspace''s account id still fails'; assert t.denied(format('select public.aura_social_record_observation(%L,gen_random_uuid(),%L,''followers'',1,%L)', t.ws('b'), acc, t.cur()-1), '42501'), 'nor can metrics be recorded onto it'; reset role;
 perform t.mfa('c'); assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('a'), '{"platform":"other","handle":"hijack"}'), '42501'), 'a Brand cannot add an account to a Creator workspace'; reset role;
 perform t.me('a'); assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('c'), '{"platform":"other","handle":"hijack"}'), '42501'), 'a Creator cannot add an account to a Brand workspace'; reset role;
 perform t.mfa('d'); assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('d'), '{"platform":"other","handle":"hijack"}'), '42501'), 'Agency accounts are not enabled in M05'; reset role;
 perform t.pass('cross-tenant: every account, observation, verification, sharing, job and suggestion function denies another Creator, a non-owner member and a Brand (' || n || ' functions x 3 actors)'); end $$;
do $$ declare i int; first uuid; n_before int; begin perform t.mfa('c');
 select (public.aura_social_accounts(t.ws('c'))->>'used')::int into n_before; assert n_before = 0, 'the Brand workspace starts empty and separate from every Creator';
 for i in 1..10 loop perform public.aura_social_add_account(t.ws('c'), gen_random_uuid(), jsonb_build_object('platform','linkedin','handle','brand-co-' || i)); end loop;
 assert (public.aura_social_accounts(t.ws('c'))->>'used')::int = 10, 'a Brand workspace has its own account allowance (shared infrastructure, F20)';
 assert t.denied(format('select public.aura_social_add_account(%L,gen_random_uuid(),%L)', t.ws('c'), '{"platform":"linkedin","handle":"brand-co-11"}'), '23514'), 'the Brand limit is enforced independently';
 perform public.aura_social_record_observation(t.ws('c'), gen_random_uuid(), (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('c'))->'accounts') x limit 1), 'followers', 4000, t.cur()-1); reset role;
 perform t.me('a'); assert (public.aura_social_accounts(t.ws('a'))->>'used')::int < 10 and not exists(select 1 from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'platform' = 'linkedin'), 'a Creator''s accounts and limit are unaffected by the Brand''s'; reset role;
 perform t.pass('the same infrastructure serves a Brand workspace with a separate limit, separate data and separate permissions'); end $$;

-- 16. Audit events and policy
do $$ begin
 assert (select count(distinct event) from aura_identity.event where event like 'social\_%') >= 12, 'material social events are audited';
 assert not exists(select 1 from aura_identity.event where event like 'social%' and event ~ '(aura-|http|@)'), 'audit events carry no codes, URLs or handles';
 perform t.me('a'); assert (public.aura_social_policy()->>'max_active_accounts')::int = 10 and jsonb_array_length(public.aura_social_policy()->'metrics') = 16, 'policy is readable and metric dictionary has 16 entries'; reset role;
 perform t.pass('audit events recorded without sensitive content; policy and metric dictionary exposed read-only'); end $$;
\copy (select 'platform',code from aura_social.platform union all select 'metric',code from aura_social.metric_def order by 1,2) to stdout csv
\echo ---RESULTS---
select name from t.results order by name;
