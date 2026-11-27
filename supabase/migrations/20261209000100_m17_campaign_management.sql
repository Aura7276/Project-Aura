-- M17 Campaign creation and management (reconstructed scope, owner reconciliation pending; see the module file).
-- Builds on the M10 campaign store (aura_market): adds category rollout, a private campaign plan (objective, KPI, audiences and products from M14,
-- milestones, owner), positions that can never drop below the Creators already selected (M11), change notices to applicants and Creators in
-- negotiation, an amendment log, duplication and archiving. Rules that must not be bypassed are enforced by triggers on the M10 tables.
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_campaign;
revoke all on schema aura_campaign from public, anon, authenticated;

create table aura_campaign.setting (key text primary key, value jsonb not null);
-- Rollout (M17 R2): paid influencer, UGC and barter first; events and ambassador next; affiliate after attribution readiness.
insert into aura_campaign.setting(key, value) values
 ('category_rollout', '{"paid":"live","ugc":"live","barter":"live","event":"planned","ambassador":"planned","affiliate":"planned"}'),
 ('max_milestones', '12');

create table aura_campaign.plan (
 campaign_id uuid primary key references aura_market.campaign on delete cascade,
 objective text check (objective in ('awareness','social_growth','content','engagement','conversion')),
 kpi_metric text check (length(kpi_metric) <= 80), kpi_target numeric check (kpi_target > 0),
 segment_ids uuid[] not null default '{}', product_ids uuid[] not null default '{}',
 milestones jsonb not null default '[]' check (jsonb_typeof(milestones) = 'array'),
 notes text check (length(notes) <= 2000), owner_user uuid references auth.users,
 archived_at timestamptz, updated_at timestamptz not null default now()
);
create table aura_campaign.amendment (
 campaign_id uuid not null references aura_market.campaign on delete cascade, version integer not null,
 changes text[] not null, savers integer not null default 0, participants integer not null default 0,
 at timestamptz not null default now(), primary key (campaign_id, version)
);
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname = 'aura_campaign' loop
  execute format('alter table aura_campaign.%I enable row level security', t);
  execute format('revoke all on aura_campaign.%I from public, anon, authenticated', t);
 end loop;
end $$;

create function aura_campaign.live(p_category text) returns boolean language sql stable set search_path='' as $$
 select coalesce((select value->>p_category from aura_campaign.setting where key = 'category_rollout'), 'planned') = 'live' $$;
create function aura_campaign.selected(p_campaign uuid) returns integer language sql stable set search_path='' as $$
 select count(*)::int from aura_apply.application where campaign_id = p_campaign and status in ('selected','converted') $$;

-- ───────── Guards on the M10 tables (cannot be bypassed by any route) ─────────
create function aura_campaign.guard_publish() returns trigger language plpgsql security definer set search_path='' as $$
declare pos int; sel int;
begin
 -- R2: a category that has not opened yet can be drafted but never go live or into review
 if new.status in ('published','in_review') and old.status is distinct from new.status and not aura_campaign.live(new.category) then
  raise exception 'This campaign type opens later. You can keep it as a draft.' using errcode = '55000';
 end if;
 -- R8: published positions can never drop below the Creators already selected
 if new.published_version is distinct from old.published_version and new.published_version is not null then
  pos := nullif(aura_market.content(new.id, new.published_version)->>'positions', '')::int;
  sel := aura_campaign.selected(new.id);
  if pos is not null and pos < sel then
   raise exception 'Positions cannot be fewer than the % Creator(s) already selected', sel using errcode = '23514';
  end if;
 end if;
 return new;
end $$;
create trigger m17_guard_publish before update on aura_market.campaign for each row execute function aura_campaign.guard_publish();

-- R8/R10: a material change reaches applicants and Creators in negotiation too (M10 already tells everyone who saved it).
-- Agreed proposals in M11 are unaffected: they keep their own terms, and the notice says so.
create function aura_campaign.on_version_published() returns trigger language plpgsql security definer set search_path='' as $$
declare title text; n_saved int; n_part int; ws uuid;
begin
 if new.published_at is null or old.published_at is not null or not new.material or cardinality(new.changes) = 0 then return new; end if;
 title := new.content->>'title';
 select count(*) into n_saved from aura_market.bookmark where campaign_id = new.campaign_id;
 n_part := 0;
 for ws in
  select distinct x.ws from (
   select a.creator_workspace_id ws from aura_apply.application a where a.campaign_id = new.campaign_id and a.status in ('submitted','review','clarification','shortlisted','waitlisted','selected')
   union select c.creator_workspace_id from aura_apply.collaboration c where c.campaign_id = new.campaign_id and c.status in ('prospective','negotiating','ready_for_agreement')
  ) x
 loop
  insert into aura_apply.notification(workspace_id, kind, title, link)
   values (ws, 'change', left('Campaign updated: ' || coalesce(title, 'a campaign') || ' (' || array_to_string(new.changes, ', ') || '). Proposals you already agreed are unchanged.', 300), '/creator/marketplace/' || new.campaign_id || '/updates');
  n_part := n_part + 1;
 end loop;
 insert into aura_campaign.amendment(campaign_id, version, changes, savers, participants) values (new.campaign_id, new.version, new.changes, n_saved, n_part)
  on conflict (campaign_id, version) do nothing;
 return new;
