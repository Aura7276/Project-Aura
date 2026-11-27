-- M23 Agency Studio (reconstructed scope, owner reconciliation pending; see the module file).
-- An independent Agency workspace works for Creator and Brand clients only through explicit, client-issued delegation:
-- areas (scopes), an expiry of at most 12 months, revocation at any time, and a separate contracting authority that only a client
-- owner can grant. Delegation is enforced in the two shared access checks every module uses (aura_creator.own, aura_social.actor),
-- so it holds for direct API calls too: every public function in the call chain must be in a granted area, unknown functions are
-- refused (fail closed), consent, verification and deletion are never delegable, delegated writes need MFA, an assigned manager and a
-- verified Agency, and each one is logged with the actual person and the client represented. Agency fees are kept apart from client
-- spend; dual representation must be disclosed to and acknowledged by both clients; ending a relationship revokes access and keeps records.
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_agency;
revoke all on schema aura_agency from public, anon, authenticated;

create table aura_agency.setting (key text primary key, value jsonb not null);
insert into aura_agency.setting(key, value) values ('max_grant_months', '12'), ('client_invite_days', '14'), ('member_invite_days', '7');

create table aura_agency.profile (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 legal_name text check (length(trim(legal_name)) between 2 and 160), kind text not null default 'hybrid' check (kind in ('talent','brand','hybrid','consultant')),
 website text check (website ~ '^https://[^\s]{3,}$' and length(website) <= 300), country text check (country ~ '^[A-Z]{2}$'), city text check (length(city) <= 80),
 services text[] not null default '{}' check (services <@ array['talent_management','campaign_management','content_production','social_management','ugc','strategy','reporting','paid_media']),
 team_size text check (team_size in ('1','2-5','6-20','21-50','51+')), about text check (length(about) <= 1500),
 completed_at timestamptz, updated_at timestamptz not null default now()
);
create table aura_agency.verification (
 workspace_id uuid primary key references aura_identity.workspace on delete cascade,
 status text not null default 'draft' check (status in ('draft','submitted','info_requested','verified','rejected')),
 registration_type text check (registration_type in ('gst','cin','llp','udyam','individual','other')), registration_number text check (length(registration_number) between 3 and 40),
 address text check (length(address) <= 400), representative text check (length(representative) between 2 and 120), representative_role text check (length(representative_role) <= 80),
 evidence text[] not null default '{}' check (cardinality(evidence) <= 5), declaration boolean not null default false,
 reviewer_note text check (length(reviewer_note) <= 1000), submitted_at timestamptz, decided_at timestamptz, decided_by uuid references auth.users
);
create table aura_agency.relationship (
 id uuid primary key default gen_random_uuid(), agency_ws uuid not null references aura_identity.workspace on delete cascade,
 client_ws uuid not null references aura_identity.workspace on delete cascade, client_kind text not null check (client_kind in ('creator','brand')),
 status text not null default 'active' check (status in ('active','ended')), started_at timestamptz not null default now(), accepted_by uuid not null references auth.users,
 ended_at timestamptz, ended_by uuid references auth.users, ended_side text check (ended_side in ('agency','client')), end_reason text check (length(end_reason) <= 300),
 check (agency_ws <> client_ws)
);
create unique index one_active_relationship on aura_agency.relationship(agency_ws, client_ws) where status = 'active';
-- Grants are never edited: a change creates a new grant and supersedes the old one, so the history of what was allowed is kept.
create table aura_agency.grant_ (
 id uuid primary key default gen_random_uuid(), relationship_id uuid not null references aura_agency.relationship on delete cascade,
 scopes text[] not null check (cardinality(scopes) between 1 and 7 and scopes <@ array['view','profile','campaigns','applications','content','results','assistant']),
 contracting boolean not null default false, expires_at timestamptz not null, granted_by uuid not null references auth.users, granted_at timestamptz not null default clock_timestamp(),
 ended_at timestamptz, ended_by uuid references auth.users, end_reason text check (end_reason in ('superseded','revoked','relationship_ended'))
);
create unique index one_current_grant on aura_agency.grant_(relationship_id) where ended_at is null;
create table aura_agency.assignment (
 relationship_id uuid not null references aura_agency.relationship on delete cascade, user_id uuid not null references auth.users,
 role text not null check (role in ('manager','viewer')), assigned_by uuid not null references auth.users, assigned_at timestamptz not null default now(),
 primary key (relationship_id, user_id)
);
create table aura_agency.client_invite (
 token_hash bytea primary key, agency_ws uuid not null references aura_identity.workspace on delete cascade, client_kind text not null check (client_kind in ('creator','brand')),
 client_label text not null check (length(trim(client_label)) between 2 and 120),
 scopes text[] not null check (cardinality(scopes) between 1 and 7 and scopes <@ array['view','profile','campaigns','applications','content','results','assistant']),
 contracting boolean not null default false, months integer not null check (months between 1 and 12), message text check (length(message) <= 600),
 created_by uuid not null references auth.users, created_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz, accepted_relationship uuid references aura_agency.relationship
);
-- Which public function belongs to which area. First match wins; 'never' is not delegable; anything unmatched is refused.
-- 'view' reads every area except the assistant (AI conversations and strategy stay private unless that area is granted).
create table aura_agency.scope_rule (position integer primary key, pattern text not null, scope text not null check (scope in ('never','profile','campaigns','applications','content','results','assistant')), contracting boolean not null default false);
insert into aura_agency.scope_rule values
 (5, '^aura_creator_state$', 'profile', false),
 (10, '^aura_(brand_delete|profile_delete|brand_verification_.*|brand_review_.*|market_(verify_brand|moderate|review_queue|decide_report)|social_(start_verification|submit_evidence|cancel_verification|delete_evidence|review_.*|decide|grant_share|revoke_share|set_sharing|can_.*)|analytics_(grant_audience|revoke_audience|cohort_optin|authorize_export)|monitor_consent|profile_(create_share|revoke_share|moderat.*|create_invite|revoke_invite)|apply_(block|report|decide_report|report_queue)|creator_.*|agency_.*|create_workspace|accept_invitation|select_workspace)$', 'never', false),
 (20, '^aura_(apply_confirm|selection_respond|apply_respond_invitation)$', 'applications', true),
 (30, '^aura_brand_content_.*$', 'content', false),
 (40, '^aura_brand_ai_.*$', 'assistant', false),
 (50, '^aura_brand_.*$', 'profile', false),
 (60, '^aura_(market|campaign)_.*$', 'campaigns', false),
 (70, '^aura_(apply|selection)_.*$', 'applications', false),
 (80, '^aura_monitor_.*$', 'results', false),
 (90, '^aura_analytics_.*$', 'results', false),
 (100, '^aura_(studio|content)_.*$', 'content', false),
 (110, '^aura_growth_.*$', 'assistant', false),
 (120, '^aura_(profile|social)_.*$', 'profile', false);
