# M19 — Campaign Monitoring and Reporting

Status: **partial reconstruction for owner reconciliation; not a complete approved specification.**

Historical tracker: 60 functional requirements approved/reported. Exact original numbered list not recovered; the entries below are not a replacement for those IDs.

## Scope
Track campaign execution and supported outcomes with permissioned, provenance-labelled reporting.

## Recovered requirements and established cross-module constraints
- Use actual M12 collaboration, deliverable, submission, revision, approval and publication evidence.
- Keep operational fulfilment, marketing performance and financial settlement independent.
- Support manual reporting when social APIs are unavailable; label observation source, date, coverage and measurement window.
- Avoid summing repeated cumulative observations or incompatible metrics.
- Do not claim deduplicated unique reach without evidence or calculate a universal campaign success score.
- Report meaningful supported outcomes, exceptions, missing evidence and limitations.
- Use permissioned, versioned reports; restrict other participants' private records.
- Link commercial reporting to authorized M22 financial information and M13/M12 obligations where relevant.

## Proposed screen inventory (not original approved screen IDs)
Campaign monitoring overview; collaboration progress; deliverable status; evidence and observations; performance breakdown; exceptions; report builder; report history.

## Proposed acceptance checks (not original approved AC IDs)
- Delivery completion does not imply payment or campaign success.
- Reports preserve source, dates and metric definitions.
- Duplicate cumulative observations cannot inflate totals.
- Revoked permissions prevent new report retrieval or export.

## Dependencies
M05, M06, M12, M13, M17, M18, M22, M25. Reuse existing M01–M14 authentication, RLS, data provenance and workspace contracts.

## Outstanding reconciliation
Recover the exact historical decision list before assigning M19-F identifiers or declaring full module acceptance. Screen routes, schema, detailed transitions, retention and any unrecovered business policies require source confirmation. Do not infer approval of missing requirements.
