# Database and environment architecture

Phase 00 introduces request-scoped Supabase clients and a read-only connectivity command. There are no application tables, migrated schemas, storage buckets or database grants in this delivery. The same SDK provides .auth, .from(...) and .storage. The server factory is for cookie-writable request handlers. The browser uses a publishable key. Never provide service-role or secret keys to either factory.

## Proposed tenant model

One identity can hold multiple memberships. Scope resource ownership to a workspace ID. Use composite foreign keys where parent and child carry the same tenant ID. Derive authorization from verified identity, active membership, role, resource relationship, onboarding, verification and required MFA. Reject caller-supplied role claims. Enforce one personal Creator workspace per identity in the database when M02 is approved for implementation. Brand verification belongs to each workspace. Agency access requires an explicit, active scope-limited client delegation. Provision platform administrators separately and authorize each administrative operation.

Use transactions for related changes. Prefer RLS with explicit operation-specific USING and WITH CHECK policies, minimal grants and indexed membership/ownership columns. Enable RLS in the same migration that creates any exposed table. Avoid privileged views and functions by default. Expose only allowlisted public projections; revocation must propagate to discovery and cached media. Test anonymous, wrong tenant, revoked membership, participant and delegate cases against the real Data API.

## Storage

Private buckets by purpose. Use server-assigned opaque object IDs, workspace-bound metadata and policies on storage.objects for every operation. Validate membership and resource ownership at upload and download. Restrict upsert, list, move and delete separately. Never grant access from path prefix alone. Quarantine pending validation; confirm MIME, file signature, quotas, scan result and metadata before release. Authorize each short-lived signed URL and document its residual lifetime after revocation.

## Local and staging setup

1. Install Docker and the Supabase CLI for a local stack. From this repository run `supabase start` and consult `supabase status` privately for the local API URL and publishable key. Keep local data separate from staging.
2. Alternatively create or select a dedicated staging Supabase project. From its Connect dialog and API Keys settings obtain the HTTPS project URL and publishable key. Use separate provider projects, redirect allowlists, secrets and deployment builds for staging and production.
3. Copy .env.example to .env.local. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Restart the development server or rebuild for a hosted environment. Run `pnpm env:check` then `pnpm supabase:check`. The latter performs real read-only calls to Auth settings and the PostgREST schema endpoint, validates their response shapes and fails on HTTP or network errors. Neither call verifies a user session, tenant grants or object access.
4. With M02 configure exact callback origins, SMTP, email verification and Google OAuth in staging. Verify real delivery, refresh, revocation and MFA. With the first storage feature verify object write/read/denial under real identities. Use separate disposable local data for migration testing.

## Migrations

Create each change with `supabase migration new descriptive_name`. Commit the resulting UTC timestamped SQL file. Review grants and policies together. Apply to a disposable local database and test upgrade on a backed-up staging copy. Preserve applied files, use a forward-fix migration and document recovery. Require approval and a verified backup before production rollout.

## M03 Creator onboarding schema

The migration `20261126000100_m03_creator_onboarding.sql` adds the private `aura_creator` schema: reference taxonomies for niches, industries and challenges, then profile, onboarding state, niches, social accounts, goals, challenges, resources, collaboration, industry preferences, industry exclusions, rates and growth plans and actions. Every table has RLS enabled with no policy and no grant, and access is only through six `SECURITY DEFINER` functions. Social accounts are a foundation that M05 extends. Money uses integer minor units. Concurrency uses `onboarding_state.revision` with a row lock. See [Creator onboarding architecture](CREATOR_ONBOARDING_ARCHITECTURE.md).

## M04 Creator Studio schema

The migration `20261127000100_m04_creator_dashboard.sql` adds the private `aura_studio` schema: dashboard preferences, daily actions, goal observations, ideas, milestone events and weekly reviews. Every table has RLS enabled with no policy and no grant, and access is only through 14 `SECURITY DEFINER` functions that re-check the M02 session, owner membership of a Creator workspace and completed M03 activation. Observations are append-only and keyed by goal category and metric, so M03's replace-set goal edits cannot erase history. The day and week are computed in the database from the stored time zone. Generation is serialized with advisory locks. See [Creator Studio architecture](CREATOR_STUDIO_ARCHITECTURE.md).

## M05 `aura_social`

Private schema, RLS on with no policies, no grants; access via `SECURITY DEFINER` functions only. Append-only observations, advisory-lock concurrency, DB-enforced account limit. See `SOCIAL_ACCOUNT_ARCHITECTURE.md`.

## M06 `aura_analytics`

Private schema; RLS on with no policies and no grants; access via `SECURITY DEFINER` functions only. Reuses M05 observations. Append-only audience snapshots; experiments freeze baselines at activation. See `CREATOR_ANALYTICS_ARCHITECTURE.md`.

## M09 `aura_profile`

Private schema; RLS on with no policies and no grants. Anonymous callers can execute only `aura_public_profile` and `aura_public_kit` and read the allowlisted `m01_public_creator_previews` view. Widens M03's `creator_profile.visibility` to private or public. See `CREATOR_PROFILE_ARCHITECTURE.md`.

## M10 `aura_market`

Private schema; RLS on with no policies and no grants. Campaign terms are versioned (`campaign_version`); eligibility and visibility are computed in the database on every read. The M01 preview view lists only public, published, open campaigns of verified Brands. See `CAMPAIGN_MARKETPLACE_ARCHITECTURE.md`.

## M11 `aura_apply`

Private schema; RLS on with no policies and no grants; 16 tables reached only through `aura_apply_*` functions (authenticated only, none for anon). Applications and proposals are versioned; capacity and duplicate checks use advisory locks. See `APPLICATIONS_ARCHITECTURE.md`.

## M14 `aura_brand`

Private schema; RLS on with no policies and no grants; 15 tables reached only through `aura_brand_*` functions. Only `aura_brand_public` is executable by anon. Verification writes the existing `aura_identity.workspace.verification` field and the M10 decision history. Migration `20261207000100`. See `BRAND_ONBOARDING_ARCHITECTURE.md`.

## Merge of M07 and M08

Jai's M07 (`20261130000100_m07_growth_studio.sql`) and M08 migrations are included. The M08 migration was renamed to `20261130000200_m08_content_studio.sql` because it shared the version `20261201000100` with M09. `20261204000100_reserve_m07_m08_routes.sql` reserves `ai` and `content` as usernames.

## M17 `aura_campaign`

Private schema; RLS on with no policies and no grants; 3 tables reached only through `aura_campaign_*` functions (authenticated only). Two triggers on M10 tables enforce the rollout and the positions floor and extend change notices. Migration `20261209000100`. See `CAMPAIGN_MANAGEMENT_ARCHITECTURE.md`.

## M18 `aura_selection`

Private schema; RLS on with no policies and no grants; 4 tables reached only through `aura_selection_*` functions. Triggers on `aura_apply.application` (capacity including holds) and `aura_apply.collaboration` (hand-off to M12). Migration `20261210000100`. See `SELECTION_ARCHITECTURE.md`.

## M19 `aura_monitor`

Private schema; RLS on with no policies and no grants; 5 tables (setting, observation, consent, report, report_access) reached only through `aura_monitor_*` functions. The roll-up reads M12 documents via the M18 hand-off and M13 payment reports. Migration `20261211000100`. See `MONITORING_ARCHITECTURE.md`.
