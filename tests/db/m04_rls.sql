-- Executed by tests/unit/db-m04.test.ts on a disposable PostgreSQL with the real M02 (patched copy), M03 and M04 migrations
-- and the auth stub (NOT Supabase). Rows are crafted with the superuser only where a test needs backdated history; every
-- assertion about access runs as the `authenticated` or `anon` role. Any failed assertion aborts with a non-zero exit.
\set ON_ERROR_STOP on
create schema t;
create table t.results(name text primary key);
create function t.pass(n text) returns void language sql as $$ insert into t.results values(n) $$;
create function t.as_user(u uuid, s uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claims', json_build_object('sub',u,'session_id',s,'role','authenticated')::text, false); execute 'set role authenticated'; end $$;
create function t.as_anon() returns void language plpgsql as $$ begin perform set_config('request.jwt.claims','',false); execute 'set role anon'; end $$;
create function t.denied(q text, code text default '42501') returns boolean language plpgsql as $$ begin
 begin execute q; exception when others then if sqlstate = code then return true; end if; raise exception 'expected % got % (%) for %', code, sqlstate, sqlerrm, q; end;
 return false; end $$;
grant usage on schema t to anon, authenticated; grant execute on all functions in schema t to anon, authenticated;
create table t.ids(k text primary key, u uuid, s uuid, w uuid);
create function t.me(k text) returns void language sql as $$ select t.as_user((select u from t.ids where ids.k=me.k),(select s from t.ids where ids.k=me.k)) $$;
create function t.ws(k text) returns uuid language sql stable as $$ select w from t.ids where ids.k=ws.k $$;
grant select on t.ids to authenticated, anon;
create function t.rev(k text) returns int language sql as $$ select (public.aura_creator_state(t.ws(k))->'onboarding'->>'revision')::int $$;
create function t.mkuser(email text) returns uuid[] language plpgsql as $$ declare u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at) values(u,email,now()); insert into auth.sessions(id,user_id) values(s,u); return array[u,s]; end $$;
-- Full M03 activation through the real functions
create function t.activate(k text) returns void language plpgsql as $$ begin
 perform t.me(k); perform public.aura_creator_begin(t.ws(k));
 perform public.aura_creator_save_section(t.ws(k),'identity','{"display_name":"Creator","country":"IN","language":"en","stage":"aspiring"}',t.rev(k));
 perform public.aura_creator_save_section(t.ws(k),'niche','{"exploring":true}',t.rev(k));
 perform public.aura_creator_save_section(t.ws(k),'goals','{"goals":[{"category":"audience_growth","metric":"follower_count","baseline_kind":"self_reported","baseline_value":40,"target_value":500,"timeframe_days":90},{"category":"consistency"}]}',t.rev(k));
 perform public.aura_creator_activate(t.ws(k), gen_random_uuid(), '{"actions":[{"day":1,"title":"Pick themes","detail":"List three"},{"day":2,"title":"Choose platform","detail":"One only"}]}');
 reset role; end $$;
do $$ declare a uuid[]; kk text; wid uuid; begin
 foreach kk in array array['a','b','c','d','e','f'] loop a := t.mkuser(kk||'@example.test'); insert into t.ids(k,u,s) values(kk,a[1],a[2]); end loop;
 foreach kk in array array['a','b','e','f'] loop
  perform t.me(kk); perform public.aura_complete_identity('Test '||kk,'IN',true,''); wid := public.aura_create_workspace(gen_random_uuid(),'creator','Creator '||kk,null); reset role; update t.ids set w=wid where ids.k=kk;
 end loop;
 perform t.me('c'); perform public.aura_complete_identity('Test c','IN',true,''); reset role;
 insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) select u,gen_random_uuid(),'brand','Brand c','company' from t.ids where k='c';
 insert into aura_identity.membership select w.id,w.founder,'owner',true from aura_identity.workspace w where kind='brand';
 perform t.me('d'); perform public.aura_complete_identity('Test d','IN',true,''); reset role;
 insert into aura_identity.workspace(founder,request_id,kind,name) select u,gen_random_uuid(),'agency','Agency d' from t.ids where k='d';
 insert into aura_identity.membership select w.id,w.founder,'owner',true from aura_identity.workspace w where kind='agency';
 insert into t.ids(k,w) select 'wbrand',id from aura_identity.workspace where kind='brand'; insert into t.ids(k,w) select 'wagency',id from aura_identity.workspace where kind='agency';
 insert into aura_identity.membership select (select w from t.ids where k='a'),(select u from t.ids where k='e'),'member',true;
 perform t.activate('a'); perform t.activate('b');
 -- f begins M03 but never activates
 perform t.me('f'); perform public.aura_creator_begin(t.ws('f')); reset role;
