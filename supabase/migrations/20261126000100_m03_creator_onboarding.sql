-- M03 Creator onboarding. Additive; depends on M02 (aura_identity schema, functions actor/eligible).
-- Ownership: aura_creator.* is owned by M03. social_account is a foundation table that M05 extends
-- (verification, provenance, analytics) rather than replaces. No table is directly granted to
-- anon/authenticated; every operation goes through the SECURITY DEFINER functions at the end,
-- each of which re-validates the session, workspace membership, ownership and workspace kind.
begin;
create schema aura_creator;
revoke all on schema aura_creator from public, anon, authenticated;

-- Reference taxonomies (maintainable; FK targets). The TypeScript taxonomy is test-checked against these seeds.
create table aura_creator.niche_ref (code text primary key, label text not null, active boolean not null default true);
create table aura_creator.industry_ref (code text primary key, label text not null, active boolean not null default true);
create table aura_creator.challenge_ref (code text primary key, label text not null, active boolean not null default true);
insert into aura_creator.niche_ref(code,label) values
 ('fashion','Fashion'),('beauty_skincare','Beauty and skincare'),('fitness','Fitness'),('food','Food'),('travel','Travel'),
 ('technology','Technology'),('education','Education'),('finance','Finance'),('gaming','Gaming'),('entertainment','Entertainment'),
 ('lifestyle','Lifestyle'),('photography','Photography'),('personal_development','Personal development'),
 ('business','Business and entrepreneurship'),('art_design','Art and design'),('other','Other'),('custom','Custom');
insert into aura_creator.industry_ref(code,label) values
 ('fashion_apparel','Fashion and apparel'),('beauty_personal_care','Beauty and personal care'),('food_beverage','Food and beverage'),
 ('health_wellness','Health and wellness'),('fitness_sports','Fitness and sports'),('travel_hospitality','Travel and hospitality'),
 ('technology_apps','Technology and apps'),('education_edtech','Education and edtech'),('finance_fintech','Finance and fintech'),
 ('gaming','Gaming'),('entertainment_media','Entertainment and media'),('home_living','Home and living'),
 ('automotive','Automotive'),('alcohol','Alcohol'),('tobacco_vaping','Tobacco and vaping'),('gambling_betting','Gambling and betting'),
 ('cryptocurrency','Cryptocurrency'),('political','Political'),('adult','Adult'),('other','Other');
insert into aura_creator.challenge_ref(code,label) values
 ('content_ideas','Finding content ideas'),('choosing_niche','Selecting a niche'),('scripts_captions','Writing scripts and captions'),
 ('hooks','Creating engaging hooks'),('consistency','Maintaining consistency'),('analytics','Understanding analytics'),
 ('content_quality','Improving content quality'),('engagement','Improving audience engagement'),('confidence','Building confidence'),
 ('time','Managing available time'),('finding_brands','Finding Brand collaborations'),('negotiation','Negotiating compensation'),
 ('commercial_workflow','Understanding commercial workflows'),('portfolio','Building a portfolio'),('monetization','Monetizing content'),('other','Something else');

