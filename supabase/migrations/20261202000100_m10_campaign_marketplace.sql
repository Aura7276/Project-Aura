-- M10 Campaign marketplace.
-- Creator discovery (For You, explore, eligibility, comparison, bookmarks, saved searches, alerts, hiding, reporting) and a minimal Brand
-- campaign editor (draft, versioned terms, publish, pause, close, invitations). Publication at ANY visibility requires an approved business
-- verification (M14-F34). Until M14 exists, a restricted platform reviewer (Platform Admin + reviewer grant + MFA) records an interim decision
-- in the existing M02 field aura_identity.workspace.verification, with a reason and an audit trail. M14 replaces this with its full process.
-- Pattern unchanged: private schema, RLS on with NO policies and NO grants, SECURITY DEFINER functions with search_path=''.
begin;
create schema aura_market;
revoke all on schema aura_market from public, anon, authenticated;

create table aura_market.setting (key text primary key, value jsonb not null);
insert into aura_market.setting(key, value) values
 ('applicant_count_threshold', '10'),   -- NON-PRODUCTION defaults, owner approval pending
 ('max_exclusivity_days', '365'),
 ('deadline_alert_days', '3'),
 ('feed_limit', '60'),
 ('max_campaigns_per_brand_on_first_page', '2');
create function aura_market.setting_int(p_key text) returns integer language sql stable set search_path='' as $$ select (value #>> '{}')::int from aura_market.setting where key = p_key $$;

create table aura_market.verification_decision (
 id bigint generated always as identity primary key, workspace_id uuid not null references aura_identity.workspace on delete cascade,
 decision text not null check (decision in ('verified','revoked')), reason text not null check (length(trim(reason)) between 3 and 500),
 decided_by uuid not null references auth.users, decided_at timestamptz not null default now()
);
create table aura_market.campaign (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references aura_identity.workspace on delete cascade,
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{4,80}$'),
 category text not null check (category in ('paid','ugc','barter','affiliate','ambassador','event')),
 visibility text not null default 'public' check (visibility in ('public','restricted','invite_only')),
 status text not null default 'draft' check (status in ('draft','in_review','published','paused','closed','removed')),
 draft_version integer not null default 1, published_version integer, published_at timestamptz, first_published_at timestamptz,
 show_applicant_count boolean not null default false, risk_flags text[] not null default '{}', review_note text check (length(review_note) <= 500),
 created_by uuid not null references auth.users, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), request_id uuid not null,
 unique (workspace_id, request_id)
);
create index campaign_live on aura_market.campaign(status, category) where status = 'published';
create table aura_market.campaign_version (
 campaign_id uuid not null references aura_market.campaign on delete cascade, version integer not null check (version > 0),
 content jsonb not null, material boolean not null default false, changes text[] not null default '{}',
 created_by uuid not null references auth.users, created_at timestamptz not null default now(), published_at timestamptz,
 primary key (campaign_id, version)
);
create table aura_market.invite (campaign_id uuid not null references aura_market.campaign on delete cascade, creator_workspace_id uuid not null references aura_identity.workspace on delete cascade, invited_at timestamptz not null default now(), primary key (campaign_id, creator_workspace_id));
create table aura_market.bookmark (workspace_id uuid not null references aura_identity.workspace on delete cascade, campaign_id uuid not null references aura_market.campaign on delete cascade, created_at timestamptz not null default now(), primary key (workspace_id, campaign_id));
create table aura_market.recent_view (workspace_id uuid not null references aura_identity.workspace on delete cascade, campaign_id uuid not null references aura_market.campaign on delete cascade, viewed_at timestamptz not null default now(), primary key (workspace_id, campaign_id));
create table aura_market.saved_search (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 name text not null check (length(trim(name)) between 2 and 60), filters jsonb not null check (jsonb_typeof(filters) = 'object'), alert boolean not null default true,
 created_at timestamptz not null default now()
);
create table aura_market.hide_rule (workspace_id uuid not null references aura_identity.workspace on delete cascade, kind text not null check (kind in ('brand','category')), value text not null check (length(value) between 1 and 60), created_at timestamptz not null default now(), primary key (workspace_id, kind, value));
create table aura_market.notification (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references aura_identity.workspace on delete cascade,
 kind text not null check (kind in ('new_match','material_change','campaign_closed')), campaign_id uuid not null references aura_market.campaign on delete cascade,
 version integer, title text not null, detail text, created_at timestamptz not null default now(), read_at timestamptz
);
create index notification_by_ws on aura_market.notification(workspace_id, created_at desc);
create table aura_market.report (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references aura_market.campaign on delete cascade,
 reporter_workspace_id uuid not null references aura_identity.workspace on delete cascade, reporter uuid not null references auth.users,
 reason text not null check (reason in ('fee_requested','misleading_terms','unsafe','inappropriate','spam','other')), details text check (length(details) <= 1000),
 status text not null default 'open' check (status in ('open','actioned','dismissed')), decision_reason text check (length(decision_reason) <= 500),
 decided_by uuid references auth.users, decided_at timestamptz, created_at timestamptz not null default now()
);
create unique index one_open_report on aura_market.report(campaign_id, reporter_workspace_id) where status = 'open';
create table aura_market.moderation_decision (id bigint generated always as identity primary key, campaign_id uuid not null references aura_market.campaign on delete cascade, decision text not null check (decision in ('approved','rejected','removed','restored')), reason text not null, decided_by uuid not null references auth.users, decided_at timestamptz not null default now());

do $$ declare t text; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'aura_market' and c.relkind = 'r' loop
  execute format('alter table aura_market.%I enable row level security', t);
 end loop; end $$;

-- ───────── helpers ─────────
create function aura_market.audit(p_user uuid, p_event text) returns void language sql set search_path='' as $$ insert into aura_identity.event(user_id, event) values (p_user, p_event) $$;
create function aura_market.brand(p_workspace uuid, p_write boolean default true) returns uuid language plpgsql stable set search_path='' as $$
declare u uuid := aura_social.actor(p_workspace, p_write);
begin
 if not exists(select 1 from aura_identity.workspace where id = p_workspace and kind = 'brand') then raise exception 'Access denied' using errcode = '42501'; end if;
 return u;
end $$;
create function aura_market.verified(p_workspace uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from aura_identity.workspace w where w.id = p_workspace and w.kind = 'brand' and w.status = 'open' and w.verification = 'verified') $$;
create function aura_market.own(p_workspace uuid, p_campaign uuid, p_lock boolean default false) returns aura_market.campaign language plpgsql set search_path='' as $$
declare c aura_market.campaign;
begin
 if p_lock then select * into c from aura_market.campaign where id = p_campaign and workspace_id = p_workspace for update;
 else select * into c from aura_market.campaign where id = p_campaign and workspace_id = p_workspace; end if;
 if c.id is null then raise exception 'Access denied' using errcode = '42501'; end if;
 return c;
