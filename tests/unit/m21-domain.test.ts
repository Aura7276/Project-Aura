// Unit tests for the M21 interface rules. The database enforces approval, rights and the checklist (tests/db/m21_rls.sql);
// these check that the screens describe them correctly.
import { describe, expect, it } from "vitest";
import {
  boardStages,
  calendarDate,
  checklistLabels,
  formatLabels,
  mixGap,
  monthGrid,
  monthOf,
  nextStep,
  rightsText,
  shiftMonth,
  stageLabels,
} from "@/features/brand-content/rules";
import { tasks, sourceLabels } from "@/features/brand-ai/rules";

const base = {
  approved_current: false,
  account_id: "a",
  planned_for: "2026-12-01",
  checklist_required: ["final_copy", "account", "link_checked"],
};

describe("M21 stage flow", () => {
  it("every stage has a label and the board runs from idea to published", () => {
    expect(Object.keys(stageLabels)).toHaveLength(8);
    expect(boardStages[0]).toBe("idea");
    expect(boardStages.at(-1)).toBe("published");
    expect(boardStages).not.toContain("archived");
  });
  it("says one clear next step per stage", () => {
    expect(nextStep({ ...base, stage: "drafting" })).toMatch(/Send for review/);
    expect(nextStep({ ...base, stage: "in_review" })).toMatch(/approval/);
    expect(nextStep({ ...base, stage: "approved", account_id: null })).toMatch(
      /Choose an account and a date/,
    );
    expect(
      nextStep({
        ...base,
        stage: "scheduled",
        checklist: { final_copy: { at: "x" } },
      }),
    ).toMatch(/tick 2 checklist items/);
    expect(
      nextStep({
        ...base,
        stage: "scheduled",
        checklist: {
          final_copy: { at: "x" },
          account: { at: "x" },
          link_checked: { at: "x" },
        },
      }),
    ).toMatch(/record the link/);
    expect(nextStep({ ...base, stage: "published" })).toMatch(/Record results/);
  });
  it("labels every checklist step the database can require, and every format", () => {
    for (const k of [
      "final_copy",
      "account",
      "link_checked",
      "disclosure",
      "claims",
    ])
      expect(checklistLabels[k]).toBeTruthy();
    expect(Object.keys(formatLabels)).toEqual([
      "reel",
      "short",
      "carousel",
      "story",
      "post",
      "video",
      "live",
      "article",
    ]);
  });
});

describe("M21 calendar", () => {
  it("builds a Monday-first six-week grid", () => {
    const g = monthGrid("2026-12");
    expect(g).toHaveLength(42);
    expect(g[0].iso).toBe("2026-11-30");
    expect(g.find((d) => d.iso === "2026-12-01")?.inMonth).toBe(true);
    expect(g.filter((d) => d.inMonth)).toHaveLength(31);
  });
  it("moves across years and rejects bad months", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(monthOf("2026-13", new Date("2026-11-27T00:00:00Z"))).toBe(
      "2026-11",
    );
    expect(monthOf("2027-02")).toBe("2027-02");
  });
  it("places published items on their live date, others on their plan", () => {
    expect(
      calendarDate({ published_on: "2026-11-20", planned_for: "2026-11-18" }),
    ).toBe("2026-11-20");
    expect(
      calendarDate({ published_on: null, planned_for: "2026-11-18" }),
    ).toBe("2026-11-18");
  });
});

describe("M21 mix and rights", () => {
  it("compares planned share with the target, ignoring items without a pillar", () => {
    const g = mixGap(
      [
        { id: "p1", name: "BTS", mix: 60 },
        { id: "p2", name: "Guests", mix: 40 },
      ],
      [
        { pillar_id: "p1", stage: "idea" },
        { pillar_id: "p1", stage: "drafting" },
        { pillar_id: "p1", stage: "published" },
        { pillar_id: "p2", stage: "idea" },
        { pillar_id: null, stage: "idea" },
        { pillar_id: "p2", stage: "archived" },
      ],
    );
    expect(g.map((x) => [x.share, x.gap])).toEqual([
      [75, 15],
      [25, -15],
    ]);
  });
  it("describes agreed rights honestly", () => {
    expect(rightsText(null)).toBe("No reuse rights agreed");
    expect(rightsText({ usage_months: 6, channels: ["Instagram"] })).toBe(
      "6 months on Instagram",
    );
    expect(rightsText({ usage_months: 1 })).toBe("1 month (no channels named)");
  });
});

describe("M20 and M21 as one product", () => {
  it("the assistant has a content task whose drafts become content ideas", () => {
    expect(tasks.content.draft).toBe("content_ideas");
    expect(tasks.content.needsCampaign).toBe(false);
    expect(sourceLabels.content_plan).toMatch(/Content plan/);
  });
});
