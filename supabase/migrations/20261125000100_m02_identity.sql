begin;
create schema aura_identity;
revoke all on schema aura_identity from public, anon, authenticated;
create table aura_identity.profile (
 user_id uuid primary key references auth.users on delete cascade,
 full_name text not null check(length(trim(full_name)) between 1 and 120),
 country text not null check(country ~ '^[A-Z]{2}$'),
 adult_attested_at timestamptz not null default now(),
 mobile text check(mobile ~ '^\+[1-9][0-9]{6,14}$'),
 enabled boolean not null default true,
 last_workspace uuid
);
create table aura_identity.workspace (
 id uuid primary key default gen_random_uuid(),
 founder uuid not null references auth.users,
 request_id uuid not null,
 kind text not null check(kind in ('creator','brand','agency')),
 name text not null check(length(trim(name)) between 1 and 100),
 business_kind text,
 status text not null default 'open' check(status in ('open','restricted','suspended')),
 verification text not null default 'pending' check(verification in ('pending','verified','revoked')),
 onboarding text not null default 'not_started' check(onboarding in ('not_started','in_progress','completed','restricted')),
 next_step text not null default 'entry',
 unique(founder,request_id),
 check(kind <> 'brand' or (business_kind is not null and business_kind in ('company','startup','individual','small_business')))
);
create unique index personal_creator on aura_identity.workspace(founder) where kind='creator';
alter table aura_identity.profile add foreign key(last_workspace) references aura_identity.workspace(id) on delete set null;
create table aura_identity.membership (
 workspace_id uuid references aura_identity.workspace on delete cascade,
 user_id uuid references auth.users on delete cascade,
 role text not null check(role in ('owner','admin','member')), active boolean not null default true,
 primary key(workspace_id,user_id)
);
create index memberships_by_user on aura_identity.membership(user_id);
create table aura_identity.platform_admin(user_id uuid primary key references auth.users, provisioned_at timestamptz not null default now());
create table aura_identity.invitation (
 token_hash bytea primary key, workspace_id uuid not null references aura_identity.workspace,
 recipient_email text not null, role text not null check(role in ('admin','member')),
 expires_at timestamptz not null, revoked boolean not null default false,
 accepted_by uuid references auth.users, accepted_at timestamptz
);
create table aura_identity.referral (
 code text primary key check(code ~ '^[A-Za-z0-9_-]{1,100}$'), creator_id uuid not null references auth.users,
 expires_at timestamptz not null, revoked boolean not null default false
);
create table aura_identity.attribution (
 referred_user uuid primary key references auth.users, referrer uuid not null references auth.users,
 recorded_at timestamptz not null default now(), check(referred_user<>referrer)
);
create table aura_identity.event (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade,
 event text not null, at timestamptz not null default now()
);
create index security_timeline on aura_identity.event(user_id,at desc);
do $$ declare t text;begin foreach t in array array['profile','workspace','membership','platform_admin','invitation','referral','attribution','event'] loop
 execute format('alter table aura_identity.%I enable row level security',t);
 end loop;end $$;
-- No direct client grants or policies. These tables are private, with default-deny RLS.
create function aura_identity.actor() returns uuid language plpgsql stable set search_path='' as $$
declare u uuid:=auth.uid();begin
 if not exists(select 1 from auth.users a join auth.sessions s on s.user_id=a.id
 where a.id=u and s.id=(auth.jwt()->>'session_id')::uuid and a.email_confirmed_at is not null
 and (s.not_after is null or s.not_after>now()) and (a.banned_until is null or a.banned_until<=now())
 and a.deleted_at is null) or exists(select 1 from aura_identity.profile p where p.user_id=u and not p.enabled)
 then raise exception 'Access denied' using errcode='42501';end if;return u;end $$;
create function aura_identity.strong(u uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from auth.sessions s join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id where s.user_id=u and s.id=(auth.jwt()->>'session_id')::uuid and f.status='verified')
$$;
create function aura_identity.required(u uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from aura_identity.platform_admin where user_id=u) or exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id where m.user_id=u and m.active and m.role in ('owner','admin') and w.kind in ('brand','agency')) or exists(select 1 from auth.mfa_factors where user_id=u and status='verified')
$$;
create function aura_identity.eligible() returns uuid language plpgsql stable set search_path='' as $$
declare u uuid:=aura_identity.actor(); begin
 if not exists(select 1 from aura_identity.profile where user_id=u and enabled) or (aura_identity.required(u) and not aura_identity.strong(u)) then raise exception 'Access denied' using errcode='42501';end if;return u;end $$;
create function public.aura_identity_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=aura_identity.actor();p aura_identity.profile;begin
 select * into p from aura_identity.profile where user_id=u;
 return jsonb_build_object('profile',p.user_id is not null,'mfa_required',aura_identity.required(u),'strong',aura_identity.strong(u),
 'last_workspace',case when exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id where m.user_id=u and m.active and w.status<>'suspended' and w.id=p.last_workspace and (not aura_identity.required(u) or aura_identity.strong(u))) then p.last_workspace end);
