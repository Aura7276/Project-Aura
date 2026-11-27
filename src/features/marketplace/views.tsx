import Link from "next/link";
import { notFound } from "next/navigation";
import { studioContext } from "@/server/studio/service";
import { market, reasonText, type MReason } from "@/server/market/service";
import { brand as brandApi } from "@/server/brand/service";
import { campaigns as campaignsApi } from "@/server/campaigns/service";
import {
  categories,
  categoryHelp,
  changeLabels,
  compensationParts,
  deliverableText,
  positionsText,
  rightsText,
  daysLeft,
  type Category,
} from "./rules";
import { assess } from "./assessment";
import { compareRows } from "./compare";
import { emptyReasons } from "./empty";
import {
  CampaignCard,
  Checklist,
  Empty,
  EligibilityPill,
  MarketTabs,
} from "./ui";
import { ReportForm } from "./forms";
import * as act from "./actions";
import type { Card } from "./types";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) =>
  typeof sp[k] === "string" ? (sp[k] as string) : undefined;
const must = <T,>(
  r: { ok: true; value: T } | { ok: false; error: string },
): T => {
  if (!r.ok) throw new Error("market:" + r.error);
  return r.value;
};
const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function Notice({ sp }: { sp: SP }) {
  const n = one(sp, "notice") as MReason | undefined;
  if (n)
    return (
      <p role="status" aria-live="polite" className="st-error">
        {reasonText[n] ?? reasonText.generic}
      </p>
    );
  return (
    <p role="status" aria-live="polite" className="st-ok">
      {["saved", "deleted", "updated"].some((k) => sp[k]) ? "Done." : ""}
    </p>
  );
}
function Hero({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="mk-hero">
      <h1>{title}</h1>
      <p>{lead}</p>
      <p style={{ fontSize: "0.85rem" }}>
        Every Brand here has passed business verification. There are no
        application fees, ever.
      </p>
    </header>
  );
}
function Grid({
  items,
  back,
  compare,
}: {
  items: Card[];
  back: string;
  compare?: boolean;
}) {
  return (
    <ul className="mk-grid">
      {items.map((c) => (
        <CampaignCard
          key={c.id}
          c={c}
          back={back}
          compareIds={compare ? [] : undefined}
        />
      ))}
    </ul>
  );
}
const filterKeys = [
  "q",
  "category",
  "eligible_only",
  "money_only",
  "min_money",
  "remote_only",
  "no_exclusivity",
  "no_travel",
  "max_deliverables",
] as const;
function readFilters(sp: SP): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  for (const k of filterKeys) {
    const v = one(sp, k);
    if (!v) continue;
    if (
      [
        "eligible_only",
        "money_only",
        "remote_only",
        "no_exclusivity",
        "no_travel",
      ].includes(k)
    )
      f[k] = v === "on" || v === "true";
    else if (["min_money", "max_deliverables"].includes(k)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n < 1e9) f[k] = n;
    } else if (k === "category") {
      if (v in categories) f[k] = v;
    } else f[k] = v.slice(0, 80);
  }
  return f;
}
function Filters({ sp, action }: { sp: SP; action: string }) {
  return (
    <form
      method="get"
      action={action}
      className="mk-filters"
      aria-label="Filter campaigns"
    >
      <div className="st-field">
        <label htmlFor="mf-q">Search</label>
        <input
          id="mf-q"
          name="q"
          maxLength={80}
          defaultValue={one(sp, "q") ?? ""}
          placeholder="Brand, topic or title"
        />
      </div>
      <div className="st-field">
        <label htmlFor="mf-c">Type</label>
        <select
          id="mf-c"
          name="category"
          defaultValue={one(sp, "category") ?? ""}
        >
          <option value="">All types</option>
          {Object.entries(categories).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="st-field">
        <label htmlFor="mf-m">Minimum money (₹)</label>
        <input
          id="mf-m"
          name="min_money"
          type="number"
          min={0}
          inputMode="numeric"
          defaultValue={one(sp, "min_money") ?? ""}
        />
      </div>
      <div className="st-field">
        <label htmlFor="mf-d">At most this many deliverables</label>
        <input
          id="mf-d"
          name="max_deliverables"
          type="number"
          min={1}
          inputMode="numeric"
          defaultValue={one(sp, "max_deliverables") ?? ""}
        />
      </div>
      <div className="mk-checks">
        {(
          [
            ["eligible_only", "Only campaigns I am eligible for"],
            ["money_only", "Includes guaranteed money"],
            ["remote_only", "Remote only"],
            ["no_exclusivity", "No exclusivity"],
            ["no_travel", "No travel"],
          ] as const
        ).map(([k, l]) => (
          <label key={k}>
            <input
              type="checkbox"
              name={k}
              defaultChecked={one(sp, k) === "on"}
            />{" "}
            {l}
          </label>
        ))}
      </div>
      <div className="mk-row">
        <button className="st-btn primary">Show campaigns</button>
        <Link href={action}>Clear</Link>
      </div>
    </form>
  );
}
export async function ForYouView({ sp }: { sp: SP }) {
  const c = await studioContext();
  const feed = must(await market.feed(c.client, c.workspaceId, {}));
  // diversity: at most two campaigns per Brand in the first twelve, so one Brand cannot fill the page (F15)
  const first: Card[] = [];
  const rest: Card[] = [];
  const per = new Map<string, number>();
  for (const it of feed.items) {
    const n = per.get(it.brand.id) ?? 0;
    if (first.length < 12 && n < 2) {
      first.push(it);
      per.set(it.brand.id, n + 1);
    } else rest.push(it);
  }
  const items = [...first, ...rest];
  const e = emptyReasons({
    filters: {},
    hidden: feed.hidden_count,
    belowThreshold: feed.below_threshold,
    total: feed.items.length,
  });
  return (
    <main>
      <Hero
        title="Campaigns for you"
        lead="Ordered by what fits you, with the reasons shown on every card. Eligibility is checked first and never traded for ranking; verification never buys a higher place."
      />
      <MarketTabs current="/creator/marketplace" />
      <Notice sp={sp} />
      {feed.below_threshold && (
        <p className="mk-banner">
          You are still building your audience, so UGC, barter and event
          campaigns with no follower minimum come first. Influencer campaigns
          that need a following are still shown so you can see what is out
          there.
        </p>
      )}
      <p className="mk-sub">
        Browse by type:{" "}
        {Object.entries(categories).map(([k, l], i) => (
          <span key={k}>
            {i ? " · " : ""}
            <Link href={`/creator/marketplace/category/${k}`}>{l}</Link>
          </span>
        ))}
      </p>
      {items.length === 0 ? (
        <Empty {...e} />
      ) : (
        <Grid items={items} back="/creator/marketplace" compare />
      )}
      {feed.preferences.length === 0 && (
        <p className="mk-sub" style={{ marginTop: "1rem" }}>
          Tell us which collaboration types interest you to improve this list:{" "}
          <Link href="/onboarding/creator/preferences">
            collaboration preferences
          </Link>
          .
        </p>
      )}
    </main>
  );
}
export async function ExploreView({
  sp,
  category,
}: {
  sp: SP;
  category?: Category;
}) {
  const c = await studioContext();
  const f = readFilters(sp);
  if (category) f.category = category;
  const feed = must(await market.feed(c.client, c.workspaceId, f));
  const action = category
    ? `/creator/marketplace/category/${category}`
    : "/creator/marketplace/explore";
  const e = emptyReasons({
    filters: f,
    hidden: feed.hidden_count,
    belowThreshold: feed.below_threshold,
    total: feed.items.length,
  });
  return (
    <main>
      <Hero
        title={
          category ? `${categories[category]} campaigns` : "Explore campaigns"
        }
        lead={
          category
            ? categoryHelp[category]
            : "Search and filter every campaign you can see, including ones you are not yet eligible for, with the reason."
        }
      />
      <MarketTabs current={category ? "" : "/creator/marketplace/explore"} />
      <Filters sp={sp} action={action} />
      <form
        action={act.saveSearch}
        className="mk-row"
        style={{ marginBottom: "1rem" }}
        aria-label="Save this search"
      >
        {Object.entries(f).map(([k, v]) => (
          <input
            key={k}
            type="hidden"
            name={k}
            value={typeof v === "boolean" ? (v ? "on" : "") : String(v)}
          />
        ))}
        <label htmlFor="ss-n" className="sr-only">
          Name this search
        </label>
        <input
          id="ss-n"
          name="name"
          placeholder="Name this search"
          maxLength={60}
        />
        <label>
          <input type="checkbox" name="alert" defaultChecked /> Alert me about
          new matches
        </label>
        <button className="st-btn">Save search</button>
      </form>
      <p className="mk-sub" aria-live="polite">
        {feed.items.length} campaign{feed.items.length === 1 ? "" : "s"}
        {feed.hidden_count
          ? ` · ${feed.hidden_count} hidden by your preferences`
          : ""}
      </p>
      {feed.items.length === 0 ? (
        <Empty {...e} />
      ) : (
        <Grid items={feed.items} back={action} compare />
      )}
    </main>
  );
}
async function loadDetail(id: string) {
  if (!uuidRe.test(id)) notFound();
  const c = await studioContext();
  const r = await market.campaign(c.client, c.workspaceId, id);
  if (!r.ok) notFound(); // invisible and nonexistent look the same
  return { c, d: r.value };
}
function DetailTabs({ id, current }: { id: string; current: string }) {
  const t: [string, string][] = [
    ["", "Brief"],
    ["/eligibility", "Eligibility"],
    ["/assessment", "Review the terms"],
    ["/updates", "Updates"],
  ];
  return (
    <nav aria-label="Campaign sections" className="mk-tabs">
      {t.map(([p, l]) => (
        <Link
          key={p}
          href={`/creator/marketplace/${id}${p}`}
          aria-current={p === current ? "page" : undefined}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
function Aside({
  d,
  back,
  remaining = null,
}: {
  d: Awaited<ReturnType<typeof loadDetail>>["d"];
  back: string;
  remaining?: number | null;
}) {
  const left = daysLeft(d.closes_at);
  return (
    <aside className="mk-aside" aria-label="Summary and actions">
      <section className="st-card" aria-labelledby="as-h">
        <h2 id="as-h" style={{ fontSize: "1.05rem" }}>
          At a glance
        </h2>
        <dl className="mk-terms">
          <dt>Compensation</dt>
          {compensationParts(d.compensation).length ? (
            compensationParts(d.compensation).map((p) => (
              <dd key={p.kind}>
                <strong>{p.kind}:</strong> {p.text}
              </dd>
            ))
          ) : (
            <dd>Not stated</dd>
          )}
          <dt>Positions</dt>
          <dd>
            {positionsText(d.positions)}
            {remaining !== null && d.positions
              ? ` · ${remaining} still open`
              : ""}
          </dd>
          <dt>Applicants</dt>
          <dd>
            {d.applicants.status === "not_shared"
              ? "The Brand does not share applicant numbers."
              : d.applicants.reason}
          </dd>
          <dt>Closes</dt>
          <dd>
            {d.closes_at.slice(0, 10)} ({left} day{left === 1 ? "" : "s"} left)
          </dd>
        </dl>
        <p>
          <EligibilityPill e={d.eligibility} />
        </p>
        <form action={act.checkApply}>
          <input type="hidden" name="id" value={d.id} />
          <button className="st-btn primary" style={{ width: "100%" }}>
            Check and apply
          </button>
        </form>
        <form action={act.toggleBookmark}>
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="on" value={d.bookmarked ? "no" : "yes"} />
          <input type="hidden" name="back" value={back} />
          <button
            className="st-btn"
            style={{ width: "100%" }}
            aria-pressed={d.bookmarked}
          >
            {d.bookmarked ? "Saved" : "Save campaign"}
          </button>
        </form>
        <p>
          <Link href={`/creator/marketplace/compare?ids=${d.id}`}>
            Add to comparison
          </Link>
        </p>
      </section>
      <section className="st-card" aria-labelledby="br-h">
        <h2 id="br-h" style={{ fontSize: "1.05rem" }}>
          {d.brand_profile.name}
        </h2>
        <p className="mk-sub">
          Business verified
          {d.brand_profile.verified_since
            ? ` since ${d.brand_profile.verified_since.slice(0, 10)}`
            : ""}{" "}
          · {d.brand_profile.published_campaigns} campaign
          {d.brand_profile.published_campaigns === 1 ? "" : "s"} published on
          AURA. Feedback from completed collaborations appears once
          collaborations exist.
        </p>
        <p>
          <Link href={`/creator/marketplace/brand/${d.brand.id}`}>
            More from this Brand
          </Link>
        </p>
        <form action={act.hide}>
          <input type="hidden" name="kind" value="brand" />
          <input type="hidden" name="value" value={d.brand.id} />
          <input type="hidden" name="on" value="yes" />
          <input type="hidden" name="back" value="/creator/marketplace" />
          <button className="st-btn">Hide this Brand</button>
        </form>
      </section>
    </aside>
  );
}
export async function DetailView({ id, sp }: { id: string; sp: SP }) {
  const { c, d } = await loadDetail(id);
  // M17: places still open (positions minus Creators already selected)
  const av = await campaignsApi.availability(c.client, c.workspaceId, id);
  const remaining = av.ok ? av.value.remaining : null;
  return (
    <main>
      <p>
        <Link href="/creator/marketplace">Marketplace</Link>
      </p>
      <div className="mk-row">
        <span className="mk-pill" data-cat={d.category}>
          {categories[d.category]}
        </span>
        {d.visibility === "invite_only" && (
          <span className="mk-pill line">You were invited</span>
        )}
        {d.visibility === "restricted" && (
          <span className="mk-pill line">
            Shown because you meet the requirements
          </span>
        )}
      </div>
      <h1>{d.title}</h1>
      <DetailTabs id={id} current="" />
      <Notice sp={sp} />
      <div className="mk-detail">
        <div>
          <section className="st-card" aria-labelledby="sum-h">
            <h2 id="sum-h">Summary</h2>
            <p>{d.summary}</p>
            <h2>Brief</h2>
            <p style={{ whiteSpace: "pre-line" }}>{d.brief}</p>
          </section>
          <section className="st-card" aria-labelledby="del-h">
            <h2 id="del-h">Deliverables</h2>
            <ul>
              {d.deliverables.map((x, i) => (
                <li key={i}>{deliverableText(x)}</li>
              ))}
            </ul>
            {d.effort_note && (
              <p className="mk-sub">
                Brand&apos;s note on effort: {d.effort_note}
              </p>
            )}
          </section>
          <section className="st-card" aria-labelledby="rt-h">
            <h2 id="rt-h">Rights, travel and location</h2>
            <p>{rightsText(d.rights)}</p>
            <p>
              {d.travel?.required
                ? d.travel.covered
                  ? "Travel is required and covered by the Brand."
                  : "Travel is required. The Brand has not said it covers costs."
                : "No travel required."}{" "}
              {d.remote ? "Remote work." : "On location."}
              {d.countries.length
                ? ` For creators in ${d.countries.join(", ")}.`
                : ""}
              {d.languages.length
                ? ` Content in ${d.languages.join(", ")}.`
                : ""}
            </p>
          </section>
          <details className="st-card">
            <summary>Report this campaign</summary>
            {d.reported ? (
              <p>
                You have reported this campaign. A reviewer will look at it.
              </p>
            ) : (
              <ReportForm action={act.report} id={d.id} />
            )}
          </details>
        </div>
        <Aside
          d={d}
          back={`/creator/marketplace/${id}`}
          remaining={remaining}
        />
      </div>
    </main>
  );
}
export async function EligibilityView({ id, sp }: { id: string; sp: SP }) {
  const { d } = await loadDetail(id);
  const apply = one(sp, "apply");
  return (
    <main>
      <p>
        <Link href="/creator/marketplace">Marketplace</Link>
      </p>
      <h1>{d.title}</h1>
      <DetailTabs id={id} current="/eligibility" />
      {apply === "blocked" && (
        <p className="mk-banner" role="status">
          You cannot apply yet: at least one mandatory requirement is not met or
          not known. The list below says which, and what would change it.
        </p>
      )}
      {apply === "eligible" && (
        <p className="mk-banner ok" role="status">
          You meet every mandatory requirement, checked just now.{" "}
          <Link href={`/creator/marketplace/${id}/apply`}>
            Start your application
          </Link>
          .
        </p>
      )}
      <section className="st-card" aria-labelledby="el-h">
        <h2 id="el-h">
          Your eligibility <EligibilityPill e={d.eligibility} />
        </h2>
        <p className="mk-sub">
          Mandatory requirements decide whether you can apply. Preferred
          attributes only explain why a campaign is shown to you. Missing
          information is never guessed.
        </p>
        <Checklist e={d.eligibility} />
        {!d.eligibility.eligible && (
          <p>
            <Link href="/creator/socials">Update your social accounts</Link> ·{" "}
            <Link href="/creator/studio">Update your profile</Link>
          </p>
        )}
      </section>
    </main>
  );
}
export async function AssessmentView({ id }: { id: string }) {
  const { d } = await loadDetail(id);
  const a = assess(d);
  return (
    <main>
      <p>
        <Link href="/creator/marketplace">Marketplace</Link>
      </p>
      <h1>{d.title}</h1>
      <DetailTabs id={id} current="/assessment" />
      <p className="mk-banner">
        A checklist built from this campaign&apos;s own terms, not an AI
        assessment (the AI assistant arrives with M07). It does not judge the
        Brand or tell you what to do.
      </p>
      <div className="st-grid">
        <section className="st-card" aria-labelledby="as-m">
          <h2 id="as-m">Missing or unclear</h2>
          {a.missing.length ? (
            <ul>
              {a.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p>The main terms are stated.</p>
          )}
        </section>
        <section className="st-card" aria-labelledby="as-q">
          <h2 id="as-q">Questions worth asking</h2>
          <ul>
            {a.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
        <section className="st-card" aria-labelledby="as-e">
          <h2 id="as-e">Effort and compensation</h2>
          <p>{a.effort}</p>
          <p>{a.compensationNote}</p>
          <p>{a.rights}</p>
        </section>
      </div>
      <ul className="mk-sub">
        {a.limits.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </main>
  );
}
export async function UpdatesView({ id }: { id: string }) {
  const { d } = await loadDetail(id);
  return (
    <main>
      <p>
        <Link href="/creator/marketplace">Marketplace</Link>
      </p>
      <h1>{d.title}</h1>
      <DetailTabs id={id} current="/updates" />
      <section className="st-card" aria-labelledby="up-h">
        <h2 id="up-h">Change history</h2>
        <ol className="st-list">
          {d.updates.map((u) => (
            <li key={u.version} className="st-item">
              Version {u.version} ·{" "}
              {u.published_at.slice(0, 16).replace("T", " ")} ·{" "}
              {u.version === 1
                ? "First published"
                : u.material
                  ? `Material change: ${u.changes.map((c) => changeLabels[c] ?? c).join(", ")}`
                  : "Wording only"}
            </li>
          ))}
        </ol>
        <p className="mk-sub">
          If you save a campaign, you are told about material changes. A change
          never alters an agreement you have already accepted.
        </p>
      </section>
    </main>
  );
}
export async function SavedView({
  sp,
  kind,
}: {
  sp: SP;
  kind: "saved" | "recent";
}) {
  const c = await studioContext();
  const l = must(await market.lists(c.client, c.workspaceId));
  const items = kind === "saved" ? l.saved : l.recent;
  return (
    <main>
      <Hero
        title={kind === "saved" ? "Saved campaigns" : "Recently viewed"}
        lead={
          kind === "saved"
            ? "Campaigns you saved. You are told when their terms change materially or they close."
            : "The last campaigns you opened."
        }
      />
      <MarketTabs
        current={
          kind === "saved"
            ? "/creator/marketplace/saved"
            : "/creator/marketplace/recent"
        }
      />
      <Notice sp={sp} />
      {items.length === 0 ? (
        <Empty
          reasons={[
            kind === "saved"
              ? "You have not saved any campaign."
              : "You have not opened any campaign yet.",
          ]}
          actions={[
            { label: "Browse campaigns", href: "/creator/marketplace" },
          ]}
        />
      ) : (
        <ul className="mk-grid">
          {items.map((x) =>
            "unavailable" in x ? (
              <li key={x.id} className="mk-card">
                <h3>{x.title}</h3>
                <p className="mk-sub">
                  No longer available: it closed, was paused, or you no longer
                  meet its visibility rules.
                </p>
                <form action={act.toggleBookmark}>
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="on" value="no" />
                  <input
                    type="hidden"
                    name="back"
                    value="/creator/marketplace/saved"
                  />
                  <button className="st-btn">Remove</button>
                </form>
              </li>
            ) : (
              <CampaignCard
                key={x.id}
                c={x}
                back={`/creator/marketplace/${kind}`}
              />
            ),
          )}
        </ul>
      )}
    </main>
  );
}
export async function CompareView({ sp }: { sp: SP }) {
  const c = await studioContext();
  const ids = (one(sp, "ids") ?? "")
    .split(",")
    .filter((x) => uuidRe.test(x))
    .slice(0, 4);
  const cards: Card[] = [];
  for (const id of ids) {
    const r = await market.campaign(c.client, c.workspaceId, id);
    if (r.ok) cards.push(r.value);
  }
  const l = must(await market.lists(c.client, c.workspaceId));
  const candidates = [
    ...l.saved.filter((x): x is Card => !("unavailable" in x)),
    ...l.recent,
  ].filter(
    (x, i, a) => a.findIndex((y) => y.id === x.id) === i && !ids.includes(x.id),
  );
  return (
    <main>
      <Hero
        title="Compare campaigns"
        lead="Up to four side by side: compensation, effort, rights and your eligibility. No winner is picked for you."
      />
      <MarketTabs current="/creator/marketplace/compare" />
      {cards.length === 0 ? (
        <p>
          Choose campaigns to compare from your saved and recently viewed list
          below, or use “Compare” on any card.
        </p>
      ) : (
        <table className="mk-compare">
          <caption className="sr-only">Campaign comparison</caption>
          <thead>
            <tr>
              <th scope="col">Term</th>
              {cards.map((x) => (
                <th key={x.id} scope="col">
                  <Link href={`/creator/marketplace/${x.id}`}>{x.title}</Link>
                  <br />
                  <span className="mk-sub">{x.brand.name}</span>
                  <br />
                  <Link
                    href={`?ids=${ids.filter((i) => i !== x.id).join(",")}`}
                    className="mk-sub"
                  >
                    Remove
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compareRows(cards).map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.values.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {candidates.length > 0 && ids.length < 4 && (
        <section style={{ marginTop: "1rem" }} aria-labelledby="add-h">
          <h2 id="add-h" style={{ fontSize: "1.05rem" }}>
            Add to the comparison
          </h2>
          <ul className="st-list">
            {candidates.slice(0, 8).map((x) => (
              <li key={x.id} className="st-item">
                <Link href={`?ids=${[...ids, x.id].join(",")}`}>{x.title}</Link>{" "}
                <span className="mk-sub">({x.brand.name})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
export async function SearchesView({ sp }: { sp: SP }) {
  const c = await studioContext();
  const l = must(await market.lists(c.client, c.workspaceId));
  const q = (f: Record<string, unknown>) =>
    new URLSearchParams(
      Object.entries(f).map(([k, v]) => [
        k,
        typeof v === "boolean" ? (v ? "on" : "") : String(v),
      ]),
    ).toString();
  return (
    <main>
      <Hero
        title="Saved searches"
        lead="Re-run a search in one click and choose which ones alert you about new matching campaigns (in AURA; email arrives later)."
      />
      <MarketTabs current="/creator/marketplace/searches" />
      <Notice sp={sp} />
      {l.searches.length === 0 ? (
        <Empty
          reasons={["You have no saved searches."]}
          actions={[
            {
              label: "Explore and save a search",
              href: "/creator/marketplace/explore",
            },
          ]}
        />
      ) : (
        <ul className="st-list">
          {l.searches.map((s) => (
            <li key={s.id} className="st-item">
              <strong>
                <Link href={`/creator/marketplace/explore?${q(s.filters)}`}>
                  {s.name}
                </Link>
              </strong>{" "}
              <span className="mk-sub">
                {Object.keys(s.filters).length} filter
                {Object.keys(s.filters).length === 1 ? "" : "s"}
              </span>
              <div className="mk-row">
                <form action={act.setAlert}>
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="on"
                    value={s.alert ? "no" : "yes"}
                  />
                  <button className="st-btn" aria-pressed={s.alert}>
                    {s.alert ? "Alerts on" : "Alerts off"}
                    <span className="sr-only"> for {s.name}</span>
                  </button>
                </form>
                <form action={act.deleteSearch}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="st-btn">
                    Delete<span className="sr-only"> {s.name}</span>
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
export async function AlertsView() {
  const c = await studioContext();
  const l = must(await market.lists(c.client, c.workspaceId));
  return (
    <main>
      <Hero
        title="Alerts"
        lead="New matches for your saved searches, invitations, material changes and closing campaigns you saved."
      />
      <MarketTabs current="/creator/marketplace/alerts" />
      {l.deadlines.length > 0 && (
        <section className="st-card" aria-labelledby="dl-h">
          <h2 id="dl-h">Closing soon</h2>
          <ul className="st-list">
            {l.deadlines.map((x) => (
              <li key={x.id} className="st-item">
                <Link href={`/creator/marketplace/${x.id}`}>{x.title}</Link> ·
                closes {x.closes_at.slice(0, 10)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="st-card" aria-labelledby="nt-h">
        <h2 id="nt-h">Notifications</h2>
        {l.notifications.length === 0 ? (
          <p>No alerts yet.</p>
        ) : (
          <>
            <form action={act.readAll}>
              <button className="st-btn">Mark all as read</button>
            </form>
            <ul className="st-list">
              {l.notifications.map((n) => (
                <li key={n.id} className="st-item" data-read={n.read}>
                  {!n.read && <span className="mk-pill">New</span>}{" "}
                  <Link
                    href={`/creator/marketplace/${n.campaign_id}${n.kind === "material_change" ? "/updates" : ""}`}
                  >
                    {n.title}
                  </Link>
                  {n.detail && (
                    <>
                      <br />
                      <span className="mk-sub">{n.detail}</span>
                    </>
                  )}
                  <br />
                  <span className="mk-sub">
                    {n.created_at.slice(0, 16).replace("T", " ")}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="mk-sub">
        Choose which saved searches alert you on{" "}
        <Link href="/creator/marketplace/searches">Saved searches</Link>.
      </p>
    </main>
  );
}
export async function PreferencesView({ sp }: { sp: SP }) {
  const c = await studioContext();
  const l = must(await market.lists(c.client, c.workspaceId));
  const hiddenCats = new Set(
    l.hidden.filter((h) => h.kind === "category").map((h) => h.value),
  );
  return (
    <main>
      <Hero
        title="Marketplace preferences"
        lead="Hide what you never want to see. Everything here can be undone."
      />
      <MarketTabs current="/creator/marketplace/preferences" />
      <Notice sp={sp} />
      <section className="st-card" aria-labelledby="pc-h">
        <h2 id="pc-h">Campaign types</h2>
        <ul className="st-list">
          {Object.entries(categories).map(([k, label]) => (
            <li key={k} className="st-item mk-row">
              <span style={{ flex: 1 }}>
                {label}{" "}
                <span className="mk-sub">{categoryHelp[k as Category]}</span>
              </span>
              <form action={act.hide}>
                <input type="hidden" name="kind" value="category" />
                <input type="hidden" name="value" value={k} />
                <input
                  type="hidden"
                  name="on"
                  value={hiddenCats.has(k) ? "no" : "yes"}
                />
                <input
                  type="hidden"
                  name="back"
                  value="/creator/marketplace/preferences"
                />
                <button className="st-btn">
                  {hiddenCats.has(k) ? "Show" : "Hide"}
                  <span className="sr-only"> {label}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
        <p className="mk-sub">
          What you are interested in comes from your{" "}
          <Link href="/onboarding/creator/preferences">
            collaboration preferences
          </Link>
          .
        </p>
      </section>
      <section className="st-card" aria-labelledby="pb-h">
        <h2 id="pb-h">Hidden Brands</h2>
        {l.hidden.filter((h) => h.kind === "brand").length === 0 ? (
          <p>None.</p>
        ) : (
          <ul className="st-list">
            {l.hidden
              .filter((h) => h.kind === "brand")
              .map((h) => (
                <li key={h.value} className="st-item mk-row">
                  <span style={{ flex: 1 }}>{h.label}</span>
                  <form action={act.hide}>
                    <input type="hidden" name="kind" value="brand" />
                    <input type="hidden" name="value" value={h.value} />
                    <input type="hidden" name="on" value="no" />
                    <input
                      type="hidden"
                      name="back"
                      value="/creator/marketplace/preferences"
                    />
                    <button className="st-btn">
                      Show again<span className="sr-only"> {h.label}</span>
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        )}
      </section>
    </main>
  );
}
export async function BrandView({ id }: { id: string }) {
  if (!uuidRe.test(id)) notFound();
  const c = await studioContext();
  const r = await market.brandPage(c.client, c.workspaceId, id);
  if (!r.ok) notFound();
  const b = r.value;
  // M14: the Brand's published profile, if it chose to publish one (never legal or private planning data)
  const pub = await brandApi.publicFor(c.client, c.workspaceId, id);
  const about = pub.ok && pub.value.found ? pub.value.profile : null;
  return (
    <main>
      <p>
        <Link href="/creator/marketplace">Marketplace</Link>
      </p>
      <header className="mk-hero">
        <h1>{b.name}</h1>
        <p>
          Business verified
          {b.verified_since
            ? ` since ${b.verified_since.slice(0, 10)}`
            : ""} · {b.published_campaigns} campaign
          {b.published_campaigns === 1 ? "" : "s"} published on AURA. No rating
          is shown; collaboration feedback appears once collaborations exist.
        </p>
      </header>
      {about && (
        <section className="st-card" aria-labelledby="bp-about-h">
          <h2 id="bp-about-h">About {about.name}</h2>
          {about.tagline && (
            <p>
              <b>{about.tagline}</b>
            </p>
          )}
          {about.about && (
            <p style={{ whiteSpace: "pre-wrap" }}>{about.about}</p>
          )}
          {about.products.length > 0 && (
            <p>
              Products and services:{" "}
              {about.products.map((x) => x.name).join(", ")}
            </p>
          )}
          {about.website && (
            <p>
              <a
                href={about.website}
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                {about.website.replace(/^https:\/\//, "")}
              </a>
            </p>
          )}
        </section>
      )}
      {b.hidden && (
        <p className="mk-banner">
          You have hidden this Brand.{" "}
          <Link href="/creator/marketplace/preferences">Show it again</Link>
        </p>
      )}
      {b.campaigns.length === 0 ? (
        <p>No live campaigns you can see.</p>
      ) : (
        <ul className="mk-grid">
          {b.campaigns.map((x) => (
            <CampaignCard
              key={x.id}
              c={x}
              back={`/creator/marketplace/brand/${id}`}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
