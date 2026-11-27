begin;
create schema aura_brand_home;
revoke all on schema aura_brand_home from public,anon,authenticated;
create table aura_brand_home.plan(
 workspace_id uuid primary key references aura_identity.workspace,
 revision integer not null default 0,
 document jsonb not null default '{"focus":{"objective":"","audience":"","resources":"","horizon":30},"tasks":[],"observations":[],"activity":[]}'
);
create table aura_brand_home.event(
 workspace_id uuid not null references aura_identity.workspace,
 request_id uuid not null,actor uuid not null references auth.users,command jsonb not null,
 at timestamptz not null default now(),primary key(workspace_id,request_id)
);
alter table aura_brand_home.plan enable row level security;
alter table aura_brand_home.event enable row level security;
revoke all on all tables in schema aura_brand_home from public,anon,authenticated;
create function aura_brand_home.access(p_workspace uuid,p_write boolean default false) returns jsonb language plpgsql stable set search_path='' as $$
declare u uuid:=aura_identity.eligible(); result jsonb;
begin
 select jsonb_build_object('id',w.id,'name',w.name,'role',m.role,'verification',w.verification,'status',w.status) into result
 from aura_identity.workspace w join aura_identity.membership m on m.workspace_id=w.id
 where w.id=p_workspace and w.kind='brand' and w.status<>'suspended' and m.user_id=u and m.active
 and (not p_write or (w.status='open' and m.role in('owner','admin')));
 if result is null then raise exception 'Brand workspace access denied' using errcode='42501';end if;
 return result;
end $$;
create function public.aura_brand_home_read(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ws jsonb:=aura_brand_home.access(p_workspace); saved_plan aura_brand_home.plan; projects jsonb:='[]'; project record;
begin
 select * into saved_plan from aura_brand_home.plan where workspace_id=p_workspace;
 if saved_plan.workspace_id is null then saved_plan.revision:=0;saved_plan.document:='{"focus":{"objective":"","audience":"","resources":"","horizon":30},"tasks":[],"observations":[],"activity":[]}';end if;
 for project in select id,document from aura_collaboration.workspace where brand_workspace=p_workspace loop
 begin
 perform aura_collaboration.access(project.id);
 projects:=projects||jsonb_build_array(jsonb_build_object('id',project.id,'title',project.document->>'title','creator',project.document->>'creator','category',project.document->>'category','status',project.document->>'status'));
 exception when insufficient_privilege then null;
 end;
 end loop;
 return saved_plan.document||jsonb_build_object('workspace',ws,'revision',saved_plan.revision,'collaborations',projects,'collaborationsAvailable',true);
end $$;
create function public.aura_brand_home_command(p_workspace uuid,p_request uuid,p_expected integer,p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ws jsonb:=aura_brand_home.access(p_workspace,true); u uuid:=aura_identity.eligible(); saved_plan aura_brand_home.plan;
 previous aura_brand_home.event; doc jsonb; item jsonb; i integer; cmd text:=p_command->>'type'; id uuid:=gen_random_uuid();
begin
 if p_request is null or p_expected is null or p_expected<0 or jsonb_typeof(p_command) is distinct from 'object' or length(p_command::text)>10000 then raise exception 'Invalid command';end if;
 perform pg_advisory_xact_lock(hashtextextended('brand-home:'||p_workspace::text,0));
 insert into aura_brand_home.plan(workspace_id) values(p_workspace) on conflict do nothing;
 select * into saved_plan from aura_brand_home.plan where workspace_id=p_workspace for update;
 select * into previous from aura_brand_home.event where workspace_id=p_workspace and request_id=p_request;
 if found then
 if previous.actor<>u or previous.command<>p_command then raise exception 'Request conflict';end if;
 return public.aura_brand_home_read(p_workspace);
 end if;
 if saved_plan.revision<>p_expected then raise exception 'Revision conflict' using errcode='40001';end if;
 doc:=saved_plan.document;
 case cmd
 when 'focus' then
 if coalesce(length(trim(p_command->>'objective')),0) not between 1 and 180 or coalesce(p_command->>'horizon','') not in('7','30','90') or length(coalesce(p_command->>'audience',''))>1000 or length(coalesce(p_command->>'resources',''))>1000 then raise exception 'Invalid planning focus';end if;
 doc:=jsonb_set(doc,'{focus}',p_command-'type');
 when 'task' then
 if coalesce(length(trim(p_command->>'title')),0) not between 1 and 180 or coalesce(p_command->>'track','') not in('Owned content','Creator marketing','Business') or length(coalesce(p_command->>'note',''))>3000 then raise exception 'Invalid priority';end if;
 perform (p_command->>'id')::uuid;
 if coalesce(p_command->>'id','')='' then raise exception 'Priority ID required';end if;
 if coalesce(p_command->>'due','')<>'' then perform (p_command->>'due')::date;end if;
 select ordinality::integer-1,value into i,item from jsonb_array_elements(doc->'tasks') with ordinality where value->>'id'=p_command->>'id';
 if item is null then
 item:=(p_command-'type')||jsonb_build_object('done',false,'created_at',now());
 doc:=jsonb_set(doc,'{tasks}',doc->'tasks'||jsonb_build_array(item));
 else
 doc:=jsonb_set(doc,array['tasks',i::text],item||(p_command-'type'));
 end if;
 when 'complete' then
 select ordinality::integer-1,value into i,item from jsonb_array_elements(doc->'tasks') with ordinality where value->>'id'=p_command->>'id';
 if item is null or jsonb_typeof(p_command->'done') is distinct from 'boolean' then raise exception 'Priority unavailable';end if;
 doc:=jsonb_set(doc,array['tasks',i::text,'done'],p_command->'done');
 when 'observation' then
 if coalesce(p_command->>'metric','') not in('Followers','Reach','Engagements','Website visits','Enquiries')
 or coalesce(p_command->>'value','') !~ '^[0-9]{1,13}$' or (p_command->>'value')::numeric>1000000000000
 or coalesce(length(trim(p_command->>'source')),0) not between 1 and 180
 or coalesce(length(trim(p_command->>'channel')),0) not between 1 and 180
 or length(coalesce(p_command->>'note',''))>2000 then raise exception 'Observation and source required';end if;
 if coalesce(p_command->>'date','')='' or (p_command->>'date')::date>current_date then raise exception 'Actual observation date required';end if;
 doc:=jsonb_set(doc,'{observations}',doc->'observations'||jsonb_build_array((p_command-'type')||jsonb_build_object('id',id)));
 else raise exception 'Unsupported action';
 end case;
 doc:=jsonb_set(doc,'{activity}',jsonb_build_array(jsonb_build_object('id',id,'action',cmd,'at',now()))||doc->'activity');
 insert into aura_brand_home.event(workspace_id,request_id,actor,command) values(p_workspace,p_request,u,p_command);
 update aura_brand_home.plan set revision=saved_plan.revision+1,document=doc where workspace_id=p_workspace;
 return public.aura_brand_home_read(p_workspace);
end $$;
revoke all on all functions in schema aura_brand_home from public,anon,authenticated;
revoke all on function public.aura_brand_home_read(uuid),public.aura_brand_home_command(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.aura_brand_home_read(uuid),public.aura_brand_home_command(uuid,uuid,integer,jsonb) to authenticated;
commit;
