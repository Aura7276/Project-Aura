# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Data model — core entities
Auth user (provider-managed) -> user_profiles; workspaces(type CREATOR/BRAND/AGENCY); workspace_memberships(role, status); invitations(token hash, expiry); agency_client_delegations(scoped rights); creator_profiles(publication state, slug, niche, location, language, unverified Instagram handle); creator_portfolio_items(file refs, ownership); creator_preferences; brand_profiles; brand_verification_requests and documents; agency_profiles; campaigns(workspace, type, status, brief, budget bounds, dates); campaign_requirements; campaign_applications(unique campaign+creator workspace); shortlists and shortlist_entries; campaign_invitations; collaborations; deliverables and revisions; creator_growth_experiments and manual observations; notifications; moderation_reports; audit_events; storage_objects metadata; user_privacy_requests.

## Invariants
- Every tenant-owned table carries workspace_id or a rigorously checked parent relation.
- Membership unique by user+workspace; a creator workspace can have one canonical creator profile.
- Profile public slug unique; private profile data never included in public search.
- A campaign belongs to a Brand workspace (or delegated Agency acting on Brand's behalf).
- Application belongs to creator workspace; creator may not apply to own campaign if same account also owns brand unless explicitly approved by policy (default block self-dealing).
- File ownership and object key always linked to authorized workspace and record.
- Verification decisions require admin actor and reason; no automatic approval.
- Audit events immutable to ordinary users; database retention governed by policy.

## Migrations
Use Supabase CLI migrations in `supabase/migrations`; SQL in `database/REFERENCE_SCHEMA.sql` is an illustrative minimum only. Codex must produce complete constraints, indexes, foreign keys, RLS policies, storage policies and migration tests for every entity.
