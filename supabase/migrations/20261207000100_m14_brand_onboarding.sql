-- M14 Brand onboarding: business profile, catalogue, audiences, goals, guidelines, budget, Creator preferences, competitors,
-- Brand social accounts (manual, source-labelled), maturity, growth plans, and the business verification case workflow.
-- Replaces the M10 interim verification process with cases, evidence, information requests, rejection, resubmission, appeal and revalidation,
-- while keeping the same `aura_identity.workspace.verification` field that M10 and M11 gates read.
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_brand;
revoke all on schema aura_brand from public, anon, authenticated;

create table aura_brand.setting (key text primary key, value jsonb not null);
insert into aura_brand.setting(key, value) values
 ('max_social_accounts', '10'),           -- approved (M14-F24)
 ('max_products', '200'), ('max_segments', '20'), ('max_goals', '20'), ('max_competitors', '30'), ('max_plan_items', '60'),
 ('cases_per_day', '5'),                   -- NON-PRODUCTION defaults, owner approval pending
 ('appeal_days', '30');
-- Evidence required per business type (proposed document matrix; owner approval pending). Domain/website is supporting only (F33).
insert into aura_brand.setting(key, value) values ('evidence_matrix', '{
 "individual":      ["representative_name","id_document_type","id_document_last4","registered_address"],
 "sole_proprietor": ["legal_name","registration_number","representative_name","id_document_type","id_document_last4","registered_address"],
 "startup":         ["legal_name","registration_number","registered_address","representative_name","representative_role"],
 "small_business":  ["legal_name","registration_number","registered_address","representative_name","representative_role"],
 "d2c":             ["legal_name","registration_number","registered_address","representative_name","representative_role"],
 "company":         ["legal_name","registration_number","registered_address","representative_name","representative_role"],
 "enterprise":      ["legal_name","registration_number","registered_address","representative_name","representative_role"],
 "international":   ["legal_name","registration_country","registration_number","registered_address","representative_name","representative_role"]
}');
create function aura_brand.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_brand.setting where key = p_key $$;

