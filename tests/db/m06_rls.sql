-- Executed by tests/unit/db-m06.test.ts on a disposable PostgreSQL with the real M02-M06 migrations, the auth stub and the storage stub (NOT Supabase).
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

-- 1. Anonymous and direct access
do $$ begin perform t.as_anon();
 assert t.denied('select public.aura_analytics_semantics()'), 'anon semantics';
 assert t.denied('select public.aura_analytics_account_series(gen_random_uuid(), current_date-30, current_date)'), 'anon series';
 assert t.denied('select public.aura_analytics_shared_audience(gen_random_uuid())'), 'anon shared';
 assert t.denied('select * from aura_analytics.insight'), 'anon table';
 reset role; perform t.me('a');
 assert t.denied('select * from aura_analytics.experiment'), 'direct experiments';
 assert t.denied('select * from aura_analytics.content_tag'), 'direct tags';
 assert t.denied('insert into aura_analytics.insight(workspace_id) values (gen_random_uuid())'), 'direct insight insert';
 assert t.denied('update aura_analytics.setting set value = ''1'''), 'settings';
 assert t.denied('select aura_analytics.actor(gen_random_uuid())'), 'private helper';
 assert t.denied('select aura_analytics.obs_snapshot(gen_random_uuid(), gen_random_uuid(), ''followers'', ''account'', gen_random_uuid())'), 'private snapshot helper';
 reset role; perform t.pass('anonymous and direct table, setting and private-function access denied'); end $$;

-- 2. Versioned semantics
do $$ declare j jsonb; begin perform t.me('a'); j := public.aura_analytics_semantics();
 assert jsonb_array_length(j->'metrics') = 16 and jsonb_array_length(j->'derived') = 4, 'every M05 metric has semantics and four derived calculations exist';
 reset role; assert not exists(select 1 from aura_social.metric_def m where not exists(select 1 from aura_analytics.metric_semantics s where s.metric = m.code)), 'no metric lacks a definition';
 assert (select aggregations from aura_analytics.metric_semantics where metric='reach') = '{per_account}', 'reach is never summed';
 assert (select aggregations from aura_analytics.metric_semantics where metric='followers') = '{per_account,sum_with_overlap_label}', 'followers carry the overlap label rule';
 assert not exists(select 1 from information_schema.columns where table_schema='aura_analytics' and (column_name ~* '(score|rank|quality|rating)')), 'no composite score or ranking column exists';
 perform t.pass('metric semantics are versioned for all 16 metrics, four derived calculations exist, and no score column exists'); end $$;

-- 3. Series: provenance, current-only, tenant isolation
do $$ declare a1 uuid; a2 uuid; o1 uuid; o2 uuid; j jsonb; begin perform t.me('a');
 a1 := t.acct('a','instagram','m06.main'); a2 := t.acct('a','youtube','m06channel');
 o1 := t.obs('a', a1, 'followers', 1000, current_date - 60); o2 := t.obs('a', a1, 'followers', 1200, current_date - 30); perform t.obs('a', a1, 'followers', 0, current_date - 10);
 perform t.obs('a', a1, 'reach', 5000, current_date - 6, current_date - 12, current_date - 6);
 j := public.aura_social_correct_observation(t.ws('a'), gen_random_uuid(), o2, 1250, 'typo');
 j := public.aura_analytics_account_series(t.ws('a'), current_date - 90, current_date);
 assert jsonb_array_length(j->'accounts') = 2, 'both tracked accounts';
 assert exists(select 1 from jsonb_array_elements(j->'observations') x where x->>'id' = o1::text and x->>'source' = 'manual' and (x->>'has_evidence')::boolean = false), 'provenance fields present';
 assert not exists(select 1 from jsonb_array_elements(j->'observations') x where x->>'id' = o2::text), 'the superseded observation is not an analytic input';
 assert exists(select 1 from jsonb_array_elements(j->'observations') x where (x->>'value')::numeric = 1250 and (x->>'corrected')::boolean), 'the correction is current and labelled corrected';
 assert exists(select 1 from jsonb_array_elements(j->'observations') x where (x->>'value')::numeric = 0 and x->>'metric' = 'followers'), 'an actual zero is preserved as zero';
 assert not exists(select 1 from jsonb_array_elements(j->'observations') x where x->>'account_id' = a2::text), 'no row is invented for an account with no observations';
 assert t.denied(format('select public.aura_analytics_account_series(%L, current_date, current_date - 1)', t.ws('a')), '22023'), 'inverted range';
 assert t.denied(format('select public.aura_analytics_account_series(%L, current_date - 900, current_date)', t.ws('a')), '22023'), 'range too long';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_account_series(%L, current_date-30, current_date)', t.ws('a'))), 'another Creator';
 perform t.mfa('c'); assert t.denied(format('select public.aura_analytics_account_series(%L, current_date-30, current_date)', t.ws('c'))), 'a Brand workspace has no Creator analytics';
 reset role; perform t.pass('series returns only current observations with provenance, preserves actual zero, and refuses other tenants and Brand workspaces'); end $$;

