begin;
create schema aura_collaboration;
revoke all on schema aura_collaboration from public,anon,authenticated;
create table aura_collaboration.workspace (
 id uuid primary key default gen_random_uuid(),
 proposal_id uuid not null unique,
 creator_workspace uuid not null references aura_identity.workspace,
 brand_workspace uuid not null references aura_identity.workspace,
 revision integer not null default 0,
 document jsonb not null check(jsonb_typeof(document)='object'),
 created_at timestamptz not null default now(),
 check(creator_workspace<>brand_workspace)
);
create table aura_collaboration.participant (
 collaboration_id uuid not null references aura_collaboration.workspace,
 user_id uuid not null references auth.users,
 side text not null check(side in ('creator','brand')),
 can_review boolean not null default false,
 active boolean not null default true,
 primary key(collaboration_id,user_id)
);
create table aura_collaboration.event (
 collaboration_id uuid not null references aura_collaboration.workspace,
 request_id uuid not null,
 actor uuid not null references auth.users,
 side text not null,
 command jsonb not null,
 revision integer not null,
 at timestamptz not null default now(),
 primary key(collaboration_id,request_id)
);
alter table aura_collaboration.workspace enable row level security;
alter table aura_collaboration.participant enable row level security;
alter table aura_collaboration.event enable row level security;
revoke all on all tables in schema aura_collaboration from public,anon,authenticated;

