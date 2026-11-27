begin;
create schema aura_commercial;
revoke all on schema aura_commercial from public,anon,authenticated;
create table aura_commercial.ledger (
 workspace_id uuid primary key references aura_identity.workspace,
 revision integer not null default 0,
 document jsonb not null default '{"obligations":[],"receipts":[],"adjustments":[],"expenses":[],"invoices":[],"targets":[],"benefits":[],"commissions":[],"forecasts":[],"events":[]}'
);
create table aura_commercial.event (
 workspace_id uuid not null references aura_identity.workspace,
 request_id uuid not null, actor uuid not null references auth.users,
 command jsonb not null, revision integer not null, at timestamptz not null default now(),
 primary key(workspace_id,request_id)
);
alter table aura_commercial.ledger enable row level security;
alter table aura_commercial.event enable row level security;
revoke all on all tables in schema aura_commercial from public,anon,authenticated;
create table aura_commercial.payment_report (
 id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references aura_collaboration.workspace,
 actor uuid not null references auth.users, side text not null check(side in('creator','brand')),
 amount numeric(18,6) not null check(amount>0), currency text not null check(currency ~ '^[A-Z]{3}$'),
 paid_on date not null, reference text not null, note text not null, evidence text not null,
 status text not null default 'Reported' check(status in('Reported','Confirmed','Disputed','Reversal requested','Reversed')),
 response text, created_at timestamptz not null default now()
);
create table aura_commercial.report_event(
 collaboration_id uuid not null references aura_collaboration.workspace, request_id uuid not null,
 actor uuid not null references auth.users, command jsonb not null, at timestamptz not null default now(),
 primary key(collaboration_id,request_id)
);
alter table aura_commercial.payment_report enable row level security;
alter table aura_commercial.report_event enable row level security;
revoke all on aura_commercial.payment_report,aura_commercial.report_event from public,anon,authenticated;
create function aura_commercial.amount(value text) returns numeric language plpgsql immutable set search_path='' as $$
begin
 if value is null or value !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' or value::numeric<=0 then raise exception 'Positive exact amount required'; end if;
 return value::numeric;
end $$;
create function aura_commercial.balance(doc jsonb, obligation text) returns numeric language sql immutable set search_path='' as $$
 select (select (o->>'amount')::numeric from jsonb_array_elements(doc->'obligations') o where o->>'id'=obligation)
 +coalesce((select sum((case when a->>'kind'='Increase' then 1 else -1 end)*(a->>'amount')::numeric) from jsonb_array_elements(doc->'adjustments') a where a->>'obligation'=obligation),0)
 -coalesce((select sum((a->>'amount')::numeric) from jsonb_array_elements(doc->'receipts') r cross join lateral jsonb_array_elements(r->'allocations') a where (r->>'reversed')::boolean is false and a->>'obligation'=obligation),0)
$$;
create function aura_commercial.validate_allocations(doc jsonb, currency_code text, entries jsonb, budget numeric)
returns void language plpgsql immutable set search_path='' as $$
declare a jsonb; total numeric:=0; group_entry record; available numeric;
begin
 if jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries)>50 then raise exception 'Invalid allocations'; end if;
 for a in select value from jsonb_array_elements(entries) loop
 total:=total+aura_commercial.amount(a->>'amount');
 if not exists(select from jsonb_array_elements(doc->'obligations') o where o->>'id'=a->>'obligation' and o->>'currency'=currency_code) then raise exception 'Allocation currency or obligation mismatch'; end if;
 end loop;
 if total>budget then raise exception 'Allocations exceed receipt'; end if;
 for group_entry in select value->>'obligation' as id,sum((value->>'amount')::numeric) as amount from jsonb_array_elements(entries) group by value->>'obligation' loop
 available:=aura_commercial.balance(doc,group_entry.id);
 if available is null or group_entry.amount>available then raise exception 'Allocation exceeds outstanding'; end if;
 end loop;