-- Material actions taken for a client: the person who acted and the client represented.
create table aura_agency.activity (
 id bigint generated always as identity primary key, agency_ws uuid not null references aura_identity.workspace on delete cascade,
 client_ws uuid not null references aura_identity.workspace on delete cascade, actor uuid not null references auth.users,
 action text not null, scope text not null, contracting boolean not null default false, at timestamptz not null default clock_timestamp()
);
create index activity_by_client on aura_agency.activity(client_ws, at desc);
create index activity_by_agency on aura_agency.activity(agency_ws, at desc);
-- Agency revenue (manual, settled outside AURA). Never mixed with client campaign spend (M13/M22).
create table aura_agency.fee (
 id uuid primary key default gen_random_uuid(), agency_ws uuid not null references aura_identity.workspace on delete cascade,
 relationship_id uuid not null references aura_agency.relationship, kind text not null check (kind in ('retainer','commission','project_fee','expense')),
 description text not null check (length(trim(description)) between 3 and 200), amount numeric not null check (amount > 0 and amount < 1e10),
 currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'), basis text check (length(basis) <= 200),
 period_start date, period_end date, due_on date, status text not null default 'planned' check (status in ('planned','invoiced','paid','cancelled')),
 reference text check (length(reference) <= 80), paid_on date, created_by uuid not null references auth.users, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (period_end is null or period_start is null or period_end >= period_start), check ((status = 'paid') = (paid_on is not null))
);
-- Dual representation: the same Agency acts for a Creator and a Brand who work together. Both clients must acknowledge.
create table aura_agency.disclosure (
 id uuid primary key default gen_random_uuid(), agency_ws uuid not null references aura_identity.workspace on delete cascade,
 creator_ws uuid not null references aura_identity.workspace, brand_ws uuid not null references aura_identity.workspace,
 note text not null check (length(trim(note)) between 20 and 1000), safeguards text not null check (length(trim(safeguards)) between 20 and 1000),
 disclosed_by uuid not null references auth.users, disclosed_at timestamptz not null default now(),
 creator_ack_by uuid references auth.users, creator_ack_at timestamptz, brand_ack_by uuid references auth.users, brand_ack_at timestamptz,
 unique (agency_ws, creator_ws, brand_ws)
);
-- Approvals: the Agency's internal approval and the client's approval are separate records; one never implies the other.
create table aura_agency.approval (
 id uuid primary key default gen_random_uuid(), relationship_id uuid not null references aura_agency.relationship on delete cascade,
 title text not null check (length(trim(title)) between 3 and 140), detail text check (length(detail) <= 2000), link text check (link ~ '^/(brand|creator|agency)/[A-Za-z0-9/_?=&.-]*$' and length(link) <= 300),
 requested_by uuid not null references auth.users, requested_at timestamptz not null default now(),
 internal_status text not null default 'pending' check (internal_status in ('pending','approved','changes_requested')), internal_by uuid references auth.users, internal_at timestamptz, internal_note text check (length(internal_note) <= 500),
 client_status text not null default 'pending' check (client_status in ('pending','approved','declined')), client_by uuid references auth.users, client_at timestamptz, client_note text check (length(client_note) <= 500)
);
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname = 'aura_agency' loop
  execute format('alter table aura_agency.%I enable row level security', t);
  execute format('revoke all on aura_agency.%I from public, anon, authenticated', t);
 end loop;
end $$;

-- ───────── Helpers ─────────
create function aura_agency.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_agency.setting where key = p_key $$;
create function aura_agency.who(p_user uuid) returns text language sql stable set search_path='' as $$
 select coalesce((select nullif(trim(p.full_name), '') from aura_identity.profile p where p.user_id = p_user), 'A team member') $$;
create function aura_agency.ws_name(p_ws uuid) returns text language sql stable set search_path='' as $$
 select coalesce((select nullif(trim(p.public_name), '') from aura_brand.profile p where p.workspace_id = p_ws), (select nullif(trim(c.display_name), '') from aura_creator.creator_profile c where c.workspace_id = p_ws), (select name from aura_identity.workspace where id = p_ws)) $$;
-- Agency side: a member of the Agency workspace; admin = owner/admin with MFA; writes need an open workspace.
create function aura_agency.actor(p_ws uuid, p_write boolean default true, p_admin boolean default false) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible(); r text; st text;
begin
 select m.role, w.status into r, st from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id
  where m.workspace_id = p_ws and m.user_id = u and m.active and w.kind = 'agency';
 if r is null or (case when p_write then st <> 'open' else st = 'suspended' end) then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_admin and (r not in ('owner','admin') or not aura_identity.strong(u)) then raise exception 'Only an Agency owner or admin, signed in with an authenticator, can do this' using errcode = '42501'; end if;
 return u;
end $$;
-- Client side: the client's own people only (Creator owner; Brand owner or admin). Never reachable through delegation.
create function aura_agency.client(p_ws uuid, p_write boolean default true, p_owner boolean default false) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible(); r text; k text; st text;
begin
 select m.role, w.kind, w.status into r, k, st from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id where m.workspace_id = p_ws and m.user_id = u and m.active;
 if r is null or not ((k = 'creator' and r = 'owner') or (k = 'brand' and r in ('owner','admin'))) or (case when p_write then st <> 'open' else st = 'suspended' end) then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_owner and r <> 'owner' then raise exception 'Only the client''s owner can grant contracting authority' using errcode = '42501'; end if;
 if p_write and k = 'brand' and not aura_identity.strong(u) then raise exception 'Access denied' using errcode = '42501'; end if;
 return u;
end $$;
create function aura_agency.current_grant(p_rel uuid) returns aura_agency.grant_ language sql stable set search_path='' as $$
 select * from aura_agency.grant_ where relationship_id = p_rel and ended_at is null $$;
-- Pairs of this Agency's clients who work together (a Creator applied to or collaborates on a Brand client's campaign).
create function aura_agency.pairs(p_agency uuid) returns table(creator_ws uuid, brand_ws uuid, collaborations bigint) language sql stable set search_path='' as $$
 select c.creator_workspace_id, m.workspace_id, count(*) from aura_apply.collaboration c join aura_market.campaign m on m.id = c.campaign_id
 where c.creator_workspace_id in (select client_ws from aura_agency.relationship where agency_ws = p_agency and status = 'active' and client_kind = 'creator')
   and m.workspace_id in (select client_ws from aura_agency.relationship where agency_ws = p_agency and status = 'active' and client_kind = 'brand')
 group by 1, 2 $$;
create function aura_agency.acknowledged(p_agency uuid, p_creator uuid, p_brand uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from aura_agency.disclosure d where d.agency_ws = p_agency and d.creator_ws = p_creator and d.brand_ws = p_brand and d.creator_ack_at is not null and d.brand_ack_at is not null) $$;