end $$;
create function aura_market.content(p_campaign uuid, p_version integer) returns jsonb language sql stable set search_path='' as $$
 select content from aura_market.campaign_version where campaign_id = p_campaign and version = p_version $$;

-- Structural validation of campaign terms. Every rule is a disclosure requirement from M10-F17 to F20 and F29.
create function aura_market.validate(p_category text, c jsonb) returns text[] language plpgsql immutable set search_path='' as $$
declare e text[] := '{}'; m jsonb := c->'compensation'->'money'; r jsonb := c->'rights'; req jsonb := c->'requirements';
begin
 if length(coalesce(trim(c->>'title'), '')) not between 5 and 120 then e := array_append(e, 'title'); end if;
 if length(coalesce(trim(c->>'summary'), '')) not between 20 and 300 then e := array_append(e, 'summary'); end if;
 if length(coalesce(trim(c->>'brief'), '')) not between 50 and 6000 then e := array_append(e, 'brief'); end if;
 if jsonb_typeof(c->'deliverables') <> 'array' or jsonb_array_length(c->'deliverables') not between 1 and 20 then e := array_append(e, 'deliverables'); end if;
 if c->>'closes_at' is null or (c->>'closes_at')::timestamptz <= now() then e := array_append(e, 'closes_at'); end if;
 -- F17/F18: money is an amount or a range; other forms of compensation are described separately and never presented as money
 if m is not null and m->>'type' not in ('fixed','range','none') then e := array_append(e, 'money'); end if;
 if m->>'type' = 'fixed' and coalesce((m->>'min')::numeric, -1) <= 0 then e := array_append(e, 'money'); end if;
 if m->>'type' = 'range' and (coalesce((m->>'min')::numeric, -1) <= 0 or coalesce((m->>'max')::numeric, -1) < coalesce((m->>'min')::numeric, 0)) then e := array_append(e, 'money'); end if;
 if m->>'type' in ('fixed','range') and coalesce(m->>'currency', '') !~ '^[A-Z]{3}$' then e := array_append(e, 'currency'); end if;
 if p_category = 'paid' and coalesce(m->>'type', 'none') not in ('fixed','range') then e := array_append(e, 'paid_needs_money'); end if;
 if p_category = 'affiliate' and coalesce((c->'compensation'->'commission'->>'rate_pct')::numeric, 0) <= 0 then e := array_append(e, 'affiliate_needs_commission'); end if;
 if p_category in ('barter','ugc','ambassador') and coalesce(m->>'type', 'none') = 'none' and coalesce(trim(c->'compensation'->'products'->>'description'), '') = '' and coalesce(trim(c->'compensation'->'services'->>'description'), '') = '' then e := array_append(e, 'compensation'); end if;
 if p_category = 'event' and coalesce(trim(c->'compensation'->'experiences'->>'description'), '') = '' and coalesce(m->>'type', 'none') = 'none' then e := array_append(e, 'event_needs_experience'); end if;
 -- F19: rights and exclusivity disclosed, or explicitly marked negotiable
 if not coalesce((r->>'negotiable')::boolean, false) and (r->>'usage_months' is null or jsonb_typeof(r->'channels') <> 'array') then e := array_append(e, 'rights'); end if;
 if coalesce((r->>'exclusivity_days')::int, 0) > aura_market.setting_int('max_exclusivity_days') or coalesce((r->>'exclusivity_days')::int, 0) < 0 then e := array_append(e, 'exclusivity'); end if;
 -- F20: positions are a real number or explicitly undisclosed (null)
 if c ? 'positions' and c->>'positions' is not null and (c->>'positions')::int not between 1 and 10000 then e := array_append(e, 'positions'); end if;
 -- AC02: UGC is never gated by follower count
 if p_category = 'ugc' and req ? 'min_followers' and req->>'min_followers' is not null then e := array_append(e, 'ugc_no_follower_minimum'); end if;
 if req->>'min_followers' is not null and (req->>'min_followers')::int not between 1 and 100000000 then e := array_append(e, 'min_followers'); end if;
 return e;
end $$;
-- Risk signals send a campaign to human review instead of publishing directly (F28, F29). They never accuse; they ask a reviewer to look.
create function aura_market.risk(p_campaign aura_market.campaign, c jsonb) returns text[] language plpgsql stable set search_path='' as $$
declare f text[] := '{}'; txt text := lower(coalesce(c->>'title', '') || ' ' || coalesce(c->>'summary', '') || ' ' || coalesce(c->>'brief', ''));
begin
 if txt ~ '(registration fee|joining fee|application fee|security deposit|refundable deposit|pay to (apply|join)|unlock fee|processing fee)' then f := array_append(f, 'fee_language'); end if;
 if txt ~ '(whatsapp|telegram)\s*[:+]?\s*\d|https?://' then f := array_append(f, 'off_platform_contact'); end if;
 if not exists(select 1 from aura_market.campaign x where x.workspace_id = p_campaign.workspace_id and x.first_published_at is not null) then f := array_append(f, 'first_publication'); end if; -- the Brand's first ever publication
 if coalesce((c->'rights'->>'exclusivity_days')::int, 0) > 180 then f := array_append(f, 'long_exclusivity'); end if;
 return f;
end $$;
-- Fields whose change is MATERIAL to a Creator's decision (F22). A material change is versioned and notified; it never amends an accepted agreement (M12).
create function aura_market.diff(a jsonb, b jsonb) returns text[] language sql immutable set search_path='' as $$
 select coalesce(array_agg(k order by k), '{}') from unnest(array['compensation','deliverables','rights','requirements','closes_at','positions','travel','countries','languages','remote']) k where a->k is distinct from b->k $$;

