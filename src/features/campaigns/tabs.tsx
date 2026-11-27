import Link from "next/link";
import "./campaigns.css";

/** Campaign tabs, shared by the M10 editor, the M11 applications page and the M17, M18 and M19 pages. */
export function CampaignTabs({
  id,
  w,
  current,
}: {
  id: string;
  w: string;
  current:
    | "overview"
    | "build"
    | "preview"
    | "applications"
    | "monitor"
    | "reports"
    | "changes";
}) {
  const t: [typeof current, string, string][] = [
    ["overview", "All terms", `/brand/campaigns/${id}?w=${w}`],
    ["build", "Builder", `/brand/campaigns/${id}/build?w=${w}`],
    ["preview", "Preview", `/brand/campaigns/${id}/preview?w=${w}`],
    [
      "applications",
      "Applications",
      `/brand/campaigns/${id}/applications?w=${w}`,
    ],
    ["monitor", "Monitor", `/brand/campaigns/${id}/monitor?w=${w}`],
    ["reports", "Reports", `/brand/campaigns/${id}/reports?w=${w}`],
    ["changes", "Changes", `/brand/campaigns/${id}/changes?w=${w}`],
  ];
  return (
    <nav aria-label="Campaign sections" className="cp-tabs">
      <Link href={`/brand/campaigns?w=${w}`} className="cp-back">
        All campaigns
      </Link>
      {t.map(([k, l, h]) => (
        <Link
          key={k}
          href={h}
          aria-current={k === current ? "page" : undefined}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
