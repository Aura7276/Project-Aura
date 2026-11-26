import Link from "next/link";
import { notFound } from "next/navigation";
import {
  brandContext,
  market,
  reasonText,
  type MReason,
} from "@/server/market/service";
import { eligible } from "@/server/auth/session";
import { EntityForm, type FieldDef } from "@/features/creator-profile/forms";
import {
  categories,
  categoryHelp,
  changeLabels,
  statuses,
  visibilities,
  type Category,
} from "./rules";
import * as act from "./actions";
import type { BrandCampaign } from "./types";
import "./market.css";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
const must = <T,>(
  r: { ok: true; value: T } | { ok: false; error: string },
): T => {
  if (!r.ok) throw new Error("market:" + r.error);
  return r.value;
};
const errorText: Record<string, string> = {
  title: "a title of 5 to 120 characters",
  summary: "a summary of 20 to 300 characters",
  brief: "a brief of at least 50 characters",
  deliverables: "at least one deliverable",
  closes_at: "a closing date in the future",
  money: "a valid amount or range",
  currency: "a currency",
  paid_needs_money: "money as an amount or a range (paid campaigns)",
  affiliate_needs_commission: "the commission rate (affiliate campaigns)",
  compensation: "what the Creator receives",
  event_needs_experience: "the event or experience",
  rights: "usage rights and channels, or mark rights as negotiable",
  exclusivity: "exclusivity of at most 365 days",
  positions: "a valid number of positions",
  ugc_no_follower_minimum: "no follower minimum (UGC)",
  min_followers: "a valid follower minimum",
};
function Banner({ verification }: { verification: string }) {
  return verification === "verified" ? (
    <p className="mk-banner ok">
      Business verified. You can publish campaigns and send invitations.
    </p>
  ) : (
    <p className="mk-banner">
      Your business is not verified yet
      {verification === "revoked" ? " (verification was withdrawn)" : ""}. You
      can prepare private drafts; publishing at any visibility and sending
      invitations need an approved verification. Until Brand onboarding (M14) is
      available, a platform reviewer checks your business.
    </p>
  );
}
export async function BrandHome({ sp }: { sp: SP }) {
  const b = await brandContext(one(sp, "w"));
  const s = must(await market.brandState(b.client, b.workspaceId));
  return (
    <main className="shell" style={{ padding: "1.5rem 1rem 4rem" }}>
      <header className="mk-hero">
        <h1>Campaigns · {b.name}</h1>
        <p>
          Write a campaign with honest, complete terms. Creators see exactly
          what you publish, and every material change is versioned and shown to
          them.
        </p>
      </header>
      <Banner verification={s.verification} />
      <section className="st-card" aria-labelledby="new-h">
        <h2 id="new-h">Start a campaign</h2>
        <EntityForm
          action={act.createCampaign}
          label="Start a campaign"
          idPrefix="nc"
          submit="Create draft"
          fields={[
            { name: "w", label: "", type: "hidden", value: b.workspaceId },
            {
              name: "category",
              label: "Type",
              type: "select",
              options: categories,
              value: "paid",
              required: true,
              hint: Object.entries(categoryHelp)
                .map(([k, v]) => `${categories[k as Category]}: ${v}`)
                .join(" "),
            },
            { name: "title", label: "Working title", max: 120, required: true },
          ]}
        />
      </section>
      <section className="st-card" aria-labelledby="list-h">
        <h2 id="list-h">Your campaigns</h2>
        {s.campaigns.length === 0 ? (
          <p>No campaigns yet.</p>
        ) : (
          <ul className="st-list">
            {s.campaigns.map((c) => (
              <li key={c.id} className="st-item">
                <Link href={`/brand/campaigns/${c.id}`}>
                  <strong>{c.title}</strong>
                </Link>{" "}
                <span className="mk-pill" data-cat={c.category}>
                  {categories[c.category]}
                </span>{" "}
                <span className="mk-pill line">{statuses[c.status]}</span>
                <br />
                <span className="mk-sub">
                  {visibilities[c.visibility]} · version{" "}
                  {c.published_version ?? "not published"}
                  {c.draft_version > (c.published_version ?? 0) &&
                  c.published_version
                    ? " · unpublished changes"
                    : ""}{" "}
                  · {c.bookmarks} saved by Creators
                  {c.review_note ? ` · reviewer: ${c.review_note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
const v = (o: Record<string, unknown> | undefined, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (x, k) =>
        x && typeof x === "object"
          ? (x as Record<string, unknown>)[k]
          : undefined,
      o,
    );
const s = (x: unknown) => (x === undefined || x === null ? "" : String(x));
function fields(c: BrandCampaign, w: string): FieldDef[] {
  const d = c.draft as Record<string, unknown>;
  const closes = s(d.closes_at).slice(0, 10);
  return [
    { name: "id", label: "", type: "hidden", value: c.id },
    { name: "w", label: "", type: "hidden", value: w },
    { name: "category", label: "", type: "hidden", value: c.category },
    {
      name: "visibility",
      label: "Who can see it",
      type: "select",
      options: visibilities,
      value: c.visibility,
      required: true,
    },
    {
      name: "title",
      label: "Title",
      value: s(d.title),
      max: 120,
      required: true,
    },
    {
      name: "summary",
      label: "Summary (shown on cards)",
      type: "textarea",
      rows: 2,
      value: s(d.summary),
      max: 300,
      required: true,
    },
    {
      name: "brief",
      label: "Brief",
      type: "textarea",
      rows: 8,
      value: s(d.brief),
      max: 6000,
      required: true,
      hint: "Describe the work honestly. Never ask Creators to pay anything: application fees and deposits are not allowed and are sent to review.",
    },
    {
      name: "deliverables",
      label: "Deliverables, one per line (for example: 2 x Reel on Instagram)",
      type: "lines",
      value: (
        (d.deliverables as {
          quantity?: number;
          type: string;
          platform?: string;
        }[]) ?? []
      )
        .map(
          (x) =>
            `${x.quantity ?? 1} x ${x.type}${x.platform ? ` on ${x.platform}` : ""}`,
        )
        .join("\n"),
      required: true,
    },
    {
      name: "effort_note",
      label: "Your estimate of the effort",
      value: s(d.effort_note),
      max: 300,
    },
    {
      name: "closes_on",
      label: "Applications close on",
      type: "date",
      value: closes,
      required: true,
    },
    {
      name: "starts_on",
      label: "Work starts on",
      type: "date",
      value: s(d.starts_on),
    },
    {
      name: "positions",
      label: "Number of positions",
      type: "number",
      value: s(d.positions),
      min: 1,
      hint: "Leave empty to show “not disclosed”. Never inflate it.",
    },
    {
      name: "money_type",
      label: "Money",
      type: "select",
      options: { none: "No money", fixed: "A fixed amount", range: "A range" },
      value:
        s(v(d, "compensation.money.type")) ||
        (c.category === "paid" ? "fixed" : "none"),
      required: true,
      hint: "Paid campaigns must state an amount or a range before Creators apply.",
    },
    {
      name: "currency",
      label: "Currency",
      type: "select",
      options: {
        INR: "INR",
        USD: "USD",
        EUR: "EUR",
        GBP: "GBP",
        AED: "AED",
        SGD: "SGD",
      },
      value: s(v(d, "compensation.money.currency")) || "INR",
      required: true,
      showIf: { field: "money_type", in: ["fixed", "range"] },
    },
    {
      name: "money_min",
      label: "Amount (or lower end)",
      type: "number",
      value: s(v(d, "compensation.money.min")),
      min: 1,
      showIf: { field: "money_type", in: ["fixed", "range"] },
    },
    {
      name: "money_max",
      label: "Upper end",
      type: "number",
      value: s(v(d, "compensation.money.max")),
      min: 1,
      showIf: { field: "money_type", in: ["range"] },
    },
    {
      name: "money_negotiable",
      label: "The amount is negotiable",
      type: "checkbox",
      value: !!v(d, "compensation.money.negotiable"),
    },
    {
      name: "products",
      label: "Products the Creator receives",
      value: s(v(d, "compensation.products.description")),
      max: 300,
    },
    {
      name: "product_value",
      label: "Retail value of the products (₹)",
      type: "number",
      value: s(v(d, "compensation.products.value")),
      min: 0,
    },
    {
      name: "services",
      label: "Services the Creator receives",
      value: s(v(d, "compensation.services.description")),
      max: 300,
    },
    {
      name: "experiences",
      label: "Experience or event",
      value: s(v(d, "compensation.experiences.description")),
      max: 300,
    },
    {
      name: "commission_pct",
      label: "Commission (% of attributed sales)",
      type: "number",
      value: s(v(d, "compensation.commission.rate_pct")),
      min: 0,
    },
    {
      name: "commission_terms",
      label: "Commission terms",
      value: s(v(d, "compensation.commission.terms")),
      max: 200,
    },
    {
      name: "usage_months",
      label: "Usage rights (months)",
      type: "number",
      value: s(v(d, "rights.usage_months")),
      min: 0,
    },
    {
      name: "channels",
      label: "Where you will use the content (comma separated)",
      value: ((v(d, "rights.channels") as string[]) ?? []).join(", "),
    },
    {
      name: "whitelisting",
      label: "Paid ads from the Creator's account (whitelisting)",
      type: "checkbox",
      value: !!v(d, "rights.whitelisting"),
    },
    {
      name: "exclusivity_days",
      label: "Exclusivity (days)",
      type: "number",
      value: s(v(d, "rights.exclusivity_days")),
      min: 0,
    },
    {
      name: "exclusivity_scope",
      label: "Exclusivity covers",
      value: s(v(d, "rights.exclusivity_scope")),
      max: 120,
    },
    {
      name: "rights_negotiable",
      label: "Rights are negotiable",
      type: "checkbox",
      value: !!v(d, "rights.negotiable"),
    },
    {
      name: "travel_required",
      label: "Travel is required",
      type: "checkbox",
      value: !!v(d, "travel.required"),
    },
    {
      name: "travel_covered",
      label: "You cover travel costs",
      type: "checkbox",
      value: !!v(d, "travel.covered"),
    },
    {
      name: "remote",
      label: "Can be done remotely",
      type: "checkbox",
      value: d.remote !== false,
    },
    {
      name: "min_followers",
      label:
        "Mandatory: minimum followers on one of the Creator's own accounts",
      type: "number",
      value: s(v(d, "requirements.min_followers")),
      min: 1,
      hint: "One account, never added together. Not allowed for UGC.",
      showIf: undefined,
    },
    {
      name: "platforms",
      label: "Mandatory: platforms (comma separated)",
      value: ((v(d, "requirements.platforms") as string[]) ?? []).join(", "),
    },
    {
      name: "verified_ownership",
      label: "Mandatory: verified account ownership",
      type: "checkbox",
      value: !!v(d, "requirements.verified_ownership"),
    },
    {
      name: "countries",
      label: "Mandatory: Creator countries (two-letter codes, comma separated)",
      value: ((d.countries as string[]) ?? []).join(", "),
    },
    {
      name: "languages",
      label: "Mandatory: content languages (codes like en, hi)",
      value: ((d.languages as string[]) ?? []).join(", "),
    },
    {
      name: "niches",
      label: "Preferred niches (not required)",
      value: ((v(d, "preferred.niches") as string[]) ?? []).join(", "),
    },
    {
      name: "beginner_friendly",
      label: "Open to creators who are starting out",
      type: "checkbox",
      value: !!v(d, "preferred.beginner_friendly"),
    },
    {
      name: "show_applicant_count",
      label:
        "Show Creators how many have applied (only above a privacy threshold)",
      type: "checkbox",
      value: c.show_applicant_count,
    },
  ];
}
export async function BrandCampaignView({ id, sp }: { id: string; sp: SP }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await brandContext(one(sp, "w"));
  const r = await market.brandCampaign(b.client, b.workspaceId, id);
  if (!r.ok) notFound();
  const c = r.value;
  const n = one(sp, "notice") as MReason | undefined;
  const missing = one(sp, "missing");
  const editable = !["closed", "removed"].includes(c.status);
  return (
    <main className="shell" style={{ padding: "1.5rem 1rem 4rem" }}>
      <p>
        <Link href="/brand/campaigns">All campaigns</Link>
      </p>
      <h1>{String(c.draft.title ?? "Campaign")}</h1>
      <p>
        <span className="mk-pill" data-cat={c.category}>
          {categories[c.category]}
        </span>{" "}
        <span className="mk-pill line">{statuses[c.status]}</span>{" "}
        {c.published_version ? (
          <span className="mk-sub">Live version {c.published_version}</span>
        ) : null}
      </p>
      <Banner verification={c.verified ? "verified" : b.verification} />
      {n && (
        <p role="status" className="st-error">
          {reasonText[n] ?? reasonText.generic}
          {missing
            ? ` Missing: ${missing
                .split(",")
                .map((m) => errorText[m] ?? m)
                .join("; ")}.`
            : ""}
        </p>
      )}
      {sp.published && (
        <p role="status" className="st-ok">
          Published. Creators who can see it will find it in the marketplace
          now.
        </p>
      )}
      {sp.review && (
        <p role="status" className="mk-banner">
          Sent to a reviewer before it goes live
          {c.risk_flags.length
            ? ` (${c.risk_flags.join(", ").replace(/_/g, " ")})`
            : ""}
          . A first campaign is always reviewed.
        </p>
      )}
      {c.review_note && (
        <p className="mk-banner">Reviewer note: {c.review_note}</p>
      )}
      {c.errors.length > 0 && (
        <p className="mk-sub">
          Still needed before publishing:{" "}
          {c.errors.map((e) => errorText[e] ?? e).join("; ")}.
        </p>
      )}
      {c.pending_changes && c.pending_changes.length > 0 && (
        <p className="mk-banner">
          Unpublished changes to{" "}
          {c.pending_changes.map((x) => changeLabels[x] ?? x).join(", ")}.
          Publishing them notifies every Creator who saved this campaign.
        </p>
      )}
      <div className="mk-row" style={{ margin: "0.6rem 0 1rem" }}>
        {editable &&
          (c.status !== "published" ||
            c.draft_version > (c.published_version ?? 0)) && (
            <form action={act.publishCampaign}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="w" value={b.workspaceId} />
              <button className="st-btn primary" disabled={!c.verified}>
                {c.published_version ? "Publish changes" : "Publish campaign"}
              </button>
            </form>
          )}
        {c.status === "published" && (
          <form action={act.setCampaignStatus}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="w" value={b.workspaceId} />
            <input type="hidden" name="action" value="pause" />
            <button className="st-btn">Pause</button>
          </form>
        )}
        {c.status === "paused" && (
          <form action={act.setCampaignStatus}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="w" value={b.workspaceId} />
            <input type="hidden" name="action" value="resume" />
            <button className="st-btn">Resume</button>
          </form>
        )}
        {editable && (
          <form action={act.setCampaignStatus}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="w" value={b.workspaceId} />
            <input type="hidden" name="action" value="close" />
            <button className="st-btn">Close campaign</button>
          </form>
        )}
      </div>
      {editable && (
        <section className="st-card" aria-labelledby="ed-h">
          <h2 id="ed-h">Terms</h2>
          <EntityForm
            action={act.saveCampaign}
            label="Campaign terms"
            idPrefix="ce"
            submit="Save draft"
            fields={fields(c, b.workspaceId)}
          />
        </section>
      )}
      {c.visibility === "invite_only" && (
        <section className="st-card" aria-labelledby="inv-h">
          <h2 id="inv-h">Invitations</h2>
          <form action={act.inviteCreator}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="w" value={b.workspaceId} />
            <div className="st-field">
              <label htmlFor="inv-c">Creator workspace id</label>
              <input id="inv-c" name="creator" required />
            </div>
            <button className="st-btn" disabled={!c.verified}>
              Invite
            </button>
          </form>
          {c.invited.length > 0 && (
            <ul className="st-list">
              {c.invited.map((i) => (
                <li key={i.workspace} className="st-item">
                  {i.name} · {i.invited_at.slice(0, 10)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section className="st-card" aria-labelledby="ver-h">
        <h2 id="ver-h">Versions</h2>
        <ol className="st-list">
          {c.versions.map((x) => (
            <li key={x.version} className="st-item">
              Version {x.version} ·{" "}
              {x.published_at
                ? `published ${x.published_at.slice(0, 16).replace("T", " ")}`
                : "draft"}
              {x.material
                ? ` · material: ${x.changes.map((k) => changeLabels[k] ?? k).join(", ")}`
                : ""}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
export async function ReviewView({ sp }: { sp: SP }) {
  const { client } = await eligible();
  const q = await market.reviewQueue(client);
  if (!q.ok) notFound();
  const v2 = q.value;
  const Decide = ({
    kind,
    id,
    options,
  }: {
    kind: string;
    id: string;
    options: Record<string, string>;
  }) => (
    <form action={act.review} className="mk-row">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`d-${id}`}>
        Decision
      </label>
      <select id={`d-${id}`} name="decision">
        {Object.entries(options).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`r-${id}`}>
        Reason
      </label>
      <input
        id={`r-${id}`}
        name="reason"
        placeholder="Reason (required)"
        required
        minLength={3}
        maxLength={500}
      />
      <button className="st-btn">Record</button>
    </form>
  );
  return (
    <main className="shell" style={{ padding: "2rem 1rem" }}>
      <h1>Marketplace review</h1>
      <p>
        Restricted to granted reviewers with a verified authenticator. You
        cannot decide on a workspace you belong to. Every decision needs a
        reason and is audited.
      </p>
      {sp.notice && (
        <p className="st-error" role="status">
          That decision could not be saved.
        </p>
      )}
      {sp.decided && (
        <p className="st-ok" role="status">
          Decision recorded.
        </p>
      )}
      <h2>Business verification (interim, until M14)</h2>
      {v2.brands.length === 0 ? (
        <p>No Brands waiting.</p>
      ) : (
        <ul>
          {v2.brands.map((b) => (
            <li key={b.id}>
              <strong>{b.name}</strong> · {b.business_kind} · {b.verification} ·{" "}
              {b.drafts} draft(s)
              <Decide
                kind="brand"
                id={b.id}
                options={{ verified: "Verify", revoked: "Do not verify" }}
              />
            </li>
          ))}
        </ul>
      )}
      <h2>Campaigns waiting for review</h2>
      {v2.campaigns.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {v2.campaigns.map((c) => (
            <li key={c.id} style={{ marginBottom: "1rem" }}>
              <strong>{c.title}</strong> · {c.brand} · {c.category} · flags:{" "}
              {c.flags.join(", ") || "none"}
              <p>{c.summary}</p>
              <details>
                <summary>Brief</summary>
                <p style={{ whiteSpace: "pre-line" }}>{c.brief}</p>
              </details>
              <Decide
                kind="campaign"
                id={c.id}
                options={{
                  approved: "Approve and publish",
                  rejected: "Send back",
                  removed: "Remove",
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <h2>Reports</h2>
      {v2.reports.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {v2.reports.map((r) => (
            <li key={r.id} style={{ marginBottom: "1rem" }}>
              <strong>{r.title}</strong> · {r.brand} ·{" "}
              {r.reason.replace(/_/g, " ")}
              {r.details ? `: ${r.details}` : ""}
              <Decide
                kind="report"
                id={r.id}
                options={{ actioned: "Actioned", dismissed: "Dismissed" }}
              />
              <Decide
                kind="campaign"
                id={r.campaign_id}
                options={{
                  removed: "Remove the campaign",
                  restored: "Restore",
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