create table aura_creator.creator_profile (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 display_name text check (length(trim(display_name)) between 1 and 80),
 country text check (country ~ '^[A-Z]{2}$'),
 city text check (length(city) <= 80),
 language text check (language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
 bio text check (length(bio) <= 280),
 stage text check (stage in ('aspiring','emerging','growing','established','ugc_focused')),
 niche_exploring boolean not null default false,
 prior_collaboration text check (prior_collaboration in ('none','some','regular')),
 restrictions text check (length(restrictions) <= 300),
 visibility text not null default 'private' check (visibility = 'private'), -- M09 owns publication and may widen this constraint.
 activated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table aura_creator.onboarding_state (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 revision integer not null default 0,
 current_step text not null default 'identity' check (current_step in ('identity','social','niche','goals','challenges','preferences','rates','resources','review')),
 steps jsonb not null default '{}'::jsonb,
 activation_request uuid,
 ai_assisted boolean not null default false check (not ai_assisted), -- M07 may relax once a real provider exists.
 updated_at timestamptz not null default now()
);
create table aura_creator.niche (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 key text not null, role text not null check (role in ('primary','secondary','interest')),
 code text not null references aura_creator.niche_ref, custom_label text check (length(trim(custom_label)) between 1 and 60),
 primary key (workspace_id, key), check ((code in ('custom','other')) = (custom_label is not null))
);
create unique index one_primary_niche on aura_creator.niche(workspace_id) where role='primary';
create table aura_creator.social_account (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 platform text not null check (platform in ('instagram','youtube','facebook','linkedin','threads','other')),
 handle text not null check (handle ~ '^[A-Za-z0-9._-]{1,60}$'),
 profile_url text check (profile_url ~ '^https://[^/\s@]+(/[^\s]*)?$' and length(profile_url) <= 300),
 account_type text check (account_type is null or (account_type in ('personal','creator','business') and platform = 'instagram')),
 ownership_scope text not null default 'individual' check (ownership_scope in ('individual','brand_or_company')),
 visibility text not null default 'unknown' check (visibility in ('public','private','unknown')),
 self_reported_followers integer check (self_reported_followers between 0 and 2000000000),
 observed_on date check (observed_on <= current_date),
 is_primary boolean not null default false,
 provenance text not null default 'self_reported' check (provenance = 'self_reported'),
 verification text not null default 'unverified' check (verification = 'unverified'), -- M05 owns verification states.
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((self_reported_followers is null) = (observed_on is null))
);
create unique index social_unique on aura_creator.social_account(workspace_id, platform, lower(handle));
create unique index social_one_primary on aura_creator.social_account(workspace_id) where is_primary;
create function aura_creator.limit_social() returns trigger language plpgsql set search_path='' as $$
begin if (select count(*) from aura_creator.social_account where workspace_id=new.workspace_id) >= 10 then
 raise exception 'Social account limit reached' using errcode='23514'; end if; return new; end $$;
create trigger social_limit before insert on aura_creator.social_account for each row execute function aura_creator.limit_social();
create table aura_creator.goal (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 category text not null check (category in ('audience_growth','engagement','consistency','content_quality','personal_brand','professional_profile','brand_collaborations','ugc','monetization','skill_development')),
 metric text check (metric in ('follower_count','engagement_rate','posts_per_week','posts_per_month','monthly_income')),
 baseline_kind text not null default 'unknown' check (baseline_kind in ('observed','self_reported','unknown')),
 baseline_value numeric check (baseline_value >= 0), target_value numeric check (target_value >= 0),
 currency text check (currency ~ '^[A-Z]{3}$'),
 timeframe_days integer check (timeframe_days between 7 and 730),
 details text check (length(details) <= 300),
 check ((baseline_kind = 'unknown') = (baseline_value is null)),
 check (metric is not null or (baseline_value is null and target_value is null)),
 check (currency is null or metric = 'monthly_income')
);
create unique index goal_unique on aura_creator.goal(workspace_id, category, coalesce(metric,''));
create table aura_creator.challenge (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 code text not null references aura_creator.challenge_ref, detail text check (length(detail) <= 300),
 primary key (workspace_id, code)
);
create table aura_creator.resource_assessment (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 hours_per_week numeric(5,1) check (hours_per_week between 0 and 168),
 posts_per_week integer check (posts_per_week between 0 and 50),
 equipment text[] not null default '{}' check (equipment <@ array['smartphone','camera','microphone','lighting','editing_tools','production_support']),
 budget_minor bigint check (budget_minor between 0 and 100000000000), budget_currency text check (budget_currency ~ '^[A-Z]{3}$'),
 check ((budget_minor is null) = (budget_currency is null))
);
create table aura_creator.collaboration_preference (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 category text not null check (category in ('paid_influencer','ugc','barter','affiliate','ambassador','event')),
 interested boolean not null, primary key (workspace_id, category)
);
create table aura_creator.industry_preference (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 industry text not null references aura_creator.industry_ref, stance text not null check (stance in ('preferred','considering')),
 primary key (workspace_id, industry)
);
create table aura_creator.industry_exclusion (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 industry text not null references aura_creator.industry_ref, note text check (length(note) <= 200),
 primary key (workspace_id, industry)
);
create function aura_creator.exclusion_wins() returns trigger language plpgsql set search_path='' as $$
begin if exists(select 1 from aura_creator.industry_exclusion where workspace_id=new.workspace_id and industry=new.industry) then
 raise exception 'Industry is excluded' using errcode='23514'; end if; return new; end $$;
create trigger preference_respects_exclusion before insert or update on aura_creator.industry_preference for each row execute function aura_creator.exclusion_wins();
create table aura_creator.rate_preference (
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 format text not null check (format in ('short_video','long_video','static_post','story','carousel','ugc_video','product_photography','other')),
 amount_minor bigint check (amount_minor between 0 and 100000000000), currency text not null check (currency ~ '^[A-Z]{3}$'),
 negotiable boolean not null default true, unsure boolean not null default false,
 primary key (workspace_id, format), check (not unsure or amount_minor is null)
);
create table aura_creator.growth_plan (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 version integer not null, label text not null default 'rule_based_initial_guidance' check (label = 'rule_based_initial_guidance'),
 basis jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique (workspace_id, version)
);
create table aura_creator.growth_action (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references aura_creator.growth_plan on delete cascade,
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 position integer not null check (position between 1 and 14), day integer not null check (day between 1 and 7),
 title text not null check (length(title) between 1 and 120), detail text not null check (length(detail) <= 300),
 status text not null default 'todo' check (status in ('todo','done')), unique (plan_id, position)
);
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='aura_creator' loop
  execute format('alter table aura_creator.%I enable row level security', t); end loop; end $$;
-- Default-deny: no policies and no grants. Only the SECURITY DEFINER functions below touch these tables.

create function aura_creator.own(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin
 if p_workspace is null or not exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id
  where m.workspace_id=p_workspace and m.user_id=u and m.active and m.role='owner' and w.kind='creator'
  and (case when p_write then w.status='open' else w.status<>'suspended' end))
 then raise exception 'Access denied' using errcode='42501'; end if;
 return u;
end $$;

create function aura_creator.state_json(p_workspace uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'workspace_id', p_workspace,
  'profile', (select to_jsonb(p) - 'workspace_id' from aura_creator.creator_profile p where p.workspace_id=p_workspace),
  'onboarding', (select jsonb_build_object('revision',s.revision,'current_step',s.current_step,'steps',s.steps,'ai_assisted',s.ai_assisted) from aura_creator.onboarding_state s where s.workspace_id=p_workspace),
  'niches', (select coalesce(jsonb_agg(jsonb_build_object('role',role,'code',code,'custom_label',custom_label) order by role,code),'[]') from aura_creator.niche where workspace_id=p_workspace),
  'social_accounts', (select coalesce(jsonb_agg(to_jsonb(a) - 'workspace_id' order by a.created_at,a.id),'[]') from aura_creator.social_account a where workspace_id=p_workspace),
  'goals', (select coalesce(jsonb_agg(to_jsonb(g) - 'workspace_id' order by g.category,g.metric),'[]') from aura_creator.goal g where workspace_id=p_workspace),
  'challenges', (select coalesce(jsonb_agg(jsonb_build_object('code',code,'detail',detail) order by code),'[]') from aura_creator.challenge where workspace_id=p_workspace),
  'resources', (select to_jsonb(r) - 'workspace_id' from aura_creator.resource_assessment r where workspace_id=p_workspace),
  'collaborations', (select coalesce(jsonb_agg(jsonb_build_object('category',category,'interested',interested) order by category),'[]') from aura_creator.collaboration_preference where workspace_id=p_workspace),
  'industry_preferences', (select coalesce(jsonb_agg(jsonb_build_object('industry',industry,'stance',stance) order by industry),'[]') from aura_creator.industry_preference where workspace_id=p_workspace),
  'industry_exclusions', (select coalesce(jsonb_agg(jsonb_build_object('industry',industry,'note',note) order by industry),'[]') from aura_creator.industry_exclusion where workspace_id=p_workspace),
  'rates', (select coalesce(jsonb_agg(to_jsonb(r) - 'workspace_id' order by format),'[]') from aura_creator.rate_preference r where workspace_id=p_workspace),
  'plan', (select jsonb_build_object('id',g.id,'version',g.version,'label',g.label,'basis',g.basis,'created_at',g.created_at,
     'actions',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'position',a.position,'day',a.day,'title',a.title,'detail',a.detail,'status',a.status) order by a.position),'[]') from aura_creator.growth_action a where a.plan_id=g.id))
     from aura_creator.growth_plan g where g.workspace_id=p_workspace order by g.version desc limit 1)
 ) $$;

