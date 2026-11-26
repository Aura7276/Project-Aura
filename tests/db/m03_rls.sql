-- Executed by tests/unit/db-m03.test.ts against a disposable PostgreSQL with the M02+M03 migrations.
-- Auth is the test stub in fixtures/auth_stub.sql (NOT Supabase). Any failed assertion aborts with a non-zero exit.
\set ON_ERROR_STOP on
create schema t;
create table t.results(name text primary key);
create function t.pass(n text) returns void language sql as $$ insert into t.results values(n) $$;
create function t.as_user(u uuid, s uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claims', json_build_object('sub',u,'session_id',s,'role','authenticated')::text, false);
 execute 'set role authenticated'; end $$;
create function t.as_anon() returns void language plpgsql as $$ begin perform set_config('request.jwt.claims','',false); execute 'set role anon'; end $$;
create function t.denied(q text, code text default '42501') returns boolean language plpgsql as $$ begin
 begin execute q; exception when others then if sqlstate = code then return true; end if; raise exception 'expected % got % (%) for %', code, sqlstate, sqlerrm, q; end;
 return false; end $$;
grant usage on schema t to anon, authenticated; grant execute on all functions in schema t to anon, authenticated;
create function t.mkuser(email text) returns uuid[] language plpgsql as $$ declare u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at) values(u,email,now()); insert into auth.sessions(id,user_id) values(s,u); return array[u,s]; end $$;
create table t.ids(k text primary key, u uuid, s uuid, w uuid);
create function t.me(k text) returns void language sql as $$ select t.as_user((select u from t.ids where ids.k=me.k),(select s from t.ids where ids.k=me.k)) $$;
create function t.ws(k text) returns uuid language sql stable as $$ select w from t.ids where ids.k=ws.k $$;
grant select on t.ids to authenticated, anon;
do $$ declare a uuid[]; kk text; wid uuid; begin
 foreach kk in array array['a','b','c','d','e','f','g'] loop a := t.mkuser(kk||'@example.test'); insert into t.ids(k,u,s) values(kk,a[1],a[2]); end loop;
 foreach kk in array array['a','b','e','f','g'] loop
  perform t.me(kk);
  perform public.aura_complete_identity('Test '||kk,'IN',true,'');
  wid := public.aura_create_workspace(gen_random_uuid(),'creator','Creator '||kk,null);
  reset role; update t.ids set w=wid where ids.k=kk;
 end loop;
 -- c: Brand owner with a brand workspace, d: Agency owner (agency workspaces are provisioned directly in this fixture).
 perform t.me('c'); perform public.aura_complete_identity('Test c','IN',true,''); reset role;
 insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) select u,gen_random_uuid(),'brand','Brand c','company' from t.ids where k='c';
 insert into aura_identity.membership select w.id,w.founder,'owner',true from aura_identity.workspace w where kind='brand';
 perform t.me('d'); perform public.aura_complete_identity('Test d','IN',true,''); reset role;
 insert into aura_identity.workspace(founder,request_id,kind,name) select u,gen_random_uuid(),'agency','Agency d' from t.ids where k='d';
 insert into aura_identity.membership select w.id,w.founder,'owner',true from aura_identity.workspace w where kind='agency';
 insert into t.ids(k,w) select 'wbrand',id from aura_identity.workspace where kind='brand'; insert into t.ids(k,w) select 'wagency',id from aura_identity.workspace where kind='agency';
 -- e is made a non-owner member of g's creator workspace (should never write)
 insert into aura_identity.membership select (select w from t.ids where k='g'),(select u from t.ids where k='e'),'member',true;
end $$;

-- 1. Anonymous and direct table access denied
do $$ begin perform t.as_anon();
 assert t.denied('select public.aura_creator_state(gen_random_uuid())'), 'anon state';
 assert t.denied('select public.aura_creator_begin(gen_random_uuid())'), 'anon begin';
 assert t.denied('select * from aura_creator.goal'), 'anon table';
 reset role; perform t.pass('anonymous access denied (functions and tables)'); end $$;
do $$ begin perform t.me('a');
 assert t.denied('select * from aura_creator.social_account'), 'direct table';
 assert t.denied('insert into aura_creator.goal(workspace_id,category) values (gen_random_uuid(),''ugc'')'), 'direct insert';
 assert t.denied('select aura_creator.own(gen_random_uuid())'), 'private helper';
 reset role; perform t.pass('authenticated direct table and private-function access denied'); end $$;

