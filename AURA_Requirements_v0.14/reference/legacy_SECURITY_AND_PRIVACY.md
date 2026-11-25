# Historical reference — superseded where conflicting

Do not execute as current instructions. V0.14 approved module documents take precedence. This is retained for traceability, not implementation evidence.

# Security and privacy baseline
- Authentication: provider-managed secure password hashing, verified email, reset tokens with expiry, secure session cookies, sign-out/revocation, anti-enumeration and throttling. Enable MFA for platform admins where supported.
- Authorization: server-side permission checks on every read/write, RLS as defense in depth, cross-workspace negative tests, private storage policy, least-privilege service accounts.
- Input: Zod validation, output escaping, parameterized DB access, upload MIME/magic-byte validation, size limits, signed URL expiry, malware scanning strategy before public launch.
- Web: CSRF-safe auth/session flows, CSP and security headers, secure redirect allowlists, XSS prevention, rate limiting, account abuse detection, dependency scanning.
- Privacy: data minimization, privacy notice, user consent/acknowledgement where legally needed, purpose limitation, access/delete/export requests, retention, audit records, restricted verification documents, never scrape Instagram or imply API verified.
- Admin: no self-service platform admin signup; secure provisioned role, audited impersonation prohibited by default, verification decisions logged with reason.
- Operations: secrets in provider vault, no `.env` in git, backup and tested restore, separate staging/prod, error monitoring, incident contacts, log redaction, secure email domain configuration (SPF/DKIM/DMARC).
- Release gate: threat model, permission matrix tests, dependency scan, secrets scan, abuse review, backup restore test, privacy/legal review and production monitoring. Security claims are not certifications.
