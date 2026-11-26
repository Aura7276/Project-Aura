import {
  compensationParts,
  deliverableCount,
  daysLeft,
  rightsText,
  type Category,
} from "./rules";
import type { Detail } from "./types";
// Rule-based review of a campaign's terms (F23 to F25 without AI). It points out what is missing or worth asking; it never decides for you.
export type Assessment = {
  missing: string[];
  questions: string[];
  effort: string;
  compensationNote: string;
  rights: string;
  limits: string[];
};
export function assess(d: Detail, now = Date.now()): Assessment {
  const missing: string[] = [];
  const questions: string[] = [];
  const parts = compensationParts(d.compensation);
  if (
    !parts.some((p) => p.guaranteed) &&
    (d.category as Category) !== "affiliate"
  )
    missing.push("No guaranteed money is offered.");
  if (d.compensation.money?.negotiable)
    questions.push(
      "The money is marked negotiable: what would change the amount?",
    );
  if (d.compensation.products?.description && !d.compensation.products.value)
    questions.push(
      "What is the retail value of the products, and are they yours to keep?",
    );
  if (d.compensation.commission?.rate_pct)
    questions.push(
      "How are sales attributed to you, and when is commission paid?",
    );
  if (!d.rights?.usage_months && !d.rights?.negotiable)
    missing.push("The usage period for your content is not stated.");
  if (d.rights?.negotiable)
    questions.push(
      "Rights are negotiable: how long and where will the Brand use your content?",
    );
  if (d.rights?.whitelisting)
    questions.push(
      "Paid ads from your account are included: for how long, and with what budget?",
    );
  if ((d.rights?.exclusivity_days ?? 0) > 0)
    questions.push(
      `There are ${d.rights.exclusivity_days} days of exclusivity: which competitors does it cover?`,
    );
  if (!d.positions) missing.push("The number of positions is not disclosed.");
  if (d.travel?.required && !d.travel.covered)
    missing.push("Travel is required and costs are not stated as covered.");
  if (!d.starts_on)
    questions.push(
      "When would the work start, and what are the content deadlines?",
    );
  questions.push("How many rounds of revisions are included?");
  const n = deliverableCount(d.deliverables);
  const left = daysLeft(d.closes_at, now);
  return {
    missing,
    questions,
    effort: `${n} deliverable${n === 1 ? "" : "s"} stated by the Brand. ${d.effort_note ? `Brand's note: ${d.effort_note}` : "The Brand gave no time estimate."}`,
    compensationNote: parts.length
      ? parts.map((p) => `${p.kind}: ${p.text}`).join(" · ")
      : "No compensation is stated.",
    rights: rightsText(d.rights),
    limits: [
      "This is a checklist built from the campaign's own terms. It is not AI and does not judge the Brand.",
      `Applications close in ${left} day${left === 1 ? "" : "s"}.`,
    ],
  };
}
