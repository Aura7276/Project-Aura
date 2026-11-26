import Link from "next/link";
import {
  categories,
  compensationParts,
  daysLeft,
  deliverableCount,
  moneyText,
  type Category,
} from "./rules";
import type { Card, Eligibility } from "./types";
import * as act from "./actions";
import "./market.css";

const tabs: [string, string][] = [
  ["/creator/marketplace", "For you"],
  ["/creator/marketplace/explore", "Explore"],
  ["/creator/marketplace/saved", "Saved"],
  ["/creator/marketplace/recent", "Recently viewed"],
  ["/creator/marketplace/compare", "Compare"],
  ["/creator/marketplace/searches", "Saved searches"],
  ["/creator/marketplace/alerts", "Alerts"],
  ["/creator/marketplace/preferences", "Preferences"],
];
export function MarketTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Marketplace sections" className="mk-tabs">
      {tabs.map(([h, l]) => (
        <Link
          key={h}
          href={h}
          aria-current={h === current ? "page" : undefined}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
export function EligibilityPill({ e }: { e: Eligibility }) {
  if (e.eligible) return <span className="mk-pill ok">You are eligible</span>;
  const unknown =
    e.hard.some((h) => h.status === "unknown") &&
    !e.hard.some((h) => h.status === "not_met");
  return (
    <span className={`mk-pill ${unknown ? "unk" : "no"}`}>
      {unknown ? "Missing information" : "Not eligible"}
    </span>
  );
}
export function CampaignCard({
  c,
  back,
  compareIds,
}: {
  c: Card;
  back: string;
  compareIds?: string[];
}) {
  const money = moneyText(c.compensation.money);
  const other = compensationParts(c.compensation).filter(
    (p) => p.kind !== "Money",
  );
  const left = daysLeft(c.closes_at);
  return (
    <li className="mk-card">
      <div className="mk-row">
        <span className="mk-pill" data-cat={c.category}>
          {categories[c.category as Category]}
        </span>
        <EligibilityPill e={c.eligibility} />
        {c.visibility === "invite_only" && (
          <span className="mk-pill line">Invited</span>
        )}
        {c.last_material_change && (
          <span className="mk-pill line">Terms updated</span>
        )}
      </div>
      <p className="mk-brand">
        <strong>{c.brand.name}</strong> · business verified
      </p>
      <h3>
        <Link href={`/creator/marketplace/${c.id}`}>{c.title}</Link>
      </h3>
      <p className="mk-sub">{c.summary}</p>
      {money ? (
        <p className="mk-money">{money}</p>
      ) : other[0] ? (
        <p className="mk-money" style={{ fontSize: "1rem" }}>
          <span className="mk-pill line" style={{ marginRight: "0.4rem" }}>
            {other[0].kind}
          </span>
          {other[0].text}
        </p>
      ) : (
        <p className="mk-sub">Compensation not stated</p>
      )}
      {(money ? other : other.slice(1)).length > 0 && (
        <p className="mk-sub">
          {(money ? other : other.slice(1))
            .map((o) => `${o.kind}: ${o.text}`)
            .join(" · ")}
        </p>
      )}
      <p className="mk-sub">
        {deliverableCount(c.deliverables)} deliverable
        {deliverableCount(c.deliverables) === 1 ? "" : "s"} ·{" "}
        {c.remote ? "Remote" : "On location"} · closes in {left} day
        {left === 1 ? "" : "s"}
      </p>
      {c.factors && c.factors.length > 0 && (
        <div className="mk-raise">
          <span className="sr-only">Why you see this:</span>
          <ul className="mk-factors" aria-label="Why you see this">
            {c.factors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mk-row mk-raise">
        <form action={act.toggleBookmark}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="on" value={c.bookmarked ? "no" : "yes"} />
          <input type="hidden" name="back" value={back} />
          <button className="st-btn" aria-pressed={c.bookmarked}>
            {c.bookmarked ? "Saved" : "Save"}
            <span className="sr-only"> {c.title}</span>
          </button>
        </form>
        {compareIds && (
          <Link
            className="st-btn"
            href={`/creator/marketplace/compare?ids=${[...new Set([...compareIds, c.id])].slice(-4).join(",")}`}
          >
            Compare<span className="sr-only"> {c.title}</span>
          </Link>
        )}
      </div>
    </li>
  );
}
export function Checklist({ e }: { e: Eligibility }) {
  return (
    <>
      <h3>Mandatory requirements</h3>
      {e.hard.length === 0 ? (
        <p className="mk-sub">None beyond the campaign type.</p>
      ) : (
        <ul className="mk-checklist">
          {e.hard.map((h) => (
            <li key={h.key} className={h.status}>
              <span className="ic" aria-hidden="true">
                {h.status === "met" ? "✓" : h.status === "not_met" ? "✕" : "?"}
              </span>
              <span>
                <strong>{h.label}</strong>{" "}
                <span className="sr-only">
                  (
                  {h.status === "met"
                    ? "met"
                    : h.status === "not_met"
                      ? "not met"
                      : "unknown"}
                  )
                </span>
                {h.detail && (
                  <>
                    <br />
                    <span className="mk-sub">{h.detail}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {e.preferred.length > 0 && (
        <>
          <h3>Preferred, not required</h3>
          <ul className="mk-checklist">
            {e.preferred.map((p) => (
              <li
                key={p.key}
                className={p.status === "met" ? "met" : "unknown"}
              >
                <span className="ic" aria-hidden="true">
                  {p.status === "met" ? "✓" : "–"}
                </span>
                <span>{p.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {e.notes.map((n) => (
        <p key={n} className="mk-sub">
          {n}
        </p>
      ))}
    </>
  );
}
export function Empty({
  reasons,
  actions,
}: {
  reasons: string[];
  actions: { label: string; href: string }[];
}) {
  return (
    <div className="mk-empty" role="status">
      <h2 style={{ fontSize: "1.2rem" }}>Nothing to show here yet</h2>
      {reasons.map((r) => (
        <p key={r}>{r}</p>
      ))}
      <ul>
        {actions.map((a) => (
          <li key={a.href + a.label}>
            <Link href={a.href}>{a.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
