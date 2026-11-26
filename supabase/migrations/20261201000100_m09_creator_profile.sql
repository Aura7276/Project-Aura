-- M09 Creator profile, portfolio, services and media kits.
-- Dated 2026-12-01 so that an M08 migration (developed separately) can be dated before it.
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
-- Public reads go through narrow projection functions (and one allowlisted directory view for M01) that re-check publication,
-- item visibility, link validity and workspace status on every call. Nothing private is ever copied into a public table.
begin;
create schema aura_profile;
revoke all on schema aura_profile from public, anon, authenticated;

create table aura_profile.setting (key text primary key, value jsonb not null);
insert into aura_profile.setting(key, value) values
 ('username_change_limit_30d', '3'),     -- NON-PRODUCTION defaults, owner approval pending
 ('username_alias_days', '30'),
 ('share_default_days', '30'),
 ('share_max_days', '365'),
 ('invite_days', '30'),
 ('discovery_min_followers', '100');     -- M03/M05 rule: best single individual account, never summed
create function aura_profile.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_profile.setting where key = p_key $$;

-- Usernames that would collide with Creator Studio routes under /creator/ or with system words.
create table aura_profile.reserved_username (word text primary key);
insert into aura_profile.reserved_username(word) values
 ('actions'),('admin'),('analytics'),('api'),('app'),('aura'),('auth'),('brand'),('brands'),('campaign'),('campaigns'),('create'),('creator'),('creators'),
 ('dashboard'),('edit'),('experiments'),('explore'),('feedback'),('grow'),('help'),('kit'),('login'),('logout'),('me'),('media-kit'),('new'),('notifications'),
 ('null'),('official'),('onboarding'),('portfolio'),('privacy'),('profile'),('progress'),('rates'),('recommendations'),('register'),('resources'),('root'),
 ('search'),('security'),('services'),('settings'),('signin'),('signup'),('socials'),('staff'),('studio'),('support'),('system'),('terms'),('undefined'),
 ('workspaces'),('www');

create table aura_profile.profile (
 workspace_id uuid primary key references aura_creator.creator_profile on delete cascade,
 username text unique check (username ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$' and username !~ '[._-]{2}'),
 headline text check (length(headline) <= 120), about text check (length(about) <= 2000),
 theme text not null default 'ivory' check (theme in ('ivory','midnight','sage','peach')),
 cover text not null default 'aurora' check (cover in ('aurora','grid','waves','plain')),
 section_order text[] not null default array['about','portfolio','case_studies','services','experience','testimonials','accounts','availability']
  check (section_order <@ array['about','portfolio','case_studies','services','experience','testimonials','accounts','availability']),
 show_follower_counts boolean not null default false, show_branding boolean not null default true,
 availability text not null default 'open' check (availability in ('open','limited','unavailable')),
 available_from date, available_until date, availability_note text check (length(availability_note) <= 200),
 published boolean not null default false, published_at timestamptz, listed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (available_until is null or available_from is null or available_until >= available_from),
 check (published or not listed)
);
create table aura_profile.username_alias (
 username text primary key, workspace_id uuid not null references aura_identity.workspace on delete cascade, retired_at timestamptz not null default now(), expires_at timestamptz not null
);
create table aura_profile.username_change (id bigint generated always as identity primary key, workspace_id uuid not null references aura_identity.workspace on delete cascade, at timestamptz not null default now());

-- Portfolio. Kind makes provenance explicit: speculative work is always labelled as such.
create table aura_profile.portfolio_item (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 kind text not null check (kind in ('organic','commercial','ugc_sample','speculative','case_study')),
 title text not null check (length(trim(title)) between 2 and 120), description text check (length(description) <= 2000),
 link text check (link ~ '^https://[^/\s@]+(/[^\s]*)?$' and length(link) <= 400),
 content_ref uuid references aura_social.content_ref on delete set null,  -- an M05 content reference (with its observations)
 studio_ref text check (length(studio_ref) <= 100),                     -- M08 Content Studio record (contract; M08 not merged)
 brand_name text check (length(brand_name) <= 100), year integer check (year between 2000 and 2100),
 objective text check (length(objective) <= 600), approach text check (length(approach) <= 1200), contribution text check (length(contribution) <= 600),
 deliverables text[] not null default '{}' check (cardinality(deliverables) <= 12),
 outcomes jsonb not null default '[]' check (jsonb_typeof(outcomes) = 'array' and jsonb_array_length(outcomes) <= 8),
 show_metrics boolean not null default false,
 visibility text not null default 'private' check (visibility in ('private','public','restricted')), featured boolean not null default false,
 position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), request_id uuid,
 unique (workspace_id, request_id),
 check (kind <> 'commercial' or brand_name is not null)
);
create table aura_profile.service (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 kind text not null check (kind in ('influencer','ugc','other')),
 name text not null check (length(trim(name)) between 2 and 80), description text check (length(description) <= 800),
 deliverables text[] not null default '{}' check (cardinality(deliverables) <= 12),
 pricing text not null default 'quote' check (pricing in ('fixed','range','quote')), currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
 price_min numeric check (price_min >= 0 and price_min <= 100000000), price_max numeric check (price_max >= 0 and price_max <= 100000000),
 visibility text not null default 'private' check (visibility in ('private','public','restricted')),
 rates_visibility text not null default 'private' check (rates_visibility in ('private','restricted')),  -- rates are never public on the open profile
 position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (pricing = 'quote' and price_min is null and price_max is null or pricing = 'fixed' and price_min is not null and price_max is null or pricing = 'range' and price_min is not null and price_max is not null and price_max >= price_min)
);
create table aura_profile.package (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 service_kind text not null default 'influencer' check (service_kind in ('influencer','ugc','other')),
 name text not null check (length(trim(name)) between 2 and 80), description text check (length(description) <= 800),
 deliverables jsonb not null default '[]' check (jsonb_typeof(deliverables) = 'array' and jsonb_array_length(deliverables) between 0 and 12),
 currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
 price_min numeric check (price_min >= 0 and price_min <= 100000000), price_max numeric check (price_max >= 0 and price_max <= 100000000),
 turnaround_days integer check (turnaround_days between 1 and 365), revisions integer check (revisions between 0 and 20),
 usage_rights text check (length(usage_rights) <= 400), terms text check (length(terms) <= 1200),
 visibility text not null default 'private' check (visibility in ('private','restricted')),
 position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (price_max is null or price_min is not null and price_max >= price_min)
);
create table aura_profile.experience (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 organisation text not null check (length(trim(organisation)) between 2 and 100), role text check (length(role) <= 100),
 year_from integer check (year_from between 1990 and 2100), year_to integer check (year_to between 1990 and 2100),
 description text check (length(description) <= 800), evidence_url text check (evidence_url ~ '^https://[^/\s@]+(/[^\s]*)?$' and length(evidence_url) <= 400),
 provenance text not null default 'self_reported' check (provenance = 'self_reported'),
 visibility text not null default 'private' check (visibility in ('private','public','restricted')),
 position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (year_to is null or year_from is null or year_to >= year_from)
);
-- Testimonials: written only by a real, signed-in person from outside the Creator's workspace, through an invitation; moderated.
create table aura_profile.testimonial_invite (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 token_hash text not null unique, label text check (length(label) <= 100), expires_at timestamptz not null, used_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table aura_profile.testimonial (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 invite_id uuid not null unique references aura_profile.testimonial_invite on delete cascade,
 author_user uuid not null references auth.users on delete cascade, author_name text not null check (length(trim(author_name)) between 2 and 80),
 author_role text check (length(author_role) <= 100), relationship text not null check (relationship in ('brand_client','agency','collaborator','other')),
 body text not null check (length(trim(body)) between 20 and 1200),
 status text not null default 'pending' check (status in ('pending','approved','rejected','disputed','removed')),
 displayed boolean not null default false, decision_reason text check (length(decision_reason) <= 500), decided_by uuid references auth.users, decided_at timestamptz,
 dispute_reason text check (length(dispute_reason) <= 500), created_at timestamptz not null default now(),
 check (not displayed or status = 'approved')
);
create table aura_profile.media_kit (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 name text not null check (length(trim(name)) between 2 and 80), audience text check (length(audience) <= 120),
 template text not null default 'editorial' check (template in ('editorial','classic','compact')),
 intro text check (length(intro) <= 800), contact_note text check (length(contact_note) <= 300),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), request_id uuid, unique (workspace_id, request_id)
);
create table aura_profile.kit_section (
 kit_id uuid not null references aura_profile.media_kit on delete cascade,
 key text not null check (key in ('about','accounts','audience','portfolio','case_studies','services','packages','experience','testimonials','availability','contact')),
 position integer not null, enabled boolean not null default true, item_ids uuid[],   -- null: every eligible item; otherwise the chosen ones
 primary key (kit_id, key)
);
create table aura_profile.kit_version (
 id uuid primary key default gen_random_uuid(), kit_id uuid not null references aura_profile.media_kit on delete cascade,
 version integer not null, content jsonb not null, note text check (length(note) <= 200), created_at timestamptz not null default now(), created_by uuid not null references auth.users,
 unique (kit_id, version)
);
create table aura_profile.kit_share (
 id uuid primary key default gen_random_uuid(), kit_id uuid not null references aura_profile.media_kit on delete cascade,
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 token_hash text not null unique, kind text not null check (kind in ('public','restricted')),
 recipient_workspace_id uuid references aura_identity.workspace on delete cascade,
 version_id uuid references aura_profile.kit_version on delete cascade,  -- null: live sections; otherwise that fixed snapshot
 include_rates boolean not null default false, label text check (length(label) <= 100),
 expires_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(),
 check ((kind = 'restricted') = (recipient_workspace_id is not null)), check (kind = 'restricted' or not include_rates)
);
-- Aggregate analytics only: counts per day. No IP address, user agent or visitor identity is stored.
create table aura_profile.profile_view (workspace_id uuid not null references aura_identity.workspace on delete cascade, day date not null, views integer not null default 0, primary key (workspace_id, day));
create table aura_profile.kit_view (share_id uuid not null references aura_profile.kit_share on delete cascade, day date not null, views integer not null default 0, primary key (share_id, day));
create table aura_profile.brand_visit (id bigint generated always as identity primary key, share_id uuid not null references aura_profile.kit_share on delete cascade, brand_workspace_id uuid not null references aura_identity.workspace on delete cascade, at timestamptz not null default now()); -- only with the visitor's explicit consent
create table aura_profile.enquiry (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 brand_workspace_id uuid not null references aura_identity.workspace on delete cascade, sender uuid not null references auth.users,
 message text not null check (length(message) between 10 and 2000), created_at timestamptz not null default now()
); -- no client function can insert until Brand verification (M14) exists
create table aura_profile.media (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 purpose text not null check (purpose in ('cover','avatar','portfolio')), storage_path text not null unique, mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
 size_bytes integer not null check (size_bytes between 1 and 5242880), scan_status text not null default 'pending_scan' check (scan_status in ('pending_scan','clean','quarantined')),
 created_at timestamptz not null default now()
); -- contract: uploads are disabled until a private bucket and malware scanning exist; nothing pending is ever public

