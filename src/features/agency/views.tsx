import Link from "next/link";
import { notFound } from "next/navigation";
import { eligible } from "@/server/auth/session";
import {
  agency,
  type AgencyState,
  type Client,
  type Scope,
} from "@/server/agency/service";
import { EntityForm, type FieldDef } from "@/features/creator-profile/forms";
import { countries } from "@/features/creator-onboarding/taxonomy";
import * as act from "./actions";
import { agencyContext } from "./context";
import {
  actionLabel,
  expiryText,
  feeKinds,
  feeStatus,
  kindLabels,
  money,
  neverDelegated,
  registrationLabels,
  scopeInfo,
  scopeOrder,
  scopesText,
  serviceLabels,
  totals,
  verificationLabels,
} from "./rules";
import "@/features/creator-profile/profile.css";
import "./agency.css";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
const uuidRe = /^[0-9a-f-]{36}$/i;
const day = (iso?: string | null) =>
  iso
    ? new Date(
        iso + (iso.length === 10 ? "T00:00:00Z" : ""),
      ).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
const W = (w: string): FieldDef => ({
  name: "w",
  label: "",
  type: "hidden",
  value: w,
});
const H = (name: string, value: string | number): FieldDef => ({
  name,
  label: "",
  type: "hidden",
  value,
});
const kindName = (k: string) => (k === "brand" ? "Brand" : "Creator");