end $$;
create function public.aura_commercial_read(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=aura_studio.own(p_workspace,false); l aura_commercial.ledger;
begin
 select * into l from aura_commercial.ledger where workspace_id=p_workspace;
 if not found then return '{"revision":0,"obligations":[],"receipts":[],"adjustments":[],"expenses":[],"invoices":[],"targets":[],"benefits":[],"commissions":[],"forecasts":[],"events":[]}'; end if;
 return l.document||jsonb_build_object('revision',l.revision);
end $$;
create function public.aura_commercial_command(p_workspace uuid,p_request uuid,p_expected integer,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=aura_studio.own(p_workspace,true); l aura_commercial.ledger; previous aura_commercial.event;
 doc jsonb; cmd text:=p_command->>'type'; entry jsonb; original jsonb; obligation jsonb; receipt jsonb;
 i integer; amount numeric; budget numeric; id uuid:=gen_random_uuid(); at_text text:=now()::text; currency_code text;
begin
 if p_request is null or p_expected is null or p_expected<0 or jsonb_typeof(p_command) is distinct from 'object' or length(p_command::text)>24000 then raise exception 'Invalid command'; end if;
 perform pg_advisory_xact_lock(hashtextextended('commercial:'||p_workspace::text,0));
 insert into aura_commercial.ledger(workspace_id) values(p_workspace) on conflict do nothing;
 select * into l from aura_commercial.ledger where workspace_id=p_workspace for update;
 select * into previous from aura_commercial.event where workspace_id=p_workspace and request_id=p_request;
 if found then
 if previous.actor<>u or previous.command<>p_command then raise exception 'Request conflict'; end if;
 return public.aura_commercial_read(p_workspace);
 end if;
 if l.revision<>p_expected then raise exception 'Revision conflict' using errcode='40001'; end if;
 doc:=l.document;
 if cmd in('obligation','receipt','adjust','expense','target','commission','forecast') then amount:=aura_commercial.amount(p_command->>'amount'); end if;
 if cmd in('obligation','receipt','expense','target','benefit','commission','forecast') then
 currency_code:=p_command->>'currency';
 if currency_code is null or currency_code !~ '^[A-Z]{3}$' then raise exception 'Original currency required'; end if;
 end if;
 if cmd in('obligation','expense','target','benefit','commission','forecast') and coalesce(length(trim(p_command->>'title')),0) not between 1 and 180 then raise exception 'Title required'; end if;
 if cmd in('obligation','receipt','expense','benefit','commission','forecast') then
 if coalesce(p_command->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Date required'; end if;
 perform (p_command->>'date')::date;
 end if;
 if cmd in('receipt','expense') and (p_command->>'date')::date>current_date then raise exception 'Actual date required'; end if;
 if cmd in('receipt','expense','adjust','benefit') and coalesce(p_command->>'evidence','')<>'' and (p_command->>'evidence' !~* '^https?://[^[:space:]]+$' or length(p_command->>'evidence')>2048) then raise exception 'Invalid evidence URL'; end if;
 case cmd
 when 'obligation' then
 if coalesce(length(trim(p_command->>'client')),0) not between 1 and 180 or coalesce(length(trim(p_command->>'terms')),0) not between 1 and 3000 or coalesce(p_command->>'category','') not in('Freelance','Platform income','Direct client','Other') then raise exception 'Client and agreed terms required'; end if;
 if coalesce(p_command->>'due','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Due date required'; end if;
 perform (p_command->>'due')::date;
 entry:=(p_command-'type')||jsonb_build_object('id',id,'disputed',false);
 doc:=jsonb_set(doc,'{obligations}',doc->'obligations'||jsonb_build_array(entry));
 when 'receipt' then
 if coalesce(length(trim(p_command->>'payer')),0) not between 1 and 180 then raise exception 'Payer required'; end if;
 if coalesce(p_command->>'reference','')<>'' and exists(select from jsonb_array_elements(doc->'receipts') r where r->>'reference'=p_command->>'reference' and r->>'payer'=p_command->>'payer' and r->>'currency'=currency_code and (r->>'reversed')::boolean is false) then raise exception 'Payment reference already recorded'; end if;
 perform aura_commercial.validate_allocations(doc,currency_code,p_command->'allocations',amount);
 entry:=(p_command-'type')||jsonb_build_object('id',id,'reversed',false,'confirmation','Self-reported');
 if p_command->>'sourceReport' is not null then
 select to_jsonb(r) into receipt from aura_commercial.payment_report r join aura_collaboration.workspace c on c.id=r.collaboration_id where r.id=(p_command->>'sourceReport')::uuid and c.creator_workspace=p_workspace and r.status='Confirmed' for update of r;
 if receipt is null or (receipt->>'amount')::numeric<>amount or receipt->>'currency'<>currency_code or (receipt->>'paid_on')::date<>(p_command->>'date')::date then raise exception 'Confirmed report mismatch'; end if;
 if exists(select from jsonb_array_elements(doc->'receipts') r where r->>'sourceReport'=p_command->>'sourceReport') then raise exception 'Report already imported'; end if;
 entry:=jsonb_set(entry,'{confirmation}','"Mutually confirmed"');
 end if;
 doc:=jsonb_set(doc,'{receipts}',doc->'receipts'||jsonb_build_array(entry));
 when 'allocate','reverse' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'receipts') with ordinality where value->>'id'=p_command->>'receipt';
 if entry is null or (entry->>'reversed')::boolean then raise exception 'Active receipt required'; end if;
 if cmd='allocate' then
 budget:=(entry->>'amount')::numeric-coalesce((select sum((a->>'amount')::numeric) from jsonb_array_elements(entry->'allocations') a),0);
 perform aura_commercial.validate_allocations(doc,entry->>'currency',p_command->'allocations',budget);
 entry:=jsonb_set(entry,'{allocations}',entry->'allocations'||p_command->'allocations');
 else
 if coalesce(length(trim(p_command->>'reason')),0) not between 1 and 3000 then raise exception 'Reversal reason required'; end if;
 entry:=entry||jsonb_build_object('reversed',true,'reason',p_command->>'reason');
 end if;
 doc:=jsonb_set(doc,array['receipts',i::text],entry);
 when 'adjust' then
 if coalesce(p_command->>'kind','') not in('Credit','Withholding','Deduction','Increase') or coalesce(length(trim(p_command->>'reason')),0) not between 1 and 3000 then raise exception 'Adjustment basis required'; end if;
 budget:=aura_commercial.balance(doc,p_command->>'obligation');
 if budget is null or (p_command->>'kind'<>'Increase' and amount>budget) then raise exception 'Adjustment exceeds eligible balance'; end if;
 doc:=jsonb_set(doc,'{adjustments}',doc->'adjustments'||jsonb_build_array((p_command-'type')||jsonb_build_object('id',id)));
 when 'dispute' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'obligations') with ordinality where value->>'id'=p_command->>'obligation';
 if entry is null or jsonb_typeof(p_command->'open') is distinct from 'boolean' or coalesce(length(trim(p_command->>'reason')),0) not between 1 and 3000 then raise exception 'Obligation and reason required'; end if;
 doc:=jsonb_set(doc,array['obligations',i::text],entry||jsonb_build_object('disputed',p_command->'open'));
 when 'expense' then
 if coalesce(length(trim(p_command->>'category')),0) not between 1 and 180 then raise exception 'Expense category required'; end if;
 if coalesce(p_command->>'hours','')<>'' and p_command->>'hours' !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' then raise exception 'Invalid production time'; end if;
 doc:=jsonb_set(doc,'{expenses}',doc->'expenses'||jsonb_build_array((p_command-'type')||jsonb_build_object('id',id,'voided',false)));
 when 'voidExpense' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'expenses') with ordinality where value->>'id'=p_command->>'expense';
 if entry is null or (entry->>'voided')::boolean or coalesce(length(trim(p_command->>'reason')),0) not between 1 and 3000 then raise exception 'Expense and correction reason required'; end if;
 doc:=jsonb_set(doc,array['expenses',i::text],entry||jsonb_build_object('voided',true));
 when 'invoice' then
 if coalesce(length(trim(p_command->>'number')),0) not between 1 and 180 or coalesce(length(trim(p_command->>'seller')),0) not between 1 and 3000 or coalesce(length(trim(p_command->>'buyer')),0) not between 1 and 3000 then raise exception 'Billing details required'; end if;
 perform (p_command->>'id')::uuid;
 select value into obligation from jsonb_array_elements(doc->'obligations') where value->>'id'=p_command->>'obligation';
 if obligation is null then raise exception 'Obligation required'; end if;
 select ordinality::integer-1,value into i,original from jsonb_array_elements(doc->'invoices') with ordinality where value->>'id'=p_command->>'id';
 if original is not null and original->>'status'<>'Draft' then raise exception 'Issued invoice is immutable'; end if;
 entry:=(p_command-'type')||jsonb_build_object('status','Draft','version',coalesce((original->>'version')::integer,0)+1,'amount',obligation->>'amount','currency',obligation->>'currency','title',obligation->>'title','due',obligation->>'due','history',coalesce(original->'history','[]'::jsonb));
 if original is not null then
 entry:=jsonb_set(entry,'{history}',entry->'history'||jsonb_build_array((original-'history')||jsonb_build_object('at',at_text)));
 doc:=jsonb_set(doc,array['invoices',i::text],entry);
 else doc:=jsonb_set(doc,'{invoices}',doc->'invoices'||jsonb_build_array(entry)); end if;
 when 'issue','cancelInvoice' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'invoices') with ordinality where value->>'id'=p_command->>'invoice';
 if entry is null then raise exception 'Invoice unavailable'; end if;
 if cmd='issue' then
 if entry->>'status'<>'Draft' then raise exception 'Draft required'; end if;
 if exists(select from jsonb_array_elements(doc->'invoices') other where other->>'id'<>entry->>'id' and (other->>'status' in('Issued','Cancelled')) and other->>'number'=entry->>'number') then raise exception 'Invoice number already issued'; end if;
 if exists(select from jsonb_array_elements(doc->'invoices') other where other->>'id'<>entry->>'id' and other->>'status'='Issued' and other->>'obligation'=entry->>'obligation') then raise exception 'Obligation already invoiced'; end if;
 entry:=entry||jsonb_build_object('status','Issued','issuedAt',at_text);
 else
 if entry->>'status'<>'Issued' or coalesce(length(trim(p_command->>'reason')),0) not between 1 and 3000 then raise exception 'Issued invoice and reason required'; end if;
 entry:=entry||jsonb_build_object('status','Cancelled','reason',p_command->>'reason');
 end if;
 doc:=jsonb_set(doc,array['invoices',i::text],entry);
 when 'target' then
 if coalesce(p_command->>'start','')='' or coalesce(p_command->>'end','')='' or (p_command->>'start')::date>(p_command->>'end')::date then raise exception 'Target period required'; end if;
 perform (p_command->>'id')::uuid;
 select ordinality::integer-1 into i from jsonb_array_elements(doc->'targets') with ordinality where value->>'id'=p_command->>'id';
 entry:=p_command-'type';
 if i is null then doc:=jsonb_set(doc,'{targets}',doc->'targets'||jsonb_build_array(entry)); else doc:=jsonb_set(doc,array['targets',i::text],entry); end if;
 when 'benefit' then
 if coalesce(p_command->>'status','') not in('Expected','Received','Returned') or coalesce(length(trim(p_command->>'partner')),0) not between 1 and 180 then raise exception 'Benefit details required'; end if;
 if coalesce(p_command->>'value','')<>'' and p_command->>'value' !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' then raise exception 'Invalid declared value'; end if;
 doc:=jsonb_set(doc,'{benefits}',doc->'benefits'||jsonb_build_array((p_command-'type')||jsonb_build_object('id',id)));
 when 'commission' then
 if coalesce(length(trim(p_command->>'partner')),0) not between 1 and 180 or coalesce(length(trim(p_command->>'source')),0) not between 1 and 3000 then raise exception 'Partner and source required'; end if;
 doc:=jsonb_set(doc,'{commissions}',doc->'commissions'||jsonb_build_array((p_command-'type')||jsonb_build_object('id',id,'status','Pending')));
 when 'commissionStatus' then
 select ordinality::integer-1,value into i,entry from jsonb_array_elements(doc->'commissions') with ordinality where value->>'id'=p_command->>'commission';
 if entry is null or coalesce(p_command->>'status','') not in('Pending','Confirmed','Reversed','Disputed','Settled') or coalesce(length(trim(p_command->>'note')),0) not between 1 and 3000 then raise exception 'Commission and status evidence required'; end if;
 doc:=jsonb_set(doc,array['commissions',i::text],entry||jsonb_build_object('status',p_command->>'status','note',p_command->>'note'));
 when 'forecast' then
 if coalesce(length(trim(p_command->>'basis')),0) not between 1 and 3000 then raise exception 'Forecast basis required'; end if;
 doc:=jsonb_set(doc,'{forecasts}',doc->'forecasts'||jsonb_build_array((p_command-'type')||jsonb_build_object('id',id)));
 else raise exception 'Unsupported command';
 end case;
 insert into aura_commercial.event(workspace_id,request_id,actor,command,revision) values(p_workspace,p_request,u,p_command,l.revision+1);
 doc:=jsonb_set(doc,'{events}',jsonb_build_array(jsonb_build_object('id',id,'action',cmd,'at',at_text,'actor',u))||doc->'events');
 update aura_commercial.ledger set document=doc,revision=l.revision+1 where workspace_id=p_workspace;
 return public.aura_commercial_read(p_workspace);
