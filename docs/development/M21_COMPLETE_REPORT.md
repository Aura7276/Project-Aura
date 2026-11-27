# M21 complete report: Brand Content and Social Planning

Branch `feature/m21-brand-content`, built on `main` (M01–M20). Built from the reconstructed module file, so M21-F numbers are not assigned. Publishing is manual: AURA does not post to any platform, generate media or call an AI provider.

## Delivered

- **Migrations**:
  - `20261213000100_m21_brand_content.sql`: schema `aura_brand_content`, 7 tables and 18 public functions.
  - `20261213000200_m21_assistant_content.sql`: the M20 assistant gets a content task.
  - `20261213000300_reserve_brand_content_route.sql`: reserves the `content` slug.
- **Content overview**:
  - counts for ideas, items being made, items waiting for review, scheduled posts and posts published this month
  - a "Needs your review" list and a "past its date" list
  - upcoming posts
  - idea capture
  - content mix against target
- **Production board**: one column per stage, and every card shows its next step. **Calendar**: a month view of planned and live posts, with a legend and a list of undated items. **Pillars**: target mix capped at 100%, with the Brand guidelines alongside.
- **Editor**:
  - Fields: format, account, date, pillar, customer group, product, hook, script, caption, call to action, disclosure, claims and notes.
  - Every save is a version, and a stale editor is told to reload.
  - Editing after approval sends the item back to review.
- **Review**: approve a specific version or request changes with a note. Claims that aren't on the Brand's approved list are flagged and need a written reason to approve.
- **Publish**: a publication checklist (disclosure for Creator content or when a disclosure is set, claims when claims are made). Then the team posts it themselves and records the https link and the live date.
- **Creator content**: published Creator deliverables, shown with the agreed rights for each Brand account. Reuse is blocked outside the agreed channels and usage period, keeps the Creator credit, and is checked again at publication.
- **Assets**: links with provenance, plus a rights note for Creator or licensed material.
- **Performance**: results recorded with source, date and who entered them, using M19's metric definitions. Each post counts once at its latest reading, and coverage is always shown. Results are broken down by pillar and by format, with a list of the most viewed posts.
- **One product**:
  - "Content" in the Brand navigation.
  - A "Your own channels" card on Brand home.
  - The M20 Assistant has a "Content ideas" task and a "content plan" source; approved ideas appear on the board.

## Verification

Local PostgreSQL 16 with auth and storage stubs (not live Supabase). These pass: Prettier, typecheck, ESLint (0 errors, 1 existing warning), Vitest (32 files, 353 tests), the browser suite (137 tests), the stack suite (42 tests), the production build, and `pnpm audit --prod` (no known vulnerabilities). M21 adds:

- 5 SQL scenario groups.
- Database tests: the M20, M19 and M11 suites re-run, RLS, grant and search_path checks, a no-posting check, and 2 races (simultaneous edits, where one wins and the other is told to reload, and parallel pillars, which never push the mix past 100%).
- 10 rule tests.
- A stack test covering the whole journey from idea to published post with results, the assistant's content ideas, isolation, and accessibility and overflow checks on 7 screens.

## Owner decisions needed

See the decision register: the stage flow, version approval, the claims rule, the checklist, the reuse rule, links-only assets, and owner/admin-only roles until M26.

## Not built

- The original requirements that were not recovered.
- Automatic publishing and platform metrics.
- File uploads.
- Reviewer and contributor roles.
- Reminders.
- A browser test of reuse with a live Creator collaboration (covered by the SQL tests).