end $$;
create function t.acts(n int) returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('rule_key','r'||i,'category','content','title','Action '||i,'detail','Detail','href','/creator/actions')) from generate_series(1,n) i $$;

-- 1. Anonymous and direct access denied
do $$ begin perform t.as_anon();
 assert t.denied('select public.aura_studio_context(gen_random_uuid())'), 'anon context';
 assert t.denied('select public.aura_studio_search(gen_random_uuid(),''ab'')'), 'anon search';
 assert t.denied('select * from aura_studio.idea'), 'anon table';
 reset role; perform t.pass('anonymous access denied (functions and tables)'); end $$;
do $$ begin perform t.me('a');
 assert t.denied('select * from aura_studio.daily_action'), 'direct select';
 assert t.denied('insert into aura_studio.idea(workspace_id,request_id,title) values (gen_random_uuid(),gen_random_uuid(),''x'')'), 'direct insert';
 assert t.denied('update aura_studio.dashboard_pref set gamification_enabled=false'), 'direct update';
 assert t.denied('select aura_studio.own(gen_random_uuid())'), 'private helper';
 reset role; perform t.pass('authenticated direct table and private-function access denied'); end $$;

-- 2. Onboarding incomplete, wrong workspace, Brand, Agency, non-owner, cross-creator
do $$ begin perform t.me('f');
 assert t.denied(format('select public.aura_studio_context(%L)', t.ws('f')), '55000'), 'inactive context';
 assert t.denied(format('select public.aura_studio_ensure_actions(%L,%L)', t.ws('f'), t.acts(3)), '55000'), 'inactive ensure';
 assert t.denied(format('select public.aura_studio_search(%L,''ab'')', t.ws('f')), '55000'), 'inactive search';
 reset role; perform t.pass('dashboard operations rejected until Creator onboarding is activated (incomplete-onboarding redirect source)'); end $$;
do $$ begin perform t.me('b');
 assert t.denied(format('select public.aura_studio_context(%L)', t.ws('a'))), 'b reads a context';
 assert t.denied(format('select public.aura_studio_ensure_actions(%L,%L)', t.ws('a'), t.acts(3))), 'b writes a';
 assert t.denied(format('select public.aura_studio_search(%L,''ab'')', t.ws('a'))), 'b searches a';
 assert t.denied(format('select public.aura_studio_ideas(%L)', t.ws('a'))), 'b ideas of a';
 assert t.denied(format('select public.aura_studio_observations(%L)', t.ws('a'))), 'b observations of a';
 assert t.denied(format('select public.aura_studio_weekly(%L)', t.ws('a'))), 'b weekly of a';
 assert t.denied(format('select public.aura_studio_events(%L)', t.ws('a'))), 'b events of a';
 assert t.denied('select public.aura_studio_context(gen_random_uuid())'), 'random workspace';
 assert t.denied('select public.aura_studio_context(null)'), 'null workspace';
 reset role; perform t.pass('cross-creator and manipulated workspace identifiers denied on every function');
 perform t.me('c'); assert t.denied(format('select public.aura_studio_context(%L)', t.ws('a'))), 'brand'; assert t.denied(format('select public.aura_studio_context(%L)', t.ws('wbrand'))), 'brand own ws';
 reset role; perform t.pass('Brand workspace members denied');
 perform t.me('d'); assert t.denied(format('select public.aura_studio_context(%L)', t.ws('a'))), 'agency'; assert t.denied(format('select public.aura_studio_search(%L,''ab'')', t.ws('wagency'))), 'agency own ws';
 reset role; perform t.pass('Agency workspace members denied');
 perform t.me('e'); assert t.denied(format('select public.aura_studio_set_prefs(%L,''{}'',true,false,''UTC'')', t.ws('a'))), 'non-owner prefs'; assert t.denied(format('select public.aura_studio_ensure_actions(%L,%L)', t.ws('a'), t.acts(3))), 'non-owner';
 reset role; perform t.pass('non-owner workspace member cannot read or write Creator Studio data'); end $$;

