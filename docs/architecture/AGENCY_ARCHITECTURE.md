# Agency architecture (M23)

## Where delegation is enforced

Every module reaches client data through two shared access checks: `aura_creator.own` (Creator workspaces) and `aura_social.actor` (used by `aura_market.brand`, `aura_brand.actor` and `aura_analytics.actor`). M23 keeps their behaviour for members and adds one fallback for non-members: `aura_agency.delegated(workspace, write, kind)`. It:

1. Finds an active relationship for that client where the caller is an active member of an open Agency **and** is assigned to the client.
2. Takes the current grant. If there is none, or it has expired, access is refused.
3. Reads the PostgreSQL call stack (`GET DIAGNOSTICS … PG_CONTEXT`). It maps **every** `public.aura_*` function in the chain to an area through `aura_agency.scope_rule`:
   - The first matching rule wins.
   - Consent, verification, deletion, onboarding and Agency functions map to `never`.
   - A function with no matching rule is refused.
4. Reads are allowed for the function's area, or for "view" (which excludes the assistant). Writes and contracting steps need the area itself. They also need a `manager` assignment, MFA and a verified Agency, and contracting additionally needs the grant's contracting authority.
5. Applies the dual-representation rules (below).
6. Logs every write in `aura_agency.activity`, with the actor, the client, the outermost function and the area.

Because this runs inside the database, it holds for the app, for direct API calls and for nested calls alike.

## Client control

Agencies invite clients with a one-time link (only its hash is stored; it lasts 14 days). The client chooses the workspace, the areas, the duration and contracting authority. These can be the requested access or less, never more. Every change creates a new grant and keeps the old one as history. Ending access (by either side) ends the grant and the assignments, and keeps fees, approvals and activity. The client's own functions (`aura_agency_client_*`, `aura_agency_accept`) check the client's own membership and are never delegable.

## Dual representation

`aura_agency.pairs` finds a Creator client and a Brand client of the same Agency who share an M11 collaboration (an application or a negotiation).

- **Before both acknowledge:** for either client, delegated steps in the applications area and any contracting step are refused until both clients acknowledge the Agency's disclosure.
- **Contracting authority:** it is refused if the counterpart's current grant also holds contracting authority.

## The app

- A cookie (`aura_acting`) records which client the person chose with "Work for this client".
- `brandContext` and `creatorContext` accept a client workspace only when `aura_agency_delegations()` lists it.
- The Brand layout and Creator Studio show a banner, and the Brand navigation hides areas outside the grant.
- Pages that manage Agency access (`/brand/agencies`, `/creator/agencies`) are refused while working for a client.

Routes: `/agency` (dashboard, clients, approvals, fees, safeguards, team, activity, profile), `/agency-invite/[token]` and `/admin/agencies`.
