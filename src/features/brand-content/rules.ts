// M21 interface rules: labels, the stage flow, the publication checklist, calendar layout and the content-mix comparison.
// The database enforces every rule that matters (approval, rights, checklist); these only describe them to people.
import type { Format, Item, Stage } from "@/server/brand-content/service";

export const stageLabels: Record<Stage, string> = {
  idea: "Idea",
  drafting: "Drafting",
  production: "In production",
  in_review: "In review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};
/** Board columns, left to right. Archived items are kept off the board. */
export const boardStages: Stage[] = [
  "idea",
  "drafting",
  "production",
  "in_review",
  "approved",
  "scheduled",
  "published",
];
export const formatLabels: Record<Format, string> = {
  reel: "Reel",
  short: "Short",
  carousel: "Carousel",
  story: "Story",
  post: "Post",
  video: "Video",
  live: "Live",
  article: "Article",
};
export const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  threads: "Threads",
  x: "X",
  other: "Other",
};
export const sourceLabels: Record<Item["source"], string> = {
  team: "Your team",
  ai: "AI suggestion",
  repurposed: "Creator content",
};
export const checklistLabels: Record<string, string> = {
  final_copy: "Final copy matches the approved version",
  account: "Posting on the right account",
  link_checked: "Links and tags checked",
  disclosure: "Disclosure included (partnership or Creator credit)",
  claims: "Every claim is approved or cleared in review",
};
export const resultSources: Record<string, string> = {
  platform_insights: "Platform insights",
  screenshot: "Screenshot",
  export: "Export file",
  manual_count: "Counted by hand",
  other: "Other",
};
export const assetKinds: Record<string, string> = {
  image: "Image",
  video: "Video",
  document: "Document",
  audio: "Audio",
  link: "Link",
};
export const provenanceLabels: Record<string, string> = {
  own: "Made by our team",
  creator: "From a Creator collaboration",
  licensed: "Licensed (stock or agency)",
  other: "Other",
};
export const handle = (
  a: { platform: string; handle: string } | null | undefined,
) =>
  a
    ? `${platformLabels[a.platform] ?? a.platform} @${a.handle}`
    : "No account yet";

/** The one next step for an item, in plain words, so every card says what to do. */
export function nextStep(
  i: Pick<
    Item,
    | "stage"
    | "approved_current"
    | "account_id"
    | "planned_for"
    | "checklist_required"
  > & { checklist?: Item["checklist"] },
): string {
  switch (i.stage) {
    case "idea":
      return "Start drafting when you are ready.";
    case "drafting":
    case "production":
      return "Send for review when the copy is ready.";
    case "in_review":
      return "Waiting for an approval.";
    case "approved":
      return !i.account_id || !i.planned_for
        ? "Choose an account and a date, then schedule."
        : "Schedule it, or post it and mark it published.";
    case "scheduled": {
      const missing = i.checklist_required.filter(
        (k) => !i.checklist?.[k],
      ).length;
      return missing
        ? `Post it yourself, then tick ${missing} checklist item${missing === 1 ? "" : "s"}.`
        : "Post it yourself, then record the link.";
    }
    case "published":
      return "Record results as they come in.";
    default:
      return "Restore it to keep working on it.";
  }
}

/** Monday-first month grid (6 weeks) for a YYYY-MM month, with each day's ISO date and whether it is in the month. */
export function monthGrid(
  month: string,
): { iso: string; day: number; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, k) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - offset + k));
    return {
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m - 1,
    };
  });
}
export const monthOf = (v: string | undefined, today = new Date()) =>
  v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : today.toISOString().slice(0, 7);
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}
/** The date an item sits on in the calendar: when it went live, or when it is planned. */
export const calendarDate = (i: Pick<Item, "published_on" | "planned_for">) =>
  i.published_on ?? i.planned_for;

/** Planned share per pillar against its target mix. Only items with a pillar count; the gap is in percentage points. */
export function mixGap(
  pillars: { id: string; name: string; mix: number }[],
  items: Pick<Item, "pillar_id" | "stage">[],
) {
  const counted = items.filter((i) => i.pillar_id && i.stage !== "archived");
  const total = counted.length;
  return pillars.map((p) => {
    const n = counted.filter((i) => i.pillar_id === p.id).length;
    const share = total ? Math.round((n / total) * 100) : 0;
    return {
      id: p.id,
      name: p.name,
      target: p.mix,
      share,
      count: n,
      gap: share - p.mix,
    };
  });
}
/** The rights a Creator agreed, in words. */
export function rightsText(
  r: { usage_months?: number; channels?: string[] } | null | undefined,
) {
  if (!r || r.usage_months === undefined || r.usage_months === null)
    return "No reuse rights agreed";
  const ch = r.channels?.length
    ? ` on ${r.channels.join(", ")}`
    : " (no channels named)";
  return `${r.usage_months} month${r.usage_months === 1 ? "" : "s"}${ch}`;
}