-- Eligibility (F02, F11, F12): mandatory requirements decide; preferred attributes only explain relevance. Missing data is "unknown", never assumed.
create function aura_market.eligibility(p_creator uuid, p_category text, c jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare req jsonb := coalesce(c->'requirements', '{}'); pref jsonb := coalesce(c->'preferred', '{}'); hard jsonb := '[]'::jsonb; soft jsonb := '[]'::jsonb; notes jsonb := '[]'::jsonb;
 minf int := nullif(req->>'min_followers', '')::int; plats text[] := coalesce(array(select jsonb_array_elements_text(req->'platforms')), '{}');
 country text; lang text; best int; anyunknown boolean; n int; cnt text[]; lng text[];
begin
 select cp.country, cp.language into country, lang from aura_creator.creator_profile cp where cp.workspace_id = p_creator;
 if minf is not null and p_category <> 'ugc' then
  select max(a.self_reported_followers), bool_or(a.self_reported_followers is null), count(*) into best, anyunknown, n from aura_creator.social_account a
   where a.workspace_id = p_creator and a.lifecycle = 'active' and a.ownership_scope = 'individual' and (cardinality(plats) = 0 or a.platform = any(plats));
  hard := hard || jsonb_build_array(jsonb_build_object('key', 'followers', 'label', format('One of your own accounts%s with %s or more followers', case when cardinality(plats) > 0 then ' on ' || array_to_string(plats, ' or ') end, minf),
   'status', case when coalesce(best, -1) >= minf then 'met' when n = 0 or (best is null and anyunknown) then 'unknown' else 'not_met' end,
   'detail', case when n = 0 then 'No matching account is added.' when best is null then 'No follower count is recorded for a matching account.' else format('Your best single matching account has %s (self-reported). Accounts are never added together.', best) end));
 elsif cardinality(plats) > 0 then
  select count(*) into n from aura_creator.social_account a where a.workspace_id = p_creator and a.lifecycle = 'active' and a.platform = any(plats);
  hard := hard || jsonb_build_array(jsonb_build_object('key', 'platform', 'label', 'An account on ' || array_to_string(plats, ' or '), 'status', case when n > 0 then 'met' else 'not_met' end, 'detail', null));
 end if;
 if p_category = 'ugc' then notes := notes || to_jsonb('UGC is assessed without a follower minimum.'::text); end if;
 if coalesce((req->>'verified_ownership')::boolean, false) then
  select count(*) into n from aura_creator.social_account a where a.workspace_id = p_creator and a.lifecycle = 'active' and a.verification = 'verified' and (cardinality(plats) = 0 or a.platform = any(plats));
  hard := hard || jsonb_build_array(jsonb_build_object('key', 'ownership', 'label', 'Verified ownership of a relevant account', 'status', case when n > 0 then 'met' else 'not_met' end, 'detail', null));
 end if;
 cnt := coalesce(array(select jsonb_array_elements_text(c->'countries')), '{}');
 if cardinality(cnt) > 0 then hard := hard || jsonb_build_array(jsonb_build_object('key', 'country', 'label', 'Based in ' || array_to_string(cnt, ', '), 'status', case when country is null then 'unknown' when country = any(cnt) then 'met' else 'not_met' end, 'detail', null)); end if;
 lng := coalesce(array(select jsonb_array_elements_text(c->'languages')), '{}');
 if cardinality(lng) > 0 then hard := hard || jsonb_build_array(jsonb_build_object('key', 'language', 'label', 'Creates in ' || array_to_string(lng, ', '), 'status', case when lang is null then 'unknown' when split_part(lang, '-', 1) = any(lng) then 'met' else 'not_met' end, 'detail', null)); end if;
 if p_category = 'paid' and minf is not null then notes := notes || to_jsonb('A paid influencer collaboration also needs verified ownership of a qualifying account before you accept it (checked again at agreement).'::text); end if;
 -- preferred attributes (relevance only)
 if jsonb_typeof(pref->'niches') = 'array' and jsonb_array_length(pref->'niches') > 0 then
  soft := soft || jsonb_build_array(jsonb_build_object('key', 'niche', 'label', 'Preferred niches', 'status', case when exists(select 1 from aura_creator.niche n2 where n2.workspace_id = p_creator and n2.code = any(array(select jsonb_array_elements_text(pref->'niches')))) then 'met' else 'not_met' end));
 end if;
 if coalesce((pref->>'beginner_friendly')::boolean, false) then soft := soft || jsonb_build_array(jsonb_build_object('key', 'beginner', 'label', 'Open to creators who are starting out', 'status', 'met')); end if;
 return jsonb_build_object('eligible', not exists(select 1 from jsonb_array_elements(hard) h where h->>'status' <> 'met'), 'hard', hard, 'preferred', soft, 'notes', notes);
end $$;
create function aura_market.below_threshold(p_creator uuid) returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from aura_creator.social_account a where a.workspace_id = p_creator and a.lifecycle = 'active' and a.ownership_scope = 'individual' and coalesce(a.self_reported_followers, -1) >= 100) $$;
-- Visibility (F04, AC01): public to signed-in Creators; restricted only to Creators who meet every mandatory requirement; invitation-only only to invited Creators.
create function aura_market.visible(p_creator uuid, c aura_market.campaign, p_elig jsonb) returns boolean language sql stable set search_path='' as $$
 select c.status = 'published' and aura_market.verified(c.workspace_id)
  and ((aura_market.content(c.id, c.published_version)->>'closes_at')::timestamptz > now())
  and (c.visibility = 'public' or (c.visibility = 'restricted' and (p_elig->>'eligible')::boolean) or (c.visibility = 'invite_only' and exists(select 1 from aura_market.invite i where i.campaign_id = c.id and i.creator_workspace_id = p_creator))) $$;
create function aura_market.card(p_creator uuid, c aura_market.campaign, p_elig jsonb) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id', c.id, 'slug', c.slug, 'category', c.category, 'visibility', c.visibility, 'version', c.published_version, 'published_at', c.published_at,
  'brand', jsonb_build_object('id', w.id, 'name', w.name), 'title', v.content->>'title', 'summary', v.content->>'summary', 'closes_at', v.content->>'closes_at',
  'compensation', v.content->'compensation', 'deliverables', v.content->'deliverables', 'rights', v.content->'rights', 'travel', v.content->'travel', 'positions', v.content->'positions',
  'remote', coalesce((v.content->>'remote')::boolean, true), 'countries', coalesce(v.content->'countries', '[]'), 'languages', coalesce(v.content->'languages', '[]'),
  'eligibility', p_elig, 'bookmarked', exists(select 1 from aura_market.bookmark b where b.workspace_id = p_creator and b.campaign_id = c.id),
  'invited', exists(select 1 from aura_market.invite i where i.campaign_id = c.id and i.creator_workspace_id = p_creator),
  'last_material_change', (select max(x.published_at) from aura_market.campaign_version x where x.campaign_id = c.id and x.material and x.published_at is not null and x.version > 1))
 from aura_market.campaign_version v join aura_identity.workspace w on w.id = c.workspace_id where v.campaign_id = c.id and v.version = c.published_version $$;

