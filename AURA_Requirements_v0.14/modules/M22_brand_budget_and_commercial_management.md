# M22 — Brand Budget and Commercial Management

Status: **73/73 business decisions explicitly approved on 27 November 2026; no exceptions.**

Source: approved decision questionnaire in the current conversation. Wording below is a faithful condensed transcription; identifiers follow approved decision numbers. Implementation details remain proposed.

## Financial management foundation

- **M22-F01** — External settlement only: AURA tracks financial activity without holding funds.
- **M22-F02** — Target individual businesses, startups, small businesses, D2C Brands and enterprise marketing teams.
- **M22-F03** — Cover Creator marketing, UGC, owned content, Agency services and related marketing expenditure.
- **M22-F04** — Provide a dedicated financial management section in Brand Studio.
- **M22-F05** — Default INR with international currencies supported.
- **M22-F06** — Support monthly, quarterly, annual and custom reporting periods.
- **M22-F07** — Configurable financial year; April–March default for Indian businesses.
- **M22-F08** — Shared commercial obligation records between M13 and M22; independent private financial records.

## Marketing budget management

- **M22-F09** — Support annual, quarterly, monthly and campaign-specific budgets.
- **M22-F10** — Allow multiple independently managed budgets within one Brand workspace.
- **M22-F11** — Categories: Creator marketing, UGC, advertising, content production, Agency fees, events, affiliate and custom categories.
- **M22-F12** — Allocate campaign budgets from an existing marketing budget or establish standalone campaign budgets.
- **M22-F13** — Support parent budgets and campaign-level allocations without double-counting.
- **M22-F14** — Allow authorized revisions with reasons and historical versions.
- **M22-F15** — Allow authorized reallocation between categories or campaigns.
- **M22-F16** — Optional approval workflow for smaller businesses; configurable approval for larger teams.
- **M22-F17** — Warn on overspending and require authorized exception approval where applicable.
- **M22-F18** — Allow authorized carry-forward or release of unused allocations.
- **M22-F19** — Restrict internal budgets to authorized Brand users; never automatically disclose to Creators.

## Budget utilization and commitments

- **M22-F20** — Separately track allocated, reserved, committed, spent and available amounts.
- **M22-F21** — Reserve an estimated amount when a Creator is shortlisted for a binding selection process.
- **M22-F22** — Release unused reservations on applicable expiry or cancellation.
- **M22-F23** — Convert reservations to actual commitments when the commercial agreement becomes binding.
- **M22-F24** — Update commitments only through authorized agreement amendments.
- **M22-F25** — Record actual external expenditure against applicable commitments.
- **M22-F26** — Deduct expenditure, outstanding commitments and active reservations without double-counting.
- **M22-F27** — Release remaining cancelled commitments only after accounting for cancellation charges and outstanding obligations.
- **M22-F28** — Configurable utilization, overspending and insufficient-budget alerts.

## Creator compensation

- **M22-F29** — Support fixed fee, milestone-based, deliverable-based, recurring, performance-based and hybrid compensation.
- **M22-F30** — Support configurable advance payment obligations.
- **M22-F31** — Allow multiple external payments against one obligation.
- **M22-F32** — Support separate or consolidated compensation obligations for multiple deliverables.
- **M22-F33** — Support recurring obligations for ambassadors, retainers and long-term partnerships.
- **M22-F34** — Record agreed conditional incentives with supported evidence and applicable confirmations.
- **M22-F35** — Additional scope compensation requires an authorized commercial amendment.
- **M22-F36** — Track approved travel, production, accommodation and other reimbursables separately.
- **M22-F37** — Track barter products, services and benefits separately from cash expenditure.
- **M22-F38** — Manual affiliate commission tracking initially; automated attribution after readiness.
- **M22-F39** — Track payment obligations, due dates, overdue amounts and remaining balances.

## Invoices and taxation

- **M22-F40** — Allow Brands to receive and review Creator invoices linked to commercial obligations.
- **M22-F41** — Allow upload and recording of externally generated invoices.
- **M22-F42** — Validate required fields, linked obligations and duplicate invoice references.
- **M22-F43** — Configurable invoice approval, rejection and correction requests.
- **M22-F44** — Support credit notes, debit notes and authorized adjustments with version history.
- **M22-F45** — Support applicable GST information and configurable tax components without automatically determining liability.
- **M22-F46** — Track applicable TDS deductions and supporting information as entered or confirmed by authorized users.
- **M22-F47** — Restricted storage of relevant tax and supporting financial documents.
- **M22-F48** — Configurable international tax fields without claiming automated jurisdiction-specific compliance.