-- 3. Preferences, walkthrough, reset
do $$ declare p jsonb; begin perform t.me('a');
 p := public.aura_studio_context(t.ws('a'));
 assert p->>'timezone' = 'Asia/Kolkata' and (p->'hidden_widgets') = '[]' and (p->>'gamification_enabled')::boolean and p->>'walkthrough_status' = 'not_seen' and not (p->>'digest_opt_in')::boolean, 'defaults';
 p := public.aura_studio_set_prefs(t.ws('a'), array['commercial','weekly'], true, true, 'America/New_York');
 assert p->'hidden_widgets' = '["commercial","weekly"]' and p->>'timezone' = 'America/New_York' and (p->>'digest_opt_in')::boolean, 'saved';
 assert public.aura_studio_context(t.ws('a'))->'hidden_widgets' = '["commercial","weekly"]', 'persisted on re-read';
 assert t.denied(format('select public.aura_studio_set_prefs(%L,%L,true,false,''UTC'')', t.ws('a'), '{security_notice}'), '23514'), 'unknown widget';
 assert t.denied(format('select public.aura_studio_set_prefs(%L,''{}'',true,false,''Mars/Olympus'')', t.ws('a')), '22023'), 'bad timezone';
 p := public.aura_studio_walkthrough(t.ws('a'), 'dismissed'); assert p->>'walkthrough_status' = 'dismissed' and p->>'walkthrough_at' is not null, 'dismissed';
 p := public.aura_studio_walkthrough(t.ws('a'), 'completed'); assert p->>'walkthrough_status' = 'completed', 'completed';
 p := public.aura_studio_walkthrough(t.ws('a'), 'not_seen'); assert p->>'walkthrough_status' = 'not_seen' and p->>'walkthrough_at' is null, 'replay resets';
 assert t.denied(format('select public.aura_studio_walkthrough(%L,''bogus'')', t.ws('a')), '22023'), 'bad walkthrough status';
 p := public.aura_studio_set_prefs(t.ws('a'), '{}', true, false, 'Asia/Kolkata'); assert p->'hidden_widgets' = '[]' and p->>'timezone' = 'Asia/Kolkata', 'reset to defaults';
 reset role;
 perform t.me('b'); assert public.aura_studio_context(t.ws('b'))->'hidden_widgets' = '[]', 'preferences are per workspace and user';
 reset role; perform t.pass('widget preferences persist, validate, reset to defaults and stay per workspace; walkthrough is skippable and repeatable'); end $$;

-- 4. Daily actions: idempotent, bounded, persisted, plan-linked
do $$ declare r1 jsonb; r2 jsonb; planact uuid; foreign_act uuid; st jsonb; begin perform t.me('b');
 assert t.denied(format('select public.aura_studio_ensure_actions(%L,%L)', t.ws('b'), t.acts(2)), '22023'), 'too few';
 assert t.denied(format('select public.aura_studio_ensure_actions(%L,%L)', t.ws('b'), t.acts(6)), '22023'), 'too many';
 assert t.denied(format('select public.aura_studio_ensure_actions(%L,%L)', t.ws('b'), '{"a":1}'), '22023'), 'not an array';
 assert jsonb_array_length(public.aura_studio_actions(t.ws('b'))) = 0, 'failed generation leaves nothing';
 reset role;
 perform t.me('a'); planact := (public.aura_creator_state(t.ws('a'))->'plan'->'actions'->0->>'id')::uuid; reset role;
 perform t.me('b'); foreign_act := (public.aura_creator_state(t.ws('b'))->'plan'->'actions'->0->>'id')::uuid; reset role;
 perform t.me('a');
 r1 := public.aura_studio_ensure_actions(t.ws('a'), (select jsonb_agg(x) from (select jsonb_build_object('rule_key','plan','category','growth_plan','title','Pick themes','detail','d','href','/creator/dashboard','plan_action_id',planact) x union all select jsonb_build_object('rule_key','idea','category','content','title','Capture an idea','detail','d','href','/creator/create') union all select jsonb_build_object('rule_key','obs','category','observation','title','Record progress','detail','d','href','/creator/progress','dependency','M06') ) q));
 assert jsonb_array_length(r1) = 3, 'three actions';
 assert (select count(*) from jsonb_array_elements(r1) e where e->>'source'='growth_plan') = 1, 'plan-linked action';
 assert (select e->>'dependency' from jsonb_array_elements(r1) e where e->>'rule_key'='obs') = 'M06', 'dependency labelled';
 r2 := public.aura_studio_ensure_actions(t.ws('a'), t.acts(5));
 assert r2 = r1, 'second call returns the same persisted rows, nothing regenerated';
 reset role; assert (select count(*) from aura_studio.daily_action where workspace_id=t.ws('a')) = 3, 'still three rows';
 perform t.pass('three to five actions only; generation is idempotent and a failed generation leaves no partial rows');
 -- foreign plan action reference is dropped, not linked
 reset role; perform t.me('b');
 r1 := public.aura_studio_ensure_actions(t.ws('b'), (select jsonb_agg(x) from (select jsonb_build_object('rule_key','plan','category','growth_plan','title','x','detail','d','plan_action_id',planact) x union all select jsonb_build_object('rule_key','b','category','content','title','y','detail','d') union all select jsonb_build_object('rule_key','c','category','content','title','z','detail','d')) q));
 assert (select count(*) from jsonb_array_elements(r1) e where e->>'plan_action_id' is not null) = 0, 'another workspace plan action is never linked';
 reset role; perform t.pass('plan action from another workspace cannot be linked'); end $$;