-- Business profile. Legal identity lives on verification cases; this holds the trading and public identity (F10).
create table aura_brand.profile (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 public_name text not null check (length(trim(public_name)) between 2 and 80),
 business_type text not null check (business_type in ('individual','sole_proprietor','startup','small_business','d2c','company','enterprise','international')),
 country text not null check (country ~ '^[A-Z]{2}$'), industry text check (length(industry) <= 60),
 website text check (website ~ '^https://[^\s]{3,200}$'),
 stage text not null default 'launching' check (stage in ('idea','launching','growing','established')),
 experience text not null default 'none' check (experience in ('none','some','experienced')),
 intent text not null default 'both' check (intent in ('creator_marketing','owned_growth','both')),
 objective text not null default 'awareness' check (objective in ('awareness','social_growth','content','engagement','conversion')),
 team_size text check (team_size in ('solo','2_10','11_50','51_200','200_plus')),
 resources text[] not null default '{}' check (resources <@ array['in_house_content','designer','video','photography','social_manager','paid_media','agency']),
 agency_name text check (length(agency_name) <= 120),   -- a label only: it grants no access (F40, AC05)
 tagline text check (length(tagline) <= 140), about text check (length(about) <= 1500),
 slug text unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
 published boolean not null default false, published_at timestamptz,
 onboarding_step text not null default 'basics', onboarding_completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table aura_brand.reserved_slug (word text primary key);
insert into aura_brand.reserved_slug(word) values ('campaigns'),('inbox'),('applications'),('negotiations'),('onboarding'),('profile'),('products'),('audiences'),
 ('goals'),('plan'),('guidelines'),('competitors'),('socials'),('preferences'),('verification'),('intelligence'),('settings'),('admin'),('aura'),('new'),('edit'),('help'),('support'),('api');

create table aura_brand.goal (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 kind text not null check (kind in ('awareness','social_growth','content','engagement','conversion')),
 metric text not null check (length(trim(metric)) between 2 and 80), baseline numeric check (baseline >= 0), target numeric check (target > 0),
 horizon_days integer not null check (horizon_days in (7, 30, 90)), note text check (length(note) <= 300),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table aura_brand.segment (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 name text not null check (length(trim(name)) between 2 and 80), description text check (length(description) <= 600),
 countries text[] not null default '{}' check (cardinality(countries) <= 20), languages text[] not null default '{}' check (cardinality(languages) <= 10),
 age_min integer check (age_min between 18 and 100), age_max integer check (age_max between 18 and 100),
 interests text[] not null default '{}' check (cardinality(interests) <= 20), considerations text check (length(considerations) <= 600),
 basis text not null default 'hypothesis' check (basis in ('confirmed','hypothesis')),   -- F16: facts and hypotheses kept apart
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (age_min is null or age_max is null or age_max >= age_min)
);
create table aura_brand.product (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 kind text not null default 'product' check (kind in ('product','service','experience')),
 name text not null check (length(trim(name)) between 2 and 100), description text check (length(description) <= 1000),
 url text check (url ~ '^https://[^\s]{3,300}$'), currency text check (currency ~ '^[A-Z]{3}$'),
 price_min numeric check (price_min >= 0), price_max numeric check (price_max >= 0),
 claims text[] not null default '{}' check (cardinality(claims) <= 12),     -- approved claims Creators may use
 segment_ids uuid[] not null default '{}', status text not null default 'active' check (status in ('active','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (price_min is null or price_max is null or price_max >= price_min)
);
create table aura_brand.guideline (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 tone text[] not null default '{}' check (cardinality(tone) <= 8), voice text check (length(voice) <= 800),
 dos text[] not null default '{}' check (cardinality(dos) <= 15), donts text[] not null default '{}' check (cardinality(donts) <= 15),
 colours text[] not null default '{}' check (cardinality(colours) <= 8), visual text check (length(visual) <= 800),
 claims_rules text check (length(claims_rules) <= 800), exclusions text check (length(exclusions) <= 800), disclosures text check (length(disclosures) <= 400),
 updated_at timestamptz not null default now()
);
create table aura_brand.budget (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 currency text not null check (currency ~ '^[A-Z]{3}$'), range_min numeric check (range_min >= 0), range_max numeric check (range_max >= 0),
 period text not null check (period in ('month','quarter','campaign')), creator_share integer check (creator_share between 0 and 100),
 note text check (length(note) <= 300), updated_at timestamptz not null default now(),
 check (range_min is not null or range_max is not null), check (range_min is null or range_max is null or range_max >= range_min)
);
create table aura_brand.creator_pref (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 niches text[] not null default '{}', formats text[] not null default '{}', languages text[] not null default '{}', platforms text[] not null default '{}',
 countries text[] not null default '{}', experience text[] not null default '{}' check (experience <@ array['emerging','growing','established']),
 ugc_interest boolean not null default true, conflict_categories text[] not null default '{}', note text check (length(note) <= 400),
 updated_at timestamptz not null default now(),
 check (cardinality(niches) <= 15 and cardinality(formats) <= 10 and cardinality(languages) <= 10 and cardinality(platforms) <= 6 and cardinality(countries) <= 20 and cardinality(conflict_categories) <= 10)
);
create table aura_brand.competitor (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 name text not null check (length(trim(name)) between 2 and 100), website text check (website ~ '^https://[^\s]{3,200}$'),
 note text check (length(note) <= 300), conflict boolean not null default false, created_at timestamptz not null default now()
);
-- Brand social accounts: separate from Creator accounts; manual, source-labelled, at most 10 (F23–F25).
create table aura_brand.social_account (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 platform text not null check (platform in ('instagram','youtube','facebook','linkedin','threads','x','other')),
 handle text not null check (handle ~ '^[A-Za-z0-9._-]{1,60}$'), followers integer check (followers >= 0), observed_on date,
 source text not null default 'self_reported' check (source in ('self_reported')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (workspace_id, platform, handle), check ((followers is null) = (observed_on is null))
);
create table aura_brand.maturity (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 answers jsonb not null check (jsonb_typeof(answers) = 'object'), updated_at timestamptz not null default now()
);
create table aura_brand.plan_item (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 horizon_days integer not null check (horizon_days in (7, 30, 90)), title text not null check (length(trim(title)) between 3 and 140),
 detail text check (length(detail) <= 500), rule_key text, edited boolean not null default false, done_at timestamptz, position integer not null default 0,
 created_at timestamptz not null default now()
);
create index plan_by_ws on aura_brand.plan_item(workspace_id, horizon_days, position);

-- Verification cases (F31–F37). One open case per workspace; every state change is an event.
create table aura_brand.verification_case (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 kind text not null default 'initial' check (kind in ('initial','resubmission','revalidation','appeal')),
 status text not null default 'draft' check (status in ('draft','submitted','info_requested','approved','rejected','withdrawn')),
 business_type text not null check (business_type in ('individual','sole_proprietor','startup','small_business','d2c','company','enterprise','international')),
 legal_name text check (length(legal_name) <= 160), registration_country text check (registration_country ~ '^[A-Z]{2}$'),
 registration_number text check (length(registration_number) between 3 and 40), registered_address text check (length(registered_address) <= 400),
 representative_name text check (length(representative_name) <= 120), representative_role text check (length(representative_role) <= 80),
 id_document_type text check (id_document_type in ('passport','national_id','driving_licence','pan','aadhaar_masked','other')),
 id_document_last4 text check (id_document_last4 ~ '^[A-Za-z0-9]{4}$'),     -- never a full government id number
 website text check (website ~ '^https://[^\s]{3,200}$'), contact_email text check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
 note text check (length(note) <= 1000), declaration_at timestamptz,
 previous_case uuid references aura_brand.verification_case, appeal_reason text check (length(appeal_reason) <= 1000),
 decision_reason text, decided_by uuid references auth.users, decided_at timestamptz, submitted_at timestamptz,
 created_by uuid not null references auth.users, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default now()
);
create unique index one_open_case on aura_brand.verification_case(workspace_id) where status in ('draft','submitted','info_requested');
create table aura_brand.verification_event (
 id bigint generated always as identity primary key, case_id uuid not null references aura_brand.verification_case on delete cascade,
 side text not null check (side in ('brand','reviewer','system')), event text not null, message text check (length(message) <= 1000),
 actor uuid references auth.users, at timestamptz not null default clock_timestamp()
);
create index vevent_by_case on aura_brand.verification_event(case_id, at);

do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname = 'aura_brand' loop
  execute format('alter table aura_brand.%I enable row level security', t);
  execute format('revoke all on aura_brand.%I from public, anon, authenticated', t);
 end loop;
end $$;

-- ───────── helpers ─────────
-- Owners and admins of an open Brand workspace (MFA enforced by aura_identity.eligible for privileged roles).
create function aura_brand.actor(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
begin return aura_market.brand(p_workspace, p_write); end $$;
create function aura_brand.audit(p_user uuid, p_event text) returns void language sql set search_path='' as $$ insert into aura_identity.event(user_id, event) values (p_user, p_event) $$;
create function aura_brand.arr(v jsonb, p_max integer, p_len integer default 60) returns text[] language sql immutable set search_path='' as $$
 select coalesce(array(select left(trim(x), p_len) from jsonb_array_elements_text(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end) x where trim(x) <> '' limit p_max), '{}') $$;
create function aura_brand.txt(v jsonb, k text) returns text language sql immutable set search_path='' as $$ select nullif(trim(v->>k), '') $$;
create function aura_brand.num(v jsonb, k text) returns numeric language plpgsql immutable set search_path='' as $$
begin return nullif(trim(v->>k), '')::numeric; exception when others then raise exception 'Invalid number: %', k using errcode = '22023'; end $$;
create function aura_brand.cap(p_workspace uuid, p_table text, p_key text) returns void language plpgsql set search_path='' as $$
declare n int;
begin
 execute format('select count(*) from aura_brand.%I where workspace_id = $1', p_table) into n using p_workspace;
 if n >= aura_brand.setting_int(p_key) then raise exception 'Limit reached' using errcode = '54000'; end if;
end $$;
create function aura_brand.log(p_case uuid, p_side text, p_event text, p_message text, p_actor uuid) returns void language sql set search_path='' as $$
 insert into aura_brand.verification_event(case_id, side, event, message, actor) values (p_case, p_side, p_event, p_message, p_actor) $$;
create function aura_brand.missing(c aura_brand.verification_case) returns text[] language sql stable set search_path='' as $$
 select coalesce(array(select f from jsonb_array_elements_text((select value from aura_brand.setting where key = 'evidence_matrix') -> c.business_type) f
   where coalesce(trim(to_jsonb(c) ->> f), '') = ''), '{}') $$;
create function aura_brand.slug_ok(p_slug text) returns boolean language sql stable set search_path='' as $$
 select p_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and p_slug !~ '--' and not exists(select 1 from aura_brand.reserved_slug where word = p_slug) $$;
create function aura_brand.prof(p_workspace uuid) returns aura_brand.profile language plpgsql stable set search_path='' as $$
declare p aura_brand.profile;
begin
 select * into p from aura_brand.profile where workspace_id = p_workspace;
 if p.workspace_id is null then raise exception 'Start onboarding first' using errcode = '55000'; end if;
 return p;
end $$;
create function aura_brand.public_json(p aura_brand.profile) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('slug', p.slug, 'name', p.public_name, 'tagline', p.tagline, 'about', p.about, 'industry', p.industry, 'country', p.country, 'website', p.website,
  'verified_since', (select max(d.decided_at) from aura_market.verification_decision d where d.workspace_id = p.workspace_id and d.decision = 'verified'),
  'products', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'kind', x.kind, 'description', x.description, 'url', x.url) order by x.created_at), '[]'::jsonb) from aura_brand.product x where x.workspace_id = p.workspace_id and x.status = 'active'),
  'socials', (select coalesce(jsonb_agg(jsonb_build_object('platform', s.platform, 'handle', s.handle) order by s.platform), '[]'::jsonb) from aura_brand.social_account s where s.workspace_id = p.workspace_id),
  'live_campaigns', (select count(*) from aura_market.campaign c where c.workspace_id = p.workspace_id and c.status = 'published' and c.visibility = 'public')) $$;

-- ───────── Onboarding and profile ─────────
create function public.aura_brand_state(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, false); w aura_identity.workspace; c aura_brand.verification_case;
begin
 select * into w from aura_identity.workspace where id = p_workspace;
 select * into c from aura_brand.verification_case where workspace_id = p_workspace order by created_at desc limit 1;
 return jsonb_build_object(
  'workspace', jsonb_build_object('id', w.id, 'name', w.name, 'business_kind', w.business_kind, 'verification', w.verification, 'status', w.status, 'onboarding', w.onboarding),
  'role', (select role from aura_identity.membership where workspace_id = p_workspace and user_id = u and active),
  'profile', (select to_jsonb(p) - 'workspace_id' from aura_brand.profile p where p.workspace_id = p_workspace),
  'goals', (select coalesce(jsonb_agg(to_jsonb(g) - 'workspace_id' order by g.horizon_days, g.created_at), '[]'::jsonb) from aura_brand.goal g where g.workspace_id = p_workspace),
  'segments', (select coalesce(jsonb_agg(to_jsonb(s) - 'workspace_id' order by s.created_at), '[]'::jsonb) from aura_brand.segment s where s.workspace_id = p_workspace),
  'products', (select coalesce(jsonb_agg(to_jsonb(x) - 'workspace_id' order by x.status, x.created_at), '[]'::jsonb) from aura_brand.product x where x.workspace_id = p_workspace),
  'guideline', (select to_jsonb(g) - 'workspace_id' from aura_brand.guideline g where g.workspace_id = p_workspace),
  'budget', (select to_jsonb(b) - 'workspace_id' from aura_brand.budget b where b.workspace_id = p_workspace),
  'creator_pref', (select to_jsonb(x) - 'workspace_id' from aura_brand.creator_pref x where x.workspace_id = p_workspace),
  'competitors', (select coalesce(jsonb_agg(to_jsonb(x) - 'workspace_id' order by x.created_at), '[]'::jsonb) from aura_brand.competitor x where x.workspace_id = p_workspace),
  'socials', (select coalesce(jsonb_agg(to_jsonb(x) - 'workspace_id' order by x.created_at), '[]'::jsonb) from aura_brand.social_account x where x.workspace_id = p_workspace),
  'maturity', (select answers from aura_brand.maturity m where m.workspace_id = p_workspace),
  'plan', (select coalesce(jsonb_agg(to_jsonb(x) - 'workspace_id' order by x.horizon_days, x.position, x.created_at), '[]'::jsonb) from aura_brand.plan_item x where x.workspace_id = p_workspace),
  'verification', case when c.id is null then null else to_jsonb(c) - 'workspace_id' - 'created_by' - 'decided_by' || jsonb_build_object('missing', to_jsonb(aura_brand.missing(c)),
     'can_appeal', c.status = 'rejected' and c.kind <> 'appeal' and c.decided_at > now() - make_interval(days => aura_brand.setting_int('appeal_days')),
     'events', (select coalesce(jsonb_agg(jsonb_build_object('side', e.side, 'event', e.event, 'message', e.message, 'at', e.at) order by e.at), '[]'::jsonb) from aura_brand.verification_event e where e.case_id = c.id)) end,
  'cases', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'status', x.status, 'submitted_at', x.submitted_at, 'decided_at', x.decided_at, 'decision_reason', x.decision_reason) order by x.created_at desc), '[]'::jsonb)
     from aura_brand.verification_case x where x.workspace_id = p_workspace),
  'matrix', (select value from aura_brand.setting where key = 'evidence_matrix'),
  'limits', jsonb_build_object('socials', aura_brand.setting_int('max_social_accounts')));