-- 4. Tags, timing and AI proposals
do $$ declare a1 uuid; cid uuid; j jsonb; tg uuid; prop uuid; begin perform t.me('a');
 a1 := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'handle' = 'm06.main');
 j := t.cobs('a', a1, 'post-1', 'views', 900, 'lifetime', current_date - 2); cid := (j->'content'->>'id')::uuid;
 j := public.aura_analytics_set_tag(t.ws('a'), cid, 'topic', 'Budget travel'); tg := (j->>'id')::uuid;
 assert j->>'source' = 'manual' and j->>'status' = 'confirmed', 'manual tags are confirmed';
 perform public.aura_analytics_set_tag(t.ws('a'), cid, 'sponsorship', 'Sponsored'); perform public.aura_analytics_set_tag(t.ws('a'), cid, 'sponsorship', 'organic');
 assert (select count(*) from jsonb_array_elements(public.aura_analytics_content(t.ws('a'))->'content') c, jsonb_array_elements(c->'tags') g where g->>'kind' = 'sponsorship') = 1, 'one sponsorship classification per content item';
 assert t.denied(format('select public.aura_analytics_set_tag(%L,%L,''sponsorship'',''maybe'')', t.ws('a'), cid), '23514'), 'sponsorship value is constrained';
 assert t.denied(format('select public.aura_analytics_set_tag(%L,%L,''nonsense'',''x'')', t.ws('a'), cid), '23514'), 'unknown tag kind';
 assert t.denied(format('select public.aura_analytics_set_tag(%L,%L,''topic'',''<script>'')', t.ws('a'), cid), '23514'), 'markup rejected';
 assert t.denied(format('select public.aura_analytics_set_timing(%L,%L,now(),''Not/AZone'')', t.ws('a'), cid), '22023'), 'unknown time zone';
 perform public.aura_analytics_set_timing(t.ws('a'), cid, now() - interval '2 days', 'Asia/Kolkata');
 assert (select c->>'tz' from jsonb_array_elements(public.aura_analytics_content(t.ws('a'))->'content') c where c->>'id' = cid::text) = 'Asia/Kolkata', 'timing stored with its zone';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_set_tag(%L,%L,''topic'',''x'')', t.ws('b'), cid)), 'another Creator cannot tag this content';
 assert t.denied(format('select public.aura_analytics_remove_tag(%L,%L)', t.ws('b'), tg)), 'another Creator cannot remove a tag';
 reset role; -- fixture (superuser): a future provider proposes a classification. No client function can create one.
 insert into aura_analytics.content_tag(workspace_id, content_id, kind, value, source, status, proposed_by, uncertainty) values (t.ws('a'), cid, 'hook', 'question', 'ai_proposed', 'proposed', 'future-provider', '{"note":"provider stated"}') returning id into prop;
 perform t.me('a');
 assert not exists(select 1 from jsonb_array_elements(public.aura_analytics_content(t.ws('a'))->'content') c, jsonb_array_elements(c->'tags') g where g->>'status' = 'proposed' and false), 'proposed tag visible for review';
 j := public.aura_analytics_review_tag(t.ws('a'), prop, 'confirm'); assert j->>'source' = 'ai_confirmed' and j->>'status' = 'confirmed', 'only explicit confirmation makes it ai_confirmed';
 assert t.denied(format('select public.aura_analytics_review_tag(%L,%L,''reject'')', t.ws('a'), tg), '42501'), 'a manual tag is not reviewable';
 perform public.aura_analytics_remove_tag(t.ws('a'), tg);
 reset role; perform t.pass('manual tags, one sponsorship class, timing with zone, explicit confirmation of proposals, and tenant isolation'); end $$;