do $$ declare t text; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'aura_profile' and c.relkind = 'r' loop
  execute format('alter table aura_profile.%I enable row level security', t);
 end loop; end $$;

-- M03 hard-coded creator_profile.visibility to 'private' and left publication to M09.
alter table aura_creator.creator_profile drop constraint if exists creator_profile_visibility_check;
alter table aura_creator.creator_profile add constraint creator_profile_visibility_check check (visibility in ('private','public'));

-- ───────── helpers ─────────
create function aura_profile.audit(p_user uuid, p_event text) returns void language sql set search_path='' as $$ insert into aura_identity.event(user_id, event) values (p_user, p_event) $$;
create function aura_profile.token() returns text language sql volatile set search_path='' as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;
create function aura_profile.hash(p_token text) returns text language sql immutable set search_path='' as $$ select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') $$;
create function aura_profile.ensure(p_workspace uuid) returns aura_profile.profile language plpgsql set search_path='' as $$
declare p aura_profile.profile;
begin
 if not exists(select 1 from aura_creator.creator_profile where workspace_id = p_workspace and activated_at is not null) then raise exception 'Complete onboarding first' using errcode = '55000'; end if;
 insert into aura_profile.profile(workspace_id) values (p_workspace) on conflict do nothing;
 select * into p from aura_profile.profile where workspace_id = p_workspace;
 return p;
end $$;
create function aura_profile.valid_username(p text) returns text language plpgsql stable set search_path='' as $$
begin
 if p is null or p !~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$' or p ~ '[._-]{2}' then return 'format'; end if;
 if exists(select 1 from aura_profile.reserved_username where word = p) then return 'reserved'; end if;
 return null;
end $$;
-- F04: the standard discovery rule. Best SINGLE individual account with 100+ followers; accounts are never summed. Self-reported counts.
create function aura_profile.qualifies(p_workspace uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from aura_creator.social_account a where a.workspace_id = p_workspace and a.lifecycle = 'active' and a.ownership_scope = 'individual'
  and coalesce(a.self_reported_followers, -1) >= aura_profile.setting_int('discovery_min_followers')) $$;
create function aura_profile.ws_open(p_workspace uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from aura_identity.workspace w where w.id = p_workspace and w.kind = 'creator' and w.status = 'open') $$;
-- M14 contract: no Brand verification exists yet, so verified outreach is never possible.
create function aura_profile.brand_verified(p_workspace uuid) returns boolean language sql stable set search_path='' as $$ select false $$;

-- Current visibility of a referenced item, used to filter live AND snapshot content at read time.
create function aura_profile.item_visibility(p_workspace uuid, p_kind text, p_id uuid) returns text language sql stable set search_path='' as $$
 select case p_kind
  when 'portfolio' then (select visibility from aura_profile.portfolio_item where id = p_id and workspace_id = p_workspace)
  when 'service' then (select visibility from aura_profile.service where id = p_id and workspace_id = p_workspace)
  when 'package' then (select visibility from aura_profile.package where id = p_id and workspace_id = p_workspace)
  when 'experience' then (select visibility from aura_profile.experience where id = p_id and workspace_id = p_workspace)
  when 'testimonial' then (select case when status = 'approved' and displayed then 'public' end from aura_profile.testimonial where id = p_id and workspace_id = p_workspace)
  when 'account' then (select case when lifecycle in ('active','disconnected') and sharing_visibility = 'published' then 'public' end from aura_creator.social_account where id = p_id and workspace_id = p_workspace)
  else null end $$;
create function aura_profile.allowed(p_vis text, p_restricted boolean) returns boolean language sql immutable set search_path='' as $$
 select p_vis = 'public' or (p_restricted and p_vis = 'restricted') $$;

-- Item projections (allowlisted fields only).
create function aura_profile.portfolio_json(i aura_profile.portfolio_item, p_metrics boolean) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('ref_kind','portfolio','ref_id',i.id,'kind',i.kind,'title',i.title,'description',i.description,'link',i.link,'brand_name',i.brand_name,'year',i.year,'featured',i.featured,
  'speculative', i.kind = 'speculative', 'case_study', case when i.kind = 'case_study' then jsonb_build_object('objective',i.objective,'approach',i.approach,'contribution',i.contribution,'deliverables',to_jsonb(i.deliverables),'outcomes',i.outcomes) end,
  'metrics', case when p_metrics and i.show_metrics and i.content_ref is not null then (
    select coalesce(jsonb_agg(jsonb_build_object('metric', o.metric, 'value', o.value, 'window', o.window_kind, 'period_start', o.period_start, 'period_end', o.period_end, 'observed_on', o.observed_on, 'source', o.source) order by o.metric), '[]'::jsonb)
    from (select distinct on (co.metric, co.window_kind) co.* from aura_social.content_observation co where co.content_id = i.content_ref and co.superseded_by is null order by co.metric, co.window_kind, co.observed_on desc, co.entered_at desc) o) end) $$;
create function aura_profile.service_json(s aura_profile.service, p_rates boolean) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('ref_kind','service','ref_id',s.id,'kind',s.kind,'name',s.name,'description',s.description,'deliverables',to_jsonb(s.deliverables),
  'pricing', case when p_rates and s.rates_visibility = 'restricted' then jsonb_build_object('mode',s.pricing,'currency',s.currency,'min',s.price_min,'max',s.price_max) else jsonb_build_object('mode','on_request') end) $$;
create function aura_profile.package_json(k aura_profile.package, p_rates boolean) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('ref_kind','package','ref_id',k.id,'service_kind',k.service_kind,'name',k.name,'description',k.description,'deliverables',k.deliverables,'turnaround_days',k.turnaround_days,'revisions',k.revisions,
  'usage_rights',k.usage_rights,'terms',k.terms,'price', case when p_rates then jsonb_build_object('currency',k.currency,'min',k.price_min,'max',k.price_max) end) $$;