do $$ declare acts jsonb; id1 uuid; pln uuid; r jsonb; t1 timestamptz; begin perform t.me('a');
 acts := public.aura_studio_actions(t.ws('a')); id1 := (select (e->>'id')::uuid from jsonb_array_elements(acts) e where e->>'rule_key'='plan'); pln := (select (e->>'plan_action_id')::uuid from jsonb_array_elements(acts) e where e->>'rule_key'='plan');
 r := public.aura_studio_set_action(t.ws('a'), id1, 'completed'); assert (select e->>'status' from jsonb_array_elements(r) e where e->>'id'=id1::text) = 'completed' and (select e->>'status_at' from jsonb_array_elements(r) e where e->>'id'=id1::text) is not null, 'completed with timestamp';
 reset role; assert (select status from aura_creator.growth_action where id=pln) = 'done', 'M03 plan action marked done'; select status_at into t1 from aura_studio.daily_action where id=id1; perform t.me('a');
 perform public.aura_studio_set_action(t.ws('a'), id1, 'completed'); reset role;
 assert (select status_at from aura_studio.daily_action where id=id1) = t1, 'repeat submit does not rewrite completion time'; perform t.me('a');
 perform public.aura_studio_set_action(t.ws('a'), id1, 'pending'); reset role;
 assert (select status from aura_creator.growth_action where id=pln) = 'todo', 'undo reverts plan action'; perform t.me('a');
 r := public.aura_studio_set_action(t.ws('a'), id1, 'deferred'); assert (select e->>'status' from jsonb_array_elements(r) e where e->>'id'=id1::text) = 'deferred', 'deferred';
 r := public.aura_studio_set_action(t.ws('a'), id1, 'skipped'); assert (select e->>'status' from jsonb_array_elements(r) e where e->>'id'=id1::text) = 'skipped', 'skipped';
 assert t.denied(format('select public.aura_studio_set_action(%L,%L,''bogus'')', t.ws('a'), id1), '22023'), 'invalid status';
 perform public.aura_studio_set_action(t.ws('a'), id1, 'completed');
 reset role; perform t.me('b');
 assert t.denied(format('select public.aura_studio_set_action(%L,%L,''completed'')', t.ws('b'), id1)), 'other creators action';
 reset role; perform t.pass('action states persist; completion is timestamped once; plan-linked completion updates the M03 plan; other creators cannot change actions'); end $$;

