import Link from "next/link";
import { notFound } from "next/navigation";
import { brandContext } from "@/server/market/service";
import {
  selection,
  type Check,
  type InboxItem,
} from "@/server/selection/service";
import { apply } from "@/server/apply/service";
import { EntityForm } from "@/features/creator-profile/forms";
import { Status } from "@/features/applications/ui";
import { CampaignTabs } from "@/features/campaigns/tabs";
import * as act from "./actions";
import "./selection.css";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
const day = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "";
const until = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
const money = (
  m?: { currency: string; amount?: number; min?: number; max?: number } | null,
) => {
  if (!m) return null;
  const f = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: m.currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (m.amount !== undefined) return f(m.amount);
  if (m.min !== undefined && m.max !== undefined && m.max !== m.min)
    return `${f(m.min)} to ${f(m.max)}`;
  return m.min !== undefined ? f(m.min) : null;
};
const accountText = (a: InboxItem["account"]) =>
  a
    ? `${a.platform} @${a.handle}${a.followers ? ` · ${a.followers.value.toLocaleString("en-IN")} followers (${a.followers.source}, ${a.followers.observed_on})` : ""}`
    : "No account shared";

// ───────── Applicant inbox (replaces the M11 applicant table) ─────────
const views: [string, string, (a: InboxItem) => boolean][] = [
  ["all", "All", () => true],
  ["new", "New", (a) => a.status === "submitted"],
  [
    "review",
    "In review",
    (a) => ["review", "clarification"].includes(a.status),
  ],
  [
    "shortlist",
    "Shortlist",
    (a) => ["shortlisted", "waitlisted"].includes(a.status) && !a.hold,
  ],
  ["held", "Places held", (a) => !!a.hold],
  ["selected", "Selected", (a) => ["selected", "converted"].includes(a.status)],
  [
    "closed",
    "Closed",
    (a) => ["rejected", "withdrawn", "expired", "cancelled"].includes(a.status),
  ],
];
export async function Inbox({
  w,
  campaignId,
  sp,
}: {
  w: string;
  campaignId: string;
  sp: SP;
}) {
  const b = await brandContext(w);
  const r = await selection.inbox(b.client, b.workspaceId, campaignId);
  if (!r.ok)
    return <p className="st-error">The applicant inbox could not be loaded.</p>;
  const { campaign: c, applications } = r.value;
  const v = views.find(([k]) => k === (one(sp, "view") ?? "all")) ?? views[0];
  const list = applications.filter(v[2]);
  const pct = c.capacity
    ? Math.min(100, Math.round((c.taken / c.capacity) * 100))
    : 0;
  const bulkMsg = one(sp, "bulk");
  return (
    <section className="st-card sl-inbox" aria-labelledby="h-inbox">
      <div className="sl-head">
        <h2 id="h-inbox">Applicants</h2>
        <div className="sl-capacity" aria-label="Places">
          {c.capacity ? (
            <>
              <span>
                <b>{c.taken}</b> of {c.capacity} places taken or held
              </span>
              <span className="sl-meter" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </span>
            </>
          ) : (
            <span>Positions not limited</span>
          )}
        </div>
      </div>
      {bulkMsg && (
        <p
          role="status"
          className={
            bulkMsg === "error" || bulkMsg === "none" ? "st-error" : "st-ok"
          }
        >
          {bulkMsg === "error"
            ? "That could not be done."
            : bulkMsg === "none"
              ? "Choose at least one applicant and an action."
              : `Done for ${one(sp, "done")}${Number(one(sp, "skipped")) ? `; ${one(sp, "skipped")} skipped because they had already left` : ""}.`}
        </p>
      )}
      <nav aria-label="Applicant views" className="sl-views">
        {views.map(([k, l, f]) => (
          <Link
            key={k}
            href={`/brand/campaigns/${c.id}/applications?w=${w}&view=${k}`}
            aria-current={v[0] === k ? "page" : undefined}
          >
            {l} <small>{applications.filter(f).length}</small>
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <div className="sl-empty">
          <p>
            {applications.length
              ? "Nobody in this view."
              : "No applications yet. Creators who meet every mandatory requirement can apply while the campaign is live."}
          </p>
        </div>
      ) : (
        <form action={act.compare} className="sl-form">
          <input type="hidden" name="w" value={w} />
          <input type="hidden" name="campaign" value={c.id} />
          <ul className="sl-list">
            {list.map((a) => (
              <li key={a.id} className="sl-row">
                <input
                  type="checkbox"
                  name="ids"
                  value={a.id}
                  aria-label={`Choose ${a.creator}`}
                />
                <div className="sl-who">
                  <Link href={`/brand/applications/${a.id}?w=${w}`}>
                    {a.creator}
                  </Link>
                  <span className="st-hint">{accountText(a.account)}</span>
                  {a.tags.length > 0 && (
                    <span className="sl-tags">
                      {a.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="sl-state">
                  <Status s={a.status} />
                  {a.hold && (
                    <span className="sl-hold">
                      Held until {until(a.hold.expires_at)}
                    </span>
                  )}
                  {a.questions_open > 0 && (
                    <span className="sl-flag">Question open</span>
                  )}
                </div>
                <dl className="sl-facts">
                  <div>
                    <dt>Requirements</dt>
                    <dd>{a.eligible ? "All met" : "Not all met"}</dd>
                  </div>
                  <div>
                    <dt>Quote</dt>
                    <dd>{money(a.quote) ?? "Campaign terms"}</dd>
                  </div>
                  <div>
                    <dt>Work shared</dt>
                    <dd>{a.portfolio_count}</dd>
                  </div>
                  <div>
                    <dt>Sent</dt>
                    <dd>{day(a.submitted_at)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="sl-actions">
            <button className="st-btn primary">Compare chosen (2 to 4)</button>
            <label htmlFor="sl-bulk" className="sr-only">
              Action for chosen applicants
            </label>
            <select id="sl-bulk" name="bulk_action" defaultValue="">
              <option value="">Action for chosen…</option>
              <option value="review">Start review</option>
              <option value="shortlist">Shortlist</option>
              <option value="reject">Not selected</option>
            </select>
            <label htmlFor="sl-fb" className="sr-only">
              Feedback for Creators who are not selected (optional)
            </label>
            <input
              id="sl-fb"
              name="feedback"
              maxLength={1000}
              placeholder="Feedback if not selected (optional)"
            />
            <button className="st-btn" formAction={act.bulk}>
              Apply
            </button>
          </div>
          <p className="st-hint">
            Places are offered one Creator at a time from the candidate page,
            with a {c.hold_hours}-hour hold. Holds count against your positions.
          </p>
        </form>
      )}
    </section>
  );
}

// ───────── Comparison (S2, S3, S8) ─────────
function ChecksList({ items, empty }: { items: Check[]; empty: string }) {
  if (!items.length) return <span className="st-hint">{empty}</span>;
  return (
    <ul className="sl-checks">
      {items.map((x) => (
        <li key={x.key} data-s={x.status}>
          <span aria-hidden>
            {x.status === "met" ? "✓" : x.status === "unknown" ? "?" : "✗"}
          </span>{" "}
          {x.label}
          {x.status === "unknown" ? " (not known)" : ""}
        </li>
      ))}
    </ul>
  );
}
export async function CompareView({ id, sp }: { id: string; sp: SP }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const ids = (one(sp, "ids") ?? "")
    .split(",")
    .filter((x) => /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, 4);
  const r =
    ids.length >= 2
      ? await selection.compare(b.client, b.workspaceId, id, ids)
      : null;
  const q = await apply.rules(b.client, b.workspaceId, id);
  const questions =
    (q.ok
      ? (q.value as { questions: { id: string; prompt: string }[] }).questions
      : []) ?? [];
  const w = b.workspaceId;
  return (
    <main className="shell sl-main">
      <CampaignTabs id={id} w={w} current="applications" />
      <header className="sl-page-head">
        <h1>Compare candidates</h1>
        <p className="st-hint">
          Only what each Creator shared with this application. Requirements and
          preferences are shown as met or not; there is no score and no ranking.
        </p>
      </header>
      {!r || !r.ok ? (
        <p className="mk-banner">
          {r && !r.ok
            ? r.message
            : "Choose 2 to 4 applicants in the inbox, then select Compare."}{" "}
          <Link href={`/brand/campaigns/${id}/applications?w=${w}`}>
            Back to applicants
          </Link>
        </p>
      ) : (
        <div className="sl-compare-wrap">
          <table className="sl-compare">
            <caption className="sr-only">
              Candidates side by side for {r.value.campaign.title}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Detail</span>
                </th>
                {r.value.candidates.map((c) => (
                  <th key={c.id} scope="col">
                    <Link href={`/brand/applications/${c.id}?w=${w}`}>
                      {c.shared.creator}
                    </Link>
                    <br />
                    <Status s={c.status} />
                    {c.hold && (
                      <span className="sl-hold">
                        Held until {until(c.hold.expires_at)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Mandatory requirements</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id}>
                    <b className="sl-verdict">
                      {c.eligibility.eligible ? "All met" : "Not all met"}
                    </b>
                    <ChecksList
                      items={c.eligibility.hard}
                      empty="No mandatory requirements"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Preferences</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id}>
                    <ChecksList
                      items={c.eligibility.preferred}
                      empty="No preferences set"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Account</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id}>
                    {accountText(c.shared.account)}
                    {c.shared.account ? (
                      <>
                        <br />
                        <span className="st-hint">
                          Ownership {c.shared.account.ownership}
                        </span>
                      </>
                    ) : null}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Pitch</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id} className="sl-pitch">
                    {c.shared.pitch ?? (
                      <span className="st-hint">Quick apply, no pitch</span>
                    )}
                  </td>
                ))}
              </tr>
              {questions.map((qq) => (
                <tr key={qq.id}>
                  <th scope="row">{qq.prompt}</th>
                  {r.value.candidates.map((c) => (
                    <td key={c.id}>
                      {c.shared.answers[qq.id] ?? (
                        <span className="st-hint">Not answered</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Work shared</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id}>
                    {c.shared.portfolio.length ? (
                      c.shared.portfolio.map((p) => p.title).join(", ")
                    ) : (
                      <span className="st-hint">None</span>
                    )}
                    {c.shared.kit ? (
                      <>
                        <br />
                        Media kit: {c.shared.kit.kit?.name ?? "attached"}
                      </>
                    ) : null}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Compensation</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id}>
                    {c.proposal?.terms.money ? (
                      <>
                        Proposal v{c.proposal.version}:{" "}
                        {money(c.proposal.terms.money)}
                      </>
                    ) : c.shared.quote ? (
                      <>Quote: {money(c.shared.quote)}</>
                    ) : (
                      <>
                        Campaign: {money(r.value.campaign.money) ?? "non-money"}
                      </>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Dates</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id}>
                    {c.proposal?.terms.start_on || c.proposal?.terms.end_on ? (
                      `${c.proposal.terms.start_on ?? "?"} to ${c.proposal.terms.end_on ?? "?"}`
                    ) : (
                      <span className="st-hint">Not proposed yet</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Your tags</th>
                {r.value.candidates.map((c) => (
                  <td key={c.id}>
                    {c.tags.length ? (
                      <span className="sl-tags">
                        {c.tags.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </span>
                    ) : (
                      <span className="st-hint">None</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// ───────── Brand candidate panel: hold, release, notes ─────────
export async function CandidatePanel({
  w,
  appId,
  status,
}: {
  w: string;
  appId: string;
  status: string;
}) {
  const b = await brandContext(w);
  const r = await selection.candidate(b.client, b.workspaceId, appId);
  if (!r.ok) return null;
  const c = r.value;
  const held = c.hold?.status === "held";
  const canOffer =
    !held &&
    [
      "submitted",
      "review",
      "clarification",
      "shortlisted",
      "waitlisted",
    ].includes(status);
  return (
    <>
      <section className="st-card sl-place" aria-labelledby="h-place">
        <h2 id="h-place">Place</h2>
        <p className="st-hint">
          {c.capacity
            ? `${c.taken} of ${c.capacity} places taken or held.`
            : "Positions are not limited."}
        </p>
        {held && c.hold ? (
          <>
            <p className="sl-hold big">Held until {until(c.hold.expires_at)}</p>
            <p className="st-hint">
              Waiting for the Creator to accept. If they do not answer in time,
              the place is freed.
            </p>
            <form action={act.releasePlace}>
              <input type="hidden" name="w" value={w} />
              <input type="hidden" name="id" value={appId} />
              <button className="st-btn">Release the place</button>
            </form>
          </>
        ) : canOffer ? (
          <EntityForm
            action={act.holdPlace}
            label="Offer a place"
            idPrefix="hp"
            submit="Offer a place (72-hour hold)"
            fields={[
              { name: "w", label: "", type: "hidden", value: w },
              { name: "id", label: "", type: "hidden", value: appId },
              {
                name: "message",
                label: "Message to the Creator",
                type: "textarea",
                rows: 2,
                max: 600,
                hint: "The place is held for 72 hours and counts against your positions. The Creator accepts or declines; nothing is binding yet.",
              },
            ]}
          />
        ) : (
          <p className="st-hint">
            {c.hold ? `Last offer: ${c.hold.status}.` : "No place offered."}
          </p>
        )}
        {c.handoff && (
          <p>
            <Link
              className="st-btn primary"
              href={`/collaborations/${c.handoff}`}
            >
              Open the collaboration workspace
            </Link>
          </p>
        )}
      </section>
      <section className="st-card" aria-labelledby="h-notes">
        <h2 id="h-notes">Team notes</h2>
        <p className="st-hint">
          Private to your team. Never shown to the Creator.
        </p>
        {c.notes.length > 0 && (
          <ul className="sl-notes">
            {c.notes.map((n, i) => (
              <li key={i}>
                {n.body}
                {n.tags.length > 0 && (
                  <span className="sl-tags">
                    {n.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </span>
                )}
                <small>
                  {n.author} · {day(n.at)}
                </small>
              </li>
            ))}
          </ul>
        )}
        <EntityForm
          action={act.addNote}
          label="Add a note"
          idPrefix="nt"
          submit="Save note"
          fields={[
            { name: "w", label: "", type: "hidden", value: w },
            { name: "id", label: "", type: "hidden", value: appId },
            {
              name: "body",
              label: "Note",
              type: "textarea",
              rows: 2,
              max: 1000,
            },
            {
              name: "tags",
              label: "Tags (comma separated)",
              max: 150,
              hint: "For example: strong fit, check dates",
            },
          ]}
        />
      </section>
    </>
  );
}

// ───────── Creator offer panel ─────────
export async function OfferPanel({
  ws,
  appId,
  client,
}: {
  ws: string;
  appId: string;
  client: Parameters<typeof selection.offer>[0];
}) {
  const r = await selection.offer(client, ws, appId);
  if (!r.ok || !r.value.hold)
    return r.ok && r.value.handoff ? (
      <p>
        <Link
          className="st-btn primary"
          href={`/collaborations/${r.value.handoff}`}
        >
          Open the collaboration workspace
        </Link>
      </p>
    ) : null;
  const h = r.value.hold;
  if (h.status === "held")
    return (
      <section className="sl-offer" aria-labelledby="h-offer">
        <h2 id="h-offer">You are offered a place</h2>
        {h.message && <p className="sl-quote">“{h.message}”</p>}
        <p>
          Answer by <b>{until(h.expires_at)}</b>. Accepting is not an agreement:
          you agree the terms in the negotiation first.
        </p>
        <div className="sl-offer-actions">
          <EntityForm
            action={act.respond}
            label="Accept the place"
            idPrefix="oa"
            submit="Accept the place"
            fields={[
              { name: "id", label: "", type: "hidden", value: appId },
              { name: "accept", label: "", type: "hidden", value: "yes" },
            ]}
          />
          <details>
            <summary>Decline</summary>
            <EntityForm
              action={act.respond}
              label="Decline the place"
              idPrefix="od"
              submit="Decline the place"
              fields={[
                { name: "id", label: "", type: "hidden", value: appId },
                { name: "accept", label: "", type: "hidden", value: "no" },
                {
                  name: "confirm",
                  label:
                    "I want to decline this place (my application will be withdrawn).",
                  type: "checkbox",
                },
              ]}
            />
          </details>
        </div>
      </section>
    );
  if (h.status === "expired")
    return (
      <p className="mk-banner">
        An offered place expired on {until(h.expires_at)} without an answer.
      </p>
    );
  if (h.status === "released")
    return <p className="mk-banner">The Brand withdrew the offered place.</p>;
  return r.value.handoff ? (
    <p>
      <Link
        className="st-btn primary"
        href={`/collaborations/${r.value.handoff}`}
      >
        Open the collaboration workspace
      </Link>
    </p>
  ) : null;
}
export async function HandoffLink({
  client,
  ws,
  collab,
}: {
  client: Parameters<typeof selection.handoff>[0];
  ws: string;
  collab: string;
}) {
  const r = await selection.handoff(client, ws, collab);
  if (!r.ok || !r.value) return null;
  return (
    <p className="mk-banner ok">
      Both sides confirmed. Your collaboration workspace is ready, with the
      agreed terms:{" "}
      <Link href={`/collaborations/${r.value}`}>
        open the collaboration workspace
      </Link>
      . The agreement becomes binding only when both of you accept it there.
    </p>
  );
}