create function aura_profile.accounts_json(p_workspace uuid, p_counts boolean) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('ref_kind','account','ref_id',a.id,'platform',a.platform,'handle',a.handle,'ownership', case when a.verification = 'verified' then 'verified' else 'self_reported' end,
   'followers', case when p_counts and a.self_reported_followers is not null then jsonb_build_object('value',a.self_reported_followers,'observed_on',a.observed_on,'source','self_reported') end) order by a.is_primary desc, a.created_at), '[]'::jsonb)
 from aura_creator.social_account a where a.workspace_id = p_workspace and a.lifecycle in ('active','disconnected') and a.sharing_visibility = 'published' $$;

-- Public profile projection. Only for a published profile in an open Creator workspace; only public items.
create function aura_profile.public_json(p_workspace uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'username', p.username, 'display_name', c.display_name, 'headline', p.headline, 'about', p.about, 'theme', p.theme, 'cover', p.cover, 'section_order', to_jsonb(p.section_order), 'show_branding', p.show_branding,
  'niche', (select coalesce(n.custom_label, r.label) from aura_creator.niche n join aura_creator.niche_ref r on r.code = n.code where n.workspace_id = p_workspace and n.role = 'primary'),
  'availability', jsonb_build_object('status', p.availability, 'from', p.available_from, 'until', p.available_until, 'note', p.availability_note),
  'discoverable', p.listed and aura_profile.qualifies(p_workspace),
  'accounts', aura_profile.accounts_json(p_workspace, p.show_follower_counts),
  'portfolio', (select coalesce(jsonb_agg(aura_profile.portfolio_json(i, true) order by i.featured desc, i.position, i.created_at desc), '[]'::jsonb) from aura_profile.portfolio_item i where i.workspace_id = p_workspace and i.visibility = 'public' and i.kind <> 'case_study'),
  'case_studies', (select coalesce(jsonb_agg(aura_profile.portfolio_json(i, true) order by i.featured desc, i.position), '[]'::jsonb) from aura_profile.portfolio_item i where i.workspace_id = p_workspace and i.visibility = 'public' and i.kind = 'case_study'),
  'services', (select coalesce(jsonb_agg(aura_profile.service_json(s, false) order by s.position, s.created_at), '[]'::jsonb) from aura_profile.service s where s.workspace_id = p_workspace and s.visibility = 'public'),
  'experience', (select coalesce(jsonb_agg(jsonb_build_object('organisation',e.organisation,'role',e.role,'year_from',e.year_from,'year_to',e.year_to,'description',e.description,'evidence_url',e.evidence_url,'provenance',e.provenance) order by e.year_from desc nulls last, e.position), '[]'::jsonb) from aura_profile.experience e where e.workspace_id = p_workspace and e.visibility = 'public'),
  'testimonials', (select coalesce(jsonb_agg(jsonb_build_object('author_name',t.author_name,'author_role',t.author_role,'relationship',t.relationship,'body',t.body,'date',t.created_at::date) order by t.created_at desc), '[]'::jsonb) from aura_profile.testimonial t where t.workspace_id = p_workspace and t.status = 'approved' and t.displayed))
 from aura_profile.profile p join aura_creator.creator_profile c on c.workspace_id = p.workspace_id where p.workspace_id = p_workspace $$;

-- Media-kit content for one audience. p_restricted: the link is restricted (restricted items allowed); p_rates: rates may be included.
create function aura_profile.kit_content(p_kit uuid, p_restricted boolean, p_rates boolean) returns jsonb language plpgsql stable set search_path='' as $$
declare k aura_profile.media_kit; ws uuid; s record; out jsonb := '[]'::jsonb; items jsonb; base jsonb; prof aura_profile.profile;
begin
 select * into k from aura_profile.media_kit where id = p_kit; ws := k.workspace_id;
 select * into prof from aura_profile.profile where workspace_id = ws;
 base := aura_profile.public_json(ws);
 for s in select * from aura_profile.kit_section where kit_id = p_kit and enabled order by position loop
  items := case s.key
   when 'portfolio' then (select coalesce(jsonb_agg(aura_profile.portfolio_json(i, true) order by i.featured desc, i.position), '[]'::jsonb) from aura_profile.portfolio_item i where i.workspace_id = ws and i.kind <> 'case_study' and aura_profile.allowed(i.visibility, p_restricted) and (s.item_ids is null or i.id = any(s.item_ids)))
   when 'case_studies' then (select coalesce(jsonb_agg(aura_profile.portfolio_json(i, true) order by i.position), '[]'::jsonb) from aura_profile.portfolio_item i where i.workspace_id = ws and i.kind = 'case_study' and aura_profile.allowed(i.visibility, p_restricted) and (s.item_ids is null or i.id = any(s.item_ids)))
   when 'services' then (select coalesce(jsonb_agg(aura_profile.service_json(x, p_rates) order by x.position), '[]'::jsonb) from aura_profile.service x where x.workspace_id = ws and aura_profile.allowed(x.visibility, p_restricted) and (s.item_ids is null or x.id = any(s.item_ids)))
   when 'packages' then case when p_restricted then (select coalesce(jsonb_agg(aura_profile.package_json(x, p_rates) order by x.position), '[]'::jsonb) from aura_profile.package x where x.workspace_id = ws and x.visibility = 'restricted' and (s.item_ids is null or x.id = any(s.item_ids))) else '[]'::jsonb end
   when 'experience' then (select coalesce(jsonb_agg(jsonb_build_object('ref_kind','experience','ref_id',e.id,'organisation',e.organisation,'role',e.role,'year_from',e.year_from,'year_to',e.year_to,'description',e.description,'provenance',e.provenance) order by e.year_from desc nulls last), '[]'::jsonb) from aura_profile.experience e where e.workspace_id = ws and aura_profile.allowed(e.visibility, p_restricted) and (s.item_ids is null or e.id = any(s.item_ids)))
   when 'testimonials' then (select coalesce(jsonb_agg(jsonb_build_object('ref_kind','testimonial','ref_id',t.id,'author_name',t.author_name,'author_role',t.author_role,'relationship',t.relationship,'body',t.body,'date',t.created_at::date)), '[]'::jsonb) from aura_profile.testimonial t where t.workspace_id = ws and t.status = 'approved' and t.displayed and (s.item_ids is null or t.id = any(s.item_ids)))
   when 'accounts' then (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(aura_profile.accounts_json(ws, prof.show_follower_counts)) x where s.item_ids is null or (x->>'ref_id')::uuid = any(s.item_ids))
   when 'audience' then case when p_restricted then (select coalesce(jsonb_agg(jsonb_build_object('ref_kind','audience','dimension',a.dimension,'buckets',a.buckets,'observed_on',a.observed_on,'source',a.source,'denominator_kind',a.denominator_kind,'coverage_pct',a.coverage_pct) order by a.dimension), '[]'::jsonb)
      from (select distinct on (x.account_id, x.dimension) x.* from aura_analytics.audience_snapshot x join aura_creator.social_account sa on sa.id = x.account_id and sa.lifecycle = 'active' where x.workspace_id = ws and x.superseded_by is null order by x.account_id, x.dimension, x.observed_on desc) a) else '[]'::jsonb end
   else '[]'::jsonb end;
  out := out || jsonb_build_array(jsonb_build_object('key', s.key, 'items', items,
   'text', case s.key when 'about' then jsonb_build_object('headline', base->'headline', 'about', base->'about', 'niche', base->'niche') when 'availability' then base->'availability' when 'contact' then to_jsonb(k.contact_note) end));
 end loop;
 return jsonb_build_object('kit', jsonb_build_object('name', k.name, 'audience', k.audience, 'template', k.template, 'intro', k.intro), 'creator', jsonb_build_object('display_name', base->'display_name', 'username', case when prof.published then base->'username' end, 'theme', base->'theme'),
  'show_branding', prof.show_branding, 'restricted', p_restricted, 'rates_included', p_rates, 'sections', out);