end $$;

-- Basics, objective, resources and public identity. Unknown keys are ignored; only the listed fields can change.
create function public.aura_brand_save_profile(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); p aura_brand.profile; v jsonb := coalesce(p_fields, '{}'); w aura_identity.workspace;
begin
 select * into w from aura_identity.workspace where id = p_workspace;
 select * into p from aura_brand.profile where workspace_id = p_workspace for update;
 if p.workspace_id is null then
  insert into aura_brand.profile(workspace_id, public_name, business_type, country)
   values (p_workspace, coalesce(aura_brand.txt(v, 'public_name'), w.name),
    coalesce(aura_brand.txt(v, 'business_type'), case w.business_kind when 'individual' then 'individual' when 'startup' then 'startup' when 'small_business' then 'small_business' else 'company' end),
    coalesce(upper(aura_brand.txt(v, 'country')), 'IN')) returning * into p;
  update aura_identity.workspace set onboarding = 'in_progress', next_step = 'brand_onboarding' where id = p_workspace and onboarding = 'not_started';
 end if;
 update aura_brand.profile set
  public_name = case when v ? 'public_name' then trim(v->>'public_name') else public_name end,
  business_type = coalesce(aura_brand.txt(v, 'business_type'), business_type), country = coalesce(upper(aura_brand.txt(v, 'country')), country),
  industry = case when v ? 'industry' then aura_brand.txt(v, 'industry') else industry end,
  website = case when v ? 'website' then aura_brand.txt(v, 'website') else website end,
  stage = coalesce(aura_brand.txt(v, 'stage'), stage), experience = coalesce(aura_brand.txt(v, 'experience'), experience),
  intent = coalesce(aura_brand.txt(v, 'intent'), intent), objective = coalesce(aura_brand.txt(v, 'objective'), objective),
  team_size = case when v ? 'team_size' then aura_brand.txt(v, 'team_size') else team_size end,
  resources = case when v ? 'resources' then aura_brand.arr(v->'resources', 7) else resources end,
  agency_name = case when v ? 'agency_name' then aura_brand.txt(v, 'agency_name') else agency_name end,
  tagline = case when v ? 'tagline' then aura_brand.txt(v, 'tagline') else tagline end,
  about = case when v ? 'about' then aura_brand.txt(v, 'about') else about end,
  onboarding_step = coalesce(aura_brand.txt(v, 'onboarding_step'), onboarding_step), updated_at = now()
 where workspace_id = p_workspace returning * into p;
 perform aura_brand.audit(u, 'brand_profile_saved');
 return to_jsonb(p) - 'workspace_id';