function ScopeChecks({
  kind,
  allowed,
  selected,
  legend,
}: {
  kind: "brand" | "creator" | "either";
  allowed?: Scope[];
  selected: Scope[];
  legend: string;
}) {
  const list = scopeOrder.filter((s) => !allowed || allowed.includes(s));
  return (
    <fieldset className="ag-scopes">
      <legend>{legend}</legend>
      {list.map((s) => (
        <label key={s}>
          <input
            type="checkbox"
            name="scopes"
            value={s}
            defaultChecked={selected.includes(s)}
          />
          <span>
            <b>{scopeInfo[s].label}</b>
            <span className="st-hint">
              {" "}
              {kind === "creator"
                ? scopeInfo[s].creator
                : kind === "brand"
                  ? scopeInfo[s].brand
                  : scopeInfo[s].brand.replace("your", "the client's")}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
function Scopes({ s, contracting }: { s: Scope[]; contracting?: boolean }) {
  return (
    <span className="ag-chips">
      {scopeOrder
        .filter((x) => s.includes(x))
        .map((x) => (
          <span key={x} className="ag-chip">
            {scopeInfo[x].label}
          </span>
        ))}
      {contracting && (
        <span className="ag-chip warn">Contracting authority</span>
      )}
    </span>
  );
}
const monthOptions = (max = 12) =>
  Object.fromEntries(
    Array.from({ length: max }, (_, i) => [
      String(i + 1),
      `${i + 1} month${i ? "s" : ""}`,
    ]).reverse(),
  );

// ───────── Agency shell ─────────
type Tab =
  | "home"
  | "clients"
  | "approvals"
  | "fees"
  | "safeguards"
  | "team"
  | "activity"
  | "profile";
const tabs: [Tab, string, string][] = [
  ["home", "Dashboard", "/agency"],
  ["clients", "Clients", "/agency/clients"],
  ["approvals", "Approvals", "/agency/approvals"],
  ["fees", "Fees", "/agency/fees"],
  ["safeguards", "Safeguards", "/agency/safeguards"],
  ["team", "Team", "/agency/team"],
  ["activity", "Activity", "/agency/activity"],
  ["profile", "Profile and verification", "/agency/profile"],
];
async function load(sp: SP) {
  const a = await agencyContext(one(sp, "w"));
  const r = await agency.state(a.client, a.workspaceId);
  if (!r.ok) notFound();
  return { a, s: r.value, w: a.workspaceId };
}
function Shell({
  w,
  s,
  current,
  title,
  lead,
  children,
  action,
}: {
  w: string;
  s: AgencyState;
  current: Tab;
  title: string;
  lead: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const verified = s.workspace.verification === "verified";
  return (
    <main className="shell ag-main">
      <header className="ag-head">
        <div>
          <p className="ag-eyebrow">
            {s.workspace.name} ·{" "}
            {verified ? "Verified Agency" : "Not verified yet"}
          </p>
          <h1>{title}</h1>
          <p className="st-hint">{lead}</p>
        </div>
        {action}
      </header>
      <nav className="ag-tabs" aria-label="Agency">
        {tabs.map(([k, label, href]) => (
          <Link
            key={k}
            href={`${href}?w=${w}`}
            aria-current={k === current ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!verified && current !== "profile" && (
        <p className="ag-callout" role="note">
          {s.verification?.status === "submitted"
            ? "Your verification is with a reviewer. You can prepare everything; clients can be invited once you are verified."
            : "Verify your Agency to invite clients and act for them. "}
          {s.verification?.status !== "submitted" && (
            <Link href={`/agency/profile?w=${w}`}>Start verification</Link>
          )}
        </p>
      )}
      {children}
    </main>
  );
}
function Flash({ sp }: { sp: SP }) {
  const e = one(sp, "error");
  if (e)
    return (
      <p className="st-error" role="alert">
        {e.slice(0, 200)}
      </p>
    );
  if (one(sp, "assigned"))
    return (
      <p className="st-ok" role="status">
        Team updated.
      </p>
    );
  return null;
}
function WorkButton({
  c,
  label = "Work for this client",
}: {
  c: Client;
  label?: string;
}) {
  if (c.status !== "active" || !c.my_role || !c.grant || c.grant.expired)
    return null;
  return (
    <form action={act.workFor}>
      <input type="hidden" name="client" value={c.client_ws} />
      <button className="st-btn primary">{label}</button>
    </form>
  );
}
const snapshotLabels: Record<string, string> = {
  campaigns_live: "live campaigns",
  campaigns_draft: "draft campaigns",
  applications_new: "new applicants",
  content_review: "content in review",
  content_scheduled: "posts scheduled",
  applications_open: "open applications",
  accounts: "social accounts",
};

// ───────── Dashboard ─────────
export async function AgencyHome({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  const active = s.clients.filter((c) => c.status === "active");
  const mine = active.filter((c) => c.my_role);
  const ending = active.filter(
    (c) => c.grant && !c.grant.expired && c.grant.days_left <= 14,
  );
  const waiting = s.approvals.filter((x) => x.client_status === "pending");
  return (
    <Shell
      w={w}
      s={s}
      current="home"
      title="Agency Studio"
      lead="Your clients, what you may do for each, and what needs attention. Clients stay in control of their own workspaces."
    >
      <Flash sp={sp} />
      <div className="ag-kpis">
        <div>
          <b>{active.length}</b>active clients
        </div>
        <div>
          <b>{mine.length}</b>assigned to you
        </div>
        <div className={waiting.length ? "warn" : ""}>
          <b>{waiting.length}</b>awaiting client approval
        </div>
        <div className={ending.length ? "warn" : ""}>
          <b>{ending.length}</b>access ending in 14 days
        </div>
        <div>
          <b>{totals(s.fees, "invoiced").join(" + ") || "None"}</b>invoiced, not
          yet paid
        </div>
      </div>
      {s.conflicts.some(
        (x) => !x.disclosure?.creator_ack_at || !x.disclosure?.brand_ack_at,
      ) && (
        <p className="ag-callout warn" role="alert">
          You represent both sides of a working relationship. Applications and
          contracting for those clients are paused until both acknowledge your
          disclosure.{" "}
          <Link href={`/agency/safeguards?w=${w}`}>Review safeguards</Link>
        </p>
      )}
      <section aria-labelledby="h-clients">
        <h2 id="h-clients" className="ag-h2">
          Clients
        </h2>
        {active.length ? (
          <ul className="ag-cards">
            {active.map((c) => (
              <li key={c.id} className="ag-card">
                <div className="ag-card-top">
                  <span className={"ag-kind " + c.kind}>
                    {kindName(c.kind)}
                  </span>
                  <span className="st-hint">{expiryText(c.grant)}</span>
                </div>
                <Link
                  href={`/agency/clients/${c.id}?w=${w}`}
                  className="ag-card-title"
                >
                  {c.name}
                </Link>
                {c.grant && (
                  <Scopes
                    s={c.grant.scopes}
                    contracting={c.grant.contracting}
                  />
                )}
                {c.snapshot && Object.keys(c.snapshot).length > 0 && (
                  <ul className="ag-snap">
                    {Object.entries(c.snapshot).map(([k, v]) => (
                      <li key={k}>
                        <b>{v}</b> {snapshotLabels[k] ?? k}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="st-hint">
                  {c.my_role ? `You: ${c.my_role}` : "Not assigned to you"} ·{" "}
                  {c.team.length} on the team
                  {c.pending_approvals > 0 &&
                    ` · ${c.pending_approvals} approval${c.pending_approvals === 1 ? "" : "s"} pending`}
                </p>
                <WorkButton c={c} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="ag-empty">
            <h3>No clients yet</h3>
            <p>
              Invite a Creator or a Brand. They choose exactly what you may do,
              for how long, and can end it at any time.
            </p>
            <Link className="st-btn primary" href={`/agency/clients?w=${w}`}>
              Invite a client
            </Link>
          </div>
        )}
      </section>
      <section className="st-card" aria-labelledby="h-recent">
        <h2 id="h-recent">Recent activity for clients</h2>
        <Activity items={s.activity.slice(0, 8)} />
        <p>
          <Link href={`/agency/activity?w=${w}`}>All activity</Link>
        </p>
      </section>
    </Shell>
  );
}
function Activity({
  items,
  client = true,
}: {
  items: {
    client?: string;
    by: string;
    action: string;
    contracting: boolean;
    at: string;
  }[];
  client?: boolean;
}) {
  if (!items.length)
    return (
      <p className="st-hint">
        Nothing yet. Every change made for a client is recorded here with who
        made it.
      </p>
    );
  return (
    <ul className="ag-log">
      {items.map((x, i) => (
        <li key={i}>
          <span className="ag-log-what">
            {actionLabel(x.action)}
            {x.contracting && <span className="ag-chip warn">Contracting</span>}
          </span>
          <span className="st-hint">
            {x.by}
            {client && x.client ? ` for ${x.client}` : ""} · {when(x.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ───────── Clients and invitations ─────────
export async function ClientsView({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  const verified = s.workspace.verification === "verified";
  return (
    <Shell
      w={w}
      s={s}
      current="clients"
      title="Clients"
      lead="Invite a client with the access you need. The client can grant less, never more."
    >
      <div className="ag-grid">
        <section className="st-card" aria-labelledby="h-inv">
          <h2 id="h-inv">Invite a client</h2>
          {verified && s.me.admin ? (
            <EntityForm
              action={act.inviteClient}
              label="Invite a client"
              idPrefix="ag-inv"
              submit="Create invitation link"
              fields={[
                W(w),
                {
                  name: "kind",
                  label: "Client type",
                  type: "select",
                  options: { brand: "Brand", creator: "Creator" },
                  required: true,
                },
                {
                  name: "label",
                  label: "Client name (for your reference)",
                  required: true,
                  max: 120,
                },
                {
                  name: "months",
                  label: "For how long",
                  type: "select",
                  options: monthOptions(),
                  value: "6",
                  required: true,
                },
                {
                  name: "contracting",
                  label:
                    "Ask for contracting authority (confirming agreed terms for the client)",
                  type: "checkbox",
                },
                {
                  name: "message",
                  label: "Message to the client",
                  type: "textarea",
                  rows: 3,
                  max: 600,
                },
              ]}
            >
              <ScopeChecks
                kind="either"
                selected={["view"]}
                legend="Access you are asking for"
              />
            </EntityForm>
          ) : (
            <p className="st-hint">
              {verified
                ? "Only Agency owners and admins, signed in with an authenticator, can invite clients."
                : "Available once your Agency is verified."}
            </p>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-pend">
          <h2 id="h-pend">Waiting for the client</h2>
          {s.invites.length ? (
            <ul className="ag-list">
              {s.invites.map((i) => (
                <li key={i.created_at}>
                  <div>
                    <b>{i.label}</b>{" "}
                    <span className="st-hint">({kindName(i.kind)})</span>
                    <p className="st-hint">
                      {scopesText(i.scopes)}
                      {i.contracting && ", contracting"} · {i.months} months ·
                      link works until {day(i.expires_at)}
                    </p>
                  </div>
                  {s.me.admin && (
                    <form action={act.revokeInvite}>
                      <input type="hidden" name="w" value={w} />
                      <input
                        type="hidden"
                        name="created"
                        value={i.created_at}
                      />
                      <button className="st-btn ag-small">Cancel</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="st-hint">No open invitations.</p>
          )}
        </section>
        <section className="st-card ag-span" aria-labelledby="h-all">
          <h2 id="h-all">All clients</h2>
          {s.clients.length ? (
            <div className="ag-table-wrap">
              <table className="ag-table">
                <thead>
                  <tr>
                    <th scope="col">Client</th>
                    <th scope="col">Access</th>
                    <th scope="col">Until</th>
                    <th scope="col">Team</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.clients.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">
                        <Link href={`/agency/clients/${c.id}?w=${w}`}>
                          {c.name}
                        </Link>{" "}
                        <span className="st-hint">{kindName(c.kind)}</span>
                      </th>
                      <td>
                        {c.grant ? (
                          <Scopes
                            s={c.grant.scopes}
                            contracting={c.grant.contracting}
                          />
                        ) : (
                          "–"
                        )}
                      </td>
                      <td>
                        {c.status === "active" ? expiryText(c.grant) : "–"}
                      </td>
                      <td>{c.team.map((m) => m.name).join(", ") || "–"}</td>
                      <td>
                        {c.status === "active"
                          ? "Active"
                          : `Ended ${day(c.ended_at)} by ${c.ended_side === "client" ? "client" : "Agency"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="st-hint">No clients yet.</p>
          )}
        </section>
      </div>
    </Shell>
  );
}
export async function ClientDetail({ id, sp }: { id: string; sp: SP }) {
  if (!uuidRe.test(id)) notFound();
  const { s, w } = await load(sp);
  const c = s.clients.find((x) => x.id === id);
  if (!c) notFound();
  const approvals = s.approvals.filter((a) => a.relationship_id === id);
  const fees = s.fees.filter((f) => f.relationship_id === id);
  const activity = s.activity.filter((a) => a.client === c.name);
  const assignable = s.team.filter(
    (m) => !c.team.some((t) => t.user_id === m.user_id),
  );
  return (
    <Shell
      w={w}
      s={s}
      current="clients"
      title={c.name}
      lead={`${kindName(c.kind)} client since ${day(c.started_at)}.`}
      action={<WorkButton c={c} />}
    >
      <Flash sp={sp} />
      <div className="ag-grid">
        <section className="st-card" aria-labelledby="h-acc">
          <h2 id="h-acc">Access granted by the client</h2>
          {c.status === "ended" ? (
            <p>
              Ended {day(c.ended_at)} by the{" "}
              {c.ended_side === "client" ? "client" : "Agency"}
              {c.end_reason && `: ${c.end_reason}`}. Records are kept; no access
              remains.
            </p>
          ) : c.grant ? (
            <>
              <Scopes s={c.grant.scopes} contracting={c.grant.contracting} />
              <ul className="ag-scope-list">
                {c.grant.scopes.map((x) => (
                  <li key={x}>
                    <b>{scopeInfo[x].label}:</b>{" "}
                    {c.kind === "brand"
                      ? scopeInfo[x].brand
                      : scopeInfo[x].creator}
                  </li>
                ))}
              </ul>
              <p className="st-hint">
                {expiryText(c.grant)} · granted by {c.grant.granted_by} on{" "}
                {day(c.grant.granted_at)}. Only the client can change this.
              </p>
            </>
          ) : (
            <p className="st-hint">No current access.</p>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-team">
          <h2 id="h-team">Team on this client</h2>
          <p className="st-hint">
            Only assigned people can act. Managers make changes; viewers only
            read.
          </p>
          <ul className="ag-list">
            {c.team.map((m) => (
              <li key={m.user_id}>
                <span>
                  <b>{m.name}</b> <span className="st-hint">{m.role}</span>
                </span>
                {s.me.admin && c.status === "active" && (
                  <form action={act.assign}>
                    <input type="hidden" name="w" value={w} />
                    <input type="hidden" name="rel" value={c.id} />
                    <input type="hidden" name="user" value={m.user_id} />
                    <input type="hidden" name="role" value="remove" />
                    <button className="st-btn ag-small">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {s.me.admin && c.status === "active" && assignable.length > 0 && (
            <form action={act.assign} className="ag-inline">
              <input type="hidden" name="w" value={w} />
              <input type="hidden" name="rel" value={c.id} />
              <label>
                Person{" "}
                <select name="user">
                  {assignable.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role{" "}
                <select name="role">
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <button className="st-btn">Assign</button>
            </form>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-appr">
          <h2 id="h-appr">Approvals</h2>
          <Approvals items={approvals} w={w} admin={s.me.admin} />
        </section>
        <section className="st-card" aria-labelledby="h-fees">
          <h2 id="h-fees">Fees</h2>
          <FeeTable fees={fees} />
          <p>
            <Link href={`/agency/fees?w=${w}`}>Record a fee</Link>
          </p>
        </section>
        <section className="st-card ag-span" aria-labelledby="h-act">
          <h2 id="h-act">Actions taken for {c.name}</h2>
          <Activity items={activity} client={false} />
        </section>
        {s.me.admin && c.status === "active" && (
          <section
            className="st-card ag-span ag-danger"
            aria-labelledby="h-off"
          >
            <h2 id="h-off">Offboard this client</h2>
            <p className="st-hint">
              Removes all access and assignments at once. Agreements, fees,
              approvals and the activity record are kept.
            </p>
            <EntityForm
              action={act.endRelationship}
              label="Offboard client"
              idPrefix="ag-off"
              submit="Offboard client"
              fields={[
                W(w),
                H("rel", c.id),
                {
                  name: "reason",
                  label: "Reason (shown to the client)",
                  required: true,
                  max: 300,
                },
                {
                  name: "confirm",
                  label: "I understand access ends immediately",
                  type: "checkbox",
                },
              ]}
            />
          </section>
        )}
      </div>
    </Shell>
  );
}

// ───────── Approvals ─────────
function Approvals({
  items,
  w,
  admin,
}: {
  items: AgencyState["approvals"];
  w: string;
  admin: boolean;
}) {
  if (!items.length) return <p className="st-hint">No approval requests.</p>;
  const st = {
    pending: "Waiting",
    approved: "Approved",
    changes_requested: "Changes requested",
    declined: "Declined",
  } as Record<string, string>;
  return (
    <ul className="ag-approvals">
      {items.map((a) => (
        <li key={a.id}>
          <div className="ag-appr-top">
            <b>{a.title}</b>
            <span className="st-hint">
              {a.client} · {a.requested_by} · {day(a.requested_at)}
            </span>
          </div>
          {a.detail && <p className="ag-pre">{a.detail}</p>}
          {a.link && (
            <p>
              <Link href={a.link}>Open the item</Link>
            </p>
          )}
          <div className="ag-two">
            <span className={"ag-status " + a.internal_status}>
              Agency review: {st[a.internal_status]}
              {a.internal_by && a.internal_status !== "pending"
                ? ` (${a.internal_by})`
                : ""}
            </span>
            <span className={"ag-status " + a.client_status}>
              Client decision: {st[a.client_status]}
              {a.client_note ? `: ${a.client_note}` : ""}
            </span>
          </div>
          {admin &&
            a.internal_status === "pending" &&
            a.client_status === "pending" && (
              <EntityForm
                action={act.internalDecide}
                label={`Internal review of ${a.title}`}
                idPrefix={"ag-ir-" + a.id.slice(0, 8)}
                submit="Save internal review"
                fields={[
                  W(w),
                  H("id", a.id),
                  {
                    name: "decision",
                    label: "Internal decision",
                    type: "select",
                    options: {
                      approved: "Ready for the client",
                      changes_requested: "Needs changes",
                    },
                    required: true,
                  },
                  { name: "note", label: "Note", max: 500 },
                ]}
              />
            )}
        </li>
      ))}
    </ul>
  );
}
export async function ApprovalsView({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  const mine = s.clients.filter((c) => c.status === "active" && c.my_role);
  return (
    <Shell
      w={w}
      s={s}
      current="approvals"
      title="Approvals"
      lead="Your Agency's internal review and the client's decision are separate. Internal approval never approves anything for a client."
    >
      <div className="ag-grid">
        <section className="st-card ag-span" aria-labelledby="h-list">
          <h2 id="h-list">Requests</h2>
          <Approvals items={s.approvals} w={w} admin={s.me.admin} />
        </section>
        <section className="st-card" aria-labelledby="h-req">
          <h2 id="h-req">Ask a client to approve</h2>
          {mine.length ? (
            <EntityForm
              action={act.requestApproval}
              label="Ask a client to approve"
              idPrefix="ag-req"
              submit="Create request"
              fields={[
                W(w),
                {
                  name: "rel",
                  label: "Client",
                  type: "select",
                  options: Object.fromEntries(mine.map((c) => [c.id, c.name])),
                  required: true,
                },
                {
                  name: "title",
                  label: "What needs approval",
                  required: true,
                  max: 140,
                },
                {
                  name: "detail",
                  label: "Details",
                  type: "textarea",
                  rows: 4,
                  max: 2000,
                },
                {
                  name: "link",
                  label: "Link inside AURA",
                  max: 300,
                  hint: "For example /brand/content/calendar. The client opens it in their own workspace.",
                },
              ]}
            />
          ) : (
            <p className="st-hint">
              You need to be assigned to a client first.
            </p>
          )}
        </section>
      </div>
    </Shell>
  );
}

// ───────── Fees ─────────
function FeeTable({
  fees,
}: {
  fees: {
    id?: string;
    client?: string;
    kind: string;
    description: string;
    amount: number;
    currency: string;
    basis: string | null;
    due_on: string | null;
    status: string;
    paid_on: string | null;
  }[];
}) {
  if (!fees.length) return <p className="st-hint">No fees recorded.</p>;
  return (
    <div className="ag-table-wrap">
      <table className="ag-table">
        <thead>
          <tr>
            {fees[0].client !== undefined && <th scope="col">Client</th>}
            <th scope="col">Fee</th>
            <th scope="col">Amount</th>
            <th scope="col">Due</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {fees.map((f, i) => (
            <tr
              key={f.id ?? i}
              className={f.status === "cancelled" ? "void" : ""}
            >
              {f.client !== undefined && <td>{f.client}</td>}
              <th scope="row">
                {feeKinds[f.kind]}: {f.description}
                {f.basis && <span className="st-hint"> · {f.basis}</span>}
              </th>
              <td>{money(f.currency, Number(f.amount))}</td>
              <td>{day(f.due_on) || "–"}</td>
              <td>
                {feeStatus[f.status]}
                {f.paid_on && ` ${day(f.paid_on)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export async function FeesView({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  return (
    <Shell
      w={w}
      s={s}
      current="fees"
      title="Fees"
      lead="Your Agency's retainers, commissions and project fees. Settled outside AURA and never mixed with your clients' campaign spend."
    >
      <div className="ag-kpis">
        <div>
          <b>{totals(s.fees, "planned").join(" + ") || "None"}</b>planned
        </div>
        <div>
          <b>{totals(s.fees, "invoiced").join(" + ") || "None"}</b>invoiced
        </div>
        <div>
          <b>{totals(s.fees, "paid").join(" + ") || "None"}</b>paid
        </div>
      </div>
      <div className="ag-grid">
        <section className="st-card ag-span" aria-labelledby="h-all">
          <h2 id="h-all">All fees</h2>
          <FeeTable fees={s.fees} />
          <p className="st-hint">
            Clients see the fees recorded for them. Amounts in different
            currencies are never added together.
          </p>
        </section>
        <section className="st-card" aria-labelledby="h-new">
          <h2 id="h-new">Record a fee</h2>
          {s.me.admin && s.clients.length ? (
            <EntityForm
              action={act.saveFee}
              label="Record a fee"
              idPrefix="ag-fee"
              submit="Save fee"
              fields={[
                W(w),
                {
                  name: "rel",
                  label: "Client",
                  type: "select",
                  options: Object.fromEntries(
                    s.clients.map((c) => [c.id, c.name]),
                  ),
                  required: true,
                },
                {
                  name: "kind",
                  label: "Type",
                  type: "select",
                  options: feeKinds,
                  required: true,
                },
                {
                  name: "description",
                  label: "Description",
                  required: true,
                  max: 200,
                },
                {
                  name: "amount",
                  label: "Amount",
                  type: "number",
                  min: 0,
                  required: true,
                },
                { name: "currency", label: "Currency", value: "INR", max: 3 },
                {
                  name: "basis",
                  label: "Basis",
                  max: 200,
                  hint: "For example: 15% of the agreed Creator fee.",
                },
                { name: "due_on", label: "Due on", type: "date" },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: feeStatus,
                  required: true,
                },
                {
                  name: "paid_on",
                  label: "Paid on",
                  type: "date",
                  showIf: { field: "status", in: ["paid"] },
                },
                { name: "reference", label: "Invoice or reference", max: 80 },
              ]}
            />
          ) : (
            <p className="st-hint">
              {s.clients.length
                ? "Only Agency owners and admins record fees."
                : "Fees are recorded per client."}
            </p>
          )}
        </section>
      </div>
    </Shell>
  );
}

// ───────── Safeguards ─────────
export async function SafeguardsView({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  return (
    <Shell
      w={w}
      s={s}
      current="safeguards"
      title="Safeguards"
      lead="Representing both a Creator and a Brand who work together needs disclosure to both, and neither can be bound by you for the other."
    >
      <div className="ag-grid">
        <section className="st-card ag-span" aria-labelledby="h-dual">
          <h2 id="h-dual">Dual representation</h2>
          {s.conflicts.length ? (
            <ul className="ag-approvals">
              {s.conflicts.map((x) => {
                const d = x.disclosure;
                const both = d?.creator_ack_at && d?.brand_ack_at;
                return (
                  <li key={x.creator_ws + x.brand_ws}>
                    <div className="ag-appr-top">
                      <b>
                        {x.creator} and {x.brand}
                      </b>
                      <span
                        className={
                          "ag-status " + (both ? "approved" : "pending")
                        }
                      >
                        {both
                          ? "Acknowledged by both"
                          : d
                            ? "Waiting for acknowledgement"
                            : "Not disclosed"}
                      </span>
                    </div>
                    <p className="st-hint">
                      {x.collaborations} application or collaboration
                      {x.collaborations === 1 ? "" : "s"} between them.
                      {d &&
                        ` Creator ${d.creator_ack_at ? "acknowledged" : "has not acknowledged"}; Brand ${d.brand_ack_at ? "acknowledged" : "has not acknowledged"}.`}
                    </p>
                    {s.me.admin && (
                      <EntityForm
                        action={act.disclose}
                        label={`Disclose to ${x.creator} and ${x.brand}`}
                        idPrefix={"ag-dis-" + x.creator_ws.slice(0, 6)}
                        submit={
                          d
                            ? "Update disclosure (asks both again)"
                            : "Disclose to both clients"
                        }
                        fields={[
                          W(w),
                          H("creator", x.creator_ws),
                          H("brand", x.brand_ws),
                          {
                            name: "note",
                            label: "What you disclose",
                            type: "textarea",
                            rows: 3,
                            required: true,
                            max: 1000,
                            value: d?.note ?? "",
                          },
                          {
                            name: "safeguards",
                            label: "Safeguards you apply",
                            type: "textarea",
                            rows: 3,
                            required: true,
                            max: 1000,
                            value: d?.safeguards ?? "",
                            hint: "For example: separate account leads for each side.",
                          },
                        ]}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="st-hint">
              None. If a Creator client applies to a Brand client&apos;s
              campaign, it appears here.
            </p>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-rules">
          <h2 id="h-rules">Rules AURA enforces</h2>
          <ul className="ag-rules">
            <li>
              You only act where a client granted access, until it ends. Expired
              or ended access stops at once.
            </li>
            <li>
              Only assigned team members act; viewers only read; changes need an
              authenticator.
            </li>
            <li>
              Every change is recorded with the person who made it and the
              client it was for.
            </li>
            <li>
              Applications and contracting for both sides wait until both
              clients acknowledge your disclosure.
            </li>
            <li>You can never hold contracting authority for both sides.</li>
            <li>The client&apos;s approval is never implied by yours.</li>
          </ul>
        </section>
        <section className="st-card" aria-labelledby="h-never">
          <h2 id="h-never">Never delegated</h2>
          <ul className="ag-rules">
            {neverDelegated.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

// ───────── Team ─────────
export async function TeamView({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  return (
    <Shell
      w={w}
      s={s}
      current="team"
      title="Team"
      lead="People in your Agency. Each acts only for clients they are assigned to."
    >
      <div className="ag-grid">
        <section className="st-card" aria-labelledby="h-people">
          <h2 id="h-people">People</h2>
          <ul className="ag-list">
            {s.team.map((m) => (
              <li key={m.user_id}>
                <span>
                  <b>{m.name}</b> <span className="st-hint">{m.role}</span>
                </span>
                <span className="st-hint">
                  {m.clients} client{m.clients === 1 ? "" : "s"} ·{" "}
                  {m.strong ? "Authenticator on" : "No authenticator"}
                </span>
              </li>
            ))}
          </ul>
          <p className="st-hint">Assign people on each client&apos;s page.</p>
        </section>
        <section className="st-card" aria-labelledby="h-inv">
          <h2 id="h-inv">Invite a team member</h2>
          {s.me.admin ? (
            <EntityForm
              action={act.inviteMember}
              label="Invite a team member"
              idPrefix="ag-mem"
              submit="Create invitation"
              fields={[
                W(w),
                {
                  name: "email",
                  label: "Email",
                  type: "text",
                  required: true,
                  max: 254,
                },
                {
                  name: "role",
                  label: "Role",
                  type: "select",
                  options: {
                    member: "Member",
                    admin: "Admin (needs an authenticator)",
                  },
                  required: true,
                },
              ]}
            />
          ) : (
            <p className="st-hint">
              Only Agency owners and admins can invite people.
            </p>
          )}
        </section>
      </div>
    </Shell>
  );
}
export async function ActivityView({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  return (
    <Shell
      w={w}
      s={s}
      current="activity"
      title="Activity"
      lead="Every change made for a client: who made it, for whom and when. Clients see the same record."
    >
      <section className="st-card">
        <Activity items={s.activity} />
      </section>
    </Shell>
  );
}

// ───────── Profile and verification ─────────
export async function ProfileView({ sp }: { sp: SP }) {
  const { s, w } = await load(sp);
  const p = s.profile;
  const v = s.verification;
  const locked = v?.status === "submitted" || v?.status === "verified";
  return (
    <Shell
      w={w}
      s={s}
      current="profile"
      title="Profile and verification"
      lead="Clients see your profile when you invite them. Verification lets you invite clients and act for them."
    >
      <div className="ag-grid">
        <section className="st-card" aria-labelledby="h-prof">
          <h2 id="h-prof">Agency profile</h2>
          {s.me.admin ? (
            <EntityForm
              action={act.saveProfile}
              label="Agency profile"
              idPrefix="ag-prof"
              submit="Save profile"
              fields={[
                W(w),
                {
                  name: "legal_name",
                  label: "Registered business name",
                  required: true,
                  max: 160,
                  value: p?.legal_name ?? "",
                },
                {
                  name: "kind",
                  label: "What you do",
                  type: "select",
                  options: kindLabels,
                  value: p?.kind ?? "hybrid",
                  required: true,
                },
                {
                  name: "website",
                  label: "Website",
                  type: "url",
                  max: 300,
                  value: p?.website ?? "",
                },
                {
                  name: "country",
                  label: "Country",
                  type: "select",
                  options: {
                    "": "Choose",
                    ...Object.fromEntries(countries.map(([c, n]) => [c, n])),
                  },
                  value: p?.country ?? "IN",
                },
                { name: "city", label: "City", max: 80, value: p?.city ?? "" },
                {
                  name: "team_size",
                  label: "Team size",
                  type: "select",
                  options: {
                    "": "Choose",
                    "1": "Just me",
                    "2-5": "2 to 5",
                    "6-20": "6 to 20",
                    "21-50": "21 to 50",
                    "51+": "More than 50",
                  },
                  value: p?.team_size ?? "",
                },
                {
                  name: "about",
                  label: "About",
                  type: "textarea",
                  rows: 4,
                  max: 1500,
                  value: p?.about ?? "",
                },
              ]}
            >
              <fieldset className="ag-scopes">
                <legend>Services</legend>
                {Object.entries(serviceLabels).map(([k, l]) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      name="services"
                      value={k}
                      defaultChecked={p?.services.includes(k)}
                    />{" "}
                    <span>{l}</span>
                  </label>
                ))}
              </fieldset>
            </EntityForm>
          ) : (
            <p className="st-hint">
              Only Agency owners and admins edit the profile.
            </p>
          )}
        </section>
        <section className="st-card" aria-labelledby="h-ver">
          <h2 id="h-ver">Verification</h2>
          <p>
            <span
              className={
                "ag-status " +
                (v?.status === "verified"
                  ? "approved"
                  : v?.status === "submitted"
                    ? "pending"
                    : "changes_requested")
              }
            >
              {verificationLabels[v?.status ?? "draft"]}
            </span>
          </p>
          {v?.reviewer_note && (
            <p className="ag-callout" role="note">
              Reviewer: {v.reviewer_note}
            </p>
          )}
          {locked ? (
            <p className="st-hint">
              {v?.status === "verified"
                ? `Verified on ${day(v.decided_at)}.`
                : `Submitted ${day(v?.submitted_at)}. A reviewer will decide.`}
            </p>
          ) : s.me.admin ? (
            <EntityForm
              action={act.saveVerification}
              label="Verification"
              idPrefix="ag-ver"
              submit="Save and submit for review"
              fields={[
                W(w),
                H("submit", "1"),
                {
                  name: "registration_type",
                  label: "Registration",
                  type: "select",
                  options: registrationLabels,
                  value: v?.registration_type ?? "gst",
                  required: true,
                },
                {
                  name: "registration_number",
                  label: "Registration number",
                  required: true,
                  max: 40,
                  value: v?.registration_number ?? "",
                },
                {
                  name: "address",
                  label: "Registered address",
                  type: "textarea",
                  rows: 2,
                  required: true,
                  max: 400,
                  value: v?.address ?? "",
                },
                {
                  name: "representative",
                  label: "Authorised representative",
                  required: true,
                  max: 120,
                  value: v?.representative ?? "",
                },
                {
                  name: "representative_role",
                  label: "Their role",
                  max: 80,
                  value: v?.representative_role ?? "",
                },
                {
                  name: "evidence",
                  label: "Evidence links",
                  type: "lines",
                  rows: 3,
                  required: true,
                  value: (v?.evidence ?? []).join("\n"),
                  hint: "https links to your registration certificate or GST record, one per line.",
                },
                {
                  name: "declaration",
                  label:
                    "I confirm I am authorised to act for this business and the details are true",
                  type: "checkbox",
                  value: !!v?.declaration,
                },
              ]}
            />
          ) : (
            <p className="st-hint">
              Only Agency owners and admins submit verification.
            </p>
          )}
        </section>
      </div>
    </Shell>
  );
}

// ───────── Client side: invitation acceptance and access management ─────────
export async function AcceptInviteView({ token }: { token: string }) {
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();
  const { client } = await eligible();
  const r = await agency.inviteInfo(client, token);
  if (!r.ok)
    return (
      <main className="shell ag-main ag-narrow">
        <h1>Invitation unavailable</h1>
        <p>
          This link has expired, was cancelled or was already used. Ask the
          Agency for a new one.
        </p>
      </main>
    );
  const i = r.value;
  return (
    <main className="shell ag-main ag-narrow">
      <p className="ag-eyebrow">Agency access request</p>
      <h1>{i.agency.name} would like to work for you</h1>
      <div className="st-card">
        <p>
          <b>{i.agency.legal_name ?? i.agency.name}</b> ·{" "}
          {i.agency.verified ? "Verified Agency" : "Not verified"}
          {i.agency.kind && ` · ${kindLabels[i.agency.kind]}`}
        </p>
        {i.agency.about && <p className="ag-pre">{i.agency.about}</p>}
        {i.message && <p className="ag-quote">“{i.message}”</p>}
        <p className="st-hint">
          Requested: {scopesText(i.scopes)}
          {i.contracting && ", contracting authority"} for up to {i.months}{" "}
          months.
        </p>
      </div>
      {i.workspaces.length ? (
        <section className="st-card" aria-labelledby="h-grant">
          <h2 id="h-grant">Choose what to allow</h2>
          <p className="st-hint">
            You can allow less than requested. You can change or end it at any
            time, and you see everything done in your name.
          </p>
          <EntityForm
            action={act.acceptInvite}
            label="Grant Agency access"
            idPrefix="ag-acc"
            submit="Grant access"
            fields={[
              H("token", token),
              H("kind", i.client_kind),
              {
                name: "client",
                label: `Your ${kindName(i.client_kind)} workspace`,
                type: "select",
                options: Object.fromEntries(
                  i.workspaces.map((x) => [x.id, x.name]),
                ),
                required: true,
              },
              {
                name: "months",
                label: "For how long",
                type: "select",
                options: monthOptions(i.months),
                value: String(i.months),
                required: true,
              },
              ...(i.contracting
                ? [
                    {
                      name: "contracting",
                      label:
                        "Also allow contracting authority: confirming agreed terms for me (owner only; needs your authenticator)",
                      type: "checkbox" as const,
                    },
                  ]
                : []),
              {
                name: "confirm",
                label: "I understand what I am allowing",
                type: "checkbox",
              },
            ]}
          >
            <ScopeChecks
              kind={i.client_kind}
              allowed={i.scopes}
              selected={i.scopes}
              legend="Areas"
            />
            <div className="ag-never">
              <b>Never delegated:</b> {neverDelegated.join("; ")}.
            </div>
          </EntityForm>
        </section>
      ) : (
        <p className="ag-callout" role="note">
          This invitation is for a {kindName(i.client_kind)} workspace that you
          own{i.client_kind === "brand" ? " or administer" : ""}, and that does
          not already work with this Agency.
        </p>
      )}
    </main>
  );
}
export async function ClientAccessView({
  kind,
  ws,
  sp,
}: {
  kind: "brand" | "creator";
  ws: string;
  sp: SP;
}) {
  const { client } = await eligible();
  const r = await agency.clientView(client, ws);
  if (!r.ok) notFound();
  const v = r.value;
  const active = v.agencies.filter((a) => a.status === "active");
  const ended = v.agencies.filter((a) => a.status === "ended");
  return (
    <main className="shell ag-main">
      <header className="ag-head">
        <div>
          <p className="ag-eyebrow">Your workspace, your rules</p>
          <h1>Agencies</h1>
          <p className="st-hint">
            Agencies act for you only where you allow, until you end it. You see
            everything they do in your name.
          </p>
        </div>
      </header>
      {one(sp, "granted") && (
        <p className="st-ok" role="status">
          Access granted. You can change or end it here at any time.
        </p>
      )}
      {one(sp, "acknowledged") && (
        <p className="st-ok" role="status">
          Thank you. Your acknowledgement is recorded.
        </p>
      )}
      {!v.agencies.length && (
        <div className="ag-empty">
          <h2>No Agencies</h2>
          <p>
            To work with an Agency, ask them for an invitation link. You choose
            what they may do and for how long.
          </p>
        </div>
      )}
      {active.map((a) => (
        <section
          key={a.id}
          className="st-card ag-client"
          aria-label={`Agency ${a.agency}`}
        >
          <div className="ag-appr-top">
            <h2>{a.agency}</h2>
            <span className="st-hint">
              {a.verified ? "Verified Agency" : "Not verified"} · since{" "}
              {day(a.started_at)}
            </span>
          </div>
          {a.grant && (
            <p>
              <Scopes s={a.grant.scopes} contracting={a.grant.contracting} />{" "}
              <span className="st-hint">{expiryText(a.grant)}</span>
            </p>
          )}
          <p className="st-hint">
            Team:{" "}
            {a.team.map((t) => `${t.name} (${t.role})`).join(", ") ||
              "nobody assigned yet"}
          </p>
          {a.disclosures
            .filter((d) => !d.acknowledged)
            .map((d) => (
              <div key={d.id} className="ag-callout warn" role="alert">
                <p>
                  <b>Disclosure:</b> {a.agency} also represents <b>{d.other}</b>
                  , who works with you.
                </p>
                <p className="ag-pre">{d.note}</p>
                <p className="ag-pre">Safeguards: {d.safeguards}</p>
                <form action={act.acknowledge}>
                  <input type="hidden" name="w" value={ws} />
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="kind" value={kind} />
                  <button className="st-btn primary">
                    I acknowledge this disclosure
                  </button>
                </form>
              </div>
            ))}
          <div className="ag-grid">
            <div>
              <h3 className="ag-h3">Approvals requested</h3>
              {a.approvals.length ? (
                <ul className="ag-approvals">
                  {a.approvals.map((p) => (
                    <li key={p.id}>
                      <div className="ag-appr-top">
                        <b>{p.title}</b>
                        <span className={"ag-status " + p.client_status}>
                          {p.client_status === "pending"
                            ? "Your decision needed"
                            : p.client_status === "approved"
                              ? "You approved"
                              : "You declined"}
                        </span>
                      </div>
                      {p.detail && <p className="ag-pre">{p.detail}</p>}
                      {p.link && (
                        <p>
                          <Link href={p.link}>Open the item</Link>
                        </p>
                      )}
                      <p className="st-hint">
                        Asked by {p.requested_by} · Agency internal review:{" "}
                        {p.internal_status.replace("_", " ")} (that is not your
                        approval)
                      </p>
                      {p.client_status === "pending" && (
                        <EntityForm
                          action={act.clientDecide}
                          label={`Decide on ${p.title}`}
                          idPrefix={"ag-cd-" + p.id.slice(0, 8)}
                          submit="Record my decision"
                          fields={[
                            W(ws),
                            H("id", p.id),
                            {
                              name: "decision",
                              label: "Decision",
                              type: "select",
                              options: {
                                approved: "Approve",
                                declined: "Decline",
                              },
                              required: true,
                            },
                            {
                              name: "note",
                              label: "Note to the Agency",
                              max: 500,
                            },
                          ]}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="st-hint">None.</p>
              )}
              <h3 className="ag-h3">Fees they recorded for you</h3>
              <FeeTable fees={a.fees} />
            </div>
            <div>
              <h3 className="ag-h3">Change access</h3>
              <EntityForm
                action={act.changeGrant}
                label={`Change access for ${a.agency}`}
                idPrefix={"ag-cg-" + a.id.slice(0, 8)}
                submit="Update access"
                fields={[
                  W(ws),
                  H("rel", a.id),
                  {
                    name: "months",
                    label: "For how long from today",
                    type: "select",
                    options: monthOptions(),
                    value: String(
                      Math.min(
                        12,
                        Math.max(
                          1,
                          Math.round((a.grant?.days_left ?? 30) / 30),
                        ),
                      ),
                    ),
                    required: true,
                  },
                  ...(v.me.owner
                    ? [
                        {
                          name: "contracting",
                          label:
                            "Contracting authority (confirming agreed terms for me; needs your authenticator)",
                          type: "checkbox" as const,
                          value: !!a.grant?.contracting,
                        },
                      ]
                    : []),
                ]}
              >
                <ScopeChecks
                  kind={kind}
                  selected={a.grant?.scopes ?? []}
                  legend="Areas"
                />
              </EntityForm>
              <h3 className="ag-h3">End access</h3>
              <EntityForm
                action={act.revokeAccess}
                label={`End access for ${a.agency}`}
                idPrefix={"ag-rv-" + a.id.slice(0, 8)}
                submit="End access now"
                fields={[
                  W(ws),
                  H("rel", a.id),
                  { name: "reason", label: "Reason", max: 300 },
                  {
                    name: "confirm",
                    label: "End all access immediately",
                    type: "checkbox",
                  },
                ]}
              />
            </div>
          </div>
          <details className="ag-details">
            <summary>
              Everything done in your name ({a.activity.length})
            </summary>
            <Activity items={a.activity} client={false} />
          </details>
          <details className="ag-details">
            <summary>Access history ({a.history.length})</summary>
            <ul className="ag-log">
              {a.history.map((h, i) => (
                <li key={i}>
                  <span className="ag-log-what">
                    {scopesText(h.scopes)}
                    {h.contracting && ", contracting"}
                  </span>
                  <span className="st-hint">
                    Granted by {h.granted_by} {day(h.granted_at)}
                    {h.ended_at
                      ? ` · ${h.end_reason === "superseded" ? "replaced" : "ended"} ${day(h.ended_at)}`
                      : ` · until ${day(h.expires_at)}`}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
      {ended.length > 0 && (
        <section className="st-card" aria-labelledby="h-ended">
          <h2 id="h-ended">Past Agencies</h2>
          <ul className="ag-list">
            {ended.map((a) => (
              <li key={a.id}>
                <span>
                  <b>{a.agency}</b>{" "}
                  <span className="st-hint">
                    ended {day(a.ended_at)}
                    {a.end_reason ? `: ${a.end_reason}` : ""}
                  </span>
                </span>
                <span className="st-hint">
                  {a.activity.length} recorded action
                  {a.activity.length === 1 ? "" : "s"} · {a.fees.length} fee
                  {a.fees.length === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// ───────── Platform review ─────────
export async function AdminAgenciesView() {
  const { client } = await eligible();
  const r = await agency.reviewQueue(client);
  if (!r.ok) notFound();
  const q = r.value as {
    workspace_id: string;
    name: string;
    legal_name: string | null;
    kind: string | null;
    website: string | null;
    registration_type: string;
    registration_number: string;
    address: string;
    representative: string;
    representative_role: string | null;
    evidence: string[];
    submitted_at: string;
    founder: string;
  }[];
  return (
    <main className="shell ag-main">
      <h1>Agency verification</h1>
      {q.length ? (
        q.map((c) => (
          <section
            key={c.workspace_id}
            className="st-card"
            aria-label={`Verification for ${c.name}`}
          >
            <h2>
              {c.legal_name ?? c.name}{" "}
              <span className="st-hint">({c.name})</span>
            </h2>
            <dl className="ag-facts">
              <div>
                <dt>Registration</dt>
                <dd>
                  {registrationLabels[c.registration_type]}{" "}
                  {c.registration_number}
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{c.address}</dd>
              </div>
              <div>
                <dt>Representative</dt>
                <dd>
                  {c.representative}
                  {c.representative_role && `, ${c.representative_role}`}{" "}
                  (account: {c.founder})
                </dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>
                  {c.evidence.map((e) => (
                    <a
                      key={e}
                      href={e}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      className="ag-link"
                    >
                      {e}
                    </a>
                  ))}
                </dd>
              </div>
            </dl>
            <EntityForm
              action={act.reviewDecide}
              label={`Decide on ${c.name}`}
              idPrefix={"ag-rd-" + c.workspace_id.slice(0, 8)}
              submit="Record decision"
              fields={[
                H("ws", c.workspace_id),
                {
                  name: "decision",
                  label: "Decision",
                  type: "select",
                  options: {
                    verified: "Verify",
                    info_requested: "Ask for more information",
                    rejected: "Reject",
                  },
                  required: true,
                },
                {
                  name: "note",
                  label: "Note to the Agency",
                  max: 1000,
                  hint: "Required unless you verify.",
                },
              ]}
            />
          </section>
        ))
      ) : (
        <p className="st-hint">No Agencies waiting for review.</p>
      )}
    </main>
  );
}
