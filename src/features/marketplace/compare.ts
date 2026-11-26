import {
  compensationParts,
  deliverableCount,
  positionsText,
  rightsText,
  categories,
} from "./rules";
import type { Card } from "./types";
// Side-by-side comparison (F09). Each row states the facts; no row is turned into a score or a winner.
export type Row = { label: string; values: string[] };
export function compareRows(cards: Card[]): Row[] {
  return [
    { label: "Type", values: cards.map((c) => categories[c.category]) },
    {
      label: "Compensation",
      values: cards.map(
        (c) =>
          compensationParts(c.compensation)
            .map((p) => `${p.kind}: ${p.text}`)
            .join("; ") || "Not stated",
      ),
    },
    {
      label: "Deliverables",
      values: cards.map((c) => `${deliverableCount(c.deliverables)} in total`),
    },
    {
      label: "Rights and exclusivity",
      values: cards.map((c) => rightsText(c.rights)),
    },
    {
      label: "Travel",
      values: cards.map((c) =>
        c.travel?.required
          ? c.travel.covered
            ? "Required, covered"
            : "Required, costs not stated"
          : "Not required",
      ),
    },
    {
      label: "Positions",
      values: cards.map((c) => positionsText(c.positions)),
    },
    {
      label: "Your eligibility",
      values: cards.map((c) =>
        c.eligibility.eligible
          ? "You meet every mandatory requirement"
          : `${c.eligibility.hard.filter((h) => h.status !== "met").length} requirement(s) not met or unknown`,
      ),
    },
    { label: "Closes", values: cards.map((c) => c.closes_at.slice(0, 10)) },
  ];
}