-- Managers inherit authority only within the two contracting workspaces.
-- Other members must have an explicit per-collaboration participant grant.
create function aura_collaboration.access(p_id uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare u uuid:=aura_identity.eligible(); c aura_collaboration.workspace; membership_record record;
begin
 select * into c from aura_collaboration.workspace where id=p_id;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 select m.role,w.kind into membership_record from aura_identity.membership m join aura_identity.workspace w on w.id=m.workspace_id
 where m.user_id=u and m.active and w.status='open'
 and w.id in(c.creator_workspace,c.brand_workspace)
 and (m.role in('owner','admin') or exists(select 1 from aura_collaboration.participant p where p.collaboration_id=p_id and p.user_id=u and p.active and p.side=w.kind))
 order by case when w.id=c.creator_workspace then 0 else 1 end limit 1;
 if not found then raise exception 'Access denied' using errcode='42501'; end if;
 -- Cross-side membership is ambiguous and cannot be used to accept both sides.
 if exists(select 1 from aura_identity.membership a join aura_identity.membership b on a.user_id=b.user_id
 where a.user_id=u and a.active and b.active and a.workspace_id=c.creator_workspace and b.workspace_id=c.brand_workspace)
 then raise exception 'Conflicting participant roles' using errcode='42501'; end if;
 return jsonb_build_object('side',membership_record.kind,'manage',membership_record.role in('owner','admin'),'review',membership_record.role in('owner','admin') or exists(select 1 from aura_collaboration.participant p where p.collaboration_id=p_id and p.user_id=u and p.active and p.can_review));
end $$;
create function public.aura_collaboration_read(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb:=aura_collaboration.access(p_id); c aura_collaboration.workspace;
begin
 select * into c from aura_collaboration.workspace where id=p_id;
 return jsonb_build_object('access',a,'collaboration',c.document||jsonb_build_object('id',c.id,'revision',c.revision));
end $$;
create function public.aura_collaboration_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=aura_identity.eligible(); c record; result jsonb:='[]';
begin
 for c in select distinct w.id from aura_collaboration.workspace w join aura_identity.membership m on m.workspace_id in(w.creator_workspace,w.brand_workspace)
 where m.user_id=u and m.active loop
 begin result:=result||jsonb_build_array(public.aura_collaboration_read(c.id)); exception when insufficient_privilege then null; end;
 end loop;
 return result;
end $$;
-- Provisioning is intentionally internal. M11 must supply a confirmed, immutable
-- proposal and legally approved agreement. No authenticated creation grant.
create function aura_collaboration.provision(p_proposal uuid,p_creator uuid,p_brand uuid,p_document jsonb)
returns uuid language plpgsql set search_path='' as $$
declare result uuid;
begin
 if not exists(select from aura_identity.workspace where id=p_creator and kind='creator' and status='open') or
 not exists(select from aura_identity.workspace where id=p_brand and kind='brand' and status='open') then raise exception 'Invalid parties'; end if;
 if p_document->>'status'<>'Agreement pending' or jsonb_array_length(p_document->'agreements')<>1
 or jsonb_array_length(p_document->'deliverables')<1 then raise exception 'Confirmed proposal and structured agreement required'; end if;
 insert into aura_collaboration.workspace(proposal_id,creator_workspace,brand_workspace,document)
 values(p_proposal,p_creator,p_brand,p_document) on conflict(proposal_id) do nothing returning id into result;
 if result is null then select id into result from aura_collaboration.workspace where proposal_id=p_proposal and creator_workspace=p_creator and brand_workspace=p_brand; end if;
 if result is null then raise exception 'Proposal parties conflict'; end if;
 return result;
end $$;

create function public.aura_collaboration_command(p_id uuid,p_request uuid,p_expected integer,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 a jsonb:=aura_collaboration.access(p_id); side text:=a->>'side'; u uuid:=aura_identity.eligible();
 c aura_collaboration.workspace; doc jsonb; cmd text:=p_command->>'type';
 i integer; j integer; k integer; d jsonb; s jsonb; entry jsonb; agreement jsonb;
 content_document jsonb; selected_text text;
 event_id uuid:=gen_random_uuid(); timestamp_text text:=now()::text; existing aura_collaboration.event;
begin
 if p_request is null or p_expected is null or p_expected<0 or jsonb_typeof(p_command)<>'object' or length(p_command::text)>16000 then raise exception 'Invalid request'; end if;
 select * into c from aura_collaboration.workspace where id=p_id for update;
 select * into existing from aura_collaboration.event where collaboration_id=p_id and request_id=p_request;
 if found then
 if existing.actor<>u or existing.command<>p_command then raise exception 'Request conflict'; end if;
 return public.aura_collaboration_read(p_id);
 end if;
 if c.revision<>p_expected then raise exception 'Revision conflict' using errcode='40001'; end if;
 doc:=c.document;
 if cmd in('accept','change','respond','dispute','resolve','confirmResolution','complete') and (a->>'manage')::boolean is not true then raise exception 'Manager required' using errcode='42501'; end if;
 if cmd in('submit','share','review','change','respond','fulfil','performance','complete') and doc->>'status'<>'Active' then raise exception 'Active agreement required'; end if;
 if cmd in('submit','share','fulfil') and side<>'creator' then raise exception 'Creator action required' using errcode='42501'; end if;
 if cmd='review' and (side<>'brand' or (a->>'review')::boolean is not true) then raise exception 'Reviewer required' using errcode='42501'; end if;
 if cmd in('submit','fulfil','evidence') and coalesce(p_command->>'url','')<>'' and (p_command->>'url' !~* '^https?://[^[:space:]]+$' or length(p_command->>'url')>2048) then raise exception 'Invalid URL'; end if;
 if cmd in('submit','review','fulfil','evidence','resolve','dependency') and coalesce(length(trim(p_command->>'note')),0) not between 1 and 6000 then raise exception 'Note required'; end if;
 if cmd in('submit','share','review','fulfil') then
 select ordinality::integer-1,value into i,d from jsonb_array_elements(doc->'deliverables') with ordinality where value->>'id'=p_command->>'deliverable';
 if d is null then raise exception 'Deliverable unavailable'; end if;
 end if;
 case cmd
 when 'accept' then
 k:=jsonb_array_length(doc->'agreements')-1; agreement:=doc->'agreements'->k;
 if jsonb_typeof(p_command->'version') is distinct from 'number' or doc->>'status'<>'Agreement pending' or (agreement->>'templateApproved')::boolean is not true or (agreement->>'version')::integer<>(p_command->>'version')::integer then raise exception 'Acceptance unavailable'; end if;
 if not exists(select from jsonb_array_elements(agreement->'acceptances') x where x->>'side'=side) then
 agreement:=jsonb_set(agreement,'{acceptances}',(agreement->'acceptances')||jsonb_build_array(jsonb_build_object('side',side,'actor',u,'at',timestamp_text)));
 doc:=jsonb_set(doc,array['agreements',k::text],agreement);
 end if;
 if jsonb_array_length(agreement->'acceptances')=2 then doc:=jsonb_set(doc,'{status}','"Active"'); end if;
 when 'message' then
 if coalesce(length(trim(p_command->>'body')),0) not between 1 and 6000 then raise exception 'Message required'; end if;
 doc:=jsonb_set(doc,'{messages}',doc->'messages'||jsonb_build_array(jsonb_build_object('id',event_id,'body',p_command->>'body','side',side,'at',timestamp_text)));
 when 'submit' then
 if p_command->>'stage' is distinct from d->>'stage' or d->>'review'='Approved' or coalesce(p_command->>'url','')='' then raise exception 'Stage unavailable'; end if;
 if exists(select from jsonb_array_elements(d->'submissions') x where x->>'stage'=d->>'stage' and x->'review' is null) then raise exception 'Review pending'; end if;
 s:=jsonb_build_object('id',event_id,'stage',d->>'stage','number',jsonb_array_length(d->'submissions')+1,'url',p_command->>'url','note',p_command->>'note','at',timestamp_text);
 d:=jsonb_set(jsonb_set(d,'{submissions}',d->'submissions'||jsonb_build_array(s)),'{review}','null');
 doc:=jsonb_set(doc,array['deliverables',i::text],d);
 when 'share' then
 perform aura_studio.own(c.creator_workspace,false);
 if p_command->>'stage' is distinct from d->>'stage' or d->>'review'='Approved' then raise exception 'Stage unavailable'; end if;
 if exists(select from jsonb_array_elements(d->'submissions') x where x->>'stage'=d->>'stage' and x->'review' is null) then raise exception 'Review pending'; end if;
 if jsonb_typeof(p_command->'fields') is distinct from 'array' or jsonb_array_length(p_command->'fields') not between 1 and 2 or exists(select from jsonb_array_elements_text(p_command->'fields') f where f not in('body','caption')) then raise exception 'Choose shared sections'; end if;
 select document into content_document from aura_studio.content_version where workspace_id=c.creator_workspace and item_id=(p_command->>'content')::uuid and revision=(p_command->>'contentRevision')::integer;
 if content_document is null then raise exception 'Content version unavailable'; end if;
 select string_agg(content_document->>f,E'\n\n') into selected_text from jsonb_array_elements_text(p_command->'fields') f;
 if coalesce(length(trim(selected_text)),0)=0 then raise exception 'Select content with text'; end if;
 s:=jsonb_build_object('id',event_id,'stage',d->>'stage','number',jsonb_array_length(d->'submissions')+1,'url','','note',selected_text,'at',timestamp_text,'content',p_command->>'content','contentRevision',p_command->'contentRevision');
 d:=jsonb_set(jsonb_set(d,'{submissions}',d->'submissions'||jsonb_build_array(s)),'{review}','null');
 doc:=jsonb_set(doc,array['deliverables',i::text],d);
 when 'review' then
 j:=jsonb_array_length(d->'submissions')-1; s:=d->'submissions'->j;
 if s is null or s->>'id' is distinct from p_command->>'submission' or s->>'stage' is distinct from d->>'stage' or s->'review' is not null then raise exception 'Review latest submission'; end if;
 if coalesce(p_command->>'decision','') not in('Approved','Revision requested','Concern raised') or coalesce(p_command->>'scope','') not in('Agreed requirement','Voluntary improvement','Additional request') then raise exception 'Invalid review'; end if;
 s:=jsonb_set(s,'{review}',jsonb_build_object('decision',p_command->>'decision','note',p_command->>'note','scope',p_command->>'scope','actor',u,'at',timestamp_text));
 d:=jsonb_set(jsonb_set(d,array['submissions',j::text],s),'{review}',p_command->'decision');
 select ordinality::integer into k from jsonb_array_elements_text(d->'stages') with ordinality where value=d->>'stage';
 if p_command->>'decision'='Approved' and k<jsonb_array_length(d->'stages') then d:=jsonb_set(jsonb_set(d,'{stage}',d->'stages'->k),'{review}','null'); end if;
 doc:=jsonb_set(doc,array['deliverables',i::text],d);
 when 'fulfil' then
 if d->>'review' is distinct from 'Approved' or d->>'stage' is distinct from d->'stages'->>(jsonb_array_length(d->'stages')-1) or coalesce(p_command->>'url','')='' then raise exception 'Complete required reviews'; end if;
 if (p_command->>'date')::date>current_date or coalesce(p_command->>'date','')='' then raise exception 'Actual date required'; end if;
 doc:=jsonb_set(doc,array['deliverables',i::text,'fulfilment'],jsonb_build_object('url',p_command->>'url','date',p_command->>'date','note',p_command->>'note'));
 when 'change' then
 if coalesce(p_command->>'kind','') not in('Amendment','Reschedule','Cancellation','Renewal') or coalesce(length(p_command->>'title'),0) not between 1 and 180 or coalesce(length(p_command->>'details'),0) not between 1 and 6000 then raise exception 'Change details required'; end if;
 if p_command->>'kind'='Reschedule' and (coalesce(p_command->>'date','')='' or not exists(select from jsonb_array_elements(doc->'deliverables') x where x->>'id'=p_command->>'deliverable')) then raise exception 'Date and deliverable required'; end if;
 if coalesce(p_command->>'date','')<>'' then perform (p_command->>'date')::date; end if;
 entry:=(p_command-'type')||jsonb_build_object('id',event_id,'side',side,'at',timestamp_text,'status','Proposed');
 doc:=jsonb_set(doc,'{changes}',doc->'changes'||jsonb_build_array(entry));
 when 'respond' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'changes') with ordinality where value->>'id'=p_command->>'change';
 if entry is null or entry->>'side'=side or entry->>'status'<>'Proposed' or jsonb_typeof(p_command->'accept') is distinct from 'boolean' then raise exception 'Proposal unavailable'; end if;
 if (p_command->>'accept')::boolean then
 if entry->>'kind' not in('Reschedule','Cancellation') then raise exception 'Approved amendment template required'; end if;
 entry:=jsonb_set(entry,'{status}','"Accepted"');
 if entry->>'kind'='Cancellation' then doc:=jsonb_set(doc,'{status}','"Cancelled"');
 else
 select ordinality::integer-1 into j from jsonb_array_elements(doc->'deliverables') with ordinality where value->>'id'=entry->>'deliverable';
 if j is null then raise exception 'Deliverable unavailable'; end if;
 doc:=jsonb_set(doc,array['deliverables',j::text,'due'],entry->'date');
 end if;
 else entry:=jsonb_set(entry,'{status}','"Declined"'); end if;
 doc:=jsonb_set(doc,array['changes',i::text],entry);
 when 'dispute' then
 if coalesce(length(p_command->>'title'),0) not between 1 and 180 or coalesce(length(p_command->>'details'),0) not between 1 and 6000 then raise exception 'Concern details required'; end if;
 if coalesce(p_command->>'deliverable','')<>'' and not exists(select from jsonb_array_elements(doc->'deliverables') x where x->>'id'=p_command->>'deliverable') then raise exception 'Deliverable unavailable'; end if;
 entry:=(p_command-'type')||jsonb_build_object('id',event_id,'side',side,'status','Open','evidence','[]'::jsonb);
 doc:=jsonb_set(doc,'{disputes}',doc->'disputes'||jsonb_build_array(entry));
 when 'evidence','resolve','confirmResolution' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'disputes') with ordinality where value->>'id'=p_command->>'dispute';
 if entry is null or entry->>'status'='Resolved' then raise exception 'Open concern required'; end if;
 if cmd='evidence' then entry:=jsonb_set(entry,'{evidence}',entry->'evidence'||jsonb_build_array(jsonb_build_object('note',p_command->>'note','url',p_command->>'url','side',side,'at',timestamp_text)));
 elsif cmd='resolve' then
 if entry->>'status'<>'Open' then raise exception 'Resolution already proposed'; end if;
 entry:=jsonb_set(jsonb_set(entry,'{resolution}',jsonb_build_object('note',p_command->>'note','side',side,'at',timestamp_text)),'{status}','"Resolution proposed"');
 else
 if entry->>'status'<>'Resolution proposed' or entry->'resolution'->>'side'=side then raise exception 'Other party confirmation required'; end if;
 entry:=jsonb_set(entry,'{status}','"Resolved"');
 end if;
 doc:=jsonb_set(doc,array['disputes',i::text],entry);
 when 'performance' then
 if coalesce(length(p_command->>'metric'),0) not between 1 and 180 or coalesce(length(p_command->>'value'),0) not between 1 and 180 or coalesce(length(p_command->>'period'),0) not between 1 and 180 or coalesce(p_command->>'source','') !~* '^https?://[^[:space:]]+$' then raise exception 'Metric and source required'; end if;
 doc:=jsonb_set(doc,'{performance}',doc->'performance'||jsonb_build_array((p_command-'type')||jsonb_build_object('id',event_id,'at',timestamp_text)));
 when 'dependency' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'dependencies') with ordinality where value->>'id'=p_command->>'dependency';
 if entry is null or entry->>'side'<>side or jsonb_typeof(p_command->'done') is distinct from 'boolean' then raise exception 'Responsible party required'; end if;
 doc:=jsonb_set(doc,array['dependencies',i::text],entry||jsonb_build_object('done',p_command->'done','note',p_command->>'note'));
 when 'complete' then
 if jsonb_array_length(doc->'deliverables')=0 or exists(select from jsonb_array_elements(doc->'deliverables') x where x->>'review' is distinct from 'Approved' or x->>'stage' is distinct from x->'stages'->>(jsonb_array_length(x->'stages')-1) or x->'fulfilment' is null)
 or exists(select from jsonb_array_elements(doc->'dependencies') x where (x->>'done')::boolean is not true)
 or exists(select from jsonb_array_elements(doc->'disputes') x where x->>'status'<>'Resolved')
 then raise exception 'Open obligations remain'; end if;
 if not (doc->'completion' ? side) then doc:=jsonb_set(doc,'{completion}',doc->'completion'||to_jsonb(side)); end if;
 if jsonb_array_length(doc->'completion')=2 then doc:=jsonb_set(doc,'{status}','"Completed"'); end if;
 else raise exception 'Unsupported action';
 end case;
 if c.document->>'status'='Active' and cmd not in('complete','message') then doc:=jsonb_set(doc,'{completion}','[]'); end if;
 entry:=jsonb_build_object('id',event_id,'action',cmd,'actor',u,'side',side,'at',timestamp_text);
 doc:=jsonb_set(doc,'{activity}',jsonb_build_array(entry)||doc->'activity');
 insert into aura_collaboration.event(collaboration_id,request_id,actor,side,command,revision) values(p_id,p_request,u,side,p_command,c.revision+1);
 update aura_collaboration.workspace set document=doc,revision=c.revision+1 where id=p_id;
 return public.aura_collaboration_read(p_id);
end $$;
revoke all on all functions in schema aura_collaboration from public,anon,authenticated;
revoke all on function public.aura_collaboration_read(uuid),public.aura_collaboration_list(),public.aura_collaboration_command(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.aura_collaboration_read(uuid),public.aura_collaboration_list(),public.aura_collaboration_command(uuid,uuid,integer,jsonb) to authenticated;
create function public.aura_collaboration_content_options(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $
declare a jsonb:=aura_collaboration.access(p_id); ws uuid;
begin
 if a->>'side'<>'creator' then raise exception 'Creator access required' using errcode='42501'; end if;
 select creator_workspace into ws from aura_collaboration.workspace where id=p_id;
 perform aura_studio.own(ws,false);
 return (select coalesce(jsonb_agg(jsonb_build_object('id',item_id,'revision',revision,'title',document->>'title','body',document->>'body','caption',document->>'caption')),'[]') from
 (select distinct on(item_id) item_id,revision,document from aura_studio.content_version where workspace_id=ws order by item_id,revision desc) drafts);
end $;
revoke all on function public.aura_collaboration_content_options(uuid) from public,anon;
grant execute on function public.aura_collaboration_content_options(uuid) to authenticated;
commit;
