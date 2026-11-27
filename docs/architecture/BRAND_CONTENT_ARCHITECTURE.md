# Brand content architecture (M21)

**Storage**: private schema `aura_brand_content` (RLS on, no policies, no grants) with `pillar`, `item`, `revision` (every saved version), `review` (submissions, approvals, change requests, reopenings), `asset` (https links with provenance), `result` (append-only readings with void) and `setting`. Public SECURITY DEFINER functions with `search_path=''`, executable by `authenticated` only; every one starts with `aura_market.brand(workspace, write)` (Brand owner/admin, MFA for writes).

**Flow**: `create` → `save` (optimistic version check; after approval a save returns the item to review) → `move` (working stages, scheduling, archive) → `review` (approve version N or request changes) → `check` (publication checklist) → `publish` (manual, approved version only). Results: `record` / `void`; `learning` uses the latest reading per post and metric.

**Connections in one product**

- M14: Brand social accounts are the publishing targets; products' approved claims drive the claims check; customer groups keep their hypothesis/confirmed basis; guidelines' disclosure text appears in the editor; Brand home shows content status.
- M11/M12/M18/M19: `aura_brand_content.deliverables` reads published deliverables through `aura_monitor.collabs` (M18 hand-off to the M12 document) and the agreed rights from the M11 proposal terms. `aura_brand_content.rights` evaluates channel and period for one account and date.
- M19: metric definitions (`aura_monitor.metrics()`), the latest-reading rule and the source/date/void model.
- M20: migration `20261213000200_m21_assistant_content.sql` adds the `content` task, the `content_ideas` draft kind (applied through `aura_brand_content_create` as ideas) and the `content_plan` context source.

**Routes**: `/brand/content`, `/board`, `/calendar`, `/pillars`, `/reuse`, `/learning` and `/brand/content/[id]`. The slug `content` is reserved for public Brand pages (`20261213000300_reserve_brand_content_route.sql`).
