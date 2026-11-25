# Social account architecture (M05)

## Layers

- **Database** (`supabase/migrations/20261128000100_m05_social_accounts.sql`): private schema `aura_social`. Every table has RLS enabled with no policies and no grants. Access is only through `SECURITY DEFINER` functions (`search_path=''`, granted to `authenticated`) that re-validate the session, workspace membership, workspace kind and status.
- **Server** (`src/server/social/service.ts`): typed RPC wrappers. Database messages are classified and never shown; users see fixed texts (`reasonText`).
- **Actions** (`src/features/creator-social/actions.ts`): zod validation, rate limits, idempotency keys, workspace resolved server-side.
- **UI**: `/creator/socials`, `/new`, `/[id]`, `/[id]/verify`, `/[id]/metrics`, `/[id]/history`, `/settings`; reviewer page `/admin/social-review`.

## Data model

`aura_creator.social_account` (extended from M03) holds the account. Status is several independent dimensions: lifecycle (active, disconnected, archived, removed), ownership verification, connection (manual, connected, disconnected), sharing visibility. Observations are append-only; a correction inserts a new row that supersedes the old one. Account-level and content-level observations are separate. Windows, lifetime values and point-in-time values are never summed.

## Concurrency

Advisory transaction locks: per workspace (limit, primary, preferred), per identity (approvals), per `(workspace, request_id)` (idempotent retries). The 10-account limit is a database trigger, not application code. Tested with real simultaneous psql sessions.

## Contracts without implementations

`ProviderAdapter`, `RefreshRunner`, `PublishingAdapter`, `ExtractionProvider`, `ScannerAdapter`: none registered. Manual tracking is the only data source and is labelled self-reported.

## Limits of the evidence

Verified on a local PostgreSQL 16 with `auth` and `storage` stubs. Not verified on a live Supabase project (including Storage API upload, signed URLs, MFA tokens).