-- Ensures the profile/state rows exist and records entry into onboarding. Idempotent.
create function public.aura_creator_begin(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, true);
begin
 insert into aura_creator.creator_profile(workspace_id) values(p_workspace) on conflict do nothing;
 insert into aura_creator.onboarding_state(workspace_id) values(p_workspace) on conflict do nothing;
 update aura_identity.workspace set onboarding='in_progress', next_step='profile' where id=p_workspace and onboarding='not_started';
 return aura_creator.state_json(p_workspace);
end $$;

create function public.aura_creator_state(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, false);
begin return aura_creator.state_json(p_workspace); end $$;

-- Saves one section atomically under optimistic concurrency. Marks the step completed. Replace-set semantics for lists.
create function public.aura_creator_save_section(p_workspace uuid, p_section text, p_payload jsonb, p_revision integer, p_next text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, true); st aura_creator.onboarding_state; r jsonb; n int;
begin
 if p_section not in ('identity','social','niche','goals','challenges','preferences','rates','resources') or jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid section' using errcode='22023'; end if;
 select * into st from aura_creator.onboarding_state where workspace_id=p_workspace for update;
 if st.workspace_id is null then raise exception 'Onboarding not started' using errcode='55000'; end if;
 if st.revision <> p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if p_section='identity' then
  update aura_creator.creator_profile set display_name=trim(p_payload->>'display_name'), country=p_payload->>'country', city=nullif(trim(p_payload->>'city'),''),
   language=p_payload->>'language', bio=nullif(trim(p_payload->>'bio'),''), stage=p_payload->>'stage', updated_at=now() where workspace_id=p_workspace;
 elsif p_section='social' then
  if coalesce((p_payload->>'none')::boolean,false) then delete from aura_creator.social_account where workspace_id=p_workspace;
  else
   r := coalesce(p_payload->'accounts','[]');
   if jsonb_array_length(r) > 10 then raise exception 'Social account limit reached' using errcode='23514'; end if;
   if (select count(*) from jsonb_to_recordset(r) as x(is_primary boolean) where x.is_primary) > 1 then raise exception 'Only one primary account' using errcode='23514'; end if;
   delete from aura_creator.social_account a where a.workspace_id=p_workspace and not exists(select 1 from jsonb_to_recordset(r) as x(platform text, handle text) where x.platform=a.platform and lower(x.handle)=lower(a.handle));
   update aura_creator.social_account set is_primary=false where workspace_id=p_workspace;
   insert into aura_creator.social_account(workspace_id,platform,handle,profile_url,account_type,ownership_scope,visibility,self_reported_followers,observed_on,is_primary)
    select p_workspace,x.platform,x.handle,nullif(x.profile_url,''),nullif(x.account_type,''),coalesce(nullif(x.ownership_scope,''),'individual'),coalesce(nullif(x.visibility,''),'unknown'),x.self_reported_followers,x.observed_on,coalesce(x.is_primary,false)
    from jsonb_to_recordset(r) as x(platform text,handle text,profile_url text,account_type text,ownership_scope text,visibility text,self_reported_followers integer,observed_on date,is_primary boolean)
    on conflict (workspace_id,platform,lower(handle)) do update set profile_url=excluded.profile_url, account_type=excluded.account_type, ownership_scope=excluded.ownership_scope,
     visibility=excluded.visibility, self_reported_followers=excluded.self_reported_followers, observed_on=excluded.observed_on, is_primary=excluded.is_primary, updated_at=now();
  end if;
 elsif p_section='niche' then
  delete from aura_creator.niche where workspace_id=p_workspace;
  update aura_creator.creator_profile set niche_exploring=coalesce((p_payload->>'exploring')::boolean,false), updated_at=now() where workspace_id=p_workspace;
  insert into aura_creator.niche(workspace_id,key,role,code,custom_label)
   select distinct on (z.key) p_workspace, z.key, z.role, z.code, z.label from (
    select x.code||':'||lower(coalesce(trim(x.custom_label),'')) as key, x.role, x.code, nullif(trim(x.custom_label),'') as label, x.o
    from (select 'primary' as role, v.code, v.custom_label, 0 as o from jsonb_to_recordset(case when jsonb_typeof(p_payload->'primary')='object' then jsonb_build_array(p_payload->'primary') else '[]'::jsonb end) as v(code text,custom_label text)
     union all select 'secondary', v.code, v.custom_label, 1 from jsonb_to_recordset(coalesce(p_payload->'secondary','[]')) as v(code text,custom_label text)
     union all select 'interest', v.code, v.custom_label, 2 from jsonb_to_recordset(coalesce(p_payload->'interests','[]')) as v(code text,custom_label text)) x) z
   order by z.key, z.o;
 elsif p_section='goals' then
  delete from aura_creator.goal where workspace_id=p_workspace;
  if exists(select 1 from jsonb_to_recordset(coalesce(p_payload->'goals','[]')) as x(baseline_kind text) where x.baseline_kind = 'observed') then raise exception 'Observed baselines come from analytics' using errcode='22023'; end if;
  insert into aura_creator.goal(workspace_id,category,metric,baseline_kind,baseline_value,target_value,currency,timeframe_days,details)
   select p_workspace,x.category,nullif(x.metric,''),coalesce(nullif(x.baseline_kind,''),'unknown'),x.baseline_value,x.target_value,nullif(x.currency,''),x.timeframe_days,nullif(trim(x.details),'')
   from jsonb_to_recordset(coalesce(p_payload->'goals','[]')) as x(category text,metric text,baseline_kind text,baseline_value numeric,target_value numeric,currency text,timeframe_days integer,details text);
 elsif p_section='challenges' then
  delete from aura_creator.challenge where workspace_id=p_workspace;
  insert into aura_creator.challenge(workspace_id,code,detail) select p_workspace,x.code,nullif(trim(x.detail),'') from jsonb_to_recordset(coalesce(p_payload->'challenges','[]')) as x(code text,detail text);
 elsif p_section='preferences' then
  delete from aura_creator.collaboration_preference where workspace_id=p_workspace;
  delete from aura_creator.industry_preference where workspace_id=p_workspace;
  delete from aura_creator.industry_exclusion where workspace_id=p_workspace;
  insert into aura_creator.collaboration_preference(workspace_id,category,interested) select p_workspace,x.category,x.interested from jsonb_to_recordset(coalesce(p_payload->'collaborations','[]')) as x(category text,interested boolean);
  insert into aura_creator.industry_exclusion(workspace_id,industry,note) select p_workspace,x.industry,nullif(trim(x.note),'') from jsonb_to_recordset(coalesce(p_payload->'exclusions','[]')) as x(industry text,note text);
  insert into aura_creator.industry_preference(workspace_id,industry,stance) select p_workspace,x.industry,x.stance from jsonb_to_recordset(coalesce(p_payload->'industries','[]')) as x(industry text,stance text);
  update aura_creator.creator_profile set prior_collaboration=nullif(p_payload->>'prior_collaboration',''), restrictions=nullif(trim(p_payload->>'restrictions'),''), updated_at=now() where workspace_id=p_workspace;
 elsif p_section='rates' then
  delete from aura_creator.rate_preference where workspace_id=p_workspace;
  insert into aura_creator.rate_preference(workspace_id,format,amount_minor,currency,negotiable,unsure)
   select p_workspace,x.format,x.amount_minor,coalesce(nullif(x.currency,''),'INR'),coalesce(x.negotiable,true),coalesce(x.unsure,false) from jsonb_to_recordset(coalesce(p_payload->'rates','[]')) as x(format text,amount_minor bigint,currency text,negotiable boolean,unsure boolean);
 elsif p_section='resources' then
  insert into aura_creator.resource_assessment(workspace_id,hours_per_week,posts_per_week,equipment,budget_minor,budget_currency)
   select p_workspace,x.hours_per_week,x.posts_per_week,coalesce(x.equipment,'{}'),x.budget_minor,case when x.budget_minor is null then null else coalesce(nullif(x.budget_currency,''),'INR') end
   from jsonb_to_record(p_payload) as x(hours_per_week numeric,posts_per_week integer,equipment text[],budget_minor bigint,budget_currency text)
   on conflict (workspace_id) do update set hours_per_week=excluded.hours_per_week,posts_per_week=excluded.posts_per_week,equipment=excluded.equipment,budget_minor=excluded.budget_minor,budget_currency=excluded.budget_currency;
 end if;
 update aura_creator.onboarding_state set revision=revision+1, steps=steps||jsonb_build_object(p_section,'completed'),
  current_step=coalesce(p_next,current_step), updated_at=now() where workspace_id=p_workspace;
 insert into aura_identity.event(user_id,event) values(u,'creator_section_saved:'||p_section);
 return aura_creator.state_json(p_workspace);
