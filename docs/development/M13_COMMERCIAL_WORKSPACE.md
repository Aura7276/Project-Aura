# M13 earnings and commercial workspace

Status — In progress. Build-only implementation on 27 November 2026. No tests, lint, type checking, build, browser inspection or hosted migration execution were performed under the owner's continuing build-only instruction.

## Preview and entry points

Development preview at http://127.0.0.1:3101/dev/earnings. This route requires development mode, uses explicitly fictional records and keeps changes in page memory. The preview URL was not opened or verified during this task.

Creator routes are /creator/earnings and /creator/invoices. Shared external payment reports are at /collaborations/[id]/payments, linked from the M12 workspace. The existing dev command is pnpm dev --port 3101.

## Implemented source

The interface includes a cash-receipt overview, income ledger, due and overdue balances, payments, allocations, expense records, production time, invoices, goals, barter, commissions, forecasts and an activity record. Currency and reporting-period selectors support monthly, quarterly, annual, April–March financial-year, all-date and custom views. Outstanding overview balances explicitly cover all dates; recorded receipts and expenses follow the selected period.

Private external income records include client/platform, agreed terms, amount, original currency and due date. Multiple receipts can be partially allocated to multiple same-currency obligations. Credits, deductions, withholding and increases require a recorded basis. Receipt reversals restore allocated balances and preserve the original record. Expense corrections retain the original as voided.

Invoices reference obligations and never add another liability. Draft edits retain versions. Issuing protects the snapshot and number. Duplicate issued numbers and concurrently issued invoices for the same obligation are rejected. Cancellation preserves the invoice and leaves the obligation unchanged. Exports are HTML documents that can be opened and printed to PDF in a browser. Tax-specific invoices and credit-note documents remain pending.

Shared M12 payment reports retain the reporting side, actual payment date, reference, evidence and note. The other authorized party can confirm or dispute. A Creator can explicitly import a confirmed report into the private ledger once, then allocate it. Reversal of a shared report requires both parties. A confirmed reversal also reverses the matching imported receipt and records an audit event without modifying unrelated private records. Shared reports are not independently added to cash totals.

The Creator dashboard now reads the real authorized M13 ledger. It reports unavailable on backend failure and an empty state when there are no income/payment records. Mixed-currency ledgers are not summed.

## Data and security

Migration 20261206000100_m13_commercial_workspace.sql adds private ledger, audit, shared payment report and shared report audit tables. Direct table access is revoked; RLS defaults to denial. RPCs enforce existing Creator ownership or M12 participant access, verified identity and required MFA. Shared writes require a workspace manager. Brand access never reads private expenses or ledger data.

Server actions validate commands with Zod. Monetary values cross application boundaries as decimal strings. SQL numeric and client BigInt arithmetic preserve exact amounts. No foreign-exchange conversion or automatic tax calculation is implemented.

Technical input bounds allow up to 12 whole digits and 6 fractional digits and reject excess precision instead of rounding. These are engineering limits, not approved currency-specific precision or accounting policy. Currency-specific validation and rounding policy remain open.

Writes serialize per Creator workspace, enforce an expected revision and use idempotent request IDs. Allocation validation checks currencies, available balances, aggregate repeated obligation allocations and receipt budget. Payment references are checked when present. Real-world duplicates without a reference still require reconciliation.

Exports escape spreadsheet formula prefixes and quote CSV fields. Invoice HTML escapes user-entered content. Download scope is visible in the interface. Evidence URLs are recorded without server-side fetching. Redaction and access at the linked provider remain the user's responsibility.

## Remaining integration and policy work

- Hosted migration application and all validation are pending.
- M12 compensation is currently agreement text. Automatic creation of obligations from accepted structured proposal terms and amendments requires M11/M12 integration. This implementation does not infer amounts from legal text.
- Tax/GST/TDS validation, statutory invoice requirements, credit-note workflows, configurable invoice templates and external invoice uploads remain pending.
- Direct evidence uploads require approved size limits, private storage, scanning and retention.
- Reimbursement agreement/submission/approval workflows, automatic recurring obligations and scheduled reminders are pending.
- Shared payment confirmation is implemented for authorized Creator/Brand participants; evidence-reviewed classification and delegated Agency workflows remain pending.
- Barter and commission registers are separate from cash. A settled commission entry does not create a receipt automatically. Affiliate attribution remains external/manual.
- Income targets and uncertain forecasts are editable/manual. Advanced pricing AI, risk analysis, commercial AI summaries and automated notifications are pending.
- There is no exchange-rate provider or cross-currency aggregation. Foreign-exchange source, precision, rounding and accounting definitions require owner decisions.
- Accountant export presently covers selected ledger columns only. Controlled accountant access and custom export-purpose profiles remain pending.
- Payment processing, escrow, cross-border settlement, transaction fees and financial products remain future scope.

## Delivery record

Work is on feature/m13-commercial-workspace, carrying forward the uncommitted M12 implementation without discarding it. No commit or push was requested for this stage. No packages were added. No visual assets were generated or sourced. Production records are never seeded by the development fixture.

Requirements are tracked individually in REQUIREMENTS_TRACEABILITY.md. The implementation is untested and is not represented as a completed or accepted M13 release.