end $$;
create function public.aura_brand_complete_onboarding(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); p aura_brand.profile := aura_brand.prof(p_workspace);
begin
 -- F03/F45: only the short mandatory part is required; everything else stays progressive
 update aura_brand.profile set onboarding_completed_at = coalesce(onboarding_completed_at, now()), onboarding_step = 'complete', updated_at = now() where workspace_id = p_workspace;
 update aura_identity.workspace set onboarding = 'completed', next_step = case when verification = 'verified' then 'ready' else 'verification' end where id = p_workspace;
 perform aura_brand.audit(u, 'brand_onboarding_completed');
 return jsonb_build_object('completed', true);
end $$;

create function public.aura_brand_save_goal(p_workspace uuid, p_id uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); g aura_brand.goal;
begin
 perform aura_brand.prof(p_workspace);
 if p_id is null then
  perform aura_brand.cap(p_workspace, 'goal', 'max_goals');
  insert into aura_brand.goal(workspace_id, kind, metric, baseline, target, horizon_days, note)
   values (p_workspace, aura_brand.txt(v, 'kind'), aura_brand.txt(v, 'metric'), aura_brand.num(v, 'baseline'), aura_brand.num(v, 'target'), (v->>'horizon_days')::int, aura_brand.txt(v, 'note')) returning * into g;
 else
  update aura_brand.goal set kind = aura_brand.txt(v, 'kind'), metric = aura_brand.txt(v, 'metric'), baseline = aura_brand.num(v, 'baseline'), target = aura_brand.num(v, 'target'),
   horizon_days = (v->>'horizon_days')::int, note = aura_brand.txt(v, 'note'), updated_at = now() where id = p_id and workspace_id = p_workspace returning * into g;
  if g.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 end if;
 return to_jsonb(g) - 'workspace_id';
end $$;
create function public.aura_brand_save_segment(p_workspace uuid, p_id uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); s aura_brand.segment;
begin
 perform aura_brand.prof(p_workspace);
 if p_id is null then
  perform aura_brand.cap(p_workspace, 'segment', 'max_segments');
  insert into aura_brand.segment(workspace_id, name) values (p_workspace, aura_brand.txt(v, 'name')) returning * into s;
 else select * into s from aura_brand.segment where id = p_id and workspace_id = p_workspace for update;
  if s.id is null then raise exception 'Access denied' using errcode = '42501'; end if; end if;
 update aura_brand.segment set name = aura_brand.txt(v, 'name'), description = aura_brand.txt(v, 'description'),
  countries = array(select upper(x) from unnest(aura_brand.arr(v->'countries', 20, 10)) x where upper(x) ~ '^[A-Z]{2}$'), languages = aura_brand.arr(v->'languages', 10, 30),
  age_min = (aura_brand.num(v, 'age_min'))::int, age_max = (aura_brand.num(v, 'age_max'))::int, interests = aura_brand.arr(v->'interests', 20, 40),
  considerations = aura_brand.txt(v, 'considerations'), basis = coalesce(aura_brand.txt(v, 'basis'), 'hypothesis'), updated_at = now()
 where id = s.id returning * into s;
 return to_jsonb(s) - 'workspace_id';
end $$;
create function public.aura_brand_save_product(p_workspace uuid, p_id uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); x aura_brand.product; segs uuid[];
begin
 perform aura_brand.prof(p_workspace);
 segs := coalesce(array(select s.id from aura_brand.segment s where s.workspace_id = p_workspace and s.id::text in (select jsonb_array_elements_text(coalesce(v->'segment_ids', '[]')))), '{}');
 if p_id is null then
  perform aura_brand.cap(p_workspace, 'product', 'max_products');
  insert into aura_brand.product(workspace_id, name) values (p_workspace, aura_brand.txt(v, 'name')) returning * into x;
 else select * into x from aura_brand.product where id = p_id and workspace_id = p_workspace for update;
  if x.id is null then raise exception 'Access denied' using errcode = '42501'; end if; end if;
 update aura_brand.product set kind = coalesce(aura_brand.txt(v, 'kind'), 'product'), name = aura_brand.txt(v, 'name'), description = aura_brand.txt(v, 'description'),
  url = aura_brand.txt(v, 'url'), currency = aura_brand.txt(v, 'currency'), price_min = aura_brand.num(v, 'price_min'), price_max = aura_brand.num(v, 'price_max'),
  claims = aura_brand.arr(v->'claims', 12, 200), segment_ids = segs, status = coalesce(aura_brand.txt(v, 'status'), status), updated_at = now()
 where id = x.id returning * into x;
 return to_jsonb(x) - 'workspace_id';