-- ───────── The delegation check (called by the shared access checks when the caller is not a client member) ─────────
create function aura_agency.log(p_agency uuid, p_client uuid, p_actor uuid, p_action text, p_scope text, p_contracting boolean) returns void language sql volatile set search_path='' as $$
 insert into aura_agency.activity(agency_ws, client_ws, actor, action, scope, contracting) values (p_agency, p_client, p_actor, p_action, p_scope, p_contracting) $$;
create function aura_agency.delegated(p_ws uuid, p_write boolean, p_kind text default null) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible(); stack text; fns text[]; fn text; sc text; con boolean; any_con boolean := false; r record; g aura_agency.grant_; a text; k text; st text; p record; outer_fn text;
begin
 select w.kind, w.status into k, st from aura_identity.workspace w where w.id = p_ws;
 if k not in ('creator','brand') or (p_kind is not null and k <> p_kind) or (case when p_write then st <> 'open' else st = 'suspended' end) then raise exception 'Access denied' using errcode = '42501'; end if;
 select rel.* into r from aura_agency.relationship rel join aura_identity.membership m on m.workspace_id = rel.agency_ws and m.user_id = u and m.active
  join aura_identity.workspace aw on aw.id = rel.agency_ws and aw.status = 'open'
  where rel.client_ws = p_ws and rel.status = 'active' and exists(select 1 from aura_agency.assignment s where s.relationship_id = rel.id and s.user_id = u) limit 1;
 if r.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 g := aura_agency.current_grant(r.id);
 if g.id is null or g.expires_at <= now() then raise exception 'Access denied' using errcode = '42501'; end if;
 select s.role into a from aura_agency.assignment s where s.relationship_id = r.id and s.user_id = u;
 get diagnostics stack = pg_context;
 select array_agg(m[1] order by ord) into fns from regexp_matches(stack, 'function public\.(aura_[a-z0-9_]+)\(', 'g') with ordinality as x(m, ord);
 if fns is null then raise exception 'Access denied' using errcode = '42501'; end if;
 outer_fn := fns[array_length(fns, 1)];
 foreach fn in array fns loop
  select s.scope, s.contracting into sc, con from aura_agency.scope_rule s where fn ~ s.pattern order by s.position limit 1;
  if sc is null or sc = 'never' then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_write or con then
   if not sc = any(g.scopes) then raise exception 'Access denied' using errcode = '42501'; end if;
  elsif not (sc = any(g.scopes) or ('view' = any(g.scopes) and sc <> 'assistant')) then raise exception 'Access denied' using errcode = '42501'; end if; -- AI conversations need their own grant
  any_con := any_con or con;
 end loop;
 if p_write or any_con then
  if a <> 'manager' or not aura_identity.strong(u) then raise exception 'Access denied' using errcode = '42501'; end if;
  if not exists(select 1 from aura_identity.workspace where id = r.agency_ws and verification = 'verified') then raise exception 'Access denied' using errcode = '42501'; end if;
  if any_con and not g.contracting then raise exception 'Access denied' using errcode = '42501'; end if;
  -- Dual representation safeguards: disclosed to and acknowledged by both clients before any application or contracting step,
  -- and never contracting authority on both sides of the same working pair.
  for p in select * from aura_agency.pairs(r.agency_ws) x where x.creator_ws = p_ws or x.brand_ws = p_ws loop
   if (sc in ('applications') or any_con) and not aura_agency.acknowledged(r.agency_ws, p.creator_ws, p.brand_ws) then
    raise exception 'Dual representation: disclose it to both clients and get their acknowledgement first' using errcode = '55000';
   end if;
   if any_con and exists(select 1 from aura_agency.relationship o join aura_agency.grant_ og on og.relationship_id = o.id and og.ended_at is null and og.contracting and og.expires_at > now()
       where o.agency_ws = r.agency_ws and o.status = 'active' and o.client_ws = case when p_ws = p.creator_ws then p.brand_ws else p.creator_ws end) then
    raise exception 'Dual representation: an Agency cannot hold contracting authority for both sides' using errcode = '55000';
   end if;
  end loop;
  perform aura_agency.log(r.agency_ws, p_ws, u, outer_fn, sc, any_con);
 end if;
 return u;
end $$;

-- The two shared access checks, unchanged for members; a non-member falls through to delegation (which fails closed).
create or replace function aura_creator.own(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin
 if p_workspace is null then raise exception 'Access denied' using errcode='42501'; end if;
 if not exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id
  where m.workspace_id=p_workspace and m.user_id=u and m.active and m.role='owner' and w.kind='creator'
  and (case when p_write then w.status='open' else w.status<>'suspended' end))
 then
  if exists(select 1 from aura_identity.membership m where m.workspace_id = p_workspace and m.user_id = u and m.active) then raise exception 'Access denied' using errcode='42501'; end if;
  return aura_agency.delegated(p_workspace, p_write, 'creator');
 end if;
 return u;
end $$;
create or replace function aura_social.actor(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible(); k text; r text; st text;
begin
 select w.kind, m.role, w.status into k, r, st from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id
  where m.workspace_id = p_workspace and m.user_id = u and m.active;
 if k is null then return aura_agency.delegated(p_workspace, p_write, null); end if;
 if not ((k = 'creator' and r = 'owner') or (k = 'brand' and r in ('owner','admin'))) or (case when p_write then st <> 'open' else st = 'suspended' end)
 then raise exception 'Access denied' using errcode = '42501'; end if;
 return u;
end $$;

-- Agency workspaces can now be created (MFA required, like Brands).
create or replace function public.aura_create_workspace(p_request uuid,p_kind text,p_name text,p_business text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=aura_identity.eligible(); wid uuid;begin
 if p_kind not in ('creator','brand','agency') or (p_kind in ('brand','agency') and not aura_identity.strong(u)) then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from aura_identity.profile where user_id=u for update;
 select id into wid from aura_identity.workspace where founder=u and request_id=p_request and kind=p_kind;
 if wid is null and p_kind='creator' then select id into wid from aura_identity.workspace where founder=u and kind='creator';end if;
 if wid is null then
 insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) values(u,p_request,p_kind,trim(p_name),case when p_kind='brand' then p_business end) returning id into wid;
 insert into aura_identity.membership values(wid,u,'owner',true);
 insert into aura_identity.event(user_id,event) values(u,'workspace_created');end if;
 if not exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id where w.id=wid and w.status<>'suspended' and m.user_id=u and m.active) then raise exception 'Access denied';end if;
 return wid;end $$;