## External payments and reconciliation

- **M22-F49** — No direct payment processing or fund custody in initial release.
- **M22-F50** — Allow Brands to record payments completed through existing financial systems.
- **M22-F51** — Optional securely stored, appropriately redacted payment references or evidence.
- **M22-F52** — Creators independently acknowledge received payments through M13.
- **M22-F53** — Distinguish Brand-reported payments from Creator-confirmed receipts.
- **M22-F54** — Allocate one payment across multiple applicable obligations without duplicate accounting.
- **M22-F55** — Identify differences in reported amount, date, deduction or settlement status.
- **M22-F56** — Link discrepancies to M12 commercial dispute workflow.
- **M22-F57** — Use authorized reversals, adjustments and correction records rather than silently deleting transaction history.
- **M22-F58** — Configurable upcoming, overdue and reconciliation reminders.

## Financial intelligence and AI

- **M22-F59** — Dashboard displays budget utilization, commitments, expenditure, outstanding payments and upcoming obligations.
- **M22-F60** — Compare approved budgets against actual recorded campaign expenditure.
- **M22-F61** — Calculate cost per view, engagement, acquisition or conversion only with reliable data.
- **M22-F62** — Calculate ROI and ROAS only with appropriate revenue attribution, cost information and disclosed limitations.
- **M22-F63** — Forecast expected expenditure and obligations using known commitments and transparent assumptions.
- **M22-F64** — AI recommends allocation and optimization using authorized financial and performance data.
- **M22-F65** — AI identifies potential overspending, unusual expenditure, overdue payments and reconciliation issues without unsupported fraud accusations.
- **M22-F66** — AI may analyze, recommend and draft; cannot independently approve budgets, amend obligations or initiate payments.

## Reports, permissions and monetization

- **M22-F67** — Reports cover budget utilization, campaign expenditure, Creator payments, outstanding obligations, tax information and reconciliation.
- **M22-F68** — PDF and CSV initially; future accounting software integrations.
- **M22-F69** — Separate permissions for viewing, creating, approving, editing, reconciling and exporting financial records.
- **M22-F70** — Agency financial access only through explicit delegation; Agency service fees separate from client marketing expenditure.
- **M22-F71** — Preserve material financial changes, approvals, corrections, actor attribution and timestamps.
- **M22-F72** — Core financial tracking free initially; advanced forecasting, reporting and accounting integrations potentially premium under M27.
- **M22-F73** — Evaluate regulated payment providers, escrow, cross-border payments and accounting integrations after product validation and applicable compliance review.

## Budget control rule

Available = approved budget − recorded expenditure − outstanding commitments − active reservations. These buckets must be mutually exclusive. A reservation converted to a commitment is not counted twice; a payment reduces the corresponding outstanding commitment. Parent and child allocations must not be double-counted.

## User journey

Approve budget → allocate → reserve at applicable selection → convert to binding commitment through M12 → record invoice and external expenditure → independently reconcile M13 receipt → report and adjust.

## Proposed logical data entities

Budget, budget version, allocation, transfer, reservation, obligation reference, expenditure, payment allocation, invoice, adjustment, reimbursement, reconciliation case, forecast, report, audit event. Reuse M12/M13 shared obligations; no duplicate financial ledger for shared obligations.

## Proposed screen inventory

Brand Finance overview; budgets; allocations; reservations and commitments; obligations; invoices; external payments; reconciliation; reimbursements; non-cash register; forecasts; reports; permission and notification settings.

## Proposed acceptance checks

- Concurrent reservations and commitments cannot bypass applicable budget controls.
- Reservation conversion and settlement never double-count the same amount.
- Cancellation preserves outstanding obligations and approved charges.
- Brand-reported payments and Creator-confirmed receipts remain distinguishable.
- Unauthorized users cannot retrieve internal budgets, evidence or reports.
- Agency revenue is isolated from client expenditure.
- AI cannot approve budgets, bind obligations or initiate payments.
- Corrections preserve audit history; exports revalidate permissions.

## Outstanding implementation decisions

M25 notifications; M26 approval hierarchy and permissions; M27 premium entitlements; M28–M29 dispute escalation; M30 financial evidence retention; jurisdiction-specific tax/accounting validation; future payment-provider selection. No payment custody or processing in initial release.