end $$;
-- A stored snapshot is re-filtered at read time: anything since made private, deleted or no longer displayed disappears; rates and restricted
-- items disappear from links that do not allow them.
create function aura_profile.filter_content(p_workspace uuid, c jsonb, p_restricted boolean, p_rates boolean) returns jsonb language plpgsql stable set search_path='' as $$
declare s jsonb; out jsonb := '[]'::jsonb; items jsonb; it jsonb; kept jsonb;
begin
 for s in select * from jsonb_array_elements(c->'sections') loop
  if s->>'key' in ('packages','audience') and not p_restricted then continue; end if;
  kept := '[]'::jsonb;
  for it in select * from jsonb_array_elements(coalesce(s->'items', '[]'::jsonb)) loop
   if it->>'ref_kind' = 'audience' then kept := kept || jsonb_build_array(it); continue; end if;
   if aura_profile.allowed(aura_profile.item_visibility(p_workspace, it->>'ref_kind', (it->>'ref_id')::uuid), p_restricted) or (it->>'ref_kind' = 'package' and p_restricted and aura_profile.item_visibility(p_workspace, 'package', (it->>'ref_id')::uuid) = 'restricted') then
    if not p_rates then it := it - 'price'; if it ? 'pricing' then it := jsonb_set(it, '{pricing}', '{"mode":"on_request"}'); end if; end if;
    kept := kept || jsonb_build_array(it);
   end if;
  end loop;
  out := out || jsonb_build_array(jsonb_set(s, '{items}', kept));
 end loop;
 return jsonb_set(jsonb_set(c, '{sections}', out), '{rates_included}', to_jsonb(p_rates));
end $$;

-- ───────── Creator: profile ─────────
create function aura_profile.state(p_workspace uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'profile', (select to_jsonb(p) - 'workspace_id' from aura_profile.profile p where p.workspace_id = p_workspace),
  'display_name', (select display_name from aura_creator.creator_profile where workspace_id = p_workspace),
  'qualifies', aura_profile.qualifies(p_workspace),
  'portfolio', (select coalesce(jsonb_agg(to_jsonb(i) - 'workspace_id' - 'request_id' order by i.featured desc, i.position, i.created_at desc), '[]'::jsonb) from aura_profile.portfolio_item i where i.workspace_id = p_workspace),
  'services', (select coalesce(jsonb_agg(to_jsonb(s) - 'workspace_id' order by s.position, s.created_at), '[]'::jsonb) from aura_profile.service s where s.workspace_id = p_workspace),
  'packages', (select coalesce(jsonb_agg(to_jsonb(k) - 'workspace_id' order by k.position, k.created_at), '[]'::jsonb) from aura_profile.package k where k.workspace_id = p_workspace),
  'experience', (select coalesce(jsonb_agg(to_jsonb(e) - 'workspace_id' order by e.year_from desc nulls last, e.position), '[]'::jsonb) from aura_profile.experience e where e.workspace_id = p_workspace),
  'testimonials', (select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'author_name',t.author_name,'author_role',t.author_role,'relationship',t.relationship,'body',t.body,'status',t.status,'displayed',t.displayed,'decision_reason',t.decision_reason,'created_at',t.created_at) order by t.created_at desc), '[]'::jsonb) from aura_profile.testimonial t where t.workspace_id = p_workspace),
  'invites', (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'label',v.label,'expires_at',v.expires_at,'used_at',v.used_at,'revoked_at',v.revoked_at,'created_at',v.created_at) order by v.created_at desc), '[]'::jsonb) from aura_profile.testimonial_invite v where v.workspace_id = p_workspace),
  'accounts', (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'platform',a.platform,'handle',a.handle,'verification',a.verification,'sharing_visibility',a.sharing_visibility,'followers',a.self_reported_followers,'observed_on',a.observed_on,'lifecycle',a.lifecycle) order by a.is_primary desc, a.created_at), '[]'::jsonb) from aura_creator.social_account a where a.workspace_id = p_workspace and a.lifecycle in ('active','disconnected')),
  'content', (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',coalesce(r.title, r.external_id),'platform',a.platform) order by r.created_at desc), '[]'::jsonb) from aura_social.content_ref r join aura_creator.social_account a on a.id = r.account_id where r.workspace_id = p_workspace),
  'aliases', (select coalesce(jsonb_agg(jsonb_build_object('username',x.username,'expires_at',x.expires_at)), '[]'::jsonb) from aura_profile.username_alias x where x.workspace_id = p_workspace and x.expires_at > now())) $$;