-- ───────── Creator ─────────
create function public.aura_market_feed(p_workspace uuid, p_filters jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); f jsonb := coalesce(p_filters, '{}'); out jsonb := '[]'::jsonb; c aura_market.campaign; e jsonb; card jsonb; q text := lower(trim(coalesce(f->>'q', '')));
 below boolean := aura_market.below_threshold(p_workspace); prefs text[]; factors jsonb; key numeric; v jsonb; hidden int := 0; ineligible_shown int := 0;
begin
 if length(q) > 80 then raise exception 'Search too long' using errcode = '22023'; end if;
 prefs := array(select case category when 'paid_influencer' then 'paid' when 'event' then 'event' else category end from aura_creator.collaboration_preference where workspace_id = p_workspace and interested);
 for c in select * from aura_market.campaign where status = 'published' order by published_at desc limit 500 loop
  v := aura_market.content(c.id, c.published_version);
  e := aura_market.eligibility(p_workspace, c.category, v);
  if not aura_market.visible(p_workspace, c, e) then continue; end if;
  if exists(select 1 from aura_market.hide_rule h where h.workspace_id = p_workspace and ((h.kind = 'brand' and h.value = c.workspace_id::text) or (h.kind = 'category' and h.value = c.category))) then hidden := hidden + 1; continue; end if;
  if f->>'category' is not null and f->>'category' <> c.category then continue; end if;
  if q <> '' and position(q in lower(coalesce(v->>'title', '') || ' ' || coalesce(v->>'summary', '') || ' ' || (select name from aura_identity.workspace where id = c.workspace_id))) = 0 then continue; end if;
  if (f->>'eligible_only')::boolean and not (e->>'eligible')::boolean then continue; end if;
  if (f->>'money_only')::boolean and coalesce(v->'compensation'->'money'->>'type', 'none') = 'none' then continue; end if;
  if f->>'min_money' is not null and coalesce((v->'compensation'->'money'->>'max')::numeric, (v->'compensation'->'money'->>'min')::numeric, 0) < (f->>'min_money')::numeric then continue; end if;
  if (f->>'remote_only')::boolean and not coalesce((v->>'remote')::boolean, true) then continue; end if;
  if (f->>'no_exclusivity')::boolean and coalesce((v->'rights'->>'exclusivity_days')::int, 0) > 0 then continue; end if;
  if (f->>'no_travel')::boolean and coalesce((v->'travel'->>'required')::boolean, false) then continue; end if;
  if f->>'max_deliverables' is not null and (select coalesce(sum(coalesce((d->>'quantity')::int, 1)), 0) from jsonb_array_elements(v->'deliverables') d) > (f->>'max_deliverables')::int then continue; end if;
  -- explainable relevance (F13): each factor is shown to the Creator; there is no score
  factors := '[]'::jsonb; key := 0;
  if (e->>'eligible')::boolean then factors := factors || to_jsonb('You meet every mandatory requirement'::text); key := key + 100; else ineligible_shown := ineligible_shown + 1; end if;
  if c.category = any(prefs) then factors := factors || to_jsonb('Matches a collaboration type you are interested in'::text); key := key + 20; end if;
  if exists(select 1 from jsonb_array_elements(e->'preferred') p where p->>'key' = 'niche' and p->>'status' = 'met') then factors := factors || to_jsonb('Fits one of your niches'::text); key := key + 15; end if;
  if below and c.category in ('ugc','barter','event') then factors := factors || to_jsonb('Suited to creators still building an audience'::text); key := key + 25; end if;
  if exists(select 1 from jsonb_array_elements(e->'preferred') p where p->>'key' = 'beginner') then factors := factors || to_jsonb('The Brand welcomes creators who are starting out'::text); key := key + 10; end if;
  if (v->>'closes_at')::timestamptz < now() + interval '5 days' then factors := factors || to_jsonb('Closes soon'::text); key := key + 5; end if;
  card := aura_market.card(p_workspace, c, e) || jsonb_build_object('factors', factors, 'order_key', key);
  out := out || jsonb_build_array(card);
 end loop;
 return jsonb_build_object('items', (select coalesce(jsonb_agg(x order by (x->>'order_key')::numeric desc, x->>'closes_at'), '[]'::jsonb) from jsonb_array_elements(out) x),
  'hidden_count', hidden, 'below_threshold', below, 'preferences', to_jsonb(prefs));
end $$;
create function public.aura_market_campaign(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); c aura_market.campaign; v jsonb; e jsonb; th int := aura_market.setting_int('applicant_count_threshold');
begin
 select * into c from aura_market.campaign where id = p_campaign;
 if c.id is null or c.published_version is null then raise exception 'Not found' using errcode = '42501'; end if;
 v := aura_market.content(c.id, c.published_version); e := aura_market.eligibility(p_workspace, c.category, v);
 -- a private campaign's direct URL cannot bypass its grant (business rule, AC01)
 if not aura_market.visible(p_workspace, c, e) then raise exception 'Not found' using errcode = '42501'; end if;
 insert into aura_market.recent_view(workspace_id, campaign_id, viewed_at) values (p_workspace, c.id, now()) on conflict (workspace_id, campaign_id) do update set viewed_at = now();
 return aura_market.card(p_workspace, c, e) || jsonb_build_object(
  'brief', v->>'brief', 'requirements', v->'requirements', 'preferred', v->'preferred', 'effort_note', v->>'effort_note', 'starts_on', v->>'starts_on',
  'applicants', case when c.show_applicant_count then jsonb_build_object('status', 'unavailable', 'reason', 'Applications open with the applications module (M11). Counts are shown only above ' || th || ' applicants.') else jsonb_build_object('status', 'not_shared') end,
  'brand_profile', (select jsonb_build_object('name', w.name, 'verified', w.verification = 'verified', 'verified_since', (select max(d.decided_at) from aura_market.verification_decision d where d.workspace_id = w.id and d.decision = 'verified'),
     'published_campaigns', (select count(*) from aura_market.campaign x where x.workspace_id = w.id and x.first_published_at is not null)) from aura_identity.workspace w where w.id = c.workspace_id),
  'updates', (select coalesce(jsonb_agg(jsonb_build_object('version', x.version, 'published_at', x.published_at, 'material', x.material, 'changes', to_jsonb(x.changes)) order by x.version desc), '[]'::jsonb) from aura_market.campaign_version x where x.campaign_id = c.id and x.published_at is not null),
  'reported', exists(select 1 from aura_market.report r where r.campaign_id = c.id and r.reporter_workspace_id = p_workspace and r.status = 'open'));
