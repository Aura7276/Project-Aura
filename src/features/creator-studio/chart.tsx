import type { Observation } from "./types";
/** Accessible inline SVG. Renders only when at least two real observations exist; always paired with a data table. */
export function TrendChart({
  series,
  label,
  target,
}: {
  series: Observation[];
  label: string;
  target?: number | null;
}) {
  if (series.length < 2) return null;
  const w = 320,
    h = 140,
    pad = 24;
  const xs = series.map((o) => Date.parse(o.observed_on + "T00:00:00Z"));
  const vals = series.map((o) => o.value).concat(target ?? []);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(0, ...vals),
    y1 = Math.max(...vals) || 1;
  const px = (t: number) =>
    pad + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (w - pad * 2);
  const py = (v: number) =>
    h - pad - ((v - y0) / (y1 - y0 || 1)) * (h - pad * 2);
  const pts = series
    .map((o, i) => `${px(xs[i]).toFixed(1)},${py(o.value).toFixed(1)}`)
    .join(" ");
  const desc = `${label}: ${series.length} self-reported observations from ${series[0].observed_on} to ${series[series.length - 1].observed_on}, from ${series[0].value} to ${series[series.length - 1].value}.`;
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
        {target != null && (
          <line
            x1={pad}
            y1={py(target)}
            x2={w - pad}
            y2={py(target)}
            stroke="#7457e8"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        )}
        <polyline
          points={pts}
          fill="none"
          stroke="#573bbb"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {series.map((o, i) => (
          <circle
            key={o.id}
            cx={px(xs[i])}
            cy={py(o.value)}
            r="3.5"
            fill="#573bbb"
          />
        ))}
      </svg>
      <figcaption className="st-hint">
        Self-reported. Dashed line is your target
        {target == null ? " (none set)" : ""}.
      </figcaption>
      <details>
        <summary>Show the data</summary>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}
        >
          <caption
            className="ob-sr"
            style={{ position: "absolute", left: -9999 }}
          >
            {label} observations
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left" }}>
                Date
              </th>
              <th scope="col" style={{ textAlign: "right" }}>
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((o) => (
              <tr key={o.id}>
                <td>{o.observed_on}</td>
                <td style={{ textAlign: "right" }}>{o.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
