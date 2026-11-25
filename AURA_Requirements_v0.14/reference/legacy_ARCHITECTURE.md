# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Architecture
## Stack
Next.js App Router + TS; Tailwind/shadcn; Supabase Auth/Postgres/Storage; versioned SQL migrations; Zod; React Hook Form; Playwright; Vitest. Prefer server components for reads, server actions or route handlers for writes, with explicit authorization. Hosted Next.js frontend plus managed DB/auth/storage.
## Security boundaries
Client -> Next.js server -> auth/session -> workspace membership/permission service -> database (RLS) -> private object storage. All writes validate Zod schemas and membership/role. Public creator directory uses dedicated constrained query exposing only approved public fields. No service-role key on client. Supabase auth cookies use supported SSR helpers with secure cookie configuration. Verify current SDK patterns rather than copying stale examples.
## Data
Relational normalized schema; UUID identifiers; timestamps; workspace_id on tenant-owned resources; optimistic concurrency where necessary; uniqueness constraints; soft-deletion for selected records; audit log append-only by application policy. Uploaded file metadata stored in DB; files in private buckets and served via short-lived authorized signed URLs.
## Workflow states
Workspace onboarding DRAFT/ACTIVE; creator profile PRIVATE/PUBLISHED/SUSPENDED; brand verification NOT_SUBMITTED/PENDING/APPROVED/REJECTED; campaign DRAFT/OPEN/PAUSED/CLOSED/CANCELLED; application SUBMITTED/SHORTLISTED/ACCEPTED/REJECTED/WITHDRAWN; collaboration PROPOSED/ACTIVE/COMPLETED/CANCELLED; deliverable DRAFT/SUBMITTED/REVISION_REQUESTED/APPROVED. Enforce transitions on server with audit.
## Integration seams
`InstagramProvider` interface reserved but disabled; no fake provider. `PaymentProvider` interface not required in this release. Email provider is REAL for auth/notification as configured; use database-backed notification for in-app. Background notification sending via reliable queue or transactional outbox as justified.
## Operational
Environment isolation dev/staging/prod, CI checks, backup and restore drill, centralized errors, rate limiting, request IDs, structured logs, security headers and monitoring. No client-side secrets. Follow `docs/SECURITY_AND_PRIVACY.md`.
