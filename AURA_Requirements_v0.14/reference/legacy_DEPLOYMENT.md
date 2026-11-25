# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Deployment and release
- Environments: dev, staging, production; independent Supabase projects or isolated equivalent; distinct secrets and redirect URLs.
- CI: lint/typecheck/unit/integration/build/E2E against staging; migration checks; dependency and secret scans.
- Hosting: deploy Next.js via selected platform; set server-only keys in encrypted environment settings; configure auth redirect allowlist, custom domain, HTTPS, CSP and security headers.
- Email: configure sender domain, SPF/DKIM/DMARC, production SMTP and deliverability checks. Provider sandbox mode is not production email.
- Storage: private buckets, signed URLs, upload policies and lifecycle rules.
- Database: migration plan, backup/restore, monitoring, connection limits, indexes, RLS review.
- Launch: privacy/terms, support contacts, admin provisioning, abuse reporting, moderation process, incident response, test real user journeys, verify no mock/test fixtures in prod.
- Deferred Meta and payment integration must be documented in product UI without fake connectivity or fabricated statuses.