end $$;
create trigger m17_version_published after update on aura_market.campaign_version for each row execute function aura_campaign.on_version_published();

-- ───────── Brand functions ─────────
create function public.aura_campaign_rollout() returns jsonb language sql stable security definer set search_path='' as $$
 select value from aura_campaign.setting where key = 'category_rollout' and aura_identity.eligible() is not null $$;

-- Campaign list with the numbers a Brand manages by (M10 terms + M11 applications + M17 plan).
create function public.aura_campaign_overview(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false);
begin
 return jsonb_build_object('rollout', (select value from aura_campaign.setting where key = 'category_rollout'), 'verified', aura_market.verified(p_workspace),
  'campaigns', (select coalesce(jsonb_agg(x order by x->>'sort' desc), '[]'::jsonb) from (
   select jsonb_build_object('id', c.id, 'category', c.category, 'visibility', c.visibility, 'status', c.status, 'sort', c.updated_at,
    'title', coalesce(aura_market.content(c.id, c.draft_version)->>'title', 'Untitled'), 'closes_at', aura_market.content(c.id, coalesce(c.published_version, c.draft_version))->>'closes_at',
    'draft_version', c.draft_version, 'published_version', c.published_version, 'unpublished_changes', c.published_version is not null and c.draft_version > c.published_version,
    'positions', nullif(aura_market.content(c.id, coalesce(c.published_version, c.draft_version))->>'positions', '')::int,
    'selected', aura_campaign.selected(c.id),
    'applications', (select count(*) from aura_apply.application a where a.campaign_id = c.id and a.status <> 'draft'),
    'new_applications', (select count(*) from aura_apply.application a where a.campaign_id = c.id and a.status = 'submitted'),
    'saved', (select count(*) from aura_market.bookmark b where b.campaign_id = c.id),
    'objective', p.objective, 'owner', (select coalesce(nullif(trim(i.full_name), ''), 'Team member') from aura_identity.profile i where i.user_id = p.owner_user),
    'next_milestone', (select m from jsonb_array_elements(coalesce(p.milestones, '[]')) m where (m->>'done')::boolean is not true order by m->>'due_on' limit 1),
    'archived', p.archived_at is not null, 'live_type', aura_campaign.live(c.category)) x
   from aura_market.campaign c left join aura_campaign.plan p on p.campaign_id = c.id where c.workspace_id = p_workspace and c.status <> 'removed') q));
end $$;

create function public.aura_campaign_plan(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign);
begin
 return jsonb_build_object('plan', (select to_jsonb(p) - 'campaign_id' from aura_campaign.plan p where p.campaign_id = c.id),
  'live_type', aura_campaign.live(c.category), 'selected', aura_campaign.selected(c.id),
  'team', (select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id, 'name', coalesce(nullif(trim(i.full_name), ''), 'Team member'), 'role', m.role) order by m.role), '[]'::jsonb)
     from aura_identity.membership m left join aura_identity.profile i on i.user_id = m.user_id where m.workspace_id = p_workspace and m.active),
  'segments', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'basis', s.basis) order by s.created_at), '[]'::jsonb) from aura_brand.segment s where s.workspace_id = p_workspace),
  'products', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'claims', to_jsonb(x.claims)) order by x.created_at), '[]'::jsonb) from aura_brand.product x where x.workspace_id = p_workspace and x.status = 'active'),
  'amendments', (select coalesce(jsonb_agg(to_jsonb(a) - 'campaign_id' order by a.version desc), '[]'::jsonb) from aura_campaign.amendment a where a.campaign_id = c.id));
end $$;

-- Private planning (never shown to Creators). Audiences and products must belong to this Brand (M14); the owner must be an active member.
create function public.aura_campaign_save_plan(p_workspace uuid, p_campaign uuid, p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign, true); v jsonb := coalesce(p_fields, '{}');
 segs uuid[]; prods uuid[]; ms jsonb := '[]'; m jsonb; ownr uuid := nullif(v->>'owner_user', '')::uuid;