-- ───────── Agency: profile, verification, team ─────────
create function public.aura_agency_save_profile(p_workspace uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); v jsonb := coalesce(p_fields, '{}');
begin
 insert into aura_agency.profile(workspace_id, legal_name, kind, website, country, city, services, team_size, about, completed_at)
 values (p_workspace, nullif(trim(v->>'legal_name'), ''), coalesce(v->>'kind', 'hybrid'), nullif(trim(coalesce(v->>'website', '')), ''), nullif(v->>'country', ''), nullif(trim(coalesce(v->>'city', '')), ''),
  coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v->'services', '[]')) x), '{}'), nullif(v->>'team_size', ''), nullif(trim(coalesce(v->>'about', '')), ''), now())
 on conflict (workspace_id) do update set legal_name = excluded.legal_name, kind = excluded.kind, website = excluded.website, country = excluded.country, city = excluded.city,
  services = excluded.services, team_size = excluded.team_size, about = excluded.about, updated_at = now(), completed_at = coalesce(aura_agency.profile.completed_at, now());
 if (select legal_name from aura_agency.profile where workspace_id = p_workspace) is null then raise exception 'Add your registered business name' using errcode = '22023'; end if;
 update aura_identity.workspace set onboarding = 'completed', next_step = 'done' where id = p_workspace and onboarding <> 'completed';
 return jsonb_build_object('saved', true);
end $$;
create function public.aura_agency_save_verification(p_workspace uuid, p_fields jsonb, p_submit boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); v jsonb := coalesce(p_fields, '{}'); c aura_agency.verification; ev text[];
begin
 select coalesce(array_agg(trim(x)) filter (where trim(x) <> ''), '{}') into ev from jsonb_array_elements_text(coalesce(v->'evidence', '[]')) x;
 if exists(select 1 from unnest(ev) e where e !~ '^https://[^\s]{3,}$' or length(e) > 500) then raise exception 'Evidence must be https links' using errcode = '22023'; end if;
 select * into c from aura_agency.verification where workspace_id = p_workspace for update;
 if c.status in ('submitted','verified') then raise exception 'This verification is already with a reviewer or complete' using errcode = '55000'; end if;
 insert into aura_agency.verification(workspace_id, registration_type, registration_number, address, representative, representative_role, evidence, declaration)
  values (p_workspace, v->>'registration_type', nullif(trim(coalesce(v->>'registration_number', '')), ''), nullif(trim(coalesce(v->>'address', '')), ''), nullif(trim(coalesce(v->>'representative', '')), ''),
   nullif(trim(coalesce(v->>'representative_role', '')), ''), ev, coalesce((v->>'declaration')::boolean, false))
  on conflict (workspace_id) do update set registration_type = excluded.registration_type, registration_number = excluded.registration_number, address = excluded.address,
   representative = excluded.representative, representative_role = excluded.representative_role, evidence = excluded.evidence, declaration = excluded.declaration
  returning * into c;
 if p_submit then
  if not exists(select 1 from aura_agency.profile where workspace_id = p_workspace and legal_name is not null) then raise exception 'Complete your Agency profile first' using errcode = '55000'; end if;
  if c.registration_type is null or c.registration_number is null or c.representative is null or c.address is null or cardinality(c.evidence) = 0 or not c.declaration then
   raise exception 'Add the registration, address, representative, at least one evidence link and the declaration' using errcode = '22023';
  end if;
  update aura_agency.verification set status = 'submitted', submitted_at = now() where workspace_id = p_workspace;
  perform aura_market.audit(u, 'agency_verification_submitted');
 end if;
 return jsonb_build_object('status', (select status from aura_agency.verification where workspace_id = p_workspace));
end $$;
create function aura_agency.reviewer() returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin
 if not exists(select 1 from aura_identity.platform_admin where user_id = u) or not aura_identity.strong(u) then raise exception 'Access denied' using errcode = '42501'; end if;
 return u;
end $$;
create function public.aura_agency_review_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_agency.reviewer();
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('workspace_id', v.workspace_id, 'name', w.name, 'legal_name', p.legal_name, 'kind', p.kind, 'website', p.website, 'country', p.country,
   'registration_type', v.registration_type, 'registration_number', v.registration_number, 'address', v.address, 'representative', v.representative, 'representative_role', v.representative_role,
   'evidence', to_jsonb(v.evidence), 'submitted_at', v.submitted_at, 'founder', aura_agency.who(w.founder)) order by v.submitted_at), '[]'::jsonb)
  from aura_agency.verification v join aura_identity.workspace w on w.id = v.workspace_id left join aura_agency.profile p on p.workspace_id = v.workspace_id where v.status = 'submitted');
