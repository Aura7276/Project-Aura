# M20 — Brand AI Growth Assistant

Status: **partial reconstruction for owner reconciliation; not a complete approved specification.**

Historical tracker: 60 functional requirements approved/reported. Exact original numbered list not recovered; the entries below are not a replacement for those IDs.

## Scope
Unified Brand marketing assistant grounded in authorized workspace context.

## Recovered requirements and established cross-module constraints
- Support business-specific marketing strategy, owned social growth and Creator-led marketing recommendations.
- Use editable M14 Brand intelligence, objectives, products, customer segments and resource constraints.
- Support editable 7-, 30- and 90-day plans and contextual assistance.
- Distinguish confirmed business facts from AI-generated hypotheses; expose source, uncertainty and data gaps.
- Provide content and campaign recommendations, drafts and supported performance analysis.
- AI may analyze, recommend and draft; users explicitly approve permitted record changes and commercial communication.
- No autonomous commercial commitments, payments or permissions changes.
- Keep private Brand strategy and conversations isolated by workspace; no private model training by default.
- Reuse M07 provider-independent infrastructure and preserve manual work and drafts on outages.

## Proposed screen inventory (not original approved screen IDs)
Brand AI workspace; contextual assistant; strategy and growth plans; conversation history; intelligence profile; draft review; action confirmation; usage and settings.

## Proposed acceptance checks (not original approved AC IDs)
- Unauthorized Brand context cannot be retrieved by the assistant.
- Draft actions require explicit confirmation and current backend authorization.
- Unverified Brands cannot bypass commercial gates using AI.
- Provider outage preserves manual workflows and drafts.

## Dependencies
M07, M14, M15, M17, M19, M21, M22, M27, M30. Reuse existing M01–M14 authentication, RLS, data provenance and workspace contracts.

## Outstanding reconciliation
Recover the exact historical decision list before assigning M20-F identifiers or declaring full module acceptance. Screen routes, schema, detailed transitions, retention and any unrecovered business policies require source confirmation. Do not infer approval of missing requirements.