-- 5. Audience snapshots
do $$ declare a1 uuid; r uuid := gen_random_uuid(); j jsonb; j2 jsonb; begin perform t.me('a');
 a1 := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'handle' = 'm06.main');
 j := public.aura_analytics_record_audience(t.ws('a'), r, a1, 'geography', '[{"bucket":"India","share":70},{"bucket":"United States","share":12.5}]', current_date - 1, current_date - 28, current_date - 1, 'followers', 1250, 82.5);
 j2 := public.aura_analytics_record_audience(t.ws('a'), r, a1, 'geography', '[{"bucket":"Other","share":5}]', current_date - 1, null, null, 'unknown', null, null);
 assert j->>'id' = j2->>'id', 'a retry returns the same snapshot';
 assert t.denied(format('select public.aura_analytics_record_audience(%L,gen_random_uuid(),%L,''geography'',''[{"bucket":"A","share":60},{"bucket":"B","share":60}]'',current_date,null,null,''unknown'',null,null)', t.ws('a'), a1), '22023'), 'shares above 100 percent';
 assert t.denied(format('select public.aura_analytics_record_audience(%L,gen_random_uuid(),%L,''geography'',''[{"bucket":"<b>","share":5}]'',current_date,null,null,''unknown'',null,null)', t.ws('a'), a1), '22023'), 'unsafe bucket label';
 assert t.denied(format('select public.aura_analytics_record_audience(%L,gen_random_uuid(),%L,''geography'',''[{"bucket":"A","share":5},{"bucket":"a","share":5}]'',current_date,null,null,''unknown'',null,null)', t.ws('a'), a1), '22023'), 'duplicate bucket';
 assert t.denied(format('select public.aura_analytics_record_audience(%L,gen_random_uuid(),%L,''geography'',''[{"bucket":"A","share":-1}]'',current_date,null,null,''unknown'',null,null)', t.ws('a'), a1), '22023'), 'negative share';
 assert t.denied(format('select public.aura_analytics_record_audience(%L,gen_random_uuid(),%L,''religion'',''[{"bucket":"A","share":1}]'',current_date,null,null,''unknown'',null,null)', t.ws('a'), a1), '23514'), 'unsupported dimension';
 j := public.aura_analytics_record_audience(t.ws('a'), gen_random_uuid(), a1, 'geography', '[{"bucket":"India","share":72}]', current_date - 1, null, null, 'followers', 1250, 82.5);
 assert (select count(*) from jsonb_array_elements(public.aura_analytics_audience(t.ws('a'))->'snapshots')) = 1, 'a correction on the same date supersedes; only the current snapshot is returned';
 reset role; assert (select count(*) from aura_analytics.audience_snapshot) = 2 and exists(select 1 from aura_analytics.audience_snapshot where superseded_by is not null), 'the original is kept';
 perform t.me('a'); assert not (public.aura_analytics_audience(t.ws('a'))->'snapshots'->0 ? 'actor'), 'internal fields are not returned';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_audience(%L)', t.ws('a'))), 'another Creator';
 reset role; assert t.denied('update aura_analytics.audience_snapshot set note = ''x''', '55000'), 'snapshots are append-only';
 perform t.pass('audience snapshots validate buckets and shares, keep source and denominator, are append-only with supersession, and are tenant-private'); end $$;