create function public.aura_profile_state(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin perform aura_profile.ensure(p_workspace); return aura_profile.state(p_workspace); end $$;

create function public.aura_profile_save(p_workspace uuid, p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); p aura_profile.profile := aura_profile.ensure(p_workspace); nu text; why text; ord text[];
begin
 perform pg_advisory_xact_lock(hashtextextended('profile:' || p_workspace::text, 0));
 if p_patch ? 'username' then
  nu := lower(trim(p_patch->>'username'));
  if nu is distinct from p.username then
   why := aura_profile.valid_username(nu);
   if why = 'format' then raise exception 'Invalid username' using errcode = '22023'; end if;
   if why = 'reserved' then raise exception 'That username is reserved' using errcode = '23505'; end if;
   perform pg_advisory_xact_lock(hashtextextended('username:' || nu, 0));
   if exists(select 1 from aura_profile.profile where username = nu) or exists(select 1 from aura_profile.username_alias where username = nu and expires_at > now() and workspace_id <> p_workspace) then raise exception 'That username is taken' using errcode = '23505'; end if;
   if p.username is not null and (select count(*) from aura_profile.username_change where workspace_id = p_workspace and at > now() - interval '30 days') >= aura_profile.setting_int('username_change_limit_30d') then raise exception 'Username changed too often' using errcode = '54000'; end if;
   delete from aura_profile.username_alias where username = nu and workspace_id = p_workspace;
   if p.username is not null then
    insert into aura_profile.username_alias(username, workspace_id, expires_at) values (p.username, p_workspace, now() + make_interval(days => aura_profile.setting_int('username_alias_days')))
     on conflict (username) do update set workspace_id = excluded.workspace_id, retired_at = now(), expires_at = excluded.expires_at;
    insert into aura_profile.username_change(workspace_id) values (p_workspace);
   end if;
  end if;
 else nu := p.username; end if;
 if p_patch ? 'section_order' then
  ord := array(select jsonb_array_elements_text(p_patch->'section_order'));
  if cardinality(ord) <> 8 or (select count(distinct x) from unnest(ord) x) <> 8 then raise exception 'Invalid section order' using errcode = '22023'; end if;
 else ord := p.section_order; end if;
 update aura_profile.profile set username = nu,
  headline = case when p_patch ? 'headline' then nullif(trim(p_patch->>'headline'), '') else headline end,
  about = case when p_patch ? 'about' then nullif(trim(p_patch->>'about'), '') else about end,
  theme = coalesce(p_patch->>'theme', theme), cover = coalesce(p_patch->>'cover', cover), section_order = ord,
  show_follower_counts = coalesce((p_patch->>'show_follower_counts')::boolean, show_follower_counts), show_branding = coalesce((p_patch->>'show_branding')::boolean, show_branding),
  availability = coalesce(p_patch->>'availability', availability),
  available_from = case when p_patch ? 'available_from' then nullif(p_patch->>'available_from', '')::date else available_from end,
  available_until = case when p_patch ? 'available_until' then nullif(p_patch->>'available_until', '')::date else available_until end,
  availability_note = case when p_patch ? 'availability_note' then nullif(trim(p_patch->>'availability_note'), '') else availability_note end,
  updated_at = now() where workspace_id = p_workspace;
 perform aura_profile.audit(u, 'profile_saved');
 return aura_profile.state(p_workspace);
end $$;
create function aura_profile.checks(p_workspace uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
  'username', p.username is not null, 'display_name', c.display_name is not null, 'headline_or_about', coalesce(p.headline, p.about) is not null,
  'workspace_open', aura_profile.ws_open(p_workspace), 'qualifies_for_discovery', aura_profile.qualifies(p_workspace))
 from aura_profile.profile p join aura_creator.creator_profile c on c.workspace_id = p.workspace_id where p.workspace_id = p_workspace $$;
create function public.aura_profile_publish(p_workspace uuid, p_publish boolean, p_listed boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); p aura_profile.profile := aura_profile.ensure(p_workspace); c jsonb;
begin
 c := aura_profile.checks(p_workspace);
 if p_publish then
  if not ((c->>'username')::boolean and (c->>'display_name')::boolean and (c->>'headline_or_about')::boolean and (c->>'workspace_open')::boolean) then raise exception 'Profile is not ready to publish' using errcode = '55000'; end if;
  if p_listed and not (c->>'qualifies_for_discovery')::boolean then raise exception 'Discovery needs a qualifying account' using errcode = '55000'; end if;
  update aura_profile.profile set published = true, listed = coalesce(p_listed, false), published_at = coalesce(published_at, now()), updated_at = now() where workspace_id = p_workspace;
  update aura_creator.creator_profile set visibility = 'public', updated_at = now() where workspace_id = p_workspace;
  perform aura_profile.audit(u, 'profile_published');
 else
  update aura_profile.profile set published = false, listed = false, updated_at = now() where workspace_id = p_workspace;
  update aura_creator.creator_profile set visibility = 'private', updated_at = now() where workspace_id = p_workspace;
  perform aura_profile.audit(u, 'profile_unpublished');
 end if;
 return jsonb_build_object('checks', c, 'state', aura_profile.state(p_workspace));
end $$;
create function public.aura_profile_preview(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 if not exists(select 1 from aura_profile.profile where workspace_id = p_workspace) then return null; end if;
 return aura_profile.public_json(p_workspace) || jsonb_build_object('checks', aura_profile.checks(p_workspace), 'published', (select published from aura_profile.profile where workspace_id = p_workspace));
end $$;

-- ───────── Creator: portfolio, services, packages, experience ─────────
create function public.aura_profile_save_item(p_workspace uuid, p_request uuid, p_id uuid, p_item jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); i aura_profile.portfolio_item; cref uuid := nullif(p_item->>'content_ref', '')::uuid; o jsonb;
begin
 perform aura_profile.ensure(p_workspace);
 if cref is not null and not exists(select 1 from aura_social.content_ref where id = cref and workspace_id = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 for o in select * from jsonb_array_elements(coalesce(p_item->'outcomes', '[]'::jsonb)) loop
  -- a "supported outcome" states its source; anything not backed by a recorded observation is labelled self-reported
  if length(coalesce(o->>'statement', '')) not between 3 and 200 or coalesce(o->>'source', '') not in ('self_reported','observation') then raise exception 'Invalid outcome' using errcode = '22023'; end if;
  if o->>'source' = 'observation' and not exists(select 1 from aura_social.content_observation x where x.id = nullif(o->>'observation_id', '')::uuid and x.workspace_id = p_workspace) and not exists(select 1 from aura_social.account_observation x where x.id = nullif(o->>'observation_id', '')::uuid and x.workspace_id = p_workspace) then raise exception 'Invalid outcome source' using errcode = '22023'; end if;
 end loop;
 if p_id is null then
  perform pg_advisory_xact_lock(hashtextextended('profile_req:' || p_workspace::text || coalesce(p_request::text, ''), 0));
  select * into i from aura_profile.portfolio_item where workspace_id = p_workspace and request_id = p_request;
  if i.id is not null then return to_jsonb(i) - 'workspace_id' - 'request_id'; end if;
  insert into aura_profile.portfolio_item(workspace_id, kind, title, description, link, content_ref, studio_ref, brand_name, year, objective, approach, contribution, deliverables, outcomes, show_metrics, visibility, featured, position, request_id)
  values (p_workspace, p_item->>'kind', trim(p_item->>'title'), nullif(trim(p_item->>'description'), ''), nullif(p_item->>'link', ''), cref, nullif(p_item->>'studio_ref', ''), nullif(trim(p_item->>'brand_name'), ''), nullif(p_item->>'year', '')::int,
   nullif(trim(p_item->>'objective'), ''), nullif(trim(p_item->>'approach'), ''), nullif(trim(p_item->>'contribution'), ''), coalesce(array(select jsonb_array_elements_text(p_item->'deliverables')), '{}'), coalesce(p_item->'outcomes', '[]'),
   coalesce((p_item->>'show_metrics')::boolean, false), coalesce(p_item->>'visibility', 'private'), coalesce((p_item->>'featured')::boolean, false), coalesce((p_item->>'position')::int, 0), p_request) returning * into i;
 else
  update aura_profile.portfolio_item set kind = p_item->>'kind', title = trim(p_item->>'title'), description = nullif(trim(p_item->>'description'), ''), link = nullif(p_item->>'link', ''), content_ref = cref, studio_ref = nullif(p_item->>'studio_ref', ''),
   brand_name = nullif(trim(p_item->>'brand_name'), ''), year = nullif(p_item->>'year', '')::int, objective = nullif(trim(p_item->>'objective'), ''), approach = nullif(trim(p_item->>'approach'), ''), contribution = nullif(trim(p_item->>'contribution'), ''),
   deliverables = coalesce(array(select jsonb_array_elements_text(p_item->'deliverables')), '{}'), outcomes = coalesce(p_item->'outcomes', '[]'), show_metrics = coalesce((p_item->>'show_metrics')::boolean, false),
   visibility = coalesce(p_item->>'visibility', 'private'), featured = coalesce((p_item->>'featured')::boolean, false), position = coalesce((p_item->>'position')::int, position), updated_at = now()
   where id = p_id and workspace_id = p_workspace returning * into i;
  if i.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 end if;
 perform aura_profile.audit(u, 'profile_portfolio_saved');
 return to_jsonb(i) - 'workspace_id' - 'request_id';
end $$;
create function public.aura_profile_save_service(p_workspace uuid, p_id uuid, p_s jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); s aura_profile.service;
begin
 perform aura_profile.ensure(p_workspace);
 if p_id is null then
  insert into aura_profile.service(workspace_id, kind, name, description, deliverables, pricing, currency, price_min, price_max, visibility, rates_visibility, position)
  values (p_workspace, p_s->>'kind', trim(p_s->>'name'), nullif(trim(p_s->>'description'), ''), coalesce(array(select jsonb_array_elements_text(p_s->'deliverables')), '{}'), coalesce(p_s->>'pricing', 'quote'), coalesce(p_s->>'currency', 'INR'),
   nullif(p_s->>'price_min', '')::numeric, nullif(p_s->>'price_max', '')::numeric, coalesce(p_s->>'visibility', 'private'), coalesce(p_s->>'rates_visibility', 'private'), coalesce((p_s->>'position')::int, 0)) returning * into s;
 else
  update aura_profile.service set kind = p_s->>'kind', name = trim(p_s->>'name'), description = nullif(trim(p_s->>'description'), ''), deliverables = coalesce(array(select jsonb_array_elements_text(p_s->'deliverables')), '{}'),
   pricing = coalesce(p_s->>'pricing', 'quote'), currency = coalesce(p_s->>'currency', 'INR'), price_min = nullif(p_s->>'price_min', '')::numeric, price_max = nullif(p_s->>'price_max', '')::numeric,
   visibility = coalesce(p_s->>'visibility', 'private'), rates_visibility = coalesce(p_s->>'rates_visibility', 'private'), updated_at = now() where id = p_id and workspace_id = p_workspace returning * into s;
  if s.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 end if;
 perform aura_profile.audit(u, 'profile_service_saved');
 return to_jsonb(s) - 'workspace_id';
end $$;
create function public.aura_profile_save_package(p_workspace uuid, p_id uuid, p_k jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); k aura_profile.package; d jsonb;
begin
 perform aura_profile.ensure(p_workspace);
 for d in select * from jsonb_array_elements(coalesce(p_k->'deliverables', '[]'::jsonb)) loop
  if length(coalesce(d->>'item', '')) not between 2 and 80 or coalesce((d->>'quantity')::int, 0) not between 1 and 100 then raise exception 'Invalid deliverable' using errcode = '22023'; end if;
 end loop;
 if p_id is null then
  insert into aura_profile.package(workspace_id, service_kind, name, description, deliverables, currency, price_min, price_max, turnaround_days, revisions, usage_rights, terms, visibility)
  values (p_workspace, coalesce(p_k->>'service_kind', 'influencer'), trim(p_k->>'name'), nullif(trim(p_k->>'description'), ''), coalesce(p_k->'deliverables', '[]'), coalesce(p_k->>'currency', 'INR'), nullif(p_k->>'price_min', '')::numeric, nullif(p_k->>'price_max', '')::numeric,
   nullif(p_k->>'turnaround_days', '')::int, nullif(p_k->>'revisions', '')::int, nullif(trim(p_k->>'usage_rights'), ''), nullif(trim(p_k->>'terms'), ''), coalesce(p_k->>'visibility', 'private')) returning * into k;
 else
  update aura_profile.package set service_kind = coalesce(p_k->>'service_kind', 'influencer'), name = trim(p_k->>'name'), description = nullif(trim(p_k->>'description'), ''), deliverables = coalesce(p_k->'deliverables', '[]'), currency = coalesce(p_k->>'currency', 'INR'),
   price_min = nullif(p_k->>'price_min', '')::numeric, price_max = nullif(p_k->>'price_max', '')::numeric, turnaround_days = nullif(p_k->>'turnaround_days', '')::int, revisions = nullif(p_k->>'revisions', '')::int,
   usage_rights = nullif(trim(p_k->>'usage_rights'), ''), terms = nullif(trim(p_k->>'terms'), ''), visibility = coalesce(p_k->>'visibility', 'private'), updated_at = now() where id = p_id and workspace_id = p_workspace returning * into k;
  if k.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 end if;
 perform aura_profile.audit(u, 'profile_package_saved');
 return to_jsonb(k) - 'workspace_id';
end $$;
create function public.aura_profile_save_experience(p_workspace uuid, p_id uuid, p_e jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); e aura_profile.experience;
begin
 perform aura_profile.ensure(p_workspace);
 if p_id is null then
  insert into aura_profile.experience(workspace_id, organisation, role, year_from, year_to, description, evidence_url, visibility)
  values (p_workspace, trim(p_e->>'organisation'), nullif(trim(p_e->>'role'), ''), nullif(p_e->>'year_from', '')::int, nullif(p_e->>'year_to', '')::int, nullif(trim(p_e->>'description'), ''), nullif(p_e->>'evidence_url', ''), coalesce(p_e->>'visibility', 'private')) returning * into e;
 else
  update aura_profile.experience set organisation = trim(p_e->>'organisation'), role = nullif(trim(p_e->>'role'), ''), year_from = nullif(p_e->>'year_from', '')::int, year_to = nullif(p_e->>'year_to', '')::int, description = nullif(trim(p_e->>'description'), ''),
   evidence_url = nullif(p_e->>'evidence_url', ''), visibility = coalesce(p_e->>'visibility', 'private'), updated_at = now() where id = p_id and workspace_id = p_workspace returning * into e;
  if e.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 end if;
 perform aura_profile.audit(u, 'profile_experience_saved');
 return to_jsonb(e) - 'workspace_id';
end $$;
create function public.aura_profile_delete(p_workspace uuid, p_kind text, p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); n int;
begin
 if p_kind = 'portfolio' then delete from aura_profile.portfolio_item where id = p_id and workspace_id = p_workspace;
 elsif p_kind = 'service' then delete from aura_profile.service where id = p_id and workspace_id = p_workspace;
 elsif p_kind = 'package' then delete from aura_profile.package where id = p_id and workspace_id = p_workspace;
 elsif p_kind = 'experience' then delete from aura_profile.experience where id = p_id and workspace_id = p_workspace;
 elsif p_kind = 'kit' then delete from aura_profile.media_kit where id = p_id and workspace_id = p_workspace;
 else raise exception 'Invalid kind' using errcode = '22023'; end if;
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Access denied' using errcode = '42501'; end if;
 perform aura_profile.audit(u, 'profile_' || p_kind || '_deleted');
 return jsonb_build_object('deleted', p_id);
end $$;

-- ───────── Testimonials ─────────
create function public.aura_profile_create_invite(p_workspace uuid, p_label text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); t text := aura_profile.token(); v aura_profile.testimonial_invite;
begin
 perform aura_profile.ensure(p_workspace);
 if (select count(*) from aura_profile.testimonial_invite where workspace_id = p_workspace and created_at > now() - interval '1 day') >= 20 then raise exception 'Too many invitations today' using errcode = '54000'; end if;
 insert into aura_profile.testimonial_invite(workspace_id, token_hash, label, expires_at) values (p_workspace, aura_profile.hash(t), nullif(trim(p_label), ''), now() + make_interval(days => aura_profile.setting_int('invite_days'))) returning * into v;
 perform aura_profile.audit(u, 'profile_invite_created');
 return jsonb_build_object('id', v.id, 'token', t, 'expires_at', v.expires_at); -- the token is returned once and only its hash is stored
end $$;
create function public.aura_profile_revoke_invite(p_workspace uuid, p_invite uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 update aura_profile.testimonial_invite set revoked_at = coalesce(revoked_at, now()) where id = p_invite and workspace_id = p_workspace;
 if not found then raise exception 'Access denied' using errcode = '42501'; end if;
 return jsonb_build_object('revoked', p_invite);
end $$;
-- What the invited person sees before writing: whose profile it is, never anything private.
create function public.aura_profile_invite_info(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v aura_profile.testimonial_invite;
begin
 perform aura_identity.eligible();
 select * into v from aura_profile.testimonial_invite where token_hash = aura_profile.hash(p_token);
 if v.id is null or v.revoked_at is not null or v.used_at is not null or v.expires_at <= now() then return jsonb_build_object('valid', false); end if;
 return jsonb_build_object('valid', true, 'display_name', (select display_name from aura_creator.creator_profile where workspace_id = v.workspace_id), 'expires_at', v.expires_at);
end $$;
create function public.aura_profile_submit_testimonial(p_token text, p_author_name text, p_author_role text, p_relationship text, p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_identity.eligible(); v aura_profile.testimonial_invite; t aura_profile.testimonial;
begin
 select * into v from aura_profile.testimonial_invite where token_hash = aura_profile.hash(p_token) for update;
 if v.id is null or v.revoked_at is not null or v.used_at is not null or v.expires_at <= now() then raise exception 'This invitation is not valid' using errcode = '42501'; end if;
 -- Genuine and attributable: nobody inside the Creator's own workspace may write their testimonial.
 if exists(select 1 from aura_identity.membership m where m.workspace_id = v.workspace_id and m.user_id = u and m.active) then raise exception 'You cannot review your own workspace' using errcode = '42501'; end if;
 insert into aura_profile.testimonial(workspace_id, invite_id, author_user, author_name, author_role, relationship, body) values (v.workspace_id, v.id, u, trim(p_author_name), nullif(trim(p_author_role), ''), p_relationship, trim(p_body)) returning * into t;
 update aura_profile.testimonial_invite set used_at = now() where id = v.id;
 perform aura_profile.audit(u, 'profile_testimonial_submitted');
 return jsonb_build_object('id', t.id, 'status', t.status);
end $$;
create function public.aura_profile_testimonial_action(p_workspace uuid, p_id uuid, p_action text, p_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); t aura_profile.testimonial;
begin
 select * into t from aura_profile.testimonial where id = p_id and workspace_id = p_workspace for update;
 if t.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_action = 'show' then
  if t.status <> 'approved' then raise exception 'Only an approved testimonial can be shown' using errcode = '55000'; end if;
  update aura_profile.testimonial set displayed = true where id = t.id;
 elsif p_action = 'hide' then update aura_profile.testimonial set displayed = false where id = t.id;
 elsif p_action = 'dispute' then
  if length(coalesce(trim(p_reason), '')) < 5 then raise exception 'Give a reason' using errcode = '22023'; end if;
  update aura_profile.testimonial set status = 'disputed', displayed = false, dispute_reason = trim(p_reason) where id = t.id;
 else raise exception 'Invalid action' using errcode = '22023'; end if;
 perform aura_profile.audit(u, 'profile_testimonial_' || p_action);
 return jsonb_build_object('id', t.id, 'action', p_action);
end $$;
-- Moderation by a restricted reviewer (Platform Admin + reviewer grant + MFA, the M05 rule). The body is never edited.
create function public.aura_profile_moderation_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'status', t.status, 'author_name', t.author_name, 'relationship', t.relationship, 'body', t.body, 'dispute_reason', t.dispute_reason, 'created_at', t.created_at,
   'creator', (select display_name from aura_creator.creator_profile where workspace_id = t.workspace_id)) order by t.created_at)
  from aura_profile.testimonial t where t.status in ('pending','disputed')), '[]'::jsonb);
end $$;
create function public.aura_profile_moderate(p_id uuid, p_decision text, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); t aura_profile.testimonial;
begin
 if p_decision not in ('approved','rejected','removed') or length(coalesce(trim(p_reason), '')) < 3 then raise exception 'A decision and reason are required' using errcode = '22023'; end if;
 select * into t from aura_profile.testimonial where id = p_id and status in ('pending','disputed') for update;
 if t.id is null then raise exception 'Nothing to decide' using errcode = '55000'; end if;
 if exists(select 1 from aura_identity.membership m where m.workspace_id = t.workspace_id and m.user_id = u and m.active) or t.author_user = u then raise exception 'You cannot moderate your own testimonial' using errcode = '42501'; end if;
 update aura_profile.testimonial set status = p_decision, displayed = false, decision_reason = trim(p_reason), decided_by = u, decided_at = now() where id = t.id returning * into t;
 perform aura_profile.audit(u, 'profile_testimonial_moderated');
 return jsonb_build_object('id', t.id, 'status', t.status);
end $$;

-- ───────── Media kits ─────────
create function aura_profile.kit_of(p_workspace uuid, p_kit uuid) returns aura_profile.media_kit language plpgsql set search_path='' as $$
declare k aura_profile.media_kit;
begin
 select * into k from aura_profile.media_kit where id = p_kit and workspace_id = p_workspace;
 if k.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return k;
end $$;
create function public.aura_profile_create_kit(p_workspace uuid, p_request uuid, p_kit jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); k aura_profile.media_kit; i int := 0; key text;
begin
 perform aura_profile.ensure(p_workspace);
 perform pg_advisory_xact_lock(hashtextextended('profile_req:' || p_workspace::text || p_request::text, 0));
 select * into k from aura_profile.media_kit where workspace_id = p_workspace and request_id = p_request;
 if k.id is not null then return to_jsonb(k) - 'workspace_id' - 'request_id'; end if;
 if (select count(*) from aura_profile.media_kit where workspace_id = p_workspace) >= 20 then raise exception 'Too many media kits' using errcode = '23514'; end if;
 insert into aura_profile.media_kit(workspace_id, name, audience, template, intro, contact_note, request_id) values (p_workspace, trim(p_kit->>'name'), nullif(trim(p_kit->>'audience'), ''), coalesce(p_kit->>'template', 'editorial'), nullif(trim(p_kit->>'intro'), ''), nullif(trim(p_kit->>'contact_note'), ''), p_request) returning * into k;
 foreach key in array array['about','accounts','portfolio','case_studies','services','packages','experience','testimonials','audience','availability','contact'] loop
  i := i + 1; insert into aura_profile.kit_section(kit_id, key, position, enabled) values (k.id, key, i, key not in ('packages','audience'));
 end loop;
 perform aura_profile.audit(u, 'profile_kit_created');
 return to_jsonb(k) - 'workspace_id' - 'request_id';
end $$;
create function public.aura_profile_save_kit(p_workspace uuid, p_kit uuid, p_meta jsonb, p_sections jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); k aura_profile.media_kit := aura_profile.kit_of(p_workspace, p_kit); s jsonb; ids uuid[];
begin
 update aura_profile.media_kit set name = coalesce(nullif(trim(p_meta->>'name'), ''), name), audience = case when p_meta ? 'audience' then nullif(trim(p_meta->>'audience'), '') else audience end,
  template = coalesce(p_meta->>'template', template), intro = case when p_meta ? 'intro' then nullif(trim(p_meta->>'intro'), '') else intro end,
  contact_note = case when p_meta ? 'contact_note' then nullif(trim(p_meta->>'contact_note'), '') else contact_note end, updated_at = now() where id = k.id;
 if p_sections is not null then
  for s in select * from jsonb_array_elements(p_sections) loop
   ids := case when s ? 'item_ids' and jsonb_typeof(s->'item_ids') = 'array' then array(select jsonb_array_elements_text(s->'item_ids')::uuid) end;
   update aura_profile.kit_section set enabled = coalesce((s->>'enabled')::boolean, enabled), position = coalesce((s->>'position')::int, position), item_ids = ids where kit_id = k.id and key = s->>'key';
   if not found then raise exception 'Invalid section' using errcode = '22023'; end if;
  end loop;
 end if;
 return (select to_jsonb(x) - 'workspace_id' - 'request_id' from aura_profile.media_kit x where x.id = k.id);
end $$;
create function public.aura_profile_kits(p_workspace uuid, p_kit uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false);
begin
 return coalesce((select jsonb_agg(to_jsonb(k) - 'workspace_id' - 'request_id' || jsonb_build_object(
   'sections', (select jsonb_agg(jsonb_build_object('key', s.key, 'position', s.position, 'enabled', s.enabled, 'item_ids', s.item_ids) order by s.position) from aura_profile.kit_section s where s.kit_id = k.id),
   'versions', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'version', v.version, 'note', v.note, 'created_at', v.created_at) order by v.version desc), '[]'::jsonb) from aura_profile.kit_version v where v.kit_id = k.id),
   'shares', (select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'kind', h.kind, 'recipient', h.recipient_workspace_id, 'version_id', h.version_id, 'include_rates', h.include_rates, 'label', h.label, 'expires_at', h.expires_at, 'revoked_at', h.revoked_at, 'created_at', h.created_at,
      'active', h.revoked_at is null and (h.expires_at is null or h.expires_at > now()), 'views', (select coalesce(sum(views), 0) from aura_profile.kit_view w where w.share_id = h.id),
      'brand_visits', (select count(*) from aura_profile.brand_visit b where b.share_id = h.id)) order by h.created_at desc), '[]'::jsonb) from aura_profile.kit_share h where h.kit_id = k.id)) order by k.updated_at desc)
  from aura_profile.media_kit k where k.workspace_id = p_workspace and (p_kit is null or k.id = p_kit)), '[]'::jsonb);