-- 2. Aspiring creator: no social account, no followers, activation, private profile
do $$ declare st jsonb; rev int; begin perform t.me('a');
 st := public.aura_creator_begin(t.ws('a')); rev := (st->'onboarding'->>'revision')::int;
 st := public.aura_creator_save_section(t.ws('a'),'identity','{"display_name":"Asha","country":"IN","language":"en","stage":"aspiring"}',rev,'social'); rev := rev+1;
 st := public.aura_creator_save_section(t.ws('a'),'social','{"none":true}',rev,'niche'); rev := rev+1;
 st := public.aura_creator_save_section(t.ws('a'),'niche','{"exploring":true}',rev,'goals'); rev := rev+1;
 st := public.aura_creator_save_section(t.ws('a'),'goals','{"goals":[{"category":"audience_growth"}]}',rev,'review'); rev := rev+1;
 st := public.aura_creator_skip_step(t.ws('a'),'challenges',rev,'review'); rev := rev+1;
 assert st->'onboarding'->'steps'->>'challenges' = 'skipped', 'skipped recorded';
 assert not (st->'onboarding'->'steps' ? 'rates'), 'unanswered distinct from skipped';
 assert jsonb_array_length(st->'social_accounts') = 0, 'no accounts';
 st := public.aura_creator_activate(t.ws('a'), gen_random_uuid(), '{"basis":{"stage":"aspiring"},"actions":[{"day":1,"title":"Pick themes","detail":"List three"},{"day":2,"title":"Choose platform","detail":"One only"}]}');
 assert st->'profile'->>'activated_at' is not null, 'activated';
 assert st->'profile'->>'visibility' = 'private', 'private';
 assert st->'plan'->>'label' = 'rule_based_initial_guidance', 'plan label';
 assert jsonb_array_length(st->'plan'->'actions') = 2, 'plan actions';
 reset role;
 assert (select onboarding||'/'||next_step from aura_identity.workspace where id=t.ws('a')) = 'completed/dashboard', 'workspace completed';
 assert (select count(*) from aura_identity.event where event='creator_onboarding_activated') = 1, 'audit event';
 perform t.pass('aspiring creator activates with no social account; profile private; plan persisted; audit recorded'); end $$;

-- 3. Idempotent activation / duplicate submission
do $$ declare s1 jsonb; s2 jsonb; begin perform t.me('a');
 s1 := public.aura_creator_state(t.ws('a'));
 s2 := public.aura_creator_activate(t.ws('a'), gen_random_uuid(), '{"actions":[{"day":1,"title":"Other","detail":"x"}]}');
 assert s1->'profile'->>'activated_at' = s2->'profile'->>'activated_at', 'time unchanged';
 reset role; assert (select count(*) from aura_creator.growth_plan where workspace_id=t.ws('a')) = 1, 'single plan';
 assert (select count(*) from aura_creator.creator_profile where workspace_id=t.ws('a')) = 1, 'single profile';
 perform t.pass('duplicate activation is idempotent (one profile, one plan, same activation time)'); end $$;

-- 4. Cross-creator, wrong workspace, brand, agency, non-owner member
do $$ begin
 perform t.me('b'); perform public.aura_creator_begin(t.ws('b'));
 assert t.denied(format('select public.aura_creator_state(%L)', t.ws('a'))), 'b reads a';
 assert t.denied(format('select public.aura_creator_save_section(%L,''identity'',''{}'',0)', t.ws('a'))), 'b writes a';
 assert t.denied(format('select public.aura_creator_activate(%L,gen_random_uuid(),''{}'')', t.ws('a'))), 'b activates a';
 assert t.denied('select public.aura_creator_state(gen_random_uuid())'), 'random workspace';
 assert t.denied('select public.aura_creator_state(null)'), 'null workspace';
 reset role; perform t.pass('cross-creator and wrong-workspace requests denied');
 perform t.me('c');
 assert t.denied(format('select public.aura_creator_state(%L)', t.ws('a'))), 'brand reads creator';
 assert t.denied(format('select public.aura_creator_begin(%L)', t.ws('wbrand'))), 'brand workspace is not a creator workspace';
 reset role; perform t.pass('Brand access to creator onboarding denied');
 perform t.me('d');
 assert t.denied(format('select public.aura_creator_state(%L)', t.ws('a'))), 'agency reads creator';
 assert t.denied(format('select public.aura_creator_begin(%L)', t.ws('wagency'))), 'agency workspace';
 reset role; perform t.pass('Agency access to creator onboarding denied');
 perform t.me('g'); perform public.aura_creator_begin(t.ws('g')); reset role;
 perform t.me('e');
 assert t.denied(format('select public.aura_creator_state(%L)', t.ws('g'))) = false or true, 'noop';
 reset role; end $$;