-- 5. Goal observations: history, zero vs unknown, validation, survives goal edits
do $$ declare o jsonb; o2 jsonb; list jsonb; rid uuid := gen_random_uuid(); begin perform t.me('a');
 assert jsonb_array_length(public.aura_studio_observations(t.ws('a'))) = 0, 'unknown until recorded: no rows, not zero';
 o := public.aura_studio_record_observation(t.ws('a'), rid, 'audience_growth','follower_count', 0, current_date - 3, 'starting out');
 assert (o->>'value')::numeric = 0 and o->>'source' = 'self_reported', 'a recorded zero is a real value labelled self-reported';
 o2 := public.aura_studio_record_observation(t.ws('a'), rid, 'audience_growth','follower_count', 999, current_date, null);
 assert o2->>'id' = o->>'id' and (o2->>'value')::numeric = 0, 'duplicate request id returns the original';
 perform public.aura_studio_record_observation(t.ws('a'), gen_random_uuid(), 'audience_growth','follower_count', 25, current_date, null);
 list := public.aura_studio_observations(t.ws('a')); assert jsonb_array_length(list) = 2, 'history retained, not replaced';
 assert t.denied(format('select public.aura_studio_record_observation(%L,gen_random_uuid(),''audience_growth'',''follower_count'',5,current_date+3,null)', t.ws('a')), '22007'), 'future date';
 assert t.denied(format('select public.aura_studio_record_observation(%L,gen_random_uuid(),''audience_growth'',''follower_count'',-1,current_date,null)', t.ws('a')), '23514'), 'negative';
 assert t.denied(format('select public.aura_studio_record_observation(%L,gen_random_uuid(),''monetization'',''monthly_income'',5,current_date,null)', t.ws('a')), '22023'), 'no such goal';
 assert t.denied(format('select public.aura_studio_record_observation(%L,gen_random_uuid(),''consistency'',''posts_per_week'',5,current_date,null)', t.ws('a')), '22023'), 'goal without a measure';
 reset role; perform t.me('b'); assert jsonb_array_length(public.aura_studio_observations(t.ws('b'))) = 0, 'other creators see nothing';
 assert t.denied(format('select public.aura_studio_record_observation(%L,gen_random_uuid(),''audience_growth'',''follower_count'',5,current_date,null)', t.ws('a'))), 'cross-creator observation';
 reset role; perform t.me('a');
 perform public.aura_creator_save_section(t.ws('a'),'goals','{"goals":[{"category":"audience_growth","metric":"follower_count","baseline_kind":"self_reported","baseline_value":40,"target_value":900,"timeframe_days":60}]}',t.rev('a'));
 assert jsonb_array_length(public.aura_studio_observations(t.ws('a'))) = 2, 'editing goals in M03 never erases observation history';
 reset role; perform t.pass('observations: append-only history, known zero kept distinct from unknown, validated, duplicate-safe, survive M03 goal edits'); end $$;

-- 6. Ideas and search isolation
do $$ declare i jsonb; i2 jsonb; rid uuid := gen_random_uuid(); s jsonb; begin perform t.me('a');
 i := public.aura_studio_capture_idea(t.ws('a'), rid, 'Zebra reels', 'about 100% striped_stuff');
 i2 := public.aura_studio_capture_idea(t.ws('a'), rid, 'Different title', null); assert i2->>'id' = i->>'id' and i2->>'title' = 'Zebra reels', 'idempotent capture';
 assert t.denied(format('select public.aura_studio_capture_idea(%L,gen_random_uuid(),''   '',null)', t.ws('a')), '23514'), 'blank title';
 assert (public.aura_studio_ideas(t.ws('a'))->>'total')::int = 1, 'one idea';
 s := public.aura_studio_search(t.ws('a'), 'zebra'); assert jsonb_array_length(s) = 1 and s->0->>'type' = 'idea', 'finds own idea';
 s := public.aura_studio_search(t.ws('a'), 'pick themes'); assert exists(select 1 from jsonb_array_elements(s) e where e->>'type' in ('plan','action')), 'finds own plan and action text';
 assert jsonb_array_length(public.aura_studio_search(t.ws('a'), '%%')) = 0, 'wildcard characters are literal';
 assert jsonb_array_length(public.aura_studio_search(t.ws('a'), '00% s')) = 1, 'literal percent matches';
 assert jsonb_array_length(public.aura_studio_search(t.ws('a'), 'striped_s')) = 1 and jsonb_array_length(public.aura_studio_search(t.ws('a'), 'striped-s')) = 0, 'underscore is literal';
 assert t.denied(format('select public.aura_studio_search(%L,''a'')', t.ws('a')), '22023'), 'short query';
 reset role; perform t.me('b');
 assert public.aura_studio_search(t.ws('b'), 'zebra') = '[]'::jsonb, 'other tenants records are not retrievable and produce no count';
 assert public.aura_studio_search(t.ws('b'), 'pick themes') <> '[]'::jsonb and not exists(select 1 from jsonb_array_elements(public.aura_studio_search(t.ws('b'), 'zebra')) ), 'own results only';
 assert (public.aura_studio_ideas(t.ws('b'))->>'total')::int = 0, 'idea totals are not shared';
 reset role; perform t.pass('search and ideas are strictly own-workspace: no foreign records, counts or snippets; wildcards are escaped'); end $$;