end $$;
create function public.aura_brand_save_competitor(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); x aura_brand.competitor;
begin
 perform aura_brand.prof(p_workspace); perform aura_brand.cap(p_workspace, 'competitor', 'max_competitors');
 insert into aura_brand.competitor(workspace_id, name, website, note, conflict) values (p_workspace, aura_brand.txt(v, 'name'), aura_brand.txt(v, 'website'), aura_brand.txt(v, 'note'), coalesce((v->>'conflict')::boolean, false)) returning * into x;
 return to_jsonb(x) - 'workspace_id';
end $$;
-- F24: at most 10 accounts per Brand workspace, enforced under a lock so concurrent adds cannot exceed it.
create function public.aura_brand_save_social(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); x aura_brand.social_account;
begin
 perform aura_brand.prof(p_workspace);
 perform pg_advisory_xact_lock(hashtextextended('brand_social:' || p_workspace::text, 0));
 perform aura_brand.cap(p_workspace, 'social_account', 'max_social_accounts');
 insert into aura_brand.social_account(workspace_id, platform, handle, followers, observed_on)
  values (p_workspace, aura_brand.txt(v, 'platform'), regexp_replace(coalesce(aura_brand.txt(v, 'handle'), ''), '^@', ''), (aura_brand.num(v, 'followers'))::int,
   case when aura_brand.num(v, 'followers') is not null then coalesce((aura_brand.txt(v, 'observed_on'))::date, current_date) end) returning * into x;
 if x.observed_on > current_date then raise exception 'A date in the future' using errcode = '22023'; end if;
 return to_jsonb(x) - 'workspace_id';
end $$;
create function public.aura_brand_delete(p_workspace uuid, p_kind text, p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); n int;
begin
 if p_kind not in ('goal','segment','product','competitor','social_account','plan_item') then raise exception 'Invalid kind' using errcode = '22023'; end if;
 execute format('delete from aura_brand.%I where id = $1 and workspace_id = $2', p_kind) using p_id, p_workspace;
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_kind = 'segment' then update aura_brand.product set segment_ids = array_remove(segment_ids, p_id) where workspace_id = p_workspace; end if;
 return jsonb_build_object('deleted', true);
end $$;
create function public.aura_brand_save_guideline(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); g aura_brand.guideline; cols text[];
begin
 perform aura_brand.prof(p_workspace);
 cols := array(select upper(x) from unnest(aura_brand.arr(v->'colours', 8, 7)) x);
 if exists(select 1 from unnest(cols) x where x !~ '^#[0-9A-F]{6}$') then raise exception 'Colours must be hex values like #5B4BD6' using errcode = '22023'; end if;
 insert into aura_brand.guideline(workspace_id, tone, voice, dos, donts, colours, visual, claims_rules, exclusions, disclosures)
  values (p_workspace, aura_brand.arr(v->'tone', 8, 30), aura_brand.txt(v, 'voice'), aura_brand.arr(v->'dos', 15, 200), aura_brand.arr(v->'donts', 15, 200), cols,
   aura_brand.txt(v, 'visual'), aura_brand.txt(v, 'claims_rules'), aura_brand.txt(v, 'exclusions'), aura_brand.txt(v, 'disclosures'))
 on conflict (workspace_id) do update set tone = excluded.tone, voice = excluded.voice, dos = excluded.dos, donts = excluded.donts, colours = excluded.colours, visual = excluded.visual,
  claims_rules = excluded.claims_rules, exclusions = excluded.exclusions, disclosures = excluded.disclosures, updated_at = now() returning * into g;
 return to_jsonb(g) - 'workspace_id';