end $$;
-- F16: eligibility is re-checked at the moment of applying. The application itself is M11; this is the boundary M11 calls.
create function public.aura_market_check_apply(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb := public.aura_market_campaign(p_workspace, p_campaign);
begin
 return jsonb_build_object('eligible', (d->'eligibility'->>'eligible')::boolean, 'eligibility', d->'eligibility', 'version', d->'version',
  'applications', 'unavailable', 'reason', case when (d->'eligibility'->>'eligible')::boolean then 'You meet the mandatory requirements. Applications open with the applications module (M11).' else 'You do not meet every mandatory requirement, so you cannot apply.' end);
end $$;
create function public.aura_market_bookmark(p_workspace uuid, p_campaign uuid, p_on boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 if p_on then perform public.aura_market_campaign(p_workspace, p_campaign); insert into aura_market.bookmark(workspace_id, campaign_id) values (p_workspace, p_campaign) on conflict do nothing;
 else delete from aura_market.bookmark where workspace_id = p_workspace and campaign_id = p_campaign; end if;
 return jsonb_build_object('bookmarked', p_on);
end $$;
create function public.aura_market_lists(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); c aura_market.campaign; e jsonb; saved jsonb := '[]'::jsonb; recent jsonb := '[]'::jsonb; r record; days int := aura_market.setting_int('deadline_alert_days');
begin
 for r in select b.campaign_id, b.created_at from aura_market.bookmark b where b.workspace_id = p_workspace order by b.created_at desc loop
  select * into c from aura_market.campaign where id = r.campaign_id; e := aura_market.eligibility(p_workspace, c.category, aura_market.content(c.id, c.published_version));
  saved := saved || jsonb_build_array(case when c.published_version is not null and aura_market.visible(p_workspace, c, e) then aura_market.card(p_workspace, c, e) else jsonb_build_object('id', c.id, 'unavailable', true, 'title', (aura_market.content(c.id, coalesce(c.published_version, c.draft_version)))->>'title') end);
 end loop;
 for r in select v.campaign_id from aura_market.recent_view v where v.workspace_id = p_workspace order by v.viewed_at desc limit 20 loop
  select * into c from aura_market.campaign where id = r.campaign_id; e := aura_market.eligibility(p_workspace, c.category, aura_market.content(c.id, c.published_version));
  if c.published_version is not null and aura_market.visible(p_workspace, c, e) then recent := recent || jsonb_build_array(aura_market.card(p_workspace, c, e)); end if;
 end loop;
 return jsonb_build_object('saved', saved, 'recent', recent,
  'searches', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'filters', s.filters, 'alert', s.alert, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb) from aura_market.saved_search s where s.workspace_id = p_workspace),
  'hidden', (select coalesce(jsonb_agg(jsonb_build_object('kind', h.kind, 'value', h.value, 'label', case when h.kind = 'brand' then (select name from aura_identity.workspace where id::text = h.value) else h.value end) order by h.created_at desc), '[]'::jsonb) from aura_market.hide_rule h where h.workspace_id = p_workspace),
  'notifications', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'campaign_id', n.campaign_id, 'title', n.title, 'detail', n.detail, 'created_at', n.created_at, 'read', n.read_at is not null) order by n.created_at desc), '[]'::jsonb) from (select * from aura_market.notification where workspace_id = p_workspace order by created_at desc limit 50) n),
  -- deadline alerts are computed when read (no scheduler yet) for saved campaigns closing soon
  'deadlines', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(saved) x where not (x ? 'unavailable') and (x->>'closes_at')::timestamptz < now() + make_interval(days => days)));
end $$;
create function public.aura_market_save_search(p_workspace uuid, p_name text, p_filters jsonb, p_alert boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); s aura_market.saved_search;
begin
 if (select count(*) from aura_market.saved_search where workspace_id = p_workspace) >= 20 then raise exception 'Too many saved searches' using errcode = '23514'; end if;
 if p_filters is null or jsonb_typeof(p_filters) <> 'object' or length(p_filters::text) > 1000 or exists(select 1 from jsonb_object_keys(p_filters) k where k not in ('q','category','eligible_only','money_only','min_money','remote_only','no_exclusivity','no_travel','max_deliverables')) then raise exception 'Invalid filters' using errcode = '22023'; end if;
 insert into aura_market.saved_search(workspace_id, name, filters, alert) values (p_workspace, trim(p_name), p_filters, coalesce(p_alert, true)) returning * into s;
 return to_jsonb(s) - 'workspace_id';