end $$;
-- The Creator's own preview: restricted view with rates, exactly as a restricted link with rates would show it.
create function public.aura_profile_kit_preview(p_workspace uuid, p_kit uuid, p_restricted boolean, p_rates boolean, p_version uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); k aura_profile.media_kit := aura_profile.kit_of(p_workspace, p_kit); c jsonb;
begin
 if p_version is not null then select content into c from aura_profile.kit_version where id = p_version and kit_id = k.id; if c is null then raise exception 'Access denied' using errcode = '42501'; end if;
  return aura_profile.filter_content(p_workspace, c, coalesce(p_restricted, false), coalesce(p_rates, false) and coalesce(p_restricted, false)); end if;
 return aura_profile.kit_content(k.id, coalesce(p_restricted, false), coalesce(p_rates, false) and coalesce(p_restricted, false));
end $$;
create function public.aura_profile_snapshot_kit(p_workspace uuid, p_kit uuid, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); k aura_profile.media_kit := aura_profile.kit_of(p_workspace, p_kit); v aura_profile.kit_version; n int;
begin
 perform pg_advisory_xact_lock(hashtextextended('kit_version:' || k.id::text, 0));
 select coalesce(max(version), 0) + 1 into n from aura_profile.kit_version where kit_id = k.id;
 -- the snapshot holds the fullest permitted content; every read re-filters it for the link and for current visibility
 insert into aura_profile.kit_version(kit_id, version, content, note, created_by) values (k.id, n, aura_profile.kit_content(k.id, true, true), nullif(trim(p_note), ''), u) returning * into v;
 perform aura_profile.audit(u, 'profile_kit_snapshot');
 return jsonb_build_object('id', v.id, 'version', v.version, 'created_at', v.created_at);