end $$;
-- F19/F20/AC07: the budget is optional, indicative and never a commitment. Passing null clears it.
create function public.aura_brand_save_budget(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := p_fields; b aura_brand.budget;
begin
 perform aura_brand.prof(p_workspace);
 if v is null or v = 'null'::jsonb then delete from aura_brand.budget where workspace_id = p_workspace; return jsonb_build_object('cleared', true); end if;
 insert into aura_brand.budget(workspace_id, currency, range_min, range_max, period, creator_share, note)
  values (p_workspace, coalesce(aura_brand.txt(v, 'currency'), 'INR'), aura_brand.num(v, 'range_min'), aura_brand.num(v, 'range_max'), coalesce(aura_brand.txt(v, 'period'), 'month'), (aura_brand.num(v, 'creator_share'))::int, aura_brand.txt(v, 'note'))
 on conflict (workspace_id) do update set currency = excluded.currency, range_min = excluded.range_min, range_max = excluded.range_max, period = excluded.period, creator_share = excluded.creator_share, note = excluded.note, updated_at = now()
 returning * into b;
 return to_jsonb(b) - 'workspace_id';
end $$;
create function public.aura_brand_save_creator_pref(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); x aura_brand.creator_pref;
begin
 perform aura_brand.prof(p_workspace);
 insert into aura_brand.creator_pref(workspace_id, niches, formats, languages, platforms, countries, experience, ugc_interest, conflict_categories, note)
  values (p_workspace, aura_brand.arr(v->'niches', 15, 40), aura_brand.arr(v->'formats', 10, 40), aura_brand.arr(v->'languages', 10, 30), aura_brand.arr(v->'platforms', 6, 20),
   array(select upper(c) from unnest(aura_brand.arr(v->'countries', 20, 10)) c where upper(c) ~ '^[A-Z]{2}$'),
   array(select e from unnest(aura_brand.arr(v->'experience', 3, 20)) e where e in ('emerging','growing','established')),
   coalesce((v->>'ugc_interest')::boolean, true), aura_brand.arr(v->'conflict_categories', 10, 60), aura_brand.txt(v, 'note'))
 on conflict (workspace_id) do update set niches = excluded.niches, formats = excluded.formats, languages = excluded.languages, platforms = excluded.platforms, countries = excluded.countries,
  experience = excluded.experience, ugc_interest = excluded.ugc_interest, conflict_categories = excluded.conflict_categories, note = excluded.note, updated_at = now()
 returning * into x;
 return to_jsonb(x) - 'workspace_id';
end $$;
-- F09: answers to fixed questions; no score is ever computed or stored.
create function public.aura_brand_save_maturity(p_workspace uuid, p_answers jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); k text; clean jsonb := '{}';
begin
 perform aura_brand.prof(p_workspace);
 for k in select jsonb_object_keys(coalesce(p_answers, '{}')) loop
  if k in ('presence','content','creators','measurement','process') and p_answers->>k in ('starting','developing','established') then clean := clean || jsonb_build_object(k, p_answers->>k); end if;
 end loop;
 insert into aura_brand.maturity(workspace_id, answers) values (p_workspace, clean) on conflict (workspace_id) do update set answers = excluded.answers, updated_at = now();
 return clean;
end $$;
-- F44: plans are proposed by rules in the application, then saved here and freely edited. Regenerating keeps edited and completed items.
create function public.aura_brand_save_plan(p_workspace uuid, p_horizon integer, p_items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); x jsonb; i int := 0;
begin
 perform aura_brand.prof(p_workspace);
 if p_horizon not in (7, 30, 90) or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then raise exception 'Invalid plan' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('brand_plan:' || p_workspace::text, 0));
 delete from aura_brand.plan_item where workspace_id = p_workspace and horizon_days = p_horizon and not edited and done_at is null;
 for x in select * from jsonb_array_elements(p_items) loop
  i := i + 1;
  if not exists(select 1 from aura_brand.plan_item where workspace_id = p_workspace and horizon_days = p_horizon and rule_key = x->>'rule_key') then
   insert into aura_brand.plan_item(workspace_id, horizon_days, title, detail, rule_key, position) values (p_workspace, p_horizon, left(x->>'title', 140), left(x->>'detail', 500), left(x->>'rule_key', 60), i);
  end if;
 end loop;
 perform aura_brand.cap(p_workspace, 'plan_item', 'max_plan_items') ;
 return jsonb_build_object('horizon', p_horizon, 'items', (select count(*) from aura_brand.plan_item where workspace_id = p_workspace and horizon_days = p_horizon));
exception when sqlstate '54000' then
 if (select count(*) from aura_brand.plan_item where workspace_id = p_workspace) > aura_brand.setting_int('max_plan_items') then raise; end if;
 return jsonb_build_object('horizon', p_horizon);
end $$;
create function public.aura_brand_plan_item(p_workspace uuid, p_id uuid, p_action text, p_title text default null, p_detail text default null, p_horizon integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); x aura_brand.plan_item;
begin
 perform aura_brand.prof(p_workspace);
 if p_action = 'add' then
  if p_horizon not in (7, 30, 90) then raise exception 'Invalid horizon' using errcode = '22023'; end if;
  perform aura_brand.cap(p_workspace, 'plan_item', 'max_plan_items');
  insert into aura_brand.plan_item(workspace_id, horizon_days, title, detail, edited, position) values (p_workspace, p_horizon, trim(p_title), nullif(trim(coalesce(p_detail, '')), ''), true, 1000) returning * into x;
 else
  select * into x from aura_brand.plan_item where id = p_id and workspace_id = p_workspace for update;
  if x.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_action = 'done' then update aura_brand.plan_item set done_at = case when done_at is null then now() end where id = x.id returning * into x;
  elsif p_action = 'edit' then update aura_brand.plan_item set title = trim(p_title), detail = nullif(trim(coalesce(p_detail, '')), ''), edited = true where id = x.id returning * into x;
  else raise exception 'Invalid action' using errcode = '22023'; end if;
 end if;
 return to_jsonb(x) - 'workspace_id';
end $$;

-- ───────── Public profile (F46, F47) ─────────
create function public.aura_brand_check_slug(p_workspace uuid, p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, false); s text := lower(trim(coalesce(p_slug, '')));
begin
 if not aura_brand.slug_ok(s) then return jsonb_build_object('ok', false, 'reason', case when exists(select 1 from aura_brand.reserved_slug where word = s) then 'reserved' else 'format' end); end if;
 if exists(select 1 from aura_brand.profile where slug = s and workspace_id <> p_workspace) then return jsonb_build_object('ok', false, 'reason', 'taken'); end if;
 return jsonb_build_object('ok', true);
end $$;
-- Private by default. Publishing needs a verified business (no public page for an unverified identity), a slug and an about text.
create function public.aura_brand_publish(p_workspace uuid, p_on boolean, p_slug text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); p aura_brand.profile := aura_brand.prof(p_workspace); s text := lower(trim(coalesce(p_slug, p.slug, '')));
begin
 if p_on then
  if not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
  if not aura_brand.slug_ok(s) then raise exception 'Invalid address' using errcode = '22023'; end if;
  if length(coalesce(p.about, '')) < 40 then raise exception 'Write an about text of at least 40 characters' using errcode = '22023'; end if;
  begin
   update aura_brand.profile set slug = s, published = true, published_at = coalesce(published_at, now()), updated_at = now() where workspace_id = p_workspace;
  exception when unique_violation then raise exception 'That address is taken' using errcode = '23505'; end;
 else
  update aura_brand.profile set published = false, updated_at = now() where workspace_id = p_workspace;
 end if;
 perform aura_brand.audit(u, case when p_on then 'brand_profile_published' else 'brand_profile_unpublished' end);
 return jsonb_build_object('published', p_on, 'slug', s);
