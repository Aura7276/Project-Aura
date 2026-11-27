# M23 complete report: Agency Studio

Branch `feature/m23-agency`, built on M21 (`feature/m21-brand-content`). Built from the reconstructed module file, so M23-F numbers are not assigned. M22 is being built separately; its new functions stay closed to Agencies until they are mapped to an area.

## Delivered

- **Migration** `20261216000100_m23_agency.sql`:
  - schema `aura_agency`: 12 tables and 25 public functions;
  - delegation built into the two shared access checks;
  - Agency workspace creation;
  - Agency route reservations in two small follow-up migrations.
- **Agency workspace**:
  - Creation needs an authenticator.
  - The profile covers business name, type, services, team size and about.
  - Verification is reviewed by a platform administrator at `/admin/agencies`.
  - Until verified, the Agency can't invite clients or act for them.
- **Clients**:
  - A private invitation link asks for specific areas, a duration and, optionally, contracting authority.
  - The client grants that much or less on `/agency-invite/[token]`.
  - The client manages Agency access on `/brand/agencies` or `/creator/agencies`: change or end access at any time, decide approvals, acknowledge disclosures, and see fees and everything done in their name, with access history.
- **Agency Studio**:
  - **Dashboard:** clients with granted areas, expiry and counts shown only for granted areas; alerts for access ending soon, approvals waiting, invoices and safeguards.
  - **Clients:** invitations and every relationship, past and present.
  - **Client page:** access, team assignments (manager or viewer), approvals, fees, activity and offboarding.
  - **Other pages:** approvals (internal review separate from the client's decision), fees, safeguards (dual representation, the enforced rules, what is never delegated), team with invitations, activity log, profile and verification.
- **Working for a client**: "Work for this client" opens the client's own Brand area or Creator Studio.
  - A banner shows who you're working for and with what access.
  - Brand menu items outside the grant are hidden.
  - The database checks every action and logs every change.

## Verification

Local PostgreSQL 16 with auth and storage stubs (not live Supabase).

- **SQL scenarios:** 6 groups.
- **Regression:** every earlier module's SQL suite passes unchanged with delegation in the shared access checks (M03–M21 and M07).
- **Database tests:** the M21, M11 and M05 suites re-run, RLS and grant checks, a check that every public function is either in an area or refused, and 2 races (one invitation accepted twice at once, and simultaneous grant changes).
- **6 unit tests.**
- **Stack test:** the full journey (create, verify, invite, grant less than asked, work for the client with the banner, refusals outside the grant, two-stage approval, fees, narrowing, ending), with accessibility and overflow checks on 10 pages.
- **Full gate:** these pass: Prettier, typecheck, ESLint (0 errors, 1 existing warning), Vitest (34 files, 365 tests), the browser suite (137 tests), the stack suite (44 tests), the production build, and `pnpm audit --prod` (no known vulnerabilities).
- **Route reservations:** the first run found four tests that check route reservations (`/creator/agencies` and `/brand/agencies` were not reserved). Two small reservation migrations fixed this (`20261216000200`, `20261216000300`), and the affected suites and the full Vitest run were re-run and pass.

## Owner decisions needed

See the decision register: the areas, grant length and who can grant, contracting authority, what is never delegable, dual representation, verification, and invitation lifetimes.

## Not built

- The original requirements that were not recovered.
- Delegation inside M12 collaborations and M13 commercial workspaces.
- Cross-client reports.
- Messaging, notifications and reminders (M24, M25).
- Agency subscriptions (M27).
- Client-side approver roles (M26).