end $$;
create function public.aura_profile_create_share(p_workspace uuid, p_kit uuid, p_kind text, p_recipient uuid, p_version uuid, p_include_rates boolean, p_label text, p_days integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); k aura_profile.media_kit := aura_profile.kit_of(p_workspace, p_kit); t text := aura_profile.token(); h aura_profile.kit_share; days int := p_days;
begin
 if p_kind not in ('public','restricted') then raise exception 'Invalid link type' using errcode = '22023'; end if;
 if p_kind = 'restricted' and (p_recipient is null or p_recipient = p_workspace or not exists(select 1 from aura_identity.workspace w where w.id = p_recipient and w.kind in ('brand','agency') and w.status = 'open')) then raise exception 'Invalid recipient' using errcode = '22023'; end if;
 if p_version is not null and not exists(select 1 from aura_profile.kit_version where id = p_version and kit_id = k.id) then raise exception 'Access denied' using errcode = '42501'; end if;
 if days is null and p_kind = 'restricted' then days := aura_profile.setting_int('share_default_days'); end if;
 if days is not null and (days < 1 or days > aura_profile.setting_int('share_max_days')) then raise exception 'Invalid expiry' using errcode = '22023'; end if;
 if (select count(*) from aura_profile.kit_share where workspace_id = p_workspace and revoked_at is null and (expires_at is null or expires_at > now())) >= 50 then raise exception 'Too many active links' using errcode = '23514'; end if;
 insert into aura_profile.kit_share(kit_id, workspace_id, token_hash, kind, recipient_workspace_id, version_id, include_rates, label, expires_at)
  values (k.id, p_workspace, aura_profile.hash(t), p_kind, case when p_kind = 'restricted' then p_recipient end, p_version, p_kind = 'restricted' and coalesce(p_include_rates, false), nullif(trim(p_label), ''), case when days is not null then now() + make_interval(days => days) end) returning * into h;
 perform aura_profile.audit(u, 'profile_kit_link_created');
 return jsonb_build_object('id', h.id, 'token', t, 'kind', h.kind, 'expires_at', h.expires_at); -- the token is shown once; only its hash is kept