-- 7. Milestones, streaks and the gamification switch
do $$ declare m jsonb; act_b timestamptz; begin select activated_at into act_b from aura_creator.creator_profile where workspace_id=t.ws('b'); perform t.me('a'); m := public.aura_studio_milestones(t.ws('a'));
 assert (m->>'enabled')::boolean, 'enabled';
 assert (select count(*) from jsonb_array_elements(m->'milestones')) = 4, 'four real milestones from real activity';
 assert (m->'streak'->>'current')::int = 1 and (m->'streak'->>'longest')::int = 1, 'streak from one genuinely completed day';
 reset role; assert (select achieved_at from aura_studio.milestone_event where workspace_id=t.ws('a') and code='onboarding_complete') = (select activated_at from aura_creator.creator_profile where workspace_id=t.ws('a')), 'milestone time is the real event time'; perform t.me('a');
 reset role; perform t.me('b'); assert (public.aura_studio_milestones(t.ws('b'))->'milestones') = jsonb_build_array(jsonb_build_object('code','onboarding_complete','achieved_at',act_b)), 'only what actually happened';
 assert (public.aura_studio_milestones(t.ws('b'))->'streak'->>'current')::int = 0, 'no activity, no streak';
 perform public.aura_studio_set_prefs(t.ws('b'), '{}', false, false, 'Asia/Kolkata'); m := public.aura_studio_milestones(t.ws('b'));
 assert not (m->>'enabled')::boolean and m->'streak' = 'null'::jsonb and m->'milestones' = '[]'::jsonb, 'disabled returns nothing';
 reset role; perform t.pass('milestones are first-time real events at their true time; streak counts only genuine completions; gamification can be disabled'); end $$;
do $$ declare m jsonb; aid uuid; begin
 -- Fixture manipulation (superuser): craft consecutive and broken completion days for the streak definition.
 delete from aura_studio.daily_action where workspace_id=t.ws('b');
 insert into aura_studio.daily_action(workspace_id,local_date,rule_key,category,title,detail,status,status_at)
  select t.ws('b'), (now() at time zone 'Asia/Kolkata')::date - d, 'k'||d, 'content','T','D','completed', now() - (d||' days')::interval from unnest(array[0,1,2,4]) d;
 perform t.me('b'); perform public.aura_studio_set_prefs(t.ws('b'), '{}', true, false, 'Asia/Kolkata'); m := public.aura_studio_milestones(t.ws('b'));
 assert (m->'streak'->>'current')::int = 3 and (m->'streak'->>'longest')::int = 3, 'three consecutive days then a gap';
 reset role; update aura_studio.daily_action set status_at = status_at - interval '10 days' where workspace_id=t.ws('b'); perform t.me('b'); m := public.aura_studio_milestones(t.ws('b'));
 assert (m->'streak'->>'current')::int = 0 and (m->'streak'->>'longest')::int >= 3, 'streak lapses without penalty text and longest is kept';
 reset role; perform t.pass('streak definition verified across a gap and a lapse'); end $$;