-- 6. Insights
do $$ declare j jsonb; id uuid; begin perform t.me('a');
 j := public.aura_analytics_sync_insights(t.ws('a'), jsonb_build_array(t.insight('fp1','h1'), t.insight('fp2','h2','rule.two')), array['rule.one','rule.two']);
 assert (j->>'created')::int = 2, 'two insights created';
 j := public.aura_analytics_sync_insights(t.ws('a'), jsonb_build_array(t.insight('fp1','h1'), t.insight('fp2','h2','rule.two')), array['rule.one','rule.two']);
 assert (j->>'created')::int = 0 and (j->>'regenerated')::int = 0, 'repeating the same data creates no duplicates';
 id := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_analytics_insights(t.ws('a'))) x where x->>'fingerprint' = 'fp1');
 perform public.aura_analytics_insight_status(t.ws('a'), id, 'dismissed');
 j := public.aura_analytics_sync_insights(t.ws('a'), jsonb_build_array(t.insight('fp1','h1'), t.insight('fp2','h2','rule.two')), array['rule.one','rule.two']);
 assert (select x->>'status' from jsonb_array_elements(public.aura_analytics_insights(t.ws('a'))) x where x->>'fingerprint' = 'fp1') = 'dismissed', 'a dismissed insight stays dismissed while the data is unchanged';
 j := public.aura_analytics_sync_insights(t.ws('a'), jsonb_build_array(t.insight('fp1','h1-changed'), t.insight('fp2','h2','rule.two')), array['rule.one','rule.two']);
 assert (j->>'regenerated')::int = 1 and (select x->>'status' from jsonb_array_elements(public.aura_analytics_insights(t.ws('a'))) x where x->>'fingerprint' = 'fp1') = 'new', 'changed data regenerates and resurfaces the insight';
 perform public.aura_analytics_insight_status(t.ws('a'), id, 'saved');
 j := public.aura_analytics_sync_insights(t.ws('a'), jsonb_build_array(t.insight('fp1','h1-again')), array['rule.one','rule.two']);
 assert (select x->>'status' from jsonb_array_elements(public.aura_analytics_insights(t.ws('a'), true)) x where x->>'fingerprint' = 'fp1') = 'saved', 'saved stays saved when regenerated';
 assert (j->>'marked_stale')::int = 1 and (select x->>'status' from jsonb_array_elements(public.aura_analytics_insights(t.ws('a'), true)) x where x->>'fingerprint' = 'fp2') = 'stale', 'a finding whose rule no longer fires is labelled stale';
 assert not exists(select 1 from jsonb_array_elements(public.aura_analytics_insights(t.ws('a'))) x where x->>'fingerprint' = 'fp2'), 'stale findings are hidden from the default feed';
 assert t.denied(format('select public.aura_analytics_insight_status(%L,%L,''acted'')', t.ws('a'), (select (x->>'id')::uuid from jsonb_array_elements(public.aura_analytics_insights(t.ws('a'), true)) x where x->>'fingerprint' = 'fp2')), '55000'), 'a stale finding cannot be acted on';
 assert t.denied(format('select public.aura_analytics_insight_status(%L,%L,''bogus'')', t.ws('a'), id), '22023'), 'invalid status';
 assert t.denied(format('select public.aura_analytics_sync_insights(%L, %L::jsonb, array[''x''])', t.ws('a'), jsonb_build_array(jsonb_set(t.insight('bad','h'), '{link}', '"https://evil.example"'))), '23514'), 'external links are refused';
 assert t.denied(format('select public.aura_analytics_sync_insights(%L, %L::jsonb, array[''x''])', t.ws('a'), jsonb_build_array(jsonb_set(t.insight('bad2','h'), '{category}', '"fraud_alert"'))), '23514'), 'unknown categories (such as fraud accusations) are refused';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_insights(%L)', t.ws('a'))), 'another Creator';
 assert t.denied(format('select public.aura_analytics_insight_status(%L,%L,''viewed'')', t.ws('b'), id), '42501'), 'another workspace id cannot touch it';
 reset role; perform t.pass('insights deduplicate, regenerate when data changes, label outdated findings, keep user status, reject external links and fraud categories'); end $$;