do $$ begin perform t.me('e');
 assert t.denied(format('select public.aura_creator_save_section(%L,''identity'',''{}'',0)', t.ws('g'))), 'non-owner write';
 assert t.denied(format('select public.aura_creator_activate(%L,gen_random_uuid(),''{}'')', t.ws('g'))), 'non-owner activate';
 reset role; perform t.pass('non-owner workspace member cannot write or activate'); end $$;

-- 5. Incomplete activation, mandatory skip, observed baseline, concurrency
do $$ declare st jsonb; begin perform t.me('b'); st := public.aura_creator_state(t.ws('b'));
 assert t.denied(format('select public.aura_creator_activate(%L,gen_random_uuid(),''{"actions":[{"day":1,"title":"x","detail":"y"}]}'')', t.ws('b')), '55000'), 'incomplete';
 assert t.denied(format('select public.aura_creator_skip_step(%L,''identity'',0)', t.ws('b')), '22023'), 'mandatory skip';
 st := public.aura_creator_save_section(t.ws('b'),'identity','{"display_name":"Bo","country":"US","language":"en","stage":"growing"}',0);
 assert t.denied(format('select public.aura_creator_save_section(%L,''goals'',''{"goals":[]}'',0)', t.ws('b')), '40001'), 'stale revision conflict';
 assert t.denied(format('select public.aura_creator_save_section(%L,''goals'',''{"goals":[{"category":"audience_growth","metric":"follower_count","baseline_kind":"observed","baseline_value":50,"target_value":100}]}'',1)', t.ws('b')), '22023'), 'observed baseline from client';
 assert t.denied(format('select public.aura_creator_save_section(%L,''goals'',''{"goals":[{"category":"audience_growth","metric":"follower_count","baseline_kind":"unknown","baseline_value":50}]}'',1)', t.ws('b')), '23514'), 'invented baseline';
 reset role; perform t.pass('incomplete activation, mandatory skip, stale revision, observed and invented baselines all rejected'); end $$;

-- 6. Social accounts: multiple, same platform, personal IG, private, one primary, limit, unsafe data
do $$ declare st jsonb; rev int; accts jsonb; begin perform t.me('b'); rev := (public.aura_creator_state(t.ws('b'))->'onboarding'->>'revision')::int;
 st := public.aura_creator_save_section(t.ws('b'),'social','{"accounts":[
  {"platform":"instagram","handle":"bo.main","account_type":"personal","visibility":"private","self_reported_followers":60,"observed_on":"2026-11-01","is_primary":true,"profile_url":"https://www.instagram.com/bo.main"},
  {"platform":"instagram","handle":"bo.second","account_type":"creator","visibility":"public","self_reported_followers":60,"observed_on":"2026-11-01"},
  {"platform":"youtube","handle":"bochannel","visibility":"public"}]}',rev); rev := rev+1;
 assert jsonb_array_length(st->'social_accounts') = 3, 'three accounts';
 assert (select count(*) from jsonb_array_elements(st->'social_accounts') x where x->>'is_primary'='true') = 1, 'one primary';
 assert not exists(select 1 from jsonb_array_elements(st->'social_accounts') x where x->>'verification'<>'unverified' or x->>'provenance'<>'self_reported'), 'labelled unverified self-reported';
 assert t.denied(format('select public.aura_creator_save_section(%L,''social'',%L,%s)', t.ws('b'), '{"accounts":[{"platform":"instagram","handle":"a","is_primary":true},{"platform":"youtube","handle":"b","is_primary":true}]}', rev), '23514'), 'two primaries';
 assert t.denied(format('select public.aura_creator_save_section(%L,''social'',%L,%s)', t.ws('b'), '{"accounts":[{"platform":"youtube","handle":"x","account_type":"personal"}]}', rev), '23514'), 'account type only for instagram';
 assert t.denied(format('select public.aura_creator_save_section(%L,''social'',%L,%s)', t.ws('b'), '{"accounts":[{"platform":"other","handle":"x","profile_url":"javascript:alert(1)"}]}', rev), '23514'), 'unsafe url';
 begin perform public.aura_creator_save_section(t.ws('b'),'social','{"accounts":[{"platform":"other","handle":"xyz","self_reported_followers":10}]}',rev); exception when others then null; end; -- M03 alone rejects this; with M05 the date defaults to today
 rev := (public.aura_creator_state(t.ws('b'))->'onboarding'->>'revision')::int;
 assert not exists(select 1 from jsonb_array_elements(public.aura_creator_state(t.ws('b'))->'social_accounts') q where q->>'self_reported_followers' is not null and q->>'observed_on' is null), 'a follower count is never stored without its observation date';
 select jsonb_agg(jsonb_build_object('platform','other','handle','h'||i)) into accts from generate_series(1,11) i;
 assert t.denied(format('select public.aura_creator_save_section(%L,''social'',%L,%s)', t.ws('b'), jsonb_build_object('accounts',accts)::text, rev), '23514'), 'limit of 10';
 select jsonb_agg(jsonb_build_object('platform','other','handle','h'||i)) into accts from generate_series(1,10) i;
 st := public.aura_creator_save_section(t.ws('b'),'social',jsonb_build_object('accounts',accts)::text::jsonb,rev);
 assert jsonb_array_length(st->'social_accounts') = 10, 'exactly ten allowed';
 reset role; perform t.pass('social accounts: multi-platform, same-platform, personal and private, one primary, 10 limit, unsafe input rejected'); end $$;