end $$;

create function public.aura_creator_skip_step(p_workspace uuid, p_step text, p_revision integer, p_next text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, true); st aura_creator.onboarding_state;
begin
 if p_step not in ('social','challenges','preferences','rates','resources') then raise exception 'This step is required' using errcode='22023'; end if;
 select * into st from aura_creator.onboarding_state where workspace_id=p_workspace for update;
 if st.workspace_id is null then raise exception 'Onboarding not started' using errcode='55000'; end if;
 if st.revision <> p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 update aura_creator.onboarding_state set revision=revision+1, steps=steps||jsonb_build_object(p_step,'skipped'), current_step=coalesce(p_next,current_step), updated_at=now() where workspace_id=p_workspace;
 return aura_creator.state_json(p_workspace);
end $$;

-- Authoritative activation. Idempotent; requires the minimal mandatory set; never publishes the profile.
create function public.aura_creator_activate(p_workspace uuid, p_request uuid, p_plan jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, true); st aura_creator.onboarding_state; pr aura_creator.creator_profile; pid uuid; missing text[] := '{}';
begin
 select * into st from aura_creator.onboarding_state where workspace_id=p_workspace for update;
 select * into pr from aura_creator.creator_profile where workspace_id=p_workspace;
 if st.workspace_id is null or pr.workspace_id is null then raise exception 'Onboarding not started' using errcode='55000'; end if;
 if pr.activated_at is not null then return aura_creator.state_json(p_workspace); end if;
 if p_request is null then raise exception 'Request id required' using errcode='22023'; end if;
 if pr.display_name is null or pr.country is null or pr.language is null or pr.stage is null then missing := array_append(missing,'identity'); end if;
 if not (pr.niche_exploring or exists(select 1 from aura_creator.niche where workspace_id=p_workspace and role='primary')) then missing := array_append(missing,'niche'); end if;
 if not exists(select 1 from aura_creator.goal where workspace_id=p_workspace) then missing := array_append(missing,'goals'); end if;
 if cardinality(missing) > 0 then raise exception 'Onboarding incomplete: %', array_to_string(missing, ',') using errcode='55000'; end if;
 if jsonb_typeof(p_plan->'actions') <> 'array' or jsonb_array_length(p_plan->'actions') not between 1 and 14 then raise exception 'Invalid plan' using errcode='22023'; end if;
 insert into aura_creator.growth_plan(workspace_id,version,basis) values(p_workspace,1,coalesce(p_plan->'basis','{}')) returning id into pid;
 insert into aura_creator.growth_action(plan_id,workspace_id,position,day,title,detail)
  select pid,p_workspace,o.ord::int,(o.a->>'day')::int,trim(o.a->>'title'),trim(o.a->>'detail') from jsonb_array_elements(p_plan->'actions') with ordinality as o(a,ord);
 update aura_creator.creator_profile set activated_at=now(), updated_at=now() where workspace_id=p_workspace;
 update aura_creator.onboarding_state set activation_request=p_request, revision=revision+1, steps=steps||'{"review":"completed"}', current_step='review', updated_at=now() where workspace_id=p_workspace;
 update aura_identity.workspace set onboarding='completed', next_step='dashboard' where id=p_workspace;
 insert into aura_identity.event(user_id,event) values(u,'creator_onboarding_activated');
 return aura_creator.state_json(p_workspace);
end $$;

create function public.aura_creator_set_action(p_workspace uuid, p_action uuid, p_done boolean) returns void language plpgsql security definer set search_path='' as $$
declare u uuid := aura_creator.own(p_workspace, true);
begin
 update aura_creator.growth_action set status=case when p_done then 'done' else 'todo' end where id=p_action and workspace_id=p_workspace;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('aura_creator_begin','aura_creator_state','aura_creator_save_section','aura_creator_skip_step','aura_creator_activate','aura_creator_set_action') loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop; end $$;
revoke all on all tables in schema aura_creator from public,anon,authenticated;
revoke all on all functions in schema aura_creator from public,anon,authenticated;
commit;