end $$;
create function public.aura_market_delete_search(p_workspace uuid, p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin delete from aura_market.saved_search where id = p_id and workspace_id = p_workspace; if not found then raise exception 'Access denied' using errcode = '42501'; end if; return jsonb_build_object('deleted', p_id); end $$;
create function public.aura_market_set_alert(p_workspace uuid, p_id uuid, p_alert boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin update aura_market.saved_search set alert = coalesce(p_alert, false) where id = p_id and workspace_id = p_workspace; if not found then raise exception 'Access denied' using errcode = '42501'; end if; return jsonb_build_object('alert', p_alert); end $$;
create function public.aura_market_hide(p_workspace uuid, p_kind text, p_value text, p_on boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin
 if p_kind = 'category' and p_value not in ('paid','ugc','barter','affiliate','ambassador','event') then raise exception 'Invalid category' using errcode = '22023'; end if;
 if p_kind = 'brand' and not exists(select 1 from aura_identity.workspace where id::text = p_value and kind = 'brand') then raise exception 'Invalid brand' using errcode = '22023'; end if;
 if p_on then insert into aura_market.hide_rule(workspace_id, kind, value) values (p_workspace, p_kind, p_value) on conflict do nothing;
 else delete from aura_market.hide_rule where workspace_id = p_workspace and kind = p_kind and value = p_value; end if;
 return jsonb_build_object('hidden', p_on);
end $$;
create function public.aura_market_read_notifications(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true);
begin update aura_market.notification set read_at = now() where workspace_id = p_workspace and read_at is null; return jsonb_build_object('ok', true); end $$;
create function public.aura_market_report(p_workspace uuid, p_campaign uuid, p_reason text, p_details text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, true); r aura_market.report;
begin
 perform public.aura_market_campaign(p_workspace, p_campaign); -- only a campaign you can see
 if (select count(*) from aura_market.report where reporter_workspace_id = p_workspace and created_at > now() - interval '1 day') >= 10 then raise exception 'Too many reports today' using errcode = '54000'; end if;
 insert into aura_market.report(campaign_id, reporter_workspace_id, reporter, reason, details) values (p_campaign, p_workspace, u, p_reason, nullif(trim(p_details), '')) returning * into r;
 perform aura_market.audit(u, 'market_report_created');
 return jsonb_build_object('id', r.id, 'status', r.status);
exception when unique_violation then raise exception 'Already reported' using errcode = '23505';
end $$;
create function public.aura_market_brand_page(p_workspace uuid, p_brand uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_analytics.actor(p_workspace, false); w aura_identity.workspace; c aura_market.campaign; e jsonb; items jsonb := '[]'::jsonb;
begin
 select * into w from aura_identity.workspace where id = p_brand and kind = 'brand';
 if w.id is null or not aura_market.verified(w.id) then raise exception 'Not found' using errcode = '42501'; end if;
 for c in select * from aura_market.campaign where workspace_id = w.id and status = 'published' order by published_at desc loop
  e := aura_market.eligibility(p_workspace, c.category, aura_market.content(c.id, c.published_version));
  if aura_market.visible(p_workspace, c, e) then items := items || jsonb_build_array(aura_market.card(p_workspace, c, e)); end if;
 end loop;
 -- genuine history only (F31): no rating or score
 return jsonb_build_object('id', w.id, 'name', w.name, 'verified_since', (select max(decided_at) from aura_market.verification_decision where workspace_id = w.id and decision = 'verified'),
  'published_campaigns', (select count(*) from aura_market.campaign where workspace_id = w.id and first_published_at is not null), 'campaigns', items,
  'hidden', exists(select 1 from aura_market.hide_rule h where h.workspace_id = p_workspace and h.kind = 'brand' and h.value = w.id::text));
end $$;

-- ───────── Brand ─────────
create function public.aura_market_brand_state(p_workspace uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false);
begin
 return jsonb_build_object('verification', (select verification from aura_identity.workspace where id = p_workspace), 'verified', aura_market.verified(p_workspace),
  'campaigns', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'category', c.category, 'visibility', c.visibility, 'status', c.status, 'draft_version', c.draft_version, 'published_version', c.published_version,
     'title', (aura_market.content(c.id, c.draft_version))->>'title', 'risk_flags', to_jsonb(c.risk_flags), 'review_note', c.review_note, 'updated_at', c.updated_at,
     'invites', (select count(*) from aura_market.invite i where i.campaign_id = c.id), 'bookmarks', (select count(*) from aura_market.bookmark b where b.campaign_id = c.id)) order by c.updated_at desc), '[]'::jsonb)
   from aura_market.campaign c where c.workspace_id = p_workspace and c.status <> 'removed'));
end $$;
create function public.aura_market_create_campaign(p_workspace uuid, p_request uuid, p_category text, p_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign; s text;
begin
 perform pg_advisory_xact_lock(hashtextextended('market_req:' || p_workspace::text || p_request::text, 0));
 select * into c from aura_market.campaign where workspace_id = p_workspace and request_id = p_request;
 if c.id is not null then return jsonb_build_object('id', c.id); end if;
 if length(coalesce(trim(p_title), '')) not between 5 and 120 then raise exception 'Invalid title' using errcode = '22023'; end if;
 if (select count(*) from aura_market.campaign where workspace_id = p_workspace and status in ('draft','in_review')) >= 50 then raise exception 'Too many drafts' using errcode = '23514'; end if;
 s := left(trim(both '-' from regexp_replace(lower(p_title), '[^a-z0-9]+', '-', 'g')), 60) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
 if length(s) < 12 then s := 'campaign-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10); end if;
 -- private drafts are allowed before verification (M14-F31); publication is not
 insert into aura_market.campaign(workspace_id, slug, category, created_by, request_id) values (p_workspace, s, p_category, u, p_request) returning * into c;
 insert into aura_market.campaign_version(campaign_id, version, content, created_by) values (c.id, 1, jsonb_build_object('title', trim(p_title), 'remote', true, 'deliverables', '[]'::jsonb, 'compensation', '{}'::jsonb, 'rights', '{}'::jsonb, 'requirements', '{}'::jsonb, 'preferred', '{}'::jsonb), u);
 perform aura_market.audit(u, 'market_campaign_created');
 return jsonb_build_object('id', c.id, 'slug', c.slug);
end $$;
create function public.aura_market_brand_campaign(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, false); c aura_market.campaign := aura_market.own(p_workspace, p_campaign);
begin
 return to_jsonb(c) - 'workspace_id' - 'request_id' - 'created_by' || jsonb_build_object('draft', aura_market.content(c.id, c.draft_version), 'live', case when c.published_version is not null then aura_market.content(c.id, c.published_version) end,
  'errors', to_jsonb(aura_market.validate(c.category, aura_market.content(c.id, c.draft_version))), 'verified', aura_market.verified(p_workspace),
  'pending_changes', case when c.published_version is not null and c.draft_version > c.published_version then to_jsonb(aura_market.diff(aura_market.content(c.id, c.published_version), aura_market.content(c.id, c.draft_version))) end,
  'versions', (select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'published_at', v.published_at, 'material', v.material, 'changes', to_jsonb(v.changes)) order by v.version desc), '[]'::jsonb) from aura_market.campaign_version v where v.campaign_id = c.id),
  'invited', (select coalesce(jsonb_agg(jsonb_build_object('workspace', w.id, 'name', w.name, 'invited_at', i.invited_at)), '[]'::jsonb) from aura_market.invite i join aura_identity.workspace w on w.id = i.creator_workspace_id where i.campaign_id = c.id));
end $$;
create function public.aura_market_save_campaign(p_workspace uuid, p_campaign uuid, p_visibility text, p_show_count boolean, p_content jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign, true); allowed text[] := array['title','summary','brief','deliverables','compensation','rights','travel','requirements','preferred','closes_at','starts_on','positions','countries','languages','remote','effort_note'];
begin
 if c.status in ('closed','removed') then raise exception 'This campaign can no longer be edited' using errcode = '55000'; end if;
 if p_content is null or jsonb_typeof(p_content) <> 'object' or length(p_content::text) > 30000 or exists(select 1 from jsonb_object_keys(p_content) k where not (k = any(allowed))) then raise exception 'Invalid content' using errcode = '22023'; end if;
 if p_visibility not in ('public','restricted','invite_only') then raise exception 'Invalid visibility' using errcode = '22023'; end if;
 if c.published_version is not null and c.draft_version = c.published_version then
  -- editing a live campaign starts a new draft version; the live version stays unchanged until republished
  insert into aura_market.campaign_version(campaign_id, version, content, created_by) values (c.id, c.draft_version + 1, p_content, u);
  update aura_market.campaign set draft_version = draft_version + 1, visibility = p_visibility, show_applicant_count = coalesce(p_show_count, false), updated_at = now() where id = c.id;
 else
  update aura_market.campaign_version set content = p_content, created_at = now() where campaign_id = c.id and version = c.draft_version;
  update aura_market.campaign set visibility = p_visibility, show_applicant_count = coalesce(p_show_count, false), status = case when status = 'in_review' then 'draft' else status end, updated_at = now() where id = c.id;
 end if;
 return public.aura_market_brand_campaign(p_workspace, p_campaign);