end $$;
-- Anonymous: only a published profile of an open, verified Brand; never legal identity, representatives, budgets or private planning.
create function public.aura_brand_public(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p aura_brand.profile;
begin
 select pr.* into p from aura_brand.profile pr join aura_identity.workspace w on w.id = pr.workspace_id
  where pr.slug = lower(coalesce(p_slug, '')) and pr.published and w.status = 'open' and w.verification = 'verified';
 if p.workspace_id is null then return jsonb_build_object('found', false); end if;
 return jsonb_build_object('found', true, 'profile', aura_brand.public_json(p));
end $$;
-- Signed-in Creators (marketplace Brand pages): the same published projection, by workspace.
create function public.aura_brand_public_for(p_workspace uuid, p_brand uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); p aura_brand.profile;
begin
 select pr.* into p from aura_brand.profile pr join aura_identity.workspace w on w.id = pr.workspace_id where pr.workspace_id = p_brand and pr.published and w.status = 'open' and w.verification = 'verified';
 if p.workspace_id is null then return jsonb_build_object('found', false); end if;
 return jsonb_build_object('found', true, 'profile', aura_brand.public_json(p));
end $$;

-- ───────── Verification cases (F31–F37) ─────────
create function public.aura_brand_verification_save(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); v jsonb := coalesce(p_fields, '{}'); c aura_brand.verification_case; last aura_brand.verification_case; p aura_brand.profile := aura_brand.prof(p_workspace); k text;
begin
 perform pg_advisory_xact_lock(hashtextextended('brand_case:' || p_workspace::text, 0));
 select * into c from aura_brand.verification_case where workspace_id = p_workspace and status in ('draft','info_requested') for update;
 if c.id is null then
  if exists(select 1 from aura_brand.verification_case where workspace_id = p_workspace and status = 'submitted') then raise exception 'Your case is with a reviewer' using errcode = '55000'; end if;
  select * into last from aura_brand.verification_case where workspace_id = p_workspace order by created_at desc limit 1;
  k := case when last.id is null then 'initial' when last.status = 'approved' then 'revalidation' else 'resubmission' end;
  insert into aura_brand.verification_case(workspace_id, kind, business_type, created_by, previous_case, legal_name, registration_country, registration_number, registered_address,
    representative_name, representative_role, id_document_type, website, contact_email)
   values (p_workspace, k, p.business_type, u, last.id, last.legal_name, last.registration_country, last.registration_number, last.registered_address,
    last.representative_name, last.representative_role, last.id_document_type, coalesce(last.website, p.website), last.contact_email) returning * into c;
  perform aura_brand.log(c.id, 'brand', 'opened', k, u);
 end if;
 update aura_brand.verification_case set
  business_type = coalesce(aura_brand.txt(v, 'business_type'), business_type), legal_name = case when v ? 'legal_name' then aura_brand.txt(v, 'legal_name') else legal_name end,
  registration_country = case when v ? 'registration_country' then upper(aura_brand.txt(v, 'registration_country')) else registration_country end,
  registration_number = case when v ? 'registration_number' then upper(regexp_replace(aura_brand.txt(v, 'registration_number'), '\s', '', 'g')) else registration_number end,
  registered_address = case when v ? 'registered_address' then aura_brand.txt(v, 'registered_address') else registered_address end,
  representative_name = case when v ? 'representative_name' then aura_brand.txt(v, 'representative_name') else representative_name end,
  representative_role = case when v ? 'representative_role' then aura_brand.txt(v, 'representative_role') else representative_role end,
  id_document_type = case when v ? 'id_document_type' then aura_brand.txt(v, 'id_document_type') else id_document_type end,
  id_document_last4 = case when v ? 'id_document_last4' then upper(aura_brand.txt(v, 'id_document_last4')) else id_document_last4 end,
  website = case when v ? 'website' then aura_brand.txt(v, 'website') else website end, contact_email = case when v ? 'contact_email' then lower(aura_brand.txt(v, 'contact_email')) else contact_email end,
  note = case when v ? 'note' then aura_brand.txt(v, 'note') else note end, updated_at = now()
 where id = c.id returning * into c;
 return to_jsonb(c) - 'workspace_id' - 'created_by' - 'decided_by' || jsonb_build_object('missing', to_jsonb(aura_brand.missing(c)));
end $$;
create function public.aura_brand_verification_submit(p_workspace uuid, p_declare boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); c aura_brand.verification_case; miss text[]; was text;
begin
 if p_declare is not true then raise exception 'Confirm the declaration before submitting' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('brand_case:' || p_workspace::text, 0));
 select * into c from aura_brand.verification_case where workspace_id = p_workspace and status in ('draft','info_requested') for update;
 if c.id is null then raise exception 'Nothing to submit' using errcode = '55000'; end if;
 if (select count(*) from aura_brand.verification_case where workspace_id = p_workspace and submitted_at > now() - interval '1 day') >= aura_brand.setting_int('cases_per_day') then raise exception 'Rate limited' using errcode = '54000'; end if;
 miss := aura_brand.missing(c);
 if cardinality(miss) > 0 then raise exception 'Missing evidence: %', array_to_string(miss, ',') using errcode = '22023'; end if;
 update aura_brand.verification_case set status = 'submitted', submitted_at = now(), declaration_at = now(), updated_at = now() where id = c.id;
 -- F36: a revalidation pauses commercial actions until a reviewer confirms the new legal identity; existing obligations are untouched
 select verification into was from aura_identity.workspace where id = p_workspace;
 if c.kind = 'revalidation' and was = 'verified' then
  update aura_identity.workspace set verification = 'pending' where id = p_workspace;
  insert into aura_market.verification_decision(workspace_id, decision, reason, decided_by) values (p_workspace, 'revoked', 'Paused for revalidation of a legal identity change', u);
 end if;
 perform aura_brand.log(c.id, 'brand', 'submitted', null, u);
 perform aura_brand.audit(u, 'brand_verification_submitted');
 return jsonb_build_object('id', c.id, 'status', 'submitted', 'paused', c.kind = 'revalidation' and was = 'verified');
end $$;
create function public.aura_brand_verification_withdraw(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); c aura_brand.verification_case;
begin
 select * into c from aura_brand.verification_case where workspace_id = p_workspace and status in ('draft','submitted','info_requested') for update;
 if c.id is null then raise exception 'Nothing to withdraw' using errcode = '55000'; end if;
 update aura_brand.verification_case set status = 'withdrawn', updated_at = now() where id = c.id;
 perform aura_brand.log(c.id, 'brand', 'withdrawn', null, u);
 return jsonb_build_object('id', c.id, 'status', 'withdrawn');