end $$;
create function public.aura_agency_review_decide(p_workspace uuid, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.reviewer(); n int;
begin
 if p_decision not in ('verified','info_requested','rejected') then raise exception 'Invalid decision' using errcode = '22023'; end if;
 if p_decision <> 'verified' and length(trim(coalesce(p_note, ''))) < 10 then raise exception 'Explain what is needed' using errcode = '22023'; end if;
 update aura_agency.verification set status = p_decision, reviewer_note = nullif(trim(coalesce(p_note, '')), ''), decided_at = now(), decided_by = u where workspace_id = p_workspace and status = 'submitted';
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Nothing to review' using errcode = '55000'; end if;
 update aura_identity.workspace set verification = case when p_decision = 'verified' then 'verified' else 'pending' end where id = p_workspace;
 perform aura_market.audit(u, 'agency_verification_' || p_decision);
 return jsonb_build_object('status', p_decision);
end $$;
-- Team invitations use the M02 invitation and acceptance flow (the token is shown once).
create function public.aura_agency_invite_member(p_workspace uuid, p_email text, p_role text) returns text language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
 if p_role not in ('admin','member') then raise exception 'Invalid role' using errcode = '22023'; end if;
 if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(p_email) > 254 then raise exception 'Enter a valid email address' using errcode = '22023'; end if;
 insert into aura_identity.invitation(token_hash, workspace_id, recipient_email, role, expires_at) values (sha256(convert_to(tok, 'UTF8')), p_workspace, lower(trim(p_email)), p_role, now() + make_interval(days => aura_agency.setting_int('member_invite_days')));
 perform aura_market.audit(u, 'agency_member_invited');
 return tok;
end $$;
create function public.aura_agency_assign(p_workspace uuid, p_relationship uuid, p_user uuid, p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true);
begin
 if not exists(select 1 from aura_agency.relationship where id = p_relationship and agency_ws = p_workspace and status = 'active') then raise exception 'Access denied' using errcode = '42501'; end if;
 if not exists(select 1 from aura_identity.membership where workspace_id = p_workspace and user_id = p_user and active) then raise exception 'Only your Agency''s team members can be assigned' using errcode = '22023'; end if;
 if p_role is null then delete from aura_agency.assignment where relationship_id = p_relationship and user_id = p_user;
 elsif p_role in ('manager','viewer') then
  insert into aura_agency.assignment(relationship_id, user_id, role, assigned_by) values (p_relationship, p_user, p_role, u)
   on conflict (relationship_id, user_id) do update set role = excluded.role, assigned_by = u, assigned_at = now();
 else raise exception 'Invalid role' using errcode = '22023'; end if;
 perform aura_market.audit(u, 'agency_assignment_changed');
 return jsonb_build_object('ok', true);
end $$;

-- ───────── Client relationships: invitation by the Agency, acceptance and grants by the client ─────────
create function aura_agency.clean_scopes(p jsonb) returns text[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(distinct x order by x), '{}') from jsonb_array_elements_text(coalesce(p, '[]')) x $$;
create function public.aura_agency_invite_client(p_workspace uuid, p_kind text, p_label text, p_scopes jsonb, p_contracting boolean, p_months integer, p_message text) returns text language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
 if not exists(select 1 from aura_identity.workspace where id = p_workspace and verification = 'verified') then raise exception 'Verify your Agency before inviting clients' using errcode = '55000'; end if;
 if p_kind not in ('creator','brand') then raise exception 'Invalid client type' using errcode = '22023'; end if;
 if p_months is null or p_months not between 1 and aura_agency.setting_int('max_grant_months') then raise exception 'Access can last 1 to 12 months' using errcode = '22023'; end if;
 insert into aura_agency.client_invite(token_hash, agency_ws, client_kind, client_label, scopes, contracting, months, message, created_by, expires_at)
  values (sha256(convert_to(tok, 'UTF8')), p_workspace, p_kind, trim(p_label), aura_agency.clean_scopes(p_scopes), coalesce(p_contracting, false), p_months, nullif(trim(coalesce(p_message, '')), ''), u,
   now() + make_interval(days => aura_agency.setting_int('client_invite_days')));
 perform aura_market.audit(u, 'agency_client_invited');
 return tok;
end $$;
create function public.aura_agency_revoke_invite(p_workspace uuid, p_created timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); n int;
begin
 update aura_agency.client_invite set revoked_at = now() where agency_ws = p_workspace and created_at = p_created and revoked_at is null and accepted_relationship is null;
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Nothing to cancel' using errcode = '55000'; end if;
 return jsonb_build_object('revoked', true);
end $$;
create function aura_agency.invite_of(p_token text) returns aura_agency.client_invite language plpgsql stable set search_path='' as $$
declare i aura_agency.client_invite;
begin
 select * into i from aura_agency.client_invite where token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'));
 if i.agency_ws is null or i.revoked_at is not null or i.accepted_relationship is not null or i.expires_at <= now() then raise exception 'This invitation is no longer available' using errcode = '55000'; end if;
 return i;
end $$;
create function public.aura_agency_invite_info(p_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_identity.eligible(); i aura_agency.client_invite := aura_agency.invite_of(p_token);
begin
 return jsonb_build_object('agency', (select jsonb_build_object('name', w.name, 'verified', w.verification = 'verified', 'legal_name', p.legal_name, 'kind', p.kind, 'website', p.website, 'about', p.about)
   from aura_identity.workspace w left join aura_agency.profile p on p.workspace_id = w.id where w.id = i.agency_ws),
  'client_kind', i.client_kind, 'client_label', i.client_label, 'scopes', to_jsonb(i.scopes), 'contracting', i.contracting, 'months', i.months, 'message', i.message, 'expires_at', i.expires_at,
  'workspaces', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', aura_agency.ws_name(w.id), 'role', m.role) order by w.name), '[]'::jsonb) from aura_identity.membership m join aura_identity.workspace w on w.id = m.workspace_id
    where m.user_id = u and m.active and w.status = 'open' and w.kind = i.client_kind and ((w.kind = 'creator' and m.role = 'owner') or (w.kind = 'brand' and m.role in ('owner','admin')))
      and not exists(select 1 from aura_agency.relationship r where r.agency_ws = i.agency_ws and r.client_ws = w.id and r.status = 'active')));
end $$;
create function aura_agency.issue(p_rel uuid, p_client uuid, p_actor uuid, p_scopes text[], p_contracting boolean, p_months integer) returns aura_agency.grant_ language plpgsql set search_path='' as $$
declare g aura_agency.grant_;
begin
 if p_months is null or p_months not between 1 and aura_agency.setting_int('max_grant_months') then raise exception 'Access can last 1 to 12 months' using errcode = '22023'; end if;
 if cardinality(p_scopes) = 0 then raise exception 'Choose at least one area' using errcode = '22023'; end if;
 if p_contracting then perform aura_agency.client(p_client, true, true); if not aura_identity.strong(p_actor) then raise exception 'Granting contracting authority needs your authenticator' using errcode = '42501'; end if;
  if not 'applications' = any(p_scopes) then raise exception 'Contracting authority needs the Applications area' using errcode = '22023'; end if; end if;
 update aura_agency.grant_ set ended_at = clock_timestamp(), ended_by = p_actor, end_reason = 'superseded' where relationship_id = p_rel and ended_at is null;
 insert into aura_agency.grant_(relationship_id, scopes, contracting, expires_at, granted_by) values (p_rel, p_scopes, p_contracting, now() + make_interval(months => p_months), p_actor) returning * into g;
 return g;
end $$;
create function public.aura_agency_accept(p_token text, p_client uuid, p_scopes jsonb, p_contracting boolean, p_months integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.client(p_client, true); i aura_agency.client_invite; rel aura_agency.relationship; sc text[] := aura_agency.clean_scopes(p_scopes);
begin
 select * into i from aura_agency.client_invite where token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8')) for update;
 perform aura_agency.invite_of(p_token);
 if (select kind from aura_identity.workspace where id = p_client) <> i.client_kind then raise exception 'This invitation is for a % workspace', i.client_kind using errcode = '22023'; end if;
 if not sc <@ i.scopes or (coalesce(p_contracting, false) and not i.contracting) or p_months > i.months then raise exception 'You can grant the requested access or less, never more' using errcode = '22023'; end if;
 if exists(select 1 from aura_identity.membership where workspace_id = i.agency_ws and user_id = u and active) then raise exception 'You cannot be your own Agency''s client' using errcode = '22023'; end if;
 insert into aura_agency.relationship(agency_ws, client_ws, client_kind, accepted_by) values (i.agency_ws, p_client, i.client_kind, u) returning * into rel;
 perform aura_agency.issue(rel.id, p_client, u, sc, coalesce(p_contracting, false), p_months);
 insert into aura_agency.assignment(relationship_id, user_id, role, assigned_by) values (rel.id, i.created_by, 'manager', i.created_by) on conflict do nothing;
 update aura_agency.client_invite set accepted_relationship = rel.id where token_hash = i.token_hash;
 perform aura_market.audit(u, 'agency_access_granted');
 return jsonb_build_object('relationship', rel.id);
end $$;
create function public.aura_agency_client_grant(p_client uuid, p_relationship uuid, p_scopes jsonb, p_contracting boolean, p_months integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.client(p_client, true); g aura_agency.grant_;
begin
 if not exists(select 1 from aura_agency.relationship where id = p_relationship and client_ws = p_client and status = 'active') then raise exception 'Access denied' using errcode = '42501'; end if;
 g := aura_agency.issue(p_relationship, p_client, u, aura_agency.clean_scopes(p_scopes), coalesce(p_contracting, false), p_months);
 perform aura_market.audit(u, 'agency_access_changed');
 return jsonb_build_object('grant', g.id, 'expires_at', g.expires_at);
end $$;
create function aura_agency.finish(p_rel uuid, p_actor uuid, p_side text, p_reason text) returns void language plpgsql set search_path='' as $$
begin
 update aura_agency.grant_ set ended_at = clock_timestamp(), ended_by = p_actor, end_reason = case when p_side = 'client' then 'revoked' else 'relationship_ended' end where relationship_id = p_rel and ended_at is null;
 delete from aura_agency.assignment where relationship_id = p_rel;
 update aura_agency.relationship set status = 'ended', ended_at = now(), ended_by = p_actor, ended_side = p_side, end_reason = nullif(trim(coalesce(p_reason, '')), '') where id = p_rel;
 update aura_agency.approval set client_status = 'declined', client_note = 'Relationship ended' where relationship_id = p_rel and client_status = 'pending';
end $$;
create function public.aura_agency_client_end(p_client uuid, p_relationship uuid, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.client(p_client, true);
begin
 if not exists(select 1 from aura_agency.relationship where id = p_relationship and client_ws = p_client and status = 'active') then raise exception 'Access denied' using errcode = '42501'; end if;
 perform aura_agency.finish(p_relationship, u, 'client', p_reason);
 perform aura_market.audit(u, 'agency_access_revoked');
 return jsonb_build_object('ended', true);
end $$;
create function public.aura_agency_end(p_workspace uuid, p_relationship uuid, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true);
begin
 if not exists(select 1 from aura_agency.relationship where id = p_relationship and agency_ws = p_workspace and status = 'active') then raise exception 'Access denied' using errcode = '42501'; end if;
 if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a short reason for the client' using errcode = '22023'; end if;
 perform aura_agency.finish(p_relationship, u, 'agency', p_reason);
 perform aura_market.audit(u, 'agency_client_offboarded');
 return jsonb_build_object('ended', true);
end $$;

-- ───────── Approvals (internal and client, independent) ─────────
create function public.aura_agency_request_approval(p_workspace uuid, p_relationship uuid, p_title text, p_detail text, p_link text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true); a aura_agency.approval;
begin
 if not exists(select 1 from aura_agency.relationship r join aura_agency.assignment s on s.relationship_id = r.id and s.user_id = u where r.id = p_relationship and r.agency_ws = p_workspace and r.status = 'active') then raise exception 'Access denied' using errcode = '42501'; end if;
 insert into aura_agency.approval(relationship_id, title, detail, link, requested_by) values (p_relationship, trim(p_title), nullif(trim(coalesce(p_detail, '')), ''), nullif(trim(coalesce(p_link, '')), ''), u) returning * into a;
 return jsonb_build_object('id', a.id);
end $$;
create function public.aura_agency_internal_decide(p_workspace uuid, p_approval uuid, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); n int;
begin
 if p_decision not in ('approved','changes_requested') then raise exception 'Invalid decision' using errcode = '22023'; end if;
 update aura_agency.approval a set internal_status = p_decision, internal_by = u, internal_at = now(), internal_note = nullif(trim(coalesce(p_note, '')), '')
  from aura_agency.relationship r where a.id = p_approval and r.id = a.relationship_id and r.agency_ws = p_workspace and a.client_status = 'pending';
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Nothing to decide' using errcode = '55000'; end if;
 return jsonb_build_object('internal_status', p_decision);
end $$;
create function public.aura_agency_client_decide(p_client uuid, p_approval uuid, p_decision text, p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.client(p_client, true); n int;
begin
 if p_decision not in ('approved','declined') then raise exception 'Invalid decision' using errcode = '22023'; end if;
 update aura_agency.approval a set client_status = p_decision, client_by = u, client_at = now(), client_note = nullif(trim(coalesce(p_note, '')), '')
  from aura_agency.relationship r where a.id = p_approval and r.id = a.relationship_id and r.client_ws = p_client and a.client_status = 'pending';
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Nothing to decide' using errcode = '55000'; end if;
 perform aura_market.audit(u, 'agency_client_approval_' || p_decision);
 return jsonb_build_object('client_status', p_decision);
end $$;

-- ───────── Dual representation ─────────
create function public.aura_agency_disclose(p_workspace uuid, p_creator uuid, p_brand uuid, p_note text, p_safeguards text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); d aura_agency.disclosure;
begin
 if not exists(select 1 from aura_agency.pairs(p_workspace) x where x.creator_ws = p_creator and x.brand_ws = p_brand) then raise exception 'These clients do not work together' using errcode = '22023'; end if;
 insert into aura_agency.disclosure(agency_ws, creator_ws, brand_ws, note, safeguards, disclosed_by) values (p_workspace, p_creator, p_brand, trim(p_note), trim(p_safeguards), u)
  on conflict (agency_ws, creator_ws, brand_ws) do update set note = excluded.note, safeguards = excluded.safeguards, disclosed_by = u, disclosed_at = now(),
   creator_ack_by = null, creator_ack_at = null, brand_ack_by = null, brand_ack_at = null returning * into d;
 return jsonb_build_object('id', d.id);
end $$;
create function public.aura_agency_client_acknowledge(p_client uuid, p_disclosure uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.client(p_client, true); n int;
begin
 update aura_agency.disclosure set creator_ack_by = case when creator_ws = p_client then u else creator_ack_by end, creator_ack_at = case when creator_ws = p_client then now() else creator_ack_at end,
  brand_ack_by = case when brand_ws = p_client then u else brand_ack_by end, brand_ack_at = case when brand_ws = p_client then now() else brand_ack_at end
  where id = p_disclosure and p_client in (creator_ws, brand_ws);
 get diagnostics n = row_count;
 if n = 0 then raise exception 'Access denied' using errcode = '42501'; end if;
 return jsonb_build_object('acknowledged', true);
end $$;

-- ───────── Agency fees (manual, separate from client spend) ─────────
create function public.aura_agency_save_fee(p_workspace uuid, p_id uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, true, true); v jsonb := coalesce(p_fields, '{}'); f aura_agency.fee; rel uuid := (v->>'relationship_id')::uuid;
begin
 if not exists(select 1 from aura_agency.relationship where id = rel and agency_ws = p_workspace) then raise exception 'Access denied' using errcode = '42501'; end if;
 if p_id is null then
  insert into aura_agency.fee(agency_ws, relationship_id, kind, description, amount, currency, basis, period_start, period_end, due_on, status, reference, paid_on, created_by)
  values (p_workspace, rel, v->>'kind', trim(v->>'description'), (v->>'amount')::numeric, coalesce(nullif(v->>'currency', ''), 'INR'), nullif(trim(coalesce(v->>'basis', '')), ''),
   (v->>'period_start')::date, (v->>'period_end')::date, (v->>'due_on')::date, coalesce(v->>'status', 'planned'), nullif(trim(coalesce(v->>'reference', '')), ''), (v->>'paid_on')::date, u) returning * into f;
 else
  update aura_agency.fee set kind = v->>'kind', description = trim(v->>'description'), amount = (v->>'amount')::numeric, currency = coalesce(nullif(v->>'currency', ''), 'INR'),
   basis = nullif(trim(coalesce(v->>'basis', '')), ''), period_start = (v->>'period_start')::date, period_end = (v->>'period_end')::date, due_on = (v->>'due_on')::date,
   status = coalesce(v->>'status', status), reference = nullif(trim(coalesce(v->>'reference', '')), ''), paid_on = (v->>'paid_on')::date, updated_at = now()
   where id = p_id and agency_ws = p_workspace and relationship_id = rel returning * into f;
  if f.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 end if;
 return jsonb_build_object('id', f.id);
end $$;

-- ───────── Reads ─────────
create function aura_agency.grant_json(g aura_agency.grant_) returns jsonb language sql stable set search_path='' as $$
 select case when g.id is null then null else jsonb_build_object('scopes', to_jsonb(g.scopes), 'contracting', g.contracting, 'expires_at', g.expires_at, 'granted_at', g.granted_at,
  'granted_by', aura_agency.who(g.granted_by), 'expired', g.expires_at <= now(), 'days_left', greatest(0, extract(day from g.expires_at - now())::int)) end $$;
-- A small, scope-filtered picture of each client for the Agency dashboard (counts only).
create function aura_agency.snapshot(p_client uuid, p_kind text, p_scopes text[]) returns jsonb language sql stable set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object(
  'campaigns_live', case when p_kind = 'brand' and (p_scopes && array['view','campaigns']) then (select count(*) from aura_market.campaign c where c.workspace_id = p_client and c.status = 'published') end,
  'campaigns_draft', case when p_kind = 'brand' and (p_scopes && array['view','campaigns']) then (select count(*) from aura_market.campaign c where c.workspace_id = p_client and c.status = 'draft') end,
  'applications_new', case when p_kind = 'brand' and (p_scopes && array['view','applications']) then (select count(*) from aura_apply.application a join aura_market.campaign c on c.id = a.campaign_id where c.workspace_id = p_client and a.status = 'submitted') end,
  'content_review', case when p_kind = 'brand' and (p_scopes && array['view','content']) then (select count(*) from aura_brand_content.item i where i.workspace_id = p_client and i.stage = 'in_review') end,
  'content_scheduled', case when p_kind = 'brand' and (p_scopes && array['view','content']) then (select count(*) from aura_brand_content.item i where i.workspace_id = p_client and i.stage = 'scheduled') end,
  'applications_open', case when p_kind = 'creator' and (p_scopes && array['view','applications']) then (select count(*) from aura_apply.application a where a.creator_workspace_id = p_client and a.status in ('submitted','review','clarification','shortlisted','waitlisted')) end,
  'accounts', case when p_kind = 'creator' and (p_scopes && array['view','profile']) then (select count(*) from aura_creator.social_account s where s.workspace_id = p_client) end)) $$;
create function public.aura_agency_state(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_agency.actor(p_workspace, false); me text := (select role from aura_identity.membership where workspace_id = p_workspace and user_id = u);
begin
 return jsonb_build_object(
  'me', jsonb_build_object('id', u, 'role', me, 'admin', me in ('owner','admin') and aura_identity.strong(u), 'strong', aura_identity.strong(u)),
  'workspace', (select jsonb_build_object('name', w.name, 'verification', w.verification, 'status', w.status) from aura_identity.workspace w where w.id = p_workspace),
  'profile', (select to_jsonb(p) - 'workspace_id' from aura_agency.profile p where p.workspace_id = p_workspace),
  'verification', (select to_jsonb(v) - 'workspace_id' - 'decided_by' from aura_agency.verification v where v.workspace_id = p_workspace),
  'clients', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'client_ws', r.client_ws, 'name', aura_agency.ws_name(r.client_ws), 'kind', r.client_kind, 'status', r.status, 'started_at', r.started_at,
     'ended_at', r.ended_at, 'ended_side', r.ended_side, 'end_reason', r.end_reason, 'grant', aura_agency.grant_json(aura_agency.current_grant(r.id)),
     'my_role', (select s.role from aura_agency.assignment s where s.relationship_id = r.id and s.user_id = u),
     'team', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', aura_agency.who(s.user_id), 'role', s.role) order by s.assigned_at), '[]'::jsonb) from aura_agency.assignment s where s.relationship_id = r.id),
     'snapshot', case when r.status = 'active' and exists(select 1 from aura_agency.assignment s where s.relationship_id = r.id and s.user_id = u) and (aura_agency.current_grant(r.id)).expires_at > now()
        then aura_agency.snapshot(r.client_ws, r.client_kind, (aura_agency.current_grant(r.id)).scopes) end,
     'pending_approvals', (select count(*) from aura_agency.approval a where a.relationship_id = r.id and a.client_status = 'pending'))
    order by r.status, aura_agency.ws_name(r.client_ws)), '[]'::jsonb) from aura_agency.relationship r where r.agency_ws = p_workspace),
  'team', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', aura_agency.who(m.user_id), 'role', m.role, 'strong', aura_identity.strong(m.user_id),
     'clients', (select count(*) from aura_agency.assignment s join aura_agency.relationship r on r.id = s.relationship_id and r.status = 'active' where s.user_id = m.user_id and r.agency_ws = p_workspace)) order by m.role, aura_agency.who(m.user_id)), '[]'::jsonb)
    from aura_identity.membership m where m.workspace_id = p_workspace and m.active),
  'invites', (select coalesce(jsonb_agg(jsonb_build_object('created_at', i.created_at, 'kind', i.client_kind, 'label', i.client_label, 'scopes', to_jsonb(i.scopes), 'contracting', i.contracting, 'months', i.months, 'expires_at', i.expires_at) order by i.created_at desc), '[]'::jsonb)
    from aura_agency.client_invite i where i.agency_ws = p_workspace and i.revoked_at is null and i.accepted_relationship is null and i.expires_at > now()),
  'conflicts', (select coalesce(jsonb_agg(jsonb_build_object('creator_ws', x.creator_ws, 'brand_ws', x.brand_ws, 'creator', aura_agency.ws_name(x.creator_ws), 'brand', aura_agency.ws_name(x.brand_ws), 'collaborations', x.collaborations,
     'disclosure', (select jsonb_build_object('id', d.id, 'note', d.note, 'safeguards', d.safeguards, 'disclosed_at', d.disclosed_at, 'creator_ack_at', d.creator_ack_at, 'brand_ack_at', d.brand_ack_at)
       from aura_agency.disclosure d where d.agency_ws = p_workspace and d.creator_ws = x.creator_ws and d.brand_ws = x.brand_ws))), '[]'::jsonb) from aura_agency.pairs(p_workspace) x),
  'approvals', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'relationship_id', a.relationship_id, 'client', aura_agency.ws_name(r.client_ws), 'title', a.title, 'detail', a.detail, 'link', a.link,
     'requested_by', aura_agency.who(a.requested_by), 'requested_at', a.requested_at, 'internal_status', a.internal_status, 'internal_by', aura_agency.who(a.internal_by), 'internal_note', a.internal_note,
     'client_status', a.client_status, 'client_note', a.client_note, 'client_at', a.client_at) order by a.requested_at desc), '[]'::jsonb)
    from aura_agency.approval a join aura_agency.relationship r on r.id = a.relationship_id where r.agency_ws = p_workspace),
  'fees', (select coalesce(jsonb_agg(to_jsonb(f) - 'agency_ws' - 'created_by' || jsonb_build_object('client', aura_agency.ws_name(r.client_ws), 'amount', trim_scale(f.amount)) order by coalesce(f.due_on, f.created_at::date) desc), '[]'::jsonb)
    from aura_agency.fee f join aura_agency.relationship r on r.id = f.relationship_id where f.agency_ws = p_workspace),
  'activity', (select coalesce(jsonb_agg(jsonb_build_object('client', aura_agency.ws_name(a.client_ws), 'by', aura_agency.who(a.actor), 'action', a.action, 'scope', a.scope, 'contracting', a.contracting, 'at', a.at) order by a.at desc), '[]'::jsonb)
    from (select * from aura_agency.activity where agency_ws = p_workspace order by at desc limit 100) a));