-- 8. Weekly reviews: periods, idempotency, evidence
do $$ declare w jsonb; w2 jsonb; n int; cur date; begin
 -- Fixture manipulation (superuser): backdate activation and craft activity in two earlier weeks for workspace b.
 cur := date_trunc('week', (now() at time zone 'Asia/Kolkata')::date)::date;
 update aura_creator.creator_profile set activated_at = ((cur - 13)::timestamp at time zone 'Asia/Kolkata') + interval '9 hours' where workspace_id=t.ws('b');
 delete from aura_studio.daily_action where workspace_id=t.ws('b');
 insert into aura_studio.daily_action(workspace_id,local_date,rule_key,category,title,detail,status,status_at) values
  (t.ws('b'), cur - 8, 'x1','content','A','D','completed', ((cur - 8)::timestamp + interval '10 hours') at time zone 'Asia/Kolkata'),
  (t.ws('b'), cur - 8, 'x2','content','B','D','skipped', ((cur - 8)::timestamp + interval '11 hours') at time zone 'Asia/Kolkata'),
  (t.ws('b'), cur - 7, 'edge_sun','content','Sunday late','D','completed', ((cur - 1)::timestamp + interval '23 hours 30 minutes') at time zone 'Asia/Kolkata'),
  (t.ws('b'), cur - 1, 'edge_mon','content','Monday early','D','completed', ((cur)::timestamp + interval '30 minutes') at time zone 'Asia/Kolkata');
 perform t.me('b'); w := public.aura_studio_weekly(t.ws('b'));
 assert jsonb_array_length(w->'reviews') = 2, 'two closed weeks since activation (' || jsonb_array_length(w->'reviews') || ')';
 assert (w->'reviews'->0->>'week_start')::date = cur - 7 and (w->'reviews'->1->>'week_start')::date = cur - 14, 'stable Monday weeks';
 assert (w->'reviews'->1->'summary'->'actions'->>'completed')::int = 1 and (w->'reviews'->1->'summary'->'actions'->>'skipped')::int = 1, 'week one evidence';
 assert (w->'reviews'->0->'summary'->'actions'->>'completed')::int = 1, 'Sunday 23:30 local belongs to the earlier week, so Monday 00:30 is not double counted';
 assert (w->'current'->'actions'->>'completed')::int = 1, 'Monday 00:30 local counts in the current week';
 assert not (w->'reviews'->1->'summary'->>'evidence_sufficient')::boolean = false, 'sufficient where evidence exists';
 assert w->>'digest_delivery' = 'unavailable', 'no delivery is claimed';
 w2 := public.aura_studio_weekly(t.ws('b')); reset role;
 select count(*) into n from aura_studio.weekly_review where workspace_id=t.ws('b'); assert n = 2, 'regeneration creates no duplicates';
 assert w2->'reviews' = w->'reviews', 'stable on re-read';
 perform t.me('b'); assert not exists(select 1 from jsonb_array_elements(w->'reviews') e where e->'summary' ? 'growth_percent' or e->'summary' ? 'percent'), 'no invented percentages';
 reset role; perform t.pass('weekly reviews: stable periods, local-time boundaries, no double counting, idempotent, no invented percentages, no delivery claim'); end $$;
do $$ declare w jsonb; begin perform t.me('a'); w := public.aura_studio_weekly(t.ws('a'));
 assert jsonb_array_length(w->'reviews') = 0, 'a workspace activated this week has no closed week yet';
 assert (w->'current'->'actions'->>'completed')::int >= 1 and (w->'current'->>'ideas')::int = 1 and (w->'current'->>'observations')::int = 2, 'current week reflects real records';
 assert (w->'current'->>'profile_updates')::int >= 1, 'profile improvements come from real M03 audit events';
 reset role;
 update aura_creator.creator_profile set activated_at = now() - interval '40 days' where workspace_id=t.ws('a');
 perform t.me('a'); w := public.aura_studio_weekly(t.ws('a')); reset role;
 assert exists(select 1 from jsonb_array_elements(w->'reviews') e where not (e->'summary'->>'evidence_sufficient')::boolean), 'empty weeks are stored as insufficient evidence, not invented';
 perform t.pass('weeks without evidence are marked insufficient; current week uses real records'); end $$;

-- 9. Events are scoped to the caller
do $$ declare e jsonb; begin
 insert into aura_identity.event(user_id,event) select u,'sentinel_a' from t.ids where k='a'; insert into aura_identity.event(user_id,event) select u,'sentinel_b' from t.ids where k='b';
 perform t.me('a'); e := public.aura_studio_events(t.ws('a'));
 assert exists(select 1 from jsonb_array_elements(e) x where x->>'event'='sentinel_a') and not exists(select 1 from jsonb_array_elements(e) x where x->>'event'='sentinel_b'), 'a sees only its own events';
 assert jsonb_array_length(e) <= 15, 'capped';
 reset role; perform t.me('b'); e := public.aura_studio_events(t.ws('b'));
 assert exists(select 1 from jsonb_array_elements(e) x where x->>'event'='sentinel_b') and not exists(select 1 from jsonb_array_elements(e) x where x->>'event'='sentinel_a'), 'b sees only its own events';
 reset role; perform t.pass('notification events are scoped to the caller and capped'); end $$;
\echo ---RESULTS---
select name from t.results order by name;