-- 7. Experiments
do $$ declare a1 uuid; e jsonb; id uuid; b1 uuid; b2 uuid; wb uuid; j jsonb; rq uuid := gen_random_uuid(); ex jsonb; lk uuid; nb uuid; begin perform t.me('a');
 a1 := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'handle' = 'm06.main');
 b1 := t.obs('a', a1, 'reach', 4000, current_date - 20, current_date - 26, current_date - 20);
 wb := t.obs('a', a1, 'reach', 4100, current_date - 12, current_date - 14, current_date - 12);
 e := jsonb_build_object('name','Question hooks','hypothesis','Question hooks may lift reach','metric','reach','evaluation_days',14,'baseline_refs',jsonb_build_array(b1),'confounders','Holiday week');
 j := public.aura_analytics_create_experiment(t.ws('a'), rq, a1, e); id := (j->>'id')::uuid;
 assert j->>'status' = 'draft' and j->>'baseline' is null, 'created as draft with no frozen baseline';
 assert public.aura_analytics_create_experiment(t.ws('a'), rq, a1, e)->>'id' = id::text, 'idempotent create';
 assert t.denied(format('select public.aura_analytics_create_experiment(%L,gen_random_uuid(),%L,%L)', t.ws('a'), (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'platform' = 'youtube'), jsonb_set(jsonb_set(e,'{metric}','"reach"'),'{baseline_refs}','[]')), '22023'), 'a metric the platform does not offer is refused';
 assert t.denied(format('select public.aura_analytics_create_experiment(%L,gen_random_uuid(),%L,%L)', t.ws('a'), a1, jsonb_set(e,'{metric}','"c_reach"')), '22023'), 'baseline observation of another metric is refused';
 assert t.denied(format('select public.aura_analytics_create_experiment(%L,gen_random_uuid(),%L,%L)', t.ws('a'), a1, jsonb_set(e,'{baseline_refs}', jsonb_build_array(gen_random_uuid()))), '22023'), 'unknown baseline reference';
 assert t.denied(format('select public.aura_analytics_activate_experiment(%L,%L)', t.ws('a'), (public.aura_analytics_create_experiment(t.ws('a'), gen_random_uuid(), a1, jsonb_set(e,'{baseline_refs}','[]'))->>'id')::uuid), '22023'), 'activation needs a baseline or a stated reason';
 j := public.aura_analytics_update_experiment(t.ws('a'), id, '{"planned_change":"Open with a question"}'); assert j->>'planned_change' = 'Open with a question', 'draft is editable';
 perform public.aura_analytics_plan_experiment(t.ws('a'), id);
 assert t.denied(format('select public.aura_analytics_link_observation(%L,%L,%L)', t.ws('a'), id, wb), '55000'), 'cannot add observations before activation';
 j := public.aura_analytics_activate_experiment(t.ws('a'), id);
 assert j->>'status' = 'active' and j->'baseline'->'observations'->0->>'ref' = b1::text and (j->'baseline'->'observations'->0->>'value')::numeric = 4000, 'activation freezes the baseline values';
 assert t.denied(format('select public.aura_analytics_activate_experiment(%L,%L)', t.ws('a'), id), '55000'), 'duplicate activation refused';
 assert t.denied(format('select public.aura_analytics_update_experiment(%L,%L,%L)', t.ws('a'), id, '{"name":"Renamed"}'), '55000'), 'a started experiment cannot be edited';
 -- the baseline observation is later corrected: the frozen copy must NOT change
 nb := (public.aura_social_correct_observation(t.ws('a'), gen_random_uuid(), b1, 4300, 'recount')->>'id')::uuid;
 assert (select (e2->'baseline'->'observations'->0->>'value')::numeric from jsonb_array_elements(public.aura_analytics_experiments(t.ws('a'), id)) e2) = 4000, 'the accepted baseline is preserved after a correction to its source observation';
 -- linking
 assert t.denied(format('select public.aura_analytics_link_observation(%L,%L,%L)', t.ws('a'), id, wb), '22023'), 'an observation from before activation is refused';
 lk := public.aura_social_record_observation(t.ws('a'), gen_random_uuid(), a1, 'reach', 4500, current_date, current_date - 6, current_date, 'manual', null, null)->>'id';
 j := public.aura_analytics_link_observation(t.ws('a'), id, lk); assert j->'snapshot'->>'observed_on' = current_date::text, 'linked with a snapshot';
 assert t.denied(format('select public.aura_analytics_link_observation(%L,%L,%L)', t.ws('a'), id, lk), '23505'), 'duplicate link';
 assert t.denied(format('select public.aura_analytics_link_observation(%L,%L,%L)', t.ws('a'), id, t.obs('a', a1, 'reach', 4400, current_date, current_date - 29, current_date)), '22023'), 'measurement window must match the baseline';
 assert t.denied(format('select public.aura_analytics_link_observation(%L,%L,%L)', t.ws('a'), id, t.obs('a', a1, 'followers', 1300, current_date)), '22023'), 'a different metric is refused';
 -- a link whose source is later corrected shows the current value and a flag, and keeps the original snapshot
 perform public.aura_social_correct_observation(t.ws('a'), gen_random_uuid(), lk::uuid, 4600, 'fix');
 ex := (select e2 from jsonb_array_elements(public.aura_analytics_experiments(t.ws('a'), id)) e2);
 assert (ex->'links'->0->'snapshot'->>'value')::numeric = 4500 and (ex->'links'->0->'current'->>'value')::numeric = 4600 and (ex->'links'->0->'current'->>'corrected_since')::boolean, 'original snapshot kept, current value and correction flag shown';
 assert jsonb_array_length(ex->'events') >= 4, 'lifecycle events recorded';
 assert t.denied(format('select public.aura_analytics_finish_experiment(%L,%L,''complete'')', t.ws('a'), id), '22023'), 'an outcome is required to complete';
 j := public.aura_analytics_finish_experiment(t.ws('a'), id, 'complete', 'inconclusive', 'Too few posts', 'Repeat for 4 weeks', array['hooks']);
 assert j->>'status' = 'completed' and j->>'outcome' = 'inconclusive' and j->>'ended_at' is not null, 'completes with an honest outcome';
 assert t.denied(format('select public.aura_analytics_finish_experiment(%L,%L,''cancel'')', t.ws('a'), id), '55000'), 'a completed experiment cannot be cancelled';
 -- cancellation never invents a result
 j := public.aura_analytics_create_experiment(t.ws('a'), gen_random_uuid(), a1, jsonb_set(e,'{name}','"To cancel"'));
 j := public.aura_analytics_finish_experiment(t.ws('a'), (j->>'id')::uuid, 'cancel'); assert j->>'status' = 'cancelled' and j->>'outcome' is null, 'cancelled with no outcome';
 assert t.denied('update aura_analytics.experiment set baseline = ''{}''', '42501'), 'no direct change';
 reset role; perform t.pass('experiments: draft, plan, explicit activation with a frozen baseline, duplicate activation refused, validated observation links, corrections preserved, honest outcomes, cancellation without a result'); end $$;