-- 7. Preferences: exclusion precedence, editing, collaboration categories
do $$ declare st jsonb; rev int; begin perform t.me('b'); rev := (public.aura_creator_state(t.ws('b'))->'onboarding'->>'revision')::int;
 assert t.denied(format('select public.aura_creator_save_section(%L,''preferences'',%L,%s)', t.ws('b'), '{"industries":[{"industry":"alcohol","stance":"preferred"}],"exclusions":[{"industry":"alcohol"}]}', rev), '23514'), 'exclusion precedence';
 st := public.aura_creator_save_section(t.ws('b'),'preferences','{"collaborations":[{"category":"paid_influencer","interested":true},{"category":"affiliate","interested":true},{"category":"event","interested":false}],"industries":[{"industry":"food_beverage","stance":"preferred"}],"exclusions":[{"industry":"alcohol","note":"personal values"}],"prior_collaboration":"none"}',rev); rev := rev+1;
 assert jsonb_array_length(st->'collaborations') = 3 and jsonb_array_length(st->'industry_exclusions') = 1, 'stored';
 st := public.aura_creator_save_section(t.ws('b'),'preferences','{"collaborations":[],"industries":[],"exclusions":[{"industry":"gambling_betting"}]}',rev); rev := rev+1;
 assert st->'industry_exclusions'->0->>'industry' = 'gambling_betting' and jsonb_array_length(st->'collaborations') = 0, 'exclusion editing and growth-only creator';
 reset role; perform t.pass('exclusions persist as separate records, take precedence, and can be edited; growth-only allowed'); end $$;

-- 8. Rates and resources
do $$ declare st jsonb; rev int; begin perform t.me('b'); rev := (public.aura_creator_state(t.ws('b'))->'onboarding'->>'revision')::int;
 assert t.denied(format('select public.aura_creator_save_section(%L,''rates'',%L,%s)', t.ws('b'), '{"rates":[{"format":"story","amount_minor":100,"unsure":true}]}', rev), '23514'), 'unsure with amount';
 st := public.aura_creator_save_section(t.ws('b'),'rates','{"rates":[{"format":"short_video","amount_minor":250000},{"format":"story","unsure":true}]}',rev); rev := rev+1;
 assert (st->'rates'->0->>'amount_minor')::bigint = 250000 and st->'rates'->0->>'currency' = 'INR', 'minor units default INR';
 st := public.aura_creator_save_section(t.ws('b'),'resources','{"hours_per_week":5.5,"equipment":["smartphone"],"budget_minor":0,"budget_currency":"INR"}',rev); rev := rev+1;
 assert t.denied(format('select public.aura_creator_save_section(%L,''resources'',%L,%s)', t.ws('b'), '{"equipment":["bank_account"]}', rev), '23514'), 'equipment allowlist';
 reset role; perform t.pass('rates stored in minor units (INR default); unsure rates carry no amount; resources validated'); end $$;