end $$;
revoke all on all functions in schema aura_commercial from public,anon,authenticated;
revoke all on function public.aura_commercial_read(uuid),public.aura_commercial_command(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.aura_commercial_read(uuid),public.aura_commercial_command(uuid,uuid,integer,jsonb) to authenticated;
create function public.aura_commercial_reports(p_collaboration uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb:=aura_collaboration.access(p_collaboration);
begin
 return a||jsonb_build_object('title',(select document->>'title' from aura_collaboration.workspace where id=p_collaboration),'reports',(select coalesce(jsonb_agg((to_jsonb(r)-'collaboration_id'-'actor'-'paid_on')||jsonb_build_object('amount',r.amount::text,'date',r.paid_on::text) order by r.created_at desc),'[]') from aura_commercial.payment_report r where r.collaboration_id=p_collaboration));
end $$;
create function public.aura_commercial_report_command(p_collaboration uuid,p_request uuid,p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb:=aura_collaboration.access(p_collaboration); u uuid:=aura_identity.eligible(); side text:=a->>'side';
 cmd text:=p_command->>'type'; r aura_commercial.payment_report; prior aura_commercial.report_event;
 ws uuid; l aura_commercial.ledger; doc jsonb; item record; event_id uuid:=gen_random_uuid();
begin
 if (a->>'manage')::boolean is not true then raise exception 'Manager required' using errcode='42501'; end if;
 if p_request is null or jsonb_typeof(p_command) is distinct from 'object' or length(p_command::text)>12000 then raise exception 'Invalid report'; end if;
 select creator_workspace into ws from aura_collaboration.workspace where id=p_collaboration;
 perform pg_advisory_xact_lock(hashtextextended('commercial:'||ws::text,0));
 perform pg_advisory_xact_lock(hashtextextended('payment-report:'||p_collaboration::text,0));
 select * into prior from aura_commercial.report_event where collaboration_id=p_collaboration and request_id=p_request;
 if found then
 if prior.actor<>u or prior.command<>p_command then raise exception 'Request conflict'; end if;
 return public.aura_commercial_reports(p_collaboration);
 end if;
 if coalesce(length(trim(p_command->>'note')),0) not between 1 and 3000 then raise exception 'Note required'; end if;
 if cmd='report' then
 perform aura_commercial.amount(p_command->>'amount');
 if coalesce(p_command->>'currency','') !~ '^[A-Z]{3}$' or coalesce(p_command->>'date','')='' or (p_command->>'date')::date>current_date then raise exception 'Currency and actual date required'; end if;
 if coalesce(p_command->>'evidence','')<>'' and (p_command->>'evidence' !~* '^https?://[^[:space:]]+$' or length(p_command->>'evidence')>2048) then raise exception 'Invalid evidence URL'; end if;
 if coalesce(p_command->>'reference','')<>'' and exists(select from aura_commercial.payment_report x where x.collaboration_id=p_collaboration and x.reference=p_command->>'reference' and x.currency=p_command->>'currency' and x.status<>'Reversed') then raise exception 'Payment reference already reported'; end if;
 insert into aura_commercial.payment_report(collaboration_id,actor,side,amount,currency,paid_on,reference,note,evidence)
 values(p_collaboration,u,side,(p_command->>'amount')::numeric,p_command->>'currency',(p_command->>'date')::date,coalesce(p_command->>'reference',''),p_command->>'note',coalesce(p_command->>'evidence',''));
 else
 select * into r from aura_commercial.payment_report where collaboration_id=p_collaboration and id=(p_command->>'report')::uuid for update;
 if not found then raise exception 'Report unavailable'; end if;
 case cmd
 when 'respond' then
 if side=r.side or r.status<>'Reported' or coalesce(p_command->>'decision','') not in('Confirmed','Disputed') then raise exception 'Counterparty review required'; end if;
 update aura_commercial.payment_report set status=p_command->>'decision',response=p_command->>'note' where id=r.id;
 when 'reverse' then
 if side<>r.side or r.status not in('Reported','Confirmed','Disputed') then raise exception 'Reporting party required'; end if;
 update aura_commercial.payment_report set status='Reversal requested',response=p_command->>'note' where id=r.id;
 when 'confirmReversal' then
 if side=r.side or r.status<>'Reversal requested' then raise exception 'Counterparty confirmation required'; end if;
 update aura_commercial.payment_report set status='Reversed',response=concat_ws(E'
',response,p_command->>'note') where id=r.id;
 select * into l from aura_commercial.ledger where workspace_id=ws for update;
 if found then
 doc:=l.document;
 for item in select ordinality::integer-1 as index,value from jsonb_array_elements(doc->'receipts') with ordinality where value->>'sourceReport'=r.id::text and (value->>'reversed')::boolean is false loop
 doc:=jsonb_set(doc,array['receipts',item.index::text],item.value||jsonb_build_object('reversed',true,'reason','Both parties confirmed report reversal.'));
 end loop;
 if doc<>l.document then
 doc:=jsonb_set(doc,'{events}',jsonb_build_array(jsonb_build_object('id',event_id,'action','Confirmed payment report reversed','actor',u,'at',now()))||doc->'events');
 update aura_commercial.ledger set document=doc,revision=l.revision+1 where workspace_id=ws;
 insert into aura_commercial.event(workspace_id,request_id,actor,command,revision) values(ws,event_id,u,jsonb_build_object('type','sharedReversal','report',r.id,'sharedRequest',p_request),l.revision+1);
 end if;
 end if;
 else raise exception 'Unsupported report action';
 end case;
 end if;
 insert into aura_commercial.report_event(collaboration_id,request_id,actor,command) values(p_collaboration,p_request,u,p_command);
 return public.aura_commercial_reports(p_collaboration);
end $$;
revoke all on function public.aura_commercial_reports(uuid),public.aura_commercial_report_command(uuid,uuid,jsonb) from public,anon;
grant execute on function public.aura_commercial_reports(uuid),public.aura_commercial_report_command(uuid,uuid,jsonb) to authenticated;
commit;
