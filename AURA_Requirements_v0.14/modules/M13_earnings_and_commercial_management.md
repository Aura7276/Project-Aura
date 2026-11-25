# M13 — Earnings and commercial management

Status: business requirements approved; implementation details proposed.

## Functional requirements

- **M13-F01** Private external income alongside AURA collaborations.
- **M13-F02** Commercial management/reconciliation without holding or processing funds.
- **M13-F03** Separate agreed, due, outstanding, received and disputed amounts.
- **M13-F04** INR default, original currencies preserved, optional sourced conversions.
- **M13-F05** Monthly, quarterly, annual, financial-year and custom periods.
- **M13-F06** Advance, partial, milestone, deliverable, final, recurring and performance-linked payments.
- **M13-F07** Obligations from accepted terms/amendments with controlled adjustments.
- **M13-F08** Multiple receipts allocated against eligible obligations.
- **M13-F09** Due dates, outstanding balances and configurable overdue reminders.
- **M13-F10** Separate deductions, withholding, credits and authorized adjustments with provenance.
- **M13-F11** Both authorized parties record external payments with reporting-party labels.
- **M13-F12** Counterparty confirmation, self-reported versus mutually confirmed states.
- **M13-F13** Optional restricted redacted evidence and references.
- **M13-F14** Structured reconciliation, response, corrections and M12 disputes.
- **M13-F15** Controlled corrections/reversals and audit history; unsubmitted drafts editable.
- **M13-F16** Optional payment method/reference; no banking credentials.
- **M13-F17** Editable invoices from obligations and authorized billing details.
- **M13-F18** External invoice uploads linked to obligations.
- **M13-F19** Invoices for private external clients.
- **M13-F20** Configurable numbering, templates, Creator branding and billing information.
- **M13-F21** Validated configurable GST/TDS and other fields; no automatic tax liability determination.
- **M13-F22** Controlled issued invoice cancellation and credit-note workflows.
- **M13-F23** Private collaboration/general business expenses and categories.
- **M13-F24** Optional estimated and actual production time.
- **M13-F25** Profitability insights with agreed value, receipts, expenses and hourly contribution limitations.
- **M13-F26** Separate reimbursement agreement/submission/approval/outstanding/receipt states.
- **M13-F27** Private expense/profitability; designated reimbursable expenses only shared.
- **M13-F28** Separate non-cash barter register with optional declared value/status/evidence.
- **M13-F29** Manual or authorized affiliate commissions initially; future attribution integration.
- **M13-F30** Pending, confirmed, reversed, disputed and settled commission states.
- **M13-F31** Recurring ambassador obligations, milestones, renewals and amendments.
- **M13-F32** Private categorized freelance/platform income.
- **M13-F33** Editable monthly, quarterly and annual income targets.
- **M13-F34** Scheduled contractual receipts separate from uncertain forecasts.
- **M13-F35** AI pricing guidance from authorized history, effort, cost and terms.
- **M13-F36** Private evidence-based concentration and payment-risk insights.
- **M13-F37** Optional monthly commercial AI summaries.
- **M13-F38** No autonomous financial transactions or binding decisions; approved non-transactional updates only.
- **M13-F39** Configurable reminders and approved editable payment follow-up messages.
- **M13-F40** PDF summaries, CSV exports and authorized invoices.
- **M13-F41** Purpose-specific accountant exports; controlled future access.
- **M13-F42** Notifications identify responsible party, due date, dependency and action.
- **M13-F43** Future authorized payment providers after manual release.
- **M13-F44** Future protected settlement/escrow evaluation through authorized providers.
- **M13-F45** Future cross-border settlement subject to validation.
- **M13-F46** Future transparent transaction model M27; no payment-processing commission in manual release.
- **M13-F47** Core ledger, tracking and basic invoices free; advanced intelligence potentially premium.
- **M13-F48** Future financial products through authorized partners only after demand and regulatory validation.

## User journey
Agreement/external income → obligations → invoice → payment report → confirm/reconcile/allocate → track expenses → analyze goals; discrepancies M12.

## Logical data entities
Obligation, schedule, receipt, confirmation, allocation, adjustment/reversal, evidence, reconciliation case, external income/client, invoice/version, credit note, expense, time, reimbursement, barter benefit, commission, recurring schedule, FX observation, target, report, audit.

## Proposed screen inventory
`/creator/earnings`, `/ledger`, `/ledger/[id]`, `/income/new`, `/clients`, `/payments`, `/payments/[id]`, `/reconciliation`, `/outstanding`, `/expenses`, `/expenses/new`, `/time`, `/reimbursements`, `/barter`, `/affiliate`, `/recurring`, `/goals`, `/profitability`, `/insights`, `/forecast`, `/reports`, `/settings`, `/billing` (earnings-relative); `/creator/invoices`, `/new`, `/[id]`, `/[id]/edit`, `/templates` (invoice-relative); payment/evidence/confirmation/correction panels.

## Business rules and security
Use exact monetary precision and original currencies. Outstanding = adjusted eligible obligation less allocated receipts and valid credits; refunds/reversals adjust allocations. Overdue/disputed flags independent. Never count invoice as duplicate obligation. Separate barter, contingent commission, reimbursements and cash. No wallet, bank verification claim or payment commission.

## Acceptance and negative tests
- M13-AC01: Partial allocations and reversals reconcile accurately under concurrency.
- M13-AC02: Duplicate payment reports do not double count receipts.
- M13-AC03: Self-reported, mutually confirmed and evidence-reviewed distinct.
- M13-AC04: Invoice generation does not duplicate liability; issued version protected.
- M13-AC05: Barter excluded from cash; forecasts not guaranteed.
- M13-AC06: Cross-currency totals require rate/source/date.
- M13-AC07: Private expenses/financial data inaccessible to unrelated Brand.
- M13-AC08: Exports enforce permissions; AI cannot transact or send unapproved follow-ups.

## Outstanding decisions / dependencies
Tax/invoice validation, precision and rounding, FX provider, retention, accounting definitions and future payment providers pending.