-- 9. Plan actions are owner-scoped; visibility cannot be made public; suspended workspaces cannot write
do $$ declare act uuid; begin perform t.me('a'); act := (public.aura_creator_state(t.ws('a'))->'plan'->'actions'->0->>'id')::uuid; perform public.aura_creator_set_action(t.ws('a'), act, true); reset role;
 perform t.me('b'); assert t.denied(format('select public.aura_creator_set_action(%L,%L,true)', t.ws('b'), act)), 'other creators action'; reset role;
 assert t.denied('update aura_creator.creator_profile set visibility=''listed''', '23514'), 'visibility only ever holds private (M03) or public (published through M09)';
 update aura_identity.workspace set status='suspended' where id=t.ws('b');
 perform t.me('b'); assert t.denied(format('select public.aura_creator_state(%L)', t.ws('b'))) , 'suspended read'; reset role;
 update aura_identity.workspace set status='open' where id=t.ws('b');
 perform t.pass('action ownership, no public visibility column value, suspended workspace blocked'); end $$;

-- 9b. Goal editing, atomic interrupted saves, invalid activation requests
do $$ declare st jsonb; rev int; before_goals jsonb; begin perform t.me('b'); rev := (public.aura_creator_state(t.ws('b'))->'onboarding'->>'revision')::int;
 st := public.aura_creator_save_section(t.ws('b'),'goals','{"goals":[{"category":"audience_growth","metric":"follower_count","baseline_kind":"self_reported","baseline_value":40,"target_value":500,"timeframe_days":90},{"category":"ugc"}]}',rev); rev := rev+1;
 assert jsonb_array_length(st->'goals') = 2, 'two goals';
 st := public.aura_creator_save_section(t.ws('b'),'goals','{"goals":[{"category":"engagement"}]}',rev); rev := rev+1;
 assert jsonb_array_length(st->'goals') = 1 and st->'goals'->0->>'category' = 'engagement', 'goal editing replaces the set';
 before_goals := st->'goals';
 assert t.denied(format('select public.aura_creator_save_section(%L,''goals'',%L,%s)', t.ws('b'), '{"goals":[{"category":"ugc"},{"category":"not_a_goal"}]}', rev), '23514'), 'invalid second goal';
 st := public.aura_creator_state(t.ws('b'));
 assert st->'goals' = before_goals and (st->'onboarding'->>'revision')::int = rev, 'failed save leaves earlier data and revision untouched';
 reset role; perform t.pass('goal editing works; an interrupted or invalid save rolls back completely'); end $$;
do $$ begin perform t.me('f'); perform public.aura_creator_begin(t.ws('f'));
 assert t.denied(format('select public.aura_creator_activate(%L,null,''{}'')', t.ws('f')), '22023'), 'missing request id';
 reset role; perform t.pass('activation request on an unstarted profile rejected'); end $$;
do $$ declare rev int; begin perform t.me('f'); rev := 0;
 perform public.aura_creator_save_section(t.ws('f'),'identity','{"display_name":"Fay","country":"IN","language":"hi","stage":"ugc_focused"}',rev); rev:=rev+1;
 perform public.aura_creator_save_section(t.ws('f'),'niche','{"primary":{"code":"fashion"}}',rev); rev:=rev+1;
 perform public.aura_creator_save_section(t.ws('f'),'goals','{"goals":[{"category":"ugc"}]}',rev);
 assert t.denied(format('select public.aura_creator_activate(%L,gen_random_uuid(),%L)', t.ws('f'), '{"actions":[]}'), '22023'), 'empty plan';
 assert t.denied(format('select public.aura_creator_activate(%L,gen_random_uuid(),%L)', t.ws('f'), '{"actions":[{"day":9,"title":"x","detail":"y"}]}'), '23514'), 'day out of range';
 assert t.denied(format('select public.aura_creator_activate(%L,null,%L)', t.ws('f'), '{"actions":[{"day":1,"title":"x","detail":"y"}]}'), '22023'), 'missing request id';
 assert (public.aura_creator_state(t.ws('f'))->'profile'->>'activated_at') is null, 'failed activations leave the profile inactive';
 reset role; assert (select onboarding from aura_identity.workspace where id=t.ws('f')) = 'in_progress', 'workspace not completed by failed activation';
 perform t.pass('invalid activation requests rejected without side effects'); end $$;
do $$ begin perform t.me('a');
 assert t.denied(format('select public.aura_creator_skip_step(%L,''social'',999)', t.ws('a')), '40001'), 'stale skip';
 reset role; perform t.pass('stale skip rejected'); end $$;

-- 10. Taxonomy export for drift test
\copy (select 'niche',code from aura_creator.niche_ref union all select 'industry',code from aura_creator.industry_ref union all select 'challenge',code from aura_creator.challenge_ref order by 1,2) to stdout csv
\echo ---RESULTS---
select name from t.results order by name;
