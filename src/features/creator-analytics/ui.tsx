import Link from "next/link";
import { sourceLabel, type Source } from "./types";
import { tolerance } from "./growth";
import { daysBetween } from "./periods";
import { platforms } from "@/features/creator-social/catalogue";
import type { Base } from "@/server/analytics/load";

export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("en");
export const signed = (n: number) =>
  `${n > 0 ? "+" : ""}${n.toLocaleString("en")}`;
const sections = [
  ["/creator/analytics", "Overview"],
  ["/creator/analytics/accounts", "Accounts"],
  ["/creator/analytics/content", "Content"],
  ["/creator/analytics/compare", "Compare"],
  ["/creator/analytics/audience", "Audience"],
  ["/creator/analytics/insights", "Insights"],
  ["/creator/experiments", "Experiments"],
  ["/creator/analytics/reports", "Reports"],
];
export function SectionNav({ current }: { current: string }) {
  return (
    <nav className="analysis-nav" aria-label="Analytics sections">
      <div>
        {sections.map(([h, l]) => (
          <Link
            key={h}
            href={h}
            aria-current={h === current ? "page" : undefined}
          >
            {l}
          </Link>
        ))}
      </div>
    </nav>
  );
}
export function Quality({
  source,
  corrected,
  evidence,
}: {
  source: Source;
  corrected?: boolean;
  evidence?: boolean;
}) {
  return (
    <span className="st-hint">
      {sourceLabel[source]}
      {corrected ? " · corrected" : ""}
      {evidence ? " · evidence attached" : ""}
    </span>
  );
}
/** Range, account and platform selection. A plain GET form: works without scripts and keeps the URL shareable. */
export function Filters({
  b,
  action,
  current,
}: {
  b: Base;
  action: string;
  current: string;
}) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Filter analytics"
      className="st-card analysis-filters"
      style={{
        display: "grid",
        gap: "0.5rem",
        gridTemplateColumns: "repeat(auto-fit,minmax(9rem,1fr))",
      }}
    >
      <div className="st-field">
        <label htmlFor="f-account">Account</label>
        <select id="f-account" name="account" defaultValue={b.accountParam}>
          <option value="all">All accounts</option>
          {b.allAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.handle} ({a.platform})
            </option>
          ))}
        </select>
      </div>
      <div className="st-field">
        <label htmlFor="f-platform">Platform</label>
        <select id="f-platform" name="platform" defaultValue={b.platform}>
          <option value="">All platforms</option>
          {platforms.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="st-field">
        <label htmlFor="f-range">Period</label>
        <select id="f-range" name="range" defaultValue={b.range.key}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="custom">Custom range</option>
        </select>
      </div>
      <div className="st-field">
        <label htmlFor="f-start">Custom start</label>
        <input
          id="f-start"
          type="date"
          name="start"
          defaultValue={b.range.key === "custom" ? b.range.current.start : ""}
          max={b.today}
        />
      </div>
      <div className="st-field">
        <label htmlFor="f-end">Custom end</label>
        <input
          id="f-end"
          type="date"
          name="end"
          defaultValue={b.range.key === "custom" ? b.range.current.end : ""}
          max={b.today}
        />
      </div>
      <div>
        <button className="st-btn primary" data-current={current}>
          Apply
        </button>
      </div>
      {b.rangeError && (
        <p className="st-error" role="alert" style={{ gridColumn: "1 / -1" }}>
          {b.rangeError} Showing the last 30 days instead.
        </p>
      )}
      <p className="st-hint" style={{ gridColumn: "1 / -1" }}>
        {b.range.current.start} – {b.range.current.end} · Compared with{" "}
        {b.range.previous.start} to {b.range.previous.end}.
        {b.range.includesToday ? " Today is included and is not finished." : ""}
      </p>
    </form>
  );
}
export type ChartPoint = {
  date: string;
  value: number;
  source: Source;
  corrected: boolean;
};
/** Real observations only. The line is broken across long gaps (no interpolation); an alternative data table is always provided. */
export function SeriesChart({
  points,
  label,
  unit = "",
  maxGap,
}: {
  points: ChartPoint[];
  label: string;
  unit?: string;
  maxGap?: number;
}) {
  if (points.length === 0)
    return <p className="st-hint">No observations to chart in this range.</p>;
  const w = 320,
    h = 150,
    pad = 28;
  const xs = points.map((p) => Date.parse(p.date + "T00:00:00Z"));
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs);
  const vals = points.map((p) => p.value);
  const y0 = Math.min(0, ...vals),
    y1 = Math.max(...vals, 1);
  const px = (t: number) =>
    pad + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (w - pad * 2);
  const py = (v: number) =>
    h - pad - ((v - y0) / (y1 - y0 || 1)) * (h - pad * 2);
  const gap =
    maxGap ??
    tolerance(Math.max(1, daysBetween(points[0].date, points.at(-1)!.date)));
  const segments: ChartPoint[][] = [];
  let cur: ChartPoint[] = [];
  points.forEach((p, i) => {
    if (i > 0 && daysBetween(points[i - 1].date, p.date) > gap * 2) {
      segments.push(cur);
      cur = [];
    }
    cur.push(p);
  });
  segments.push(cur);
  const desc = `${label}: ${points.length} recorded observation${points.length === 1 ? "" : "s"} from ${points[0].date} to ${points.at(-1)!.date}, from ${fmt(points[0].value)} to ${fmt(points.at(-1)!.value)}${unit}. Gaps between observations are left blank, not filled in.`;
  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="st-chart"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={desc}
      >
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="#8b87a0"
          strokeWidth="1"
        />
        <text x={pad} y={h - 8} fontSize="9" fill="#5b5775">
          {points[0].date}
        </text>
        <text
          x={w - pad}
          y={h - 8}
          fontSize="9"
          fill="#5b5775"
          textAnchor="end"
        >
          {points.at(-1)!.date}
        </text>
        <text x={4} y={py(y1) + 3} fontSize="9" fill="#5b5775">
          {fmt(y1)}
        </text>
        {segments
          .filter((s) => s.length > 1)
          .map((s, i) => (
            <polyline
              key={i}
              points={s
                .map(
                  (p) =>
                    `${px(Date.parse(p.date + "T00:00:00Z")).toFixed(1)},${py(p.value).toFixed(1)}`,
                )
                .join(" ")}
              fill="none"
              stroke="#573bbb"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          ))}
        {points.map((p) =>
          p.corrected ? (
            <rect
              key={p.date + p.value}
              x={px(Date.parse(p.date + "T00:00:00Z")) - 3.5}
              y={py(p.value) - 3.5}
              width="7"
              height="7"
              fill="#573bbb"
            />
          ) : (
            <circle
              key={p.date + p.value}
              cx={px(Date.parse(p.date + "T00:00:00Z"))}
              cy={py(p.value)}
              r="3.5"
              fill="#573bbb"
            />
          ),
        )}
      </svg>
      <figcaption className="st-hint">
        {label}. Each mark is a number you recorded. Square marks are corrected
        values.
      </figcaption>
      <details>
        <summary>Show the data</summary>
        <table>
          <caption className="st-hint">
            {label}
            {unit ? ` (${unit.trim()})` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Value</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date + p.value}>
                <td>{p.date}</td>
                <td>{fmt(p.value)}</td>
                <td>
                  {sourceLabel[p.source]}
                  {p.corrected ? ", corrected" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
export function Limits({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <details>
      <summary>Limitations</summary>
      <ul>
        {items.map((l) => (
          <li key={l} className="st-hint">
            {l}
          </li>
        ))}
      </ul>
    </details>
  );
}
export function Missing({
  title,
  reason,
  need,
  href,
  cta,
}: {
  title: string;
  reason: string;
  need?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="st-empty" role="note">
      <strong>{title}</strong>
      <p>{reason}</p>
      {need && (
        <details>
          <summary>What to record</summary>
          <p>{need}</p>
        </details>
      )}
      {href && (
        <p>
          <Link href={href}>{cta ?? "Do this next"}</Link>
        </p>
      )}
    </div>
  );
}
export const Notice = ({
  sp,
}: {
  sp: Record<string, string | string[] | undefined>;
}) => {
  const n = typeof sp.notice === "string" ? sp.notice : null;
  if (n)
    return (
      <p role="status" aria-live="polite" className="st-error">
        That could not be saved. Check what you entered and the
        experiment&apos;s state, then try again.
      </p>
    );
  if (sp.updated || sp.refreshed)
    return (
      <p role="status" aria-live="polite" className="st-ok">
        Done.
      </p>
    );
  return <p role="status" aria-live="polite" />;
};