end $$;
create function aura_market.go_live(c aura_market.campaign, u uuid) returns void language plpgsql set search_path='' as $$
declare prev jsonb := case when c.published_version is not null then aura_market.content(c.id, c.published_version) end; cur jsonb := aura_market.content(c.id, c.draft_version); ch text[]; s aura_market.saved_search; f jsonb;
begin
 ch := case when prev is null then '{}' else aura_market.diff(prev, cur) end;
 update aura_market.campaign_version set published_at = now(), material = cardinality(ch) > 0, changes = ch where campaign_id = c.id and version = c.draft_version;
 update aura_market.campaign set status = 'published', published_version = c.draft_version, published_at = now(), first_published_at = coalesce(first_published_at, now()), risk_flags = '{}', updated_at = now() where id = c.id;
 if prev is not null and cardinality(ch) > 0 then
  -- F22/AC04: everyone who saved the campaign is told what changed
  insert into aura_market.notification(workspace_id, kind, campaign_id, version, title, detail)
   select b.workspace_id, 'material_change', c.id, c.draft_version, 'Terms changed: ' || (cur->>'title'), 'Changed: ' || array_to_string(ch, ', ') || '. Review before applying.' from aura_market.bookmark b where b.campaign_id = c.id;
 elsif prev is null then
  -- F08/F32: saved searches with alerts on, matching category and text, hear about new public campaigns
  for s in select * from aura_market.saved_search where alert loop
   f := s.filters;
   if c.visibility = 'public' and (f->>'category' is null or f->>'category' = c.category) and (coalesce(f->>'q', '') = '' or position(lower(f->>'q') in lower(coalesce(cur->>'title', '') || ' ' || coalesce(cur->>'summary', ''))) > 0)
    and (f->>'money_only' is null or not (f->>'money_only')::boolean or coalesce(cur->'compensation'->'money'->>'type', 'none') <> 'none') then
    insert into aura_market.notification(workspace_id, kind, campaign_id, version, title, detail) values (s.workspace_id, 'new_match', c.id, c.draft_version, 'New campaign for "' || s.name || '": ' || (cur->>'title'), null);
   end if;
  end loop;
  insert into aura_market.notification(workspace_id, kind, campaign_id, version, title) select i.creator_workspace_id, 'new_match', c.id, c.draft_version, 'You are invited: ' || (cur->>'title') from aura_market.invite i where i.campaign_id = c.id;
 end if;
 perform aura_market.audit(u, 'market_campaign_published');
end $$;
create function public.aura_market_publish(p_workspace uuid, p_campaign uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign, true); e text[]; flags text[]; cur jsonb;
begin
 -- M10-F27 / M14-F34 / AC05: no publication at any visibility without approved business verification
 if not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
 if c.status in ('closed','removed') then raise exception 'This campaign can no longer be published' using errcode = '55000'; end if;
 if c.published_version is not null and c.draft_version = c.published_version and c.status = 'published' then raise exception 'Nothing to publish' using errcode = '55000'; end if;
 cur := aura_market.content(c.id, c.draft_version);
 e := aura_market.validate(c.category, cur);
 if cardinality(e) > 0 then raise exception 'Campaign is incomplete: %', array_to_string(e, ',') using errcode = '22023'; end if;
 flags := aura_market.risk(c, cur);
 if cardinality(flags) > 0 then
  update aura_market.campaign set status = case when published_version is null then 'in_review' else status end, risk_flags = flags, updated_at = now() where id = c.id;
  perform aura_market.audit(u, 'market_campaign_sent_to_review');
  return jsonb_build_object('status', 'in_review', 'flags', to_jsonb(flags));
 end if;
 perform aura_market.go_live(c, u);
 return jsonb_build_object('status', 'published');
end $$;
create function public.aura_market_set_status(p_workspace uuid, p_campaign uuid, p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign, true);
begin
 if p_action = 'pause' and c.status = 'published' then update aura_market.campaign set status = 'paused', updated_at = now() where id = c.id;
 elsif p_action = 'resume' and c.status = 'paused' then
  if not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
  update aura_market.campaign set status = 'published', updated_at = now() where id = c.id;
 elsif p_action = 'close' and c.status in ('published','paused','draft','in_review') then
  update aura_market.campaign set status = 'closed', updated_at = now() where id = c.id;
  insert into aura_market.notification(workspace_id, kind, campaign_id, title) select b.workspace_id, 'campaign_closed', c.id, 'Closed: ' || ((aura_market.content(c.id, coalesce(c.published_version, c.draft_version)))->>'title') from aura_market.bookmark b where b.campaign_id = c.id and c.published_version is not null;
 else raise exception 'That is not possible now' using errcode = '55000'; end if;
 perform aura_market.audit(u, 'market_campaign_' || p_action);
 return jsonb_build_object('status', (select status from aura_market.campaign where id = c.id));
