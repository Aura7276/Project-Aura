# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Decisions, credentials and prerequisites
## Approved
- Product: creator-first growth and collaboration platform serving creators, brands, agencies, and admins.
- Brand: `Project AURA` temporary; all copy/logo references configurable.
- Design: Creative Premium Theme A; editorial + product homepage; premium interactions.
- Product: real app, no filler; Instagram/Meta integrations and payment integration deferred.
- Identity: one person can have multiple workspaces; creator/brand/agency separately onboarded; workspace RBAC.
- Direct creator-brand payment is outside app; app may record **unverified, self-reported** settlement notes but must not state verified paid.

## Proposed implementation defaults (change in config before coding if desired)
- Next.js App Router, TypeScript, Tailwind, shadcn/ui, Motion, React Hook Form + Zod.
- Supabase Auth (email/password, verification and password recovery), Supabase PostgreSQL, Supabase Storage, Supabase RLS. Server authorization remains mandatory. Supabase is a proposed choice, not a confirmed connected account.
- Hosted Next.js deployment on Vercel or equivalent; email delivery via properly configured Supabase Auth SMTP provider and an application transactional email provider if required.
- Database migrations tracked in repo. Background jobs only where necessary, with idempotency and retry design.

## User-owned setup required
- Create Supabase project and set site URL, allowed redirect URLs, production SMTP, email templates, abuse protections.
- Create hosting project and configure environment variables separately per environment.
- Configure storage buckets and file size/MIME limits, private objects, signed downloads.
- Configure DNS, domain, privacy notice, terms, retention policy, support and grievance contact.
- Decide whether the agency may manage brand campaigns directly, and whether creator identity verification is required. Defaults: agency must be explicitly delegated; creator identity verification is not mandatory for profile creation, but trust badge requires review.
- Select supported geography and age/eligibility rules; do not assert regulatory compliance automatically.

## Deferred integration contracts
- Instagram handle is manually entered, unverified, and never presented as API connected. Reserve provider connection table and status `NOT_CONNECTED` for future Meta OAuth.
- Payment provider integration deferred; never expose a 'Pay now' action. Collaboration contract may record compensation terms, but no platform-held funds or automated paid state.
