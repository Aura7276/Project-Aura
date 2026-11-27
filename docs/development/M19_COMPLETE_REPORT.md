# M19 complete report: Campaign monitoring and reporting

Branch `feature/m19-monitoring`, built on `main` (M01–M18). Built from the reconstructed module file, so M19-F numbers are not assigned. The recovered scope and the decisions waiting for the owner are in the traceability matrix and the decision register.

## Delivered

- **Migration** `20261211000100_m19_monitoring.sql`: schema `aura_monitor` (settings with metric definitions and the 30-day stale rule, append-only results with void, sharing consent, versioned reports, report access log) and 10 public functions. One roll-up reads the M12 collaboration workspaces (through the M18 hand-off), the M11 agreed terms and the M13 payment records.
- **Monitor tab** on every campaign: deliverables published, overdue, results coverage, items needing attention and payments confirmed, each kept apart. Delivery from M12, results entered by hand with source, date and who entered them, payments from M13. Delivery never counts as success or payment.
- **Results recording on both sides**: the Brand and the Creator can record a result for any published deliverable (metric, value, cumulative or a set period, read-on date, source). Entries are never edited, only voided with a reason, so the history stays complete. Totals use the latest cumulative reading per deliverable and metric. Reach is labelled as not unique people.
- **Needs attention**: overdue deliverables, two or more revision rounds, disputes, published work with no results, results older than 30 days, and agreements still pending.
- **Creator side**: a results panel on the negotiation page. The Creator chooses whether the Brand can see results the Creator recorded, and can change that choice later.
- **Reports**: named and versioned (the same name gets the next version), with chosen sections (delivery, performance, payments, exceptions) and a period. Each report is a frozen snapshot, records which Creators' data it holds, and logs every view and refused view. CSV and PDF downloads are built from the snapshot.

## Verification

Local PostgreSQL 16 with auth and storage stubs (not live Supabase). These all pass: Prettier, typecheck, ESLint (0 errors, 3 existing warnings), Vitest (28 files, 322 tests), the browser suite (137 tests), the production build, and `pnpm audit --prod` (no known vulnerabilities).

Stack suite: 32 passed, 1 failed and 5 did not run, because the files run in order and stop after a failure. The failure was the M04 test "daily actions persist across reloads" in `studio.spec.ts`. Re-run on its own, that file passed 11 of 11, including the 5 that had not run. It is a timing flake under full-suite load, not an M19 regression.

M19 adds:
- 6 SQL scenario groups.
- Database tests: earlier suites re-run, grant checks, and a race where three parallel reports with the same name get versions 1, 2 and 3.
- Domain tests.
- A stack test (`monitor.spec.ts`) covering publishing a deliverable, recording results on both sides, consent, reports and downloads, accessibility and overflow. Screenshots are in `evidence/m19`.

## Not built

- The original requirements that were not recovered.
- Automatic metric import from social platforms (needs approved provider connections).
- Scheduled report delivery.
- Benchmarks across campaigns.
- Attribution or conversion tracking beyond figures people record.
- Approved M12 agreement templates.