end $$;
-- What the client sees about the Agencies working for it: access, team, activity in its name, fees, approvals and disclosures.
create function public.aura_agency_client_view(p_client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_agency.client(p_client, false);
begin
 return jsonb_build_object(
  'me', jsonb_build_object('owner', exists(select 1 from aura_identity.membership where workspace_id = p_client and user_id = u and role = 'owner' and active), 'strong', aura_identity.strong(u)),
  'agencies', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'agency', w.name, 'legal_name', p.legal_name, 'verified', w.verification = 'verified', 'status', r.status, 'started_at', r.started_at,
     'ended_at', r.ended_at, 'ended_side', r.ended_side, 'end_reason', r.end_reason, 'grant', aura_agency.grant_json(aura_agency.current_grant(r.id)),
     'history', (select coalesce(jsonb_agg(jsonb_build_object('scopes', to_jsonb(g.scopes), 'contracting', g.contracting, 'granted_at', g.granted_at, 'granted_by', aura_agency.who(g.granted_by), 'expires_at', g.expires_at, 'ended_at', g.ended_at, 'end_reason', g.end_reason) order by g.granted_at desc), '[]'::jsonb) from aura_agency.grant_ g where g.relationship_id = r.id),
     'team', (select coalesce(jsonb_agg(jsonb_build_object('name', aura_agency.who(s.user_id), 'role', s.role)), '[]'::jsonb) from aura_agency.assignment s where s.relationship_id = r.id),
     'activity', (select coalesce(jsonb_agg(jsonb_build_object('by', aura_agency.who(a.actor), 'action', a.action, 'scope', a.scope, 'contracting', a.contracting, 'at', a.at) order by a.at desc), '[]'::jsonb)
        from (select * from aura_agency.activity a where a.agency_ws = r.agency_ws and a.client_ws = p_client order by a.at desc limit 50) a),
     'fees', (select coalesce(jsonb_agg(jsonb_build_object('kind', f.kind, 'description', f.description, 'amount', trim_scale(f.amount), 'currency', f.currency, 'basis', f.basis, 'period_start', f.period_start, 'period_end', f.period_end, 'due_on', f.due_on, 'status', f.status, 'paid_on', f.paid_on) order by coalesce(f.due_on, f.created_at::date) desc), '[]'::jsonb)
        from aura_agency.fee f where f.relationship_id = r.id and f.status <> 'cancelled'),
     'approvals', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'detail', a.detail, 'link', a.link, 'requested_by', aura_agency.who(a.requested_by), 'requested_at', a.requested_at,
        'internal_status', a.internal_status, 'client_status', a.client_status, 'client_note', a.client_note) order by a.requested_at desc), '[]'::jsonb) from aura_agency.approval a where a.relationship_id = r.id),
     'disclosures', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'other', aura_agency.ws_name(case when d.creator_ws = p_client then d.brand_ws else d.creator_ws end), 'note', d.note, 'safeguards', d.safeguards,
        'disclosed_at', d.disclosed_at, 'acknowledged', case when d.creator_ws = p_client then d.creator_ack_at is not null else d.brand_ack_at is not null end)), '[]'::jsonb)
        from aura_agency.disclosure d where d.agency_ws = r.agency_ws and p_client in (d.creator_ws, d.brand_ws)))
    order by r.status, r.started_at desc), '[]'::jsonb)
   from aura_agency.relationship r join aura_identity.workspace w on w.id = r.agency_ws left join aura_agency.profile p on p.workspace_id = r.agency_ws where r.client_ws = p_client));