end $$;
create function public.aura_complete_identity(p_name text,p_country text,p_adult boolean,p_mobile text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=aura_identity.actor();begin
 if p_adult is not true then raise exception 'Adult confirmation required';end if;
 insert into aura_identity.profile(user_id,full_name,country,mobile) values(u,trim(p_name),p_country,nullif(p_mobile,'')) on conflict(user_id) do nothing;
end $$;
create function public.aura_workspaces() returns table(id uuid,name text,kind text,role text,status text,onboarding text,verification text,next_step text) language sql stable security definer set search_path='' as $$
 select w.id,w.name,w.kind,m.role,w.status,w.onboarding,w.verification,w.next_step from aura_identity.workspace w join aura_identity.membership m on m.workspace_id=w.id where m.user_id=aura_identity.eligible() and m.active and w.status<>'suspended' order by w.name,w.id
$$;
create function public.aura_create_workspace(p_request uuid,p_kind text,p_name text,p_business text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=aura_identity.eligible(); wid uuid;begin
 if p_kind not in ('creator','brand') or (p_kind='brand' and not aura_identity.strong(u)) then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from aura_identity.profile where user_id=u for update;
 select id into wid from aura_identity.workspace where founder=u and request_id=p_request and kind=p_kind;
 if wid is null and p_kind='creator' then select id into wid from aura_identity.workspace where founder=u and kind='creator';end if;
 if wid is null then
 insert into aura_identity.workspace(founder,request_id,kind,name,business_kind) values(u,p_request,p_kind,trim(p_name),p_business) returning id into wid;
 insert into aura_identity.membership values(wid,u,'owner',true);
 insert into aura_identity.event(user_id,event) values(u,'workspace_created');end if;
 if not exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id where w.id=wid and w.status<>'suspended' and m.user_id=u and m.active) then raise exception 'Access denied';end if;
 update aura_identity.profile set last_workspace=wid where user_id=u;return wid;end $$;
create function public.aura_select_workspace(p_workspace uuid,p_begin boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=aura_identity.eligible(); r text; st text;begin
 select m.role,w.status into r,st from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id where m.workspace_id=p_workspace and m.user_id=u and m.active and w.status<>'suspended' for share of m;
 if r is null then raise exception 'Access denied' using errcode='42501';end if;
 if p_begin then if r<>'owner' or st<>'open' then raise exception 'Access denied';end if;
 update aura_identity.workspace set onboarding='in_progress',next_step='profile' where id=p_workspace and onboarding='not_started';end if;
 update aura_identity.profile set last_workspace=p_workspace where user_id=u;end $$;
create function public.aura_accept_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=aura_identity.eligible();i aura_identity.invitation;begin
 select * into i from aura_identity.invitation where token_hash=sha256(convert_to(p_token,'UTF8')) for update;
 if i.workspace_id is null or i.revoked or i.expires_at<=now() or lower(i.recipient_email)<>(select lower(email) from auth.users where id=u) or (i.accepted_by is not null and i.accepted_by<>u)
 or not exists(select 1 from aura_identity.workspace where id=i.workspace_id and status='open' and kind in ('brand','agency')) or (i.role='admin' and not aura_identity.strong(u)) then raise exception 'Invitation unavailable';end if;
 if i.accepted_by is null then insert into aura_identity.membership values(i.workspace_id,u,i.role,true) on conflict do nothing;
 update aura_identity.invitation set accepted_by=u,accepted_at=now() where token_hash=i.token_hash;end if;
 perform public.aura_select_workspace(i.workspace_id,false);return i.workspace_id;end $$;
create function public.aura_attribute_referral(p_code text) returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=aura_identity.eligible();begin
 insert into aura_identity.attribution(referred_user,referrer) select u,r.creator_id from aura_identity.referral r where r.code=p_code and not r.revoked and r.expires_at>now() and r.creator_id<>u on conflict do nothing;
 return exists(select 1 from aura_identity.attribution a join aura_identity.referral r on r.creator_id=a.referrer where a.referred_user=u and r.code=p_code and not r.revoked and r.expires_at>now());end $$;
create function public.aura_security_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=aura_identity.eligible(); begin return jsonb_build_object(
 'sessions',(select coalesce(jsonb_agg(jsonb_build_object('current',s.id=(auth.jwt()->>'session_id')::uuid,'created_at',s.created_at,'agent',left(s.user_agent,160)) order by s.created_at desc),'[]') from auth.sessions s where s.user_id=u and (s.not_after is null or s.not_after>now())),
 'activity',(select coalesce(jsonb_agg(row_to_json(e)),'[]') from (select event,at from aura_identity.event where user_id=u union all select payload->>'action',created_at from auth.audit_log_entries where payload->>'actor_id'=u::text and payload->>'action' in ('login','logout','user_recovery_requested','factor_enrolled','factor_unenrolled','user_modified') order by at desc limit 40)e),
 'mobile',(select mobile from aura_identity.profile where user_id=u),
 'verified_phone',(select case when phone_confirmed_at is not null then phone end from auth.users where id=u));end $$;
create function aura_identity.membership_event() returns trigger language plpgsql set search_path='' as $$begin
 insert into aura_identity.event(user_id,event) values(new.user_id,case when tg_op='INSERT' then 'membership_created' else 'membership_changed' end);return new;end $$;
create trigger membership_audit after insert or update on aura_identity.membership for each row execute function aura_identity.membership_event();
create function public.aura_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from aura_identity.platform_admin where user_id=aura_identity.eligible() and aura_identity.strong(auth.uid()))
$$;
create function public.aura_privileged_mfa() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from aura_identity.platform_admin where user_id=aura_identity.eligible()) or exists(select 1 from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id where m.user_id=aura_identity.eligible() and m.active and m.role in ('owner','admin') and w.kind in ('brand','agency')) $$;
do $$ declare fn regprocedure;begin for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('aura_identity_state','aura_complete_identity','aura_workspaces','aura_create_workspace','aura_select_workspace','aura_accept_invitation','aura_attribute_referral','aura_security_state','aura_is_admin','aura_privileged_mfa') loop
 execute format('revoke all on function %s from public,anon,authenticated',fn);
 execute format('grant execute on function %s to authenticated',fn);end loop;end $$;
revoke all on all tables in schema aura_identity from public,anon,authenticated;
revoke all on all functions in schema aura_identity from public,anon,authenticated;
commit;