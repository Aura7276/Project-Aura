# Security and privacy requirements / proposed controls

## Identity and authorization
Real authentication; email/password and Google; 18+; mandatory MFA for platform admins, Brand/Agency owners, Brand admins and designated high-privilege commercial roles; optional Creator MFA. Mobile verification conditional, exact triggers TBD. Server-side authorization for every operation; deny by default. Workspace membership, role, verification, onboarding, delegated scope and resource relationship evaluated independently. Admin separately provisioned. No client service-role keys.

## Tenant boundaries
Creator private growth data, AI conversations, earnings, assets and drafts never exposed to Brands by default. Brand budgets, legal verification, AI strategy and internal notes restricted. Shared collaboration access limited to participating authorized parties and designated assets; no access to other campaign participants' private records. Public projection allowlists, restricted link expiry and revocation, no search/index leaks. Agency access only explicit delegation (M23 pending).

## Database and storage
Proposed defense-in-depth: RLS on all exposed tenant tables; separate scoped public views/functions; no bypass with untrusted security-definer functions. Validate ownership on writes, storage object metadata and signed URLs. Short-lived access URLs; restrict evidence downloads; malware scanning, MIME/signature validation, size limits, quarantine and safe rendering. Append-only audit history at application level, restricted administrative access and tamper-evidence evaluation. Mask secrets and financial identifiers in logs. No banking/social credentials collected.

## Application controls
Schema validation, output encoding, parameterized queries, CSRF/session controls, rate limiting, abuse reporting, secure headers, dependency and secret scans. URL import SSRF defenses. Concurrency/idempotency for capacity, agreement activation, receipts, invitations and jobs. No automatic commercial decision by AI. AI tool authorization on every action; untrusted retrieved content cannot override policy. Redact sensitive material from email summaries and notifications.

## Privacy operations
Collect minimum required information; explicit publishing, item/account visibility and purpose-specific grants. Revocation propagates to hosted media, discovery/search/cache and future processing. External copies cannot be recalled. Source/freshness labels for metrics. No private model training by default. Deletion/retention policy, legal holds, export and rights-request workflows need validation under M29/M30 and applicable law. Protect dispute/financial evidence from unauthorized deletion without indefinite blanket retention.

## Security testing
Anonymous, wrong tenant, wrong role, revoked membership, unverified business, expired grant, missing MFA, stale record, duplicate request and concurrent transitions tested on backend and direct database/storage interfaces. Run dependency scans, secrets scans, abuse tests and backup restore. No production personal data in tests. Incident response: triage, contain, preserve evidence, assess notification obligations, recover, review. Regulatory/legal requirements not represented as validated by this document.