end $$;
-- The client workspaces the signed-in person may currently work in for an Agency (used by the app to resolve "working for").
create function public.aura_agency_delegations() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_identity.eligible();
begin
 return (select coalesce(jsonb_agg(jsonb_build_object('client_ws', r.client_ws, 'kind', r.client_kind, 'name', aura_agency.ws_name(r.client_ws), 'agency_ws', r.agency_ws, 'agency', aw.name,
   'scopes', to_jsonb(g.scopes), 'contracting', g.contracting, 'expires_at', g.expires_at, 'role', s.role,
   'can_write', s.role = 'manager' and aw.verification = 'verified' and aura_identity.strong(u)) order by aura_agency.ws_name(r.client_ws)), '[]'::jsonb)
  from aura_agency.relationship r join aura_agency.assignment s on s.relationship_id = r.id and s.user_id = u
  join aura_identity.membership m on m.workspace_id = r.agency_ws and m.user_id = u and m.active join aura_identity.workspace aw on aw.id = r.agency_ws and aw.status = 'open'
  join aura_agency.grant_ g on g.relationship_id = r.id and g.ended_at is null and g.expires_at > now()
  join aura_identity.workspace cw on cw.id = r.client_ws and cw.status <> 'suspended'
  where r.status = 'active');
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_agency\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'aura_agency' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
 end loop;
end $$;
commit;