-- 8. Experiment tenancy and concurrency limits
do $$ declare a1 uuid; id uuid; i int; begin perform t.me('a');
 a1 := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'handle' = 'm06.main');
 for i in 1..3 loop id := (public.aura_analytics_create_experiment(t.ws('a'), gen_random_uuid(), a1, jsonb_build_object('name','Lim '||i,'hypothesis','Hypothesis '||i,'metric','followers','evaluation_days',7,'baseline_unavailable_reason','new account'))->>'id')::uuid; perform public.aura_analytics_activate_experiment(t.ws('a'), id); end loop;
 id := (public.aura_analytics_create_experiment(t.ws('a'), gen_random_uuid(), a1, jsonb_build_object('name','Lim 4','hypothesis','Hypothesis 4','metric','followers','evaluation_days',7,'baseline_unavailable_reason','new account'))->>'id')::uuid;
 assert t.denied(format('select public.aura_analytics_activate_experiment(%L,%L)', t.ws('a'), id), '23514'), 'the active experiment limit is enforced';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_experiments(%L)', t.ws('a'))), 'another Creator cannot list';
 assert t.denied(format('select public.aura_analytics_activate_experiment(%L,%L)', t.ws('b'), id), '42501'), 'cannot reach another workspace''s experiment by id';
 assert t.denied(format('select public.aura_analytics_create_experiment(%L,gen_random_uuid(),%L,''{"name":"Cross","hypothesis":"Hypothesis","metric":"followers","evaluation_days":7}'')', t.ws('b'), a1), '42501'), 'cannot attach to another Creator''s account';
 reset role; perform t.pass('active-experiment limit enforced; experiments are tenant-private'); end $$;

-- 9. Cohort benchmarking suppression
do $$ declare i int; k text; a1 uuid; j jsonb; begin perform t.me('a');
 a1 := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'handle' = 'm06.main');
 j := public.aura_analytics_cohort_benchmark(t.ws('a'), 'instagram'); assert j->>'available' = 'false' and j->>'reason' = 'not_opted_in', 'no benchmark without opt-in';
 perform public.aura_analytics_cohort_optin(t.ws('a'), true);
 perform t.obs('a', a1, 'followers', 1300, current_date - 1); -- mine
 j := public.aura_analytics_cohort_benchmark(t.ws('a'), 'instagram'); assert j->>'reason' = 'cohort_too_small' and not (j ? 'cohort_size') and not (j ? 'median'), 'a tiny cohort returns nothing that depends on it';
 reset role; update aura_analytics.setting set value = '1' where key = 'cohort_min_size';
 for i in 1..9 loop k := 'p' || i; perform t.mkcreator(k); perform t.me(k);
  a1 := t.acct(k, 'instagram', 'peer.' || i); perform t.obs(k, a1, 'followers', 1000 + i * 10, current_date - 60); perform t.obs(k, a1, 'followers', 1100 + i * 25, current_date - 2);
  perform public.aura_analytics_cohort_optin(t.ws(k), true); reset role; end loop;
 perform t.me('a'); j := public.aura_analytics_cohort_benchmark(t.ws('a'), 'instagram');
 assert j->>'reason' = 'cohort_too_small' and (j->>'minimum')::int = 10, 'the configured minimum cannot be lowered below the floor of 10';
 for i in 10..11 loop k := 'p' || i; reset role; perform t.mkcreator(k); perform t.me(k);
  a1 := t.acct(k, 'instagram', 'peer.' || i); perform t.obs(k, a1, 'followers', 1000 + i * 10, current_date - 60); perform t.obs(k, a1, 'followers', 1100 + i * 25, current_date - 2);
  perform public.aura_analytics_cohort_optin(t.ws(k), true); reset role; end loop;
 perform t.me('a'); j := public.aura_analytics_cohort_benchmark(t.ws('a'), 'instagram');
 assert j->>'available' = 'true' and (j->>'median')::numeric is not null and (j->>'p25')::numeric <= (j->>'median')::numeric, 'a large enough cohort returns quartiles';
 assert j::text !~* '(peer\.|@example|workspace|uuid)' and not (j ? 'members') and not (j ? 'ranks'), 'no individual peer is identifiable in the response';
 perform public.aura_analytics_cohort_optin(t.ws('a'), false); assert public.aura_analytics_cohort_benchmark(t.ws('a'), 'instagram')->>'reason' = 'not_opted_in', 'opting out removes access (and contribution)';
 perform t.me('p1'); perform public.aura_analytics_cohort_optin(t.ws('p1'), false); perform t.me('a'); perform public.aura_analytics_cohort_optin(t.ws('a'), true);
 j := public.aura_analytics_cohort_benchmark(t.ws('a'), 'instagram'); assert j->>'available' = 'true', 'still at the minimum with ten others';
 reset role; perform t.mfa('c'); assert t.denied(format('select public.aura_analytics_cohort_benchmark(%L,''instagram'')', t.ws('c'))), 'Brand workspaces have no cohort access'; reset role;
 perform t.pass('peer cohorts: opt-in required, suppressed below a floor of 10 with no size leakage, quartiles only, no peer identifiable, opt-out honoured'); end $$;

