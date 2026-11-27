# Campaign monitoring and reporting (M19)

One roll-up per campaign, built in the database (`aura_monitor.rollup`), keeps delivery, performance and money apart.

## Sources

- **Delivery**: the M12 collaboration document of every collaboration the M18 hand-off opened for the campaign (deliverables, stages, submissions, reviews, publication date and link, disputes, completion).
- **Performance**: `aura_monitor.observation`, append-only, one reading per deliverable, metric and read date; cumulative ("since publication") or a dated window; with source, note and the side that entered it. Corrections are voids with a reason.
- **Money**: the agreed amount from the confirmed M11 proposal and M13 payment reports, labelled as recorded by the parties.

## Counting rules

Totals take only the latest cumulative reading per deliverable and metric (the M06 rule), so repeated readings never inflate a figure; windows are shown but never added; reach is labelled as not unique people; there is no campaign score. Coverage (deliverables with results / published deliverables) is shown with every total.

## Sharing and reports

Figures a Creator entered appear in the Brand's views and reports while the Creator shares them (`consent`, default shared). Reports are versioned snapshots (`report`, per name); each records which collaborations contributed Creator-entered figures. Opening or exporting re-checks sharing every time and logs the attempt (`report_access`); if a Creator stopped sharing, the old version is refused and a new version (without those figures) can be created.

## Screens

Campaign tabs **Monitor** (`/brand/campaigns/[id]/monitor`: KPIs, needs attention, performance, payments, delivery, record a result, recorded results) and **Reports** (`/reports`, `/reports/[rid]`, `/reports/[rid]/download?format=csv|pdf`). Creators record and review their own results, and choose whether to share them, on `/creator/negotiations/[id]#results`.