end $$;
create function public.aura_profile_revoke_share(p_workspace uuid, p_share uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 update aura_profile.kit_share set revoked_at = coalesce(revoked_at, now()) where id = p_share and workspace_id = p_workspace;
 if not found then raise exception 'Access denied' using errcode = '42501'; end if;
 perform aura_profile.audit(u, 'profile_kit_link_revoked');
 return jsonb_build_object('revoked', p_share);
end $$;

-- ───────── Public reads (anon and authenticated) ─────────
create function public.aura_public_profile(p_username text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ws uuid; nu text := lower(coalesce(p_username, '')); al aura_profile.username_alias; viewer uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub', '')::uuid;
begin
 if aura_profile.valid_username(nu) = 'format' then return jsonb_build_object('found', false); end if;
 select workspace_id into ws from aura_profile.profile where username = nu and published;
 if ws is null then
  select * into al from aura_profile.username_alias where username = nu and expires_at > now();
  if al.username is not null and exists(select 1 from aura_profile.profile where workspace_id = al.workspace_id and published) then
   return jsonb_build_object('found', false, 'redirect', (select username from aura_profile.profile where workspace_id = al.workspace_id));
  end if;
  return jsonb_build_object('found', false);
 end if;
 if not aura_profile.ws_open(ws) then return jsonb_build_object('found', false); end if; -- suspended or closed workspaces disappear at once
 -- aggregate count only; the Creator's own visits are not counted
 if viewer is null or not exists(select 1 from aura_identity.membership m where m.workspace_id = ws and m.user_id = viewer and m.active) then
  insert into aura_profile.profile_view(workspace_id, day, views) values (ws, current_date, 1) on conflict (workspace_id, day) do update set views = aura_profile.profile_view.views + 1;
 end if;
 return jsonb_build_object('found', true, 'profile', aura_profile.public_json(ws));
end $$;
create function public.aura_public_kit(p_token text, p_share_identity_as uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare h aura_profile.kit_share; viewer uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub', '')::uuid; c jsonb; member boolean;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'not_found'); end if;
 select * into h from aura_profile.kit_share where token_hash = aura_profile.hash(p_token);
 if h.id is null then return jsonb_build_object('status', 'not_found'); end if;
 if h.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
 if h.expires_at is not null and h.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
 if not aura_profile.ws_open(h.workspace_id) then return jsonb_build_object('status', 'not_found'); end if;
 if h.kind = 'restricted' then
  if viewer is null then return jsonb_build_object('status', 'sign_in_required'); end if;
  if not exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id and w.status = 'open' where m.workspace_id = h.recipient_workspace_id and m.user_id = viewer and m.active) then return jsonb_build_object('status', 'not_permitted'); end if;
 end if;
 if h.version_id is not null then c := aura_profile.filter_content(h.workspace_id, (select content from aura_profile.kit_version where id = h.version_id), h.kind = 'restricted', h.include_rates);
 else c := aura_profile.kit_content(h.kit_id, h.kind = 'restricted', h.include_rates); end if;
 member := viewer is not null and exists(select 1 from aura_identity.membership m where m.workspace_id = h.workspace_id and m.user_id = viewer and m.active);
 if not member then insert into aura_profile.kit_view(share_id, day, views) values (h.id, current_date, 1) on conflict (share_id, day) do update set views = aura_profile.kit_view.views + 1; end if;
 -- F31: a Brand is identified to the Creator only when its member explicitly chooses to share that it viewed the kit
 if p_share_identity_as is not null and viewer is not null and not member and exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id and w.kind in ('brand','agency') and w.status = 'open' where m.workspace_id = p_share_identity_as and m.user_id = viewer and m.active) then
  insert into aura_profile.brand_visit(share_id, brand_workspace_id) values (h.id, p_share_identity_as);
 end if;
 return jsonb_build_object('status', 'ok', 'kind', h.kind, 'snapshot', h.version_id is not null, 'expires_at', h.expires_at, 'content', c,
  'viewer_brands', case when viewer is not null and not member then (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name)), '[]'::jsonb) from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id and w.kind in ('brand','agency') and w.status = 'open' where m.user_id = viewer and m.active) else '[]'::jsonb end);
end $$;
-- F06: AURA-mediated enquiries need a signed-in, VERIFIED Brand. Verification is M14, which does not exist, so this always refuses.
create function public.aura_profile_enquire(p_username text, p_brand_workspace uuid, p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin
 if not exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id and w.kind = 'brand' where m.workspace_id = p_brand_workspace and m.user_id = u and m.active) then raise exception 'Access denied' using errcode = '42501'; end if;
 if not aura_profile.brand_verified(p_brand_workspace) then raise exception 'Brand verification required' using errcode = '55000'; end if;
 raise exception 'Enquiries are not available yet' using errcode = '55000';
end $$;
create function public.aura_profile_analytics(p_workspace uuid, p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); d int := least(greatest(coalesce(p_days, 30), 7), 365);
begin
 return jsonb_build_object('days', d,
  'profile_views', (select coalesce(jsonb_agg(jsonb_build_object('day', v.day, 'views', v.views) order by v.day), '[]'::jsonb) from aura_profile.profile_view v where v.workspace_id = p_workspace and v.day > current_date - d),
  'kit_views', (select coalesce(jsonb_agg(jsonb_build_object('kit', k.name, 'link', coalesce(h.label, h.kind), 'views', (select coalesce(sum(w.views), 0) from aura_profile.kit_view w where w.share_id = h.id and w.day > current_date - d))), '[]'::jsonb)
    from aura_profile.kit_share h join aura_profile.media_kit k on k.id = h.kit_id where h.workspace_id = p_workspace),
  'brand_visits', (select coalesce(jsonb_agg(jsonb_build_object('brand', w.name, 'kit', k.name, 'at', b.at) order by b.at desc), '[]'::jsonb) from aura_profile.brand_visit b join aura_profile.kit_share h on h.id = b.share_id join aura_profile.media_kit k on k.id = h.kit_id join aura_identity.workspace w on w.id = b.brand_workspace_id where h.workspace_id = p_workspace and b.at > now() - make_interval(days => d)),
  'enquiries', (select count(*) from aura_profile.enquiry where workspace_id = p_workspace and created_at > now() - make_interval(days => d)));
end $$;

-- The M01 public directory reads this allowlisted view (slug, display_name, bio) through the REST API. Only published, listed profiles of
-- open workspaces that meet the discovery rule appear; it is recomputed on every read.
create view public.m01_public_creator_previews as
 select p.username as slug, c.display_name, coalesce(p.headline, left(p.about, 200)) as bio
 from aura_profile.profile p join aura_creator.creator_profile c on c.workspace_id = p.workspace_id join aura_identity.workspace w on w.id = p.workspace_id
 where p.published and p.listed and p.username is not null and c.display_name is not null and w.status = 'open' and w.kind = 'creator'
  -- the discovery rule, inlined: functions inside a view run with the caller's privileges, tables with the view owner's
  and exists(select 1 from aura_creator.social_account a where a.workspace_id = p.workspace_id and a.lifecycle = 'active' and a.ownership_scope = 'individual'
   and coalesce(a.self_reported_followers, -1) >= (select (value #>> '{}')::int from aura_profile.setting where key = 'discovery_min_followers'));
revoke all on public.m01_public_creator_previews from public, anon, authenticated;
grant select on public.m01_public_creator_previews to anon, authenticated;

-- M04 gains a Profile widget (forward change to the preference allowlist).
alter table aura_studio.dashboard_pref drop constraint dashboard_pref_hidden_widgets_check;
alter table aura_studio.dashboard_pref add constraint dashboard_pref_hidden_widgets_check
 check (hidden_widgets <@ array['actions','plan','goals','content','checklist','recommendations','commercial','milestones','weekly','social','analytics','profile']);

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like 'aura\_profile\_%' or p.proname like 'aura\_public\_%') loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop; end $$;
grant execute on function public.aura_public_profile(text) to anon;
grant execute on function public.aura_public_kit(text, uuid) to anon;
revoke all on all tables in schema aura_profile from public, anon, authenticated;
revoke all on all functions in schema aura_profile from public, anon, authenticated;
commit;