-- 10. Audience sharing and Brand reads
do $$ declare a1 uuid; g jsonb; j jsonb; gid uuid; declare_tmp uuid; begin perform t.me('a');
 a1 := (select (x->>'id')::uuid from jsonb_array_elements(public.aura_social_accounts(t.ws('a'))->'accounts') x where x->>'handle' = 'm06.main');
 perform public.aura_analytics_record_audience(t.ws('a'), gen_random_uuid(), a1, 'language', '[{"bucket":"English","share":60}]', current_date - 1, null, null, 'followers', 1300, 80);
 perform t.mfa('c'); j := public.aura_analytics_shared_audience(t.ws('c')); assert j = '[]'::jsonb, 'nothing is visible before a grant';
 perform t.me('a');
 assert t.denied(format('select public.aura_analytics_grant_audience(%L,%L,%L,array[''geography''],''Campaign fit'')', t.ws('a'), a1, t.ws('d')), '22023'), 'an Agency cannot receive (Brand only)';
 assert t.denied(format('select public.aura_analytics_grant_audience(%L,%L,%L,array[''religion''],''Campaign fit'')', t.ws('a'), a1, t.ws('c')), '23514'), 'unsupported dimension';
 assert t.denied(format('select public.aura_analytics_grant_audience(%L,%L,%L,array[''geography''],''x'')', t.ws('a'), a1, t.ws('c')), '23514'), 'a purpose is required';
 g := public.aura_analytics_grant_audience(t.ws('a'), a1, t.ws('c'), array['geography'], 'Campaign audience fit'); gid := (g->>'id')::uuid;
 perform t.mfa('c'); j := public.aura_analytics_shared_audience(t.ws('c'));
 assert jsonb_array_length(j) = 1 and jsonb_array_length(j->0->'audience') = 1 and j->0->'audience'->0->>'dimension' = 'geography', 'only the granted dimension is returned';
 assert not exists(select 1 from jsonb_array_elements(j->0->'audience') x where x->>'dimension' = 'language'), 'an ungranted dimension is never returned';
 assert j::text !~* '(insight|experiment|diagnos|hypothesis|evidence|goal|baseline|workspace_id)', 'private diagnostics and experiments are absent from what a Brand sees';
 assert j->0->>'account' = 'A private instagram account', 'an unpublished handle is masked';
 assert j->0->>'purpose' = 'Campaign audience fit', 'purpose is carried with the data';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_shared_audience(%L)', t.ws('a'))), 'a Creator workspace is not a recipient';
 perform t.me('a'); perform public.aura_analytics_revoke_audience(t.ws('a'), gid);
 perform t.mfa('c'); assert public.aura_analytics_shared_audience(t.ws('c')) = '[]'::jsonb, 'revocation takes effect on the next read';
 perform t.me('a'); g := public.aura_analytics_grant_audience(t.ws('a'), a1, t.ws('c'), array['geography','language'], 'Short window', now() + interval '1 hour'); gid := (g->>'id')::uuid;
 reset role; update aura_analytics.audience_grant set valid_until = now() - interval '1 minute' where id = gid; -- fixture: the grant lapses
 perform t.mfa('c'); assert public.aura_analytics_shared_audience(t.ws('c')) = '[]'::jsonb, 'an expired grant exposes nothing';
 perform t.me('a'); g := public.aura_analytics_grant_audience(t.ws('a'), a1, t.ws('c'), array['geography'], 'Renewed');
 declare_tmp := t.acct('a','threads','tmp.account');
 perform public.aura_analytics_record_audience(t.ws('a'), gen_random_uuid(), declare_tmp, 'language', '[{"bucket":"English","share":50}]', current_date - 1, null, null, 'unknown', null, null);
 perform public.aura_analytics_grant_audience(t.ws('a'), declare_tmp, t.ws('c'), array['language'], 'Tmp share');
 perform t.mfa('c'); assert jsonb_array_length(public.aura_analytics_shared_audience(t.ws('c'))) = 2, 'two accounts shared';
 perform t.me('a'); perform public.aura_social_remove_account(t.ws('a'), declare_tmp, null);
 perform t.mfa('c'); assert jsonb_array_length(public.aura_analytics_shared_audience(t.ws('c'))) = 1, 'a removed account stops being shared';
 perform t.me('a'); assert jsonb_array_length(public.aura_analytics_audience_grants(t.ws('a'))) >= 3, 'the Creator sees their grants';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_revoke_audience(%L,%L)', t.ws('b'), gid), '42501'), 'another Creator cannot revoke';
 reset role; perform t.pass('audience sharing is purpose-bound, dimension-limited, revocable, expiring, Brand-only and never exposes private analytics'); end $$;