end $$;
-- F37: one appeal per rejected case, within the appeal window; it reopens the same evidence for a different reviewer.
create function public.aura_brand_verification_appeal(p_workspace uuid, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_brand.actor(p_workspace, true); c aura_brand.verification_case; a aura_brand.verification_case;
begin
 if length(coalesce(trim(p_reason), '')) < 20 then raise exception 'Explain the appeal in at least 20 characters' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('brand_case:' || p_workspace::text, 0));
 select * into c from aura_brand.verification_case where workspace_id = p_workspace order by created_at desc limit 1;
 if c.status <> 'rejected' or c.kind = 'appeal' or c.decided_at < now() - make_interval(days => aura_brand.setting_int('appeal_days')) then raise exception 'No appeal is available' using errcode = '55000'; end if;
 insert into aura_brand.verification_case(workspace_id, kind, status, business_type, legal_name, registration_country, registration_number, registered_address, representative_name, representative_role,
   id_document_type, id_document_last4, website, contact_email, note, declaration_at, previous_case, appeal_reason, submitted_at, created_by)
  values (p_workspace, 'appeal', 'submitted', c.business_type, c.legal_name, c.registration_country, c.registration_number, c.registered_address, c.representative_name, c.representative_role,
   c.id_document_type, c.id_document_last4, c.website, c.contact_email, c.note, now(), c.id, trim(p_reason), now(), u) returning * into a;
 perform aura_brand.log(a.id, 'brand', 'appealed', trim(p_reason), u);
 return jsonb_build_object('id', a.id, 'status', 'submitted');
end $$;

-- Reviewer side: Platform Admin with reviewer grant and MFA; never their own workspace; a reason for every decision.
create function public.aura_brand_review_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check();
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'workspace_id', c.workspace_id, 'brand', w.name, 'kind', c.kind, 'status', c.status, 'business_type', c.business_type, 'submitted_at', c.submitted_at,
   'own', exists(select 1 from aura_identity.membership m where m.workspace_id = c.workspace_id and m.user_id = u and m.active)) order by c.submitted_at), '[]'::jsonb)
  from aura_brand.verification_case c join aura_identity.workspace w on w.id = c.workspace_id where c.status = 'submitted');
end $$;
create function public.aura_brand_review_case(p_case uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); c aura_brand.verification_case; p aura_brand.profile; dom text; mail text;
begin
 select * into c from aura_brand.verification_case where id = p_case;
 if c.id is null then raise exception 'Not found' using errcode = '42501'; end if;
 perform aura_market.not_member(u, c.workspace_id);
 select * into p from aura_brand.profile where workspace_id = c.workspace_id;
 dom := lower(substring(c.website from '^https://(?:www\.)?([^/:?#]+)')); mail := lower(split_part(c.contact_email, '@', 2));
 return to_jsonb(c) - 'created_by' || jsonb_build_object('brand', (select name from aura_identity.workspace where id = c.workspace_id), 'public_name', p.public_name, 'country', p.country,
  'missing', to_jsonb(aura_brand.missing(c)),
  -- F33: supporting signal only, never sufficient on its own
  'domain_match', case when dom is null or mail = '' then null else mail = dom or mail like '%.' || dom end,
  'history', (select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'status', x.status, 'decided_at', x.decided_at, 'decision_reason', x.decision_reason) order by x.created_at), '[]'::jsonb) from aura_brand.verification_case x where x.workspace_id = c.workspace_id and x.id <> c.id),
  'events', (select coalesce(jsonb_agg(jsonb_build_object('side', e.side, 'event', e.event, 'message', e.message, 'at', e.at) order by e.at), '[]'::jsonb) from aura_brand.verification_event e where e.case_id = c.id),
  'appeal_of_reviewer', case when c.kind = 'appeal' then (select decided_by = u from aura_brand.verification_case where id = c.previous_case) end);
end $$;
create function public.aura_brand_review_decide(p_case uuid, p_decision text, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); c aura_brand.verification_case;
begin
 if p_decision not in ('approved','rejected','info_requested') or length(coalesce(trim(p_reason), '')) < 5 then raise exception 'A decision and a reason of at least 5 characters are required' using errcode = '22023'; end if;
 select * into c from aura_brand.verification_case where id = p_case for update;
 if c.id is null then raise exception 'Not found' using errcode = '42501'; end if;
 if c.status <> 'submitted' then raise exception 'This case was already decided' using errcode = '55000'; end if;
 perform aura_market.not_member(u, c.workspace_id);
 if c.kind = 'appeal' and exists(select 1 from aura_brand.verification_case where id = c.previous_case and decided_by = u) then raise exception 'An appeal needs a different reviewer' using errcode = '42501'; end if;
 if p_decision = 'approved' and cardinality(aura_brand.missing(c)) > 0 then raise exception 'Evidence is incomplete' using errcode = '55000'; end if;
 update aura_brand.verification_case set status = p_decision, decision_reason = trim(p_reason), decided_by = case when p_decision = 'info_requested' then null else u end,
  decided_at = case when p_decision = 'info_requested' then null else now() end, updated_at = now() where id = c.id;
 if p_decision = 'approved' then
  update aura_identity.workspace set verification = 'verified', next_step = case when onboarding = 'completed' then 'ready' else next_step end where id = c.workspace_id;
  insert into aura_market.verification_decision(workspace_id, decision, reason, decided_by) values (c.workspace_id, 'verified', trim(p_reason), u);
 elsif p_decision = 'rejected' and c.kind = 'revalidation' then
  -- a rejected revalidation leaves the workspace unverified (already paused at submission); existing obligations are not erased
  update aura_identity.workspace set verification = 'revoked' where id = c.workspace_id;
 end if;
 perform aura_brand.log(c.id, 'reviewer', p_decision, trim(p_reason), u);
 perform aura_brand.audit(u, 'brand_verification_' || p_decision);
 return jsonb_build_object('id', c.id, 'status', p_decision);
end $$;

-- The M09 enquiry stub now reads the real verification state (it previously always refused).
create or replace function aura_profile.brand_verified(p_workspace uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from aura_identity.workspace where id = p_workspace and kind = 'brand' and status = 'open' and verification = 'verified') $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_brand\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'aura_brand' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
 end loop;
end $$;
grant execute on function public.aura_brand_public(text) to anon;
commit;
