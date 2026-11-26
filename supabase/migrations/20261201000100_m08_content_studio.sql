-- Private versioned content documents. Production progress has no contract approval effects.
create table aura_studio.content_version (
 workspace_id uuid not null references aura_identity.workspace on delete cascade, item_id uuid not null, revision integer not null check(revision>0),
 document jsonb not null, saved_at timestamptz not null default now(),
 primary key(workspace_id,item_id,revision)
);
alter table aura_studio.content_version enable row level security;
revoke all on aura_studio.content_version from public,anon,authenticated;
create function public.aura_content_read(p_workspace uuid,p_item uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform aura_studio.own(p_workspace,false);
 if p_item is not null then
 return (select coalesce(jsonb_agg(jsonb_build_object('item',document,'revision',revision,'at',saved_at) order by revision desc),'[]') from aura_studio.content_version where workspace_id=p_workspace and item_id=p_item);
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('item',document,'revision',revision) order by saved_at desc),'[]') from
 (select distinct on(item_id) document,revision,saved_at from aura_studio.content_version where workspace_id=p_workspace order by item_id,revision desc) v);
end $$;
create function public.aura_content_save(p_workspace uuid,p_item jsonb,p_expected integer)
returns integer language plpgsql security definer set search_path='' as $$
declare k uuid := (p_item->>'id')::uuid; r integer; previous jsonb;
begin
 perform aura_studio.own(p_workspace,true);
 if k is null or p_expected is null or p_expected<0 or jsonb_typeof(p_item)<>'object' or length(p_item::text)>85000 or coalesce(length(trim(p_item->>'title')),0) not between 1 and 180 then raise exception 'Invalid content'; end if;
 if coalesce(p_item->>'published','')<>'' and (p_item->>'published') !~* '^https?://[^[:space:]]+$' then raise exception 'Publication URL required'; end if;
 if p_item->>'idea' is not null and not exists(select from aura_studio.idea where workspace_id=p_workspace and id=(p_item->>'idea')::uuid) then raise exception 'Idea unavailable'; end if;
 if p_item->>'parent' is not null and not exists(select from aura_studio.content_version where workspace_id=p_workspace and item_id=(p_item->>'parent')::uuid) then raise exception 'Source unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text||k::text,0));
 select revision,document into r,previous from aura_studio.content_version where workspace_id=p_workspace and item_id=k order by revision desc limit 1;
 r:=coalesce(r,0);
 if previous=p_item then return r; end if;
 if r<>p_expected then raise exception 'Revision conflict'; end if;
 insert into aura_studio.content_version(workspace_id,item_id,revision,document) values(p_workspace,k,r+1,p_item);
 return r+1;
end $$;
revoke all on function public.aura_content_read(uuid,uuid),public.aura_content_save(uuid,jsonb,integer) from public,anon;
grant execute on function public.aura_content_read(uuid,uuid),public.aura_content_save(uuid,jsonb,integer) to authenticated;
create table aura_studio.content_resource(
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 id uuid not null, kind text not null check(kind in ('pillar','reference')),
 name text not null check(length(trim(name)) between 1 and 120),
 note text not null check(length(note)<=6000),url text not null check(url='' or (length(url)<=2048 and url ~* '^https?://[^[:space:]]+$')),
 mix integer check(mix between 0 and 100),primary key(workspace_id,id)
);
alter table aura_studio.content_resource enable row level security;
revoke all on aura_studio.content_resource from public,anon,authenticated;
create function public.aura_content_resources(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform aura_studio.own(p_workspace,false);
return (select coalesce(jsonb_agg(to_jsonb(r)-'workspace_id' order by name),'[]') from aura_studio.content_resource r where workspace_id=p_workspace);
end $$;
create function public.aura_content_resource_save(p_workspace uuid,p_resource jsonb) returns void language plpgsql security definer set search_path='' as $$
begin perform aura_studio.own(p_workspace,true);
insert into aura_studio.content_resource as r(workspace_id,id,kind,name,note,url,mix)
values(p_workspace,(p_resource->>'id')::uuid,p_resource->>'kind',p_resource->>'name',p_resource->>'note',p_resource->>'url',(p_resource->>'mix')::integer)
on conflict(workspace_id,id) do update set name=excluded.name,note=excluded.note,url=excluded.url,mix=excluded.mix;
end $$;
revoke all on function public.aura_content_resources(uuid),public.aura_content_resource_save(uuid,jsonb) from public,anon;
grant execute on function public.aura_content_resources(uuid),public.aura_content_resource_save(uuid,jsonb) to authenticated;
