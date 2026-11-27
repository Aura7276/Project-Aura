import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// M18 rules that live in the interface: selection is never a bulk action, the Brand's decision menu no longer selects directly,
// holds are 72 hours, and offers always say they are not an agreement.
describe("M18 interface rules", () => {
  const inbox = readFileSync("src/features/selection/panels.tsx", "utf8");
  const brand = readFileSync("src/features/applications/brand.tsx", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20261210000100_m18_selection.sql",
    "utf8",
  );
  it("offers review, shortlist and reject as bulk actions, never selection", () => {
    const bulk = inbox.slice(
      inbox.indexOf('name="bulk_action"'),
      inbox.indexOf("</select>", inbox.indexOf('name="bulk_action"')),
    );
    expect(bulk).toMatch(/value="shortlist"/);
    expect(bulk).toMatch(/value="reject"/);
    expect(bulk).not.toMatch(/value="select"/);
  });
  it("removes direct selection from the Brand decision menu (places are offered and accepted)", () => {
    expect(brand).not.toMatch(/select: "Select \(not an agreement\)"/);
    expect(brand).toMatch(/offer a place/i);
  });
  it("holds last 72 hours and the Creator is told it is not an agreement", () => {
    expect(migration).toMatch(/\('hold_hours', '72'\)/);
    expect(migration).toMatch(/answer within 72 hours; not an agreement/);
    expect(inbox).toMatch(/Accepting is not an agreement/);
  });
  it("comparison never shows a score or a ranking", () => {
    const compare = inbox.slice(
      inbox.indexOf("export async function CompareView"),
      inbox.indexOf("export async function CandidatePanel"),
    );
    expect(compare).toMatch(/there is no score and no ranking/);
    expect(compare.replace(/there is no score and no ranking/, "")).not.toMatch(
      /score|ranking|\.sort\(/i,
    );
  });
  it("the M12 hand-off waits for an approved legal template before anyone can accept", () => {
    expect(migration).toMatch(/'templateApproved', false/);
    expect(migration).toMatch(/'status', 'Agreement pending'/);
  });
});