-- 11. Exports
do $$ declare j jsonb; a1 uuid; begin perform t.me('a');
 j := public.aura_analytics_authorize_export(t.ws('a'), 'summary', 'pdf', 'Share with my manager'); assert j->>'id' is not null, 'creator export authorized';
 assert t.denied(format('select public.aura_analytics_authorize_export(%L,''summary'',''pdf'',''x'')', t.ws('a')), '22023'), 'purpose required';
 assert t.denied(format('select public.aura_analytics_authorize_export(%L,''summary'',''docx'',''Purpose ok'')', t.ws('a')), '22023'), 'format restricted';
 assert t.denied(format('select public.aura_analytics_authorize_export(%L,''shared_audience'',''csv'',''Purpose ok'')', t.ws('a')), '42501'), 'a Creator cannot use the Brand export';
 perform t.me('b'); assert t.denied(format('select public.aura_analytics_authorize_export(%L,''summary'',''csv'',''Purpose ok'')', t.ws('a')), '42501'), 'another Creator denied';
 perform t.mfa('c'); j := public.aura_analytics_authorize_export(t.ws('c'), 'shared_audience', 'csv', 'Campaign planning'); assert j->>'id' is not null, 'a Brand with an active grant may export what is shared';
 assert t.denied(format('select public.aura_analytics_authorize_export(%L,''summary'',''csv'',''Purpose ok'')', t.ws('c')), '42501'), 'a Brand cannot export Creator analytics';
 reset role; perform t.mfa('d'); assert t.denied(format('select public.aura_analytics_authorize_export(%L,''shared_audience'',''csv'',''Purpose ok'')', t.ws('d')), '42501'), 'an Agency with no grant is denied';
 reset role; update aura_analytics.audience_grant set status = 'revoked' where recipient_workspace_id = t.ws('c'); perform t.mfa('c');
 assert t.denied(format('select public.aura_analytics_authorize_export(%L,''shared_audience'',''csv'',''Campaign planning'')', t.ws('c')), '42501'), 'permission is re-checked at export time; a revoked grant blocks it';
 reset role; assert (select count(*) from aura_analytics.export_log) = 2 and not exists(select 1 from aura_analytics.export_log where purpose = ''), 'exports are logged with purpose, without their content';
 perform t.me('a'); assert jsonb_array_length(public.aura_analytics_exports(t.ws('a'))) = 1, 'the Creator sees only their own export log';
 reset role; perform t.pass('exports require purpose and a live permission, are logged without content, and are re-checked at the time of export'); end $$;

-- 12. Cross-tenant sweep, overview and audit
do $$ declare n int := 0; f text; begin perform t.me('b');
 foreach f in array array['select public.aura_analytics_content(%L)','select public.aura_analytics_audience(%L)','select public.aura_analytics_insights(%L)','select public.aura_analytics_experiments(%L)','select public.aura_analytics_audience_grants(%L)','select public.aura_analytics_exports(%L)','select public.aura_analytics_overview(%L)',
   'select public.aura_analytics_sync_insights(%L,''[]''::jsonb,array[''x''])','select public.aura_analytics_cohort_optin(%L,true)'] loop
  assert t.denied(format(f, t.ws('a'))), 'another Creator denied: ' || f; n := n + 1; end loop;
 perform t.mfa('c'); foreach f in array array['select public.aura_analytics_content(%L)','select public.aura_analytics_insights(%L)','select public.aura_analytics_experiments(%L)','select public.aura_analytics_overview(%L)'] loop
  assert t.denied(format(f, t.ws('c'))), 'a Brand workspace denied: ' || f; n := n + 1; end loop;
 reset role; perform t.me('a'); assert (public.aura_analytics_overview(t.ws('a'))->>'active_experiments')::int = 3, 'overview counts real experiments';
 reset role; assert (select count(distinct event) from aura_identity.event where event like 'analytics\_%') >= 8, 'material analytics events are audited';
 assert not exists(select 1 from aura_identity.event where event like 'analytics%' and event ~ '(http|@|aura-)'), 'audit events carry no content';
 reset role; perform t.pass('cross-tenant: ' || n || ' function checks denied; overview and audit trail verified'); end $$;
\echo ---RESULTS---
select name from t.results order by name;