end $$;
create function public.aura_market_invite(p_workspace uuid, p_campaign uuid, p_creator uuid, p_on boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_market.brand(p_workspace, true); c aura_market.campaign := aura_market.own(p_workspace, p_campaign);
begin
 -- invitations are formal outreach: they also need approved verification (M14-F34)
 if not aura_market.verified(p_workspace) then raise exception 'Business verification required' using errcode = '55000'; end if;
 if not exists(select 1 from aura_identity.workspace w where w.id = p_creator and w.kind = 'creator' and w.status = 'open') then raise exception 'Invalid creator' using errcode = '22023'; end if;
 if p_on then
  insert into aura_market.invite(campaign_id, creator_workspace_id) values (c.id, p_creator) on conflict do nothing;
  if c.status = 'published' then insert into aura_market.notification(workspace_id, kind, campaign_id, version, title) values (p_creator, 'new_match', c.id, c.published_version, 'You are invited: ' || ((aura_market.content(c.id, c.published_version))->>'title')); end if;
 else delete from aura_market.invite where campaign_id = c.id and creator_workspace_id = p_creator; end if;
 perform aura_market.audit(u, 'market_invite_' || case when p_on then 'sent' else 'withdrawn' end);
 return jsonb_build_object('invited', p_on);
end $$;

-- ───────── Restricted review (Platform Admin + reviewer grant + MFA) ─────────
create function public.aura_market_review_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check();
begin
 return jsonb_build_object(
  'campaigns', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'brand', w.name, 'category', c.category, 'title', (aura_market.content(c.id, c.draft_version))->>'title', 'summary', (aura_market.content(c.id, c.draft_version))->>'summary',
     'brief', (aura_market.content(c.id, c.draft_version))->>'brief', 'flags', to_jsonb(c.risk_flags), 'updated_at', c.updated_at) order by c.updated_at), '[]'::jsonb)
   from aura_market.campaign c join aura_identity.workspace w on w.id = c.workspace_id where c.status = 'in_review' or (cardinality(c.risk_flags) > 0 and c.draft_version > coalesce(c.published_version, 0))),
  'reports', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'campaign_id', r.campaign_id, 'title', (aura_market.content(c.id, coalesce(c.published_version, c.draft_version)))->>'title', 'brand', w.name, 'reason', r.reason, 'details', r.details, 'created_at', r.created_at) order by r.created_at), '[]'::jsonb)
   from aura_market.report r join aura_market.campaign c on c.id = r.campaign_id join aura_identity.workspace w on w.id = c.workspace_id where r.status = 'open'),
  'brands', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'business_kind', w.business_kind, 'verification', w.verification, 'drafts', (select count(*) from aura_market.campaign c where c.workspace_id = w.id))), '[]'::jsonb)
   from aura_identity.workspace w where w.kind = 'brand' and w.verification <> 'verified' and w.status = 'open' and exists(select 1 from aura_market.campaign c where c.workspace_id = w.id)));
end $$;
create function aura_market.not_member(p_user uuid, p_workspace uuid) returns void language plpgsql stable set search_path='' as $$
begin if exists(select 1 from aura_identity.membership m where m.workspace_id = p_workspace and m.user_id = p_user and m.active) then raise exception 'You cannot review your own workspace' using errcode = '42501'; end if; end $$;
create function public.aura_market_verify_brand(p_brand uuid, p_decision text, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check();
begin
 if p_decision not in ('verified','revoked') or length(coalesce(trim(p_reason), '')) < 3 then raise exception 'A decision and reason are required' using errcode = '22023'; end if;
 if not exists(select 1 from aura_identity.workspace where id = p_brand and kind = 'brand') then raise exception 'Invalid brand' using errcode = '22023'; end if;
 perform aura_market.not_member(u, p_brand);
 update aura_identity.workspace set verification = p_decision where id = p_brand;
 insert into aura_market.verification_decision(workspace_id, decision, reason, decided_by) values (p_brand, p_decision, trim(p_reason), u);
 -- revocation takes campaigns out of the marketplace immediately (visibility re-checks verification on every read)
 perform aura_market.audit(u, 'market_brand_' || p_decision);
 return jsonb_build_object('brand', p_brand, 'verification', p_decision);
end $$;
create function public.aura_market_moderate(p_campaign uuid, p_decision text, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); c aura_market.campaign;
begin
 if p_decision not in ('approved','rejected','removed','restored') or length(coalesce(trim(p_reason), '')) < 3 then raise exception 'A decision and reason are required' using errcode = '22023'; end if;
 select * into c from aura_market.campaign where id = p_campaign for update;
 if c.id is null then raise exception 'Not found' using errcode = '42501'; end if;
 perform aura_market.not_member(u, c.workspace_id);
 if p_decision = 'approved' then
  if not aura_market.verified(c.workspace_id) then raise exception 'Business verification required' using errcode = '55000'; end if;
  if cardinality(aura_market.validate(c.category, aura_market.content(c.id, c.draft_version))) > 0 then raise exception 'Campaign is incomplete' using errcode = '22023'; end if;
  perform aura_market.go_live(c, u);
 elsif p_decision = 'rejected' then update aura_market.campaign set status = case when published_version is null then 'draft' else status end, review_note = trim(p_reason), updated_at = now() where id = c.id;
 elsif p_decision = 'removed' then update aura_market.campaign set status = 'removed', review_note = trim(p_reason), updated_at = now() where id = c.id;
 else update aura_market.campaign set status = case when published_version is not null then 'paused' else 'draft' end, review_note = trim(p_reason), updated_at = now() where id = c.id and status = 'removed'; end if;
 insert into aura_market.moderation_decision(campaign_id, decision, reason, decided_by) values (c.id, p_decision, trim(p_reason), u);
 perform aura_market.audit(u, 'market_campaign_' || p_decision);
 return jsonb_build_object('campaign', c.id, 'decision', p_decision);
end $$;
create function public.aura_market_decide_report(p_report uuid, p_decision text, p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := aura_social.reviewer_check(); r aura_market.report;
begin
 if p_decision not in ('actioned','dismissed') or length(coalesce(trim(p_reason), '')) < 3 then raise exception 'A decision and reason are required' using errcode = '22023'; end if;
 update aura_market.report set status = p_decision, decision_reason = trim(p_reason), decided_by = u, decided_at = now() where id = p_report and status = 'open' returning * into r;
 if r.id is null then raise exception 'Nothing to decide' using errcode = '55000'; end if;
 perform aura_market.audit(u, 'market_report_' || p_decision);
 return jsonb_build_object('report', r.id, 'status', r.status);
end $$;

-- M01 public campaign previews (slug, title, summary): public, published, open campaigns of verified Brands only. Recomputed on every read.
create view public.m01_public_campaign_previews as
 select c.slug, v.content->>'title' as title, v.content->>'summary' as summary
 from aura_market.campaign c join aura_market.campaign_version v on v.campaign_id = c.id and v.version = c.published_version join aura_identity.workspace w on w.id = c.workspace_id
 where c.status = 'published' and c.visibility = 'public' and w.kind = 'brand' and w.status = 'open' and w.verification = 'verified' and (v.content->>'closes_at')::timestamptz > now();
revoke all on public.m01_public_campaign_previews from public, anon, authenticated;
grant select on public.m01_public_campaign_previews to anon, authenticated;

do $$ declare fn regprocedure; begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'aura\_market\_%' loop
  execute format('revoke all on function %s from public,anon,authenticated', fn);
  execute format('grant execute on function %s to authenticated', fn);
 end loop; end $$;
revoke all on all tables in schema aura_market from public, anon, authenticated;
revoke all on all functions in schema aura_market from public, anon, authenticated;
commit;
