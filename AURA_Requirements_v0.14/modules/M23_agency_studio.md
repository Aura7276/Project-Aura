# M23 — Agency Studio

Status: **partial reconstruction for owner reconciliation; not a complete approved specification.**

Historical tracker: 71 functional requirements approved/reported. Exact original numbered list not recovered; the entries below are not a replacement for those IDs.

## Scope
Independent Agency workspace managing authorized Creator and Brand client relationships.

## Recovered requirements and established cross-module constraints
- Agency workspace is independent; clients retain ownership of their own workspaces and data.
- Support Agency onboarding and verification with mandatory MFA for owners and administrators.
- Client access requires explicit granular delegation, with scope, expiry and revocation; effective permissions cannot exceed client authorization.
- Agency staff access requires authorized client assignment and appropriate internal role.
- Record actual actor and represented party for material actions.
- Agency internal approval and client approval are independent; contracting authority must be explicit.
- Support Creator roster, Brand client portfolio, delegated campaign, collaboration and content operations, reporting and AI assistance.
- Agency fees, commissions and retainers remain distinct from client marketing expenditure; external settlement only.
- Dual representation requires disclosure and independent conflict safeguards.
- AI context and outputs must be isolated by client and Agency authorization; manual workflows continue during outages.
- Offboarding revokes access while preserving applicable agreements, obligations and audit records.

## Proposed screen inventory (not original approved screen IDs)
Onboarding and verification; dashboard; client relationships; delegation and permissions; Creator roster; Brand portfolio; campaign and collaboration operations; content and approvals; commercial overview, fees, commissions, retainers, invoices, expenses and forecasts; reports; AI; team and assignments; conflicts; offboarding; activity; settings and subscription.

## Proposed acceptance checks (not original approved AC IDs)
- Effective permissions cannot exceed client authorization, including direct API/database access.
- Client approval is not implied by Agency internal approval.
- Agency revenue is distinct from client spend.
- Dual representation requires disclosure and conflict safeguards.
- No cross-client data or AI leakage; revoked access fails closed.
- Manual workflows remain available during AI outages.

## Dependencies
M02, M05, M07–M22, M24–M30. Reuse existing M01–M14 authentication, RLS, data provenance and workspace contracts.

## Outstanding reconciliation
Recover the exact historical decision list before assigning M23-F identifiers or declaring full module acceptance. Screen routes, schema, detailed transitions, retention and any unrecovered business policies require source confirmation. Do not infer approval of missing requirements.
