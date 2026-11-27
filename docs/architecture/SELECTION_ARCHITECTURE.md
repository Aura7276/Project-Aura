# Creator selection and comparison (M18)

M11 (`aura_apply`) remains the authoritative record of applications, invitations and negotiations. M18 (`aura_selection`) adds holds, private review notes, comparison and the hand-off to M12.

## Data (private schema, RLS on, no policies, no grants)

- `hold`: one live hold per application; `held` for 72 hours (`setting.hold_hours`), then `accepted`, `declined`, `released` or `expired`.
- `note`: private team notes and tags per application.
- `handoff`: which M12 collaboration workspace an M11 collaboration opened.

## Rules

- **Capacity**: `taken = selected + converted + live holds`. Offering a place, accepting it and M11's own `select` all check it under the same per-campaign lock (`apply_capacity:<campaign>`). A trigger on `aura_apply.application` enforces it for every path.
- **Hold lifecycle**: offering moves the application to shortlisted with a hold. The Creator accepts (eligibility re-checked, application becomes `selected`) or declines (application withdrawn). Unanswered holds expire when anyone reads the campaign or offer (no scheduler yet) and both sides are told.
- **Hand-off**: when both sides confirm the same proposal version (M11), a trigger on `aura_apply.collaboration` calls M12's internal `aura_collaboration.provision` with the agreed terms (one deliverable per item, compensation, rights, exclusivity). The workspace starts as "Agreement pending" with `templateApproved: false`, so neither side can accept until an approved legal template exists. The application becomes `converted`.
- **Privacy**: comparison and the inbox use `aura_apply.shared()` only. Notes are never in any Creator projection.

## Screens

Inbox on `/brand/campaigns/[id]/applications` (views, capacity meter, bulk review, compare); `/brand/campaigns/[id]/compare?ids=`; candidate panel on `/brand/applications/[id]` (offer, release, notes); offer panel on `/creator/applications/[id]`; hand-off links on both negotiation pages to `/collaborations/[id]`.
