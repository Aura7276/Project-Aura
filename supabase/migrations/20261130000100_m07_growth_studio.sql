begin;
create schema aura_growth;
revoke all on schema aura_growth from public, anon, authenticated;
create table aura_growth.draft (
 id uuid primary key, workspace_id uuid not null references aura_identity.workspace(id),
 brief text not null check(length(brief) between 1 and 3000), body text not null default '' check(length(body)<=8000),
 kind text not null check(kind in ('Plan','Content','Opportunity','Pitch')), days int not null check(days in (7,30,90)),
 language text not null check(language in ('English','Hindi','Hinglish')), approved boolean not null default false,
 created_at timestamptz not null default now());
create index growth_history on aura_growth.draft(workspace_id,created_at desc);
create table aura_growth.turn(id bigint generated always as identity primary key,draft_id uuid not null references aura_growth.draft(id) on delete cascade, prompt text not null check(length(prompt)<=3000), reply text not null check(length(reply)<=8000), at timestamptz not null default now());
create index growth_turn_history on aura_growth.turn(draft_id,id desc);
alter table aura_growth.turn enable row level security;
create table aura_growth.memory(workspace_id uuid primary key references aura_identity.workspace(id),enabled boolean not null, preferences text not null check(length(preferences)<=2000),delete_requested_at timestamptz);
alter table aura_growth.memory add cadence text not null default 'off' check(cadence in ('off','daily','weekly'));
create table aura_growth.checkin(workspace_id uuid references aura_identity.workspace(id),due date,primary key(workspace_id,due));
alter table aura_growth.checkin enable row level security;
create function aura_growth.schedule_checkins() returns void language sql set search_path='' as $$
insert into aura_growth.checkin select workspace_id,current_date from aura_growth.memory where cadence='daily' or (cadence='weekly' and extract(isodow from current_date)=1) on conflict do nothing
$$;
revoke all on function aura_growth.schedule_checkins() from public,anon,authenticated;
do $$begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('aura-growth-checkins','15 0 * * *','select aura_growth.schedule_checkins()');end if;end $$;
create table aura_growth.usage(workspace_id uuid references aura_identity.workspace(id),period date, used integer not null,primary key(workspace_id,period));
create table aura_growth.policy(singleton boolean primary key check(singleton), monthly_requests integer not null check(monthly_requests between 0 and 10000));
alter table aura_growth.draft enable row level security;
alter table aura_growth.memory enable row level security;
alter table aura_growth.usage enable row level security;
alter table aura_growth.policy enable row level security;
create function public.aura_growth_state(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform aura_studio.own(p_workspace,false);
return jsonb_build_object('drafts',(select coalesce(jsonb_agg((to_jsonb(d)-'workspace_id') || jsonb_build_object('history',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from (select id,prompt,reply from aura_growth.turn where draft_id=d.id order by id desc limit 8)t)) order by created_at desc),'[]') from (select * from aura_growth.draft where workspace_id=p_workspace order by created_at desc limit 50)d),
'checkin',(select max(c.due) from aura_growth.checkin c join aura_growth.memory m using(workspace_id) where c.workspace_id=p_workspace and m.cadence<>'off' and c.due=current_date),'memory',(select to_jsonb(m)-'workspace_id' from aura_growth.memory m where workspace_id=p_workspace));end $$;
create function public.aura_growth_save(p_workspace uuid,p_id uuid,p_brief text,p_body text,p_kind text,p_days integer,p_language text) returns void language plpgsql security definer set search_path='' as $$
begin perform aura_studio.own(p_workspace,true);
insert into aura_growth.draft(id,workspace_id,brief,body,kind,days,language) values(p_id,p_workspace,p_brief,p_body,p_kind,p_days,p_language)
on conflict(id) do update set brief=excluded.brief,body=excluded.body,kind=excluded.kind,days=excluded.days,language=excluded.language where aura_growth.draft.workspace_id=p_workspace and not aura_growth.draft.approved;
if not found then raise exception 'Draft unavailable';end if;end $$;
create function public.aura_growth_memory(p_workspace uuid,p_enabled boolean,p_preferences text,p_delete boolean,p_cadence text) returns void language plpgsql security definer set search_path='' as $$
begin perform aura_studio.own(p_workspace,true);insert into aura_growth.memory values(p_workspace,p_enabled and not p_delete,case when p_delete then '' else p_preferences end,case when p_delete then now() end,case when p_delete then 'off' else p_cadence end) on conflict(workspace_id) do update set cadence=excluded.cadence,enabled=excluded.enabled,preferences=excluded.preferences,delete_requested_at=coalesce(excluded.delete_requested_at,aura_growth.memory.delete_requested_at);end $$;
create function public.aura_growth_reserve(p_workspace uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare cap int;begin perform aura_studio.own(p_workspace,true);select monthly_requests into cap from aura_growth.policy where singleton;if coalesce(cap,0)=0 then return false;end if;
insert into aura_growth.usage values(p_workspace,date_trunc('month',now() at time zone 'UTC')::date,1) on conflict(workspace_id,period) do update set used=aura_growth.usage.used+1 where aura_growth.usage.used<cap;return found;end $$;
create function public.aura_growth_approve(p_workspace uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d aura_growth.draft;begin perform aura_studio.own(p_workspace,true);select * into strict d from aura_growth.draft where id=p_id and workspace_id=p_workspace for update;
if d.approved then return;end if;if length(trim(d.body))=0 then raise exception 'Empty draft';end if;
perform public.aura_studio_capture_idea(p_workspace,d.id,left(d.brief,100),left(d.body,1000));update aura_growth.draft set approved=true where id=d.id;end $$;
create function public.aura_growth_turn(p_workspace uuid,p_id uuid,p_prompt text,p_reply text) returns void language plpgsql security definer set search_path='' as $$
begin perform aura_studio.own(p_workspace,true);perform 1 from aura_growth.draft where workspace_id=p_workspace and id=p_id and not approved for update;if not found then raise exception 'Draft unavailable';end if;insert into aura_growth.turn(draft_id,prompt,reply) values(p_id,p_prompt,p_reply);end $$;
do $$ declare f regprocedure;begin for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'aura_growth_%' loop execute format('revoke all on function %s from public,anon; grant execute on function %s to authenticated',f,f);end loop;end $$;
commit;
