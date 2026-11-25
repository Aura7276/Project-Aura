import {
  goalCategories,
  niches,
  label,
} from "@/features/creator-onboarding/taxonomy";
import type { CreatorState } from "@/features/creator-onboarding/types";
import { articles } from "@/features/public-site/resources";
import { areas, isInternalPath } from "./nav";
import type { SearchHit } from "./types";

export type SearchGroup = { id: string; label: string; hits: SearchHit[] };
export const unsearchedModules = [
  { id: "campaigns", label: "Campaigns", module: "M10" },
  { id: "collaborations", label: "Collaborations", module: "M12" },
] as const;
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.replace(/\s+/g, " ").trim();
  return q.length >= 2 && q.length <= 60 ? q : null;
}
const has = (text: string, q: string) =>
  text.toLowerCase().includes(q.toLowerCase());
/** Public, non-private catalogues. These contain no tenant data, so they are safe to search without a database call. */
export function searchCatalogues(q: string): SearchGroup[] {
  const tools = areas
    .flatMap((a) => a.items)
    .filter((i) => i.href && has(i.label, q))
    .map((i): SearchHit => ({
      type: "plan",
      id: i.id,
      title: i.label,
      snippet: i.note ?? `${i.module} tool`,
      href: i.href as string,
    }));
  const resources = articles
    .filter((a) => has(a.title, q) || has(a.intro, q))
    .map((a): SearchHit => ({
      type: "plan",
      id: a.slug,
      title: a.title,
      snippet: a.intro.slice(0, 120),
      href: `/resources/${a.slug}`,
    }));
  return [
    { id: "tools", label: "Tools", hits: tools },
    { id: "resources", label: "Guides", hits: resources },
  ];
}
/** Own-profile labels, searched only from the caller's already-authorized state. */
export function searchOwnProfile(q: string, state: CreatorState): SearchGroup {
  const hits: SearchHit[] = [];
  for (const g of state.goals)
    if (has(label(goalCategories, g.category), q))
      hits.push({
        type: "goal",
        id: g.category,
        title: label(goalCategories, g.category),
        snippet: g.metric ? "Goal with a measure" : "Goal",
        href: "/creator/progress",
      });
  for (const n of state.niches) {
    const l = n.custom_label ?? label(niches, n.code);
    if (has(l, q))
      hits.push({
        type: "goal",
        id: n.code,
        title: l,
        snippet: `${n.role} niche`,
        href: "/onboarding/creator/niche",
      });
  }
  return { id: "profile", label: "Your profile", hits };
}
export const safeHits = (hits: SearchHit[]) =>
  hits.filter((h) => isInternalPath(h.href));
