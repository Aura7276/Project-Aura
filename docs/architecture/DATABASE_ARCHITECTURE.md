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