begin
 segs := coalesce(array(select s.id from aura_brand.segment s where s.workspace_id = p_workspace and s.id::text in (select jsonb_array_elements_text(coalesce(v->'segment_ids', '[]')))), '{}');
 prods := coalesce(array(select x.id from aura_brand.product x where x.workspace_id = p_workspace and x.id::text in (select jsonb_array_elements_text(coalesce(v->'product_ids', '[]')))), '{}');
 if ownr is not null and not exists(select 1 from aura_identity.membership where workspace_id = p_workspace and user_id = ownr and active) then raise exception 'The owner must be a member of this workspace' using errcode = '22023'; end if;
 if jsonb_typeof(coalesce(v->'milestones', '[]')) <> 'array' or jsonb_array_length(coalesce(v->'milestones', '[]')) > (select (value #>> '{}')::int from aura_campaign.setting where key = 'max_milestones') then raise exception 'Too many milestones' using errcode = '22023'; end if;
 for m in select * from jsonb_array_elements(coalesce(v->'milestones', '[]')) loop
  if length(coalesce(trim(m->>'label'), '')) not between 2 and 80 then raise exception 'Each milestone needs a label' using errcode = '22023'; end if;
  ms := ms || jsonb_build_array(jsonb_build_object('label', trim(m->>'label'), 'due_on', nullif(m->>'due_on', '')::date, 'done', coalesce((m->>'done')::boolean, false)));
 end loop;
 insert into aura_campaign.plan(campaign_id, objective, kpi_metric, kpi_target, segment_ids, product_ids, milestones, notes, owner_user)
  values (c.id, nullif(v->>'objective', ''), nullif(trim(v->>'kpi_metric'), ''), nullif(v->>'kpi_target', '')::numeric, segs, prods, ms, nullif(trim(v->>'notes'), ''), ownr)
 on conflict (campaign_id) do update set objective = excluded.objective, kpi_metric = excluded.kpi_metric, kpi_target = excluded.kpi_target, segment_ids = excluded.segment_ids,
  product_ids = excluded.product_ids, milestones = excluded.milestones, notes = excluded.notes, owner_user = excluded.owner_user, updated_at = now();
 perform aura_market.audit(u, 'campaign_plan_saved');
 return public.aura_campaign_plan(p_workspace, p_campaign);
end $$;

-- Duplicate: a new private draft with the same terms and plan (never the published state, applications or history).
create function public.aura_campaign_duplicate(p_workspace uuid, p_campaign uuid, p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign); src jsonb := aura_market.content(c.id, c.draft_version); r jsonb; nid uuid;
begin
 r := public.aura_market_create_campaign(p_workspace, p_request, c.category, left('Copy of ' || coalesce(src->>'title', 'campaign'), 120));
 nid := (r->>'id')::uuid;
 if (select count(*) from aura_market.campaign_version where campaign_id = nid) = 1 and (select draft_version from aura_market.campaign where id = nid) = 1 then
  perform public.aura_market_save_campaign(p_workspace, nid, c.visibility, c.show_applicant_count, src || jsonb_build_object('title', left('Copy of ' || coalesce(src->>'title', 'campaign'), 120)));
  insert into aura_campaign.plan(campaign_id, objective, kpi_metric, kpi_target, segment_ids, product_ids, milestones, notes, owner_user)
   select nid, objective, kpi_metric, kpi_target, segment_ids, product_ids, (select coalesce(jsonb_agg(m - 'done' || '{"done":false}'), '[]') from jsonb_array_elements(milestones) m), notes, owner_user
   from aura_campaign.plan where campaign_id = c.id on conflict do nothing;
 end if;
 perform aura_market.audit(u, 'campaign_duplicated');
 return jsonb_build_object('id', nid);
end $$;

-- Archive tidies the list. Only drafts and closed campaigns can be archived; live work stays visible.
create function public.aura_campaign_archive(p_workspace uuid, p_campaign uuid, p_on boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign, true);
begin
 if p_on and c.status not in ('draft','closed') then raise exception 'Close the campaign before archiving it' using errcode = '55000'; end if;
 insert into aura_campaign.plan(campaign_id, archived_at) values (c.id, case when p_on then now() end)
  on conflict (campaign_id) do update set archived_at = case when p_on then now() end, updated_at = now();
 return jsonb_build_object('archived', p_on);
end $$;

-- Creators: positions still open for a campaign they can see (positions minus Creators already selected).
create function public.aura_campaign_availability(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb := public.aura_market_campaign(p_workspace, p_campaign); c aura_market.campaign; pos int; sel int;
begin
 select * into c from aura_market.campaign where id = p_campaign;
 pos := nullif(aura_market.content(c.id, c.published_version)->>'positions', '')::int;
 sel := aura_campaign.selected(c.id);
 return jsonb_build_object('positions', pos, 'selected', sel, 'remaining', case when pos is null then null else greatest(pos - sel, 0) end);
end $$;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_campaign\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'aura_campaign' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
 end loop;
end $$;
commit;
