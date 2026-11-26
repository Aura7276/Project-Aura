import { describe, expect, it } from "vitest";
import {
  appStatus,
  collabStatus,
  pendingAction,
  termsDiff,
  termsLines,
} from "@/features/applications/rules";
import {
  questionsForm,
  termsForm,
  toTerms,
} from "@/features/applications/schemas";

describe("M11 domain rules", () => {
  it("never describes selection, interest or confirmation as an agreement (F31)", () => {
    expect(appStatus.selected.detail).toMatch(/Nothing is binding/);
    expect(appStatus.waitlisted.detail).toMatch(/not a guarantee/);
    expect(appStatus.shortlisted.detail).toMatch(/not a selection/);
    expect(collabStatus.ready_for_agreement).toMatch(/not yet binding/);
    for (const v of Object.values(appStatus))
      expect(v.label.toLowerCase()).not.toContain("hired");
  });
  it("parses proposal terms, deliverables and rights", () => {
    const p = termsForm.parse({
      currency: "INR",
      amount: "4500",
      deliverables: "2 x reel\nstory",
      start_on: "2026-12-10",
      end_on: "2026-12-20",
      revisions: "2",
      usage_months: "6",
      channels: "organic, website",
      exclusivity_days: "",
      note: "",
      valid_days: "",
    });
    const t = toTerms(p);
    expect(t.money).toEqual({ currency: "INR", amount: 4500 });
    expect(t.deliverables).toEqual([
      { type: "reel", quantity: 2 },
      { type: "story", quantity: 1 },
    ]);
    expect(t.rights).toEqual({
      usage_months: 6,
      channels: ["organic", "website"],
      exclusivity_days: 0,
    });
    expect(termsLines(t)[0]).toMatch(/4,500/);
  });
  it("rejects an end date before the start date and out-of-range numbers", () => {
    expect(
      termsForm.safeParse({
        currency: "INR",
        start_on: "2026-12-20",
        end_on: "2026-12-10",
      }).success,
    ).toBe(false);
    expect(
      termsForm.safeParse({ currency: "INR", revisions: "50" }).success,
    ).toBe(false);
    expect(termsForm.safeParse({ currency: "inr" }).success).toBe(false);
  });
  it("shows what changed between proposal versions", () => {
    expect(
      termsDiff(
        { money: { currency: "INR", amount: 5000 }, revisions: 1 },
        { money: { currency: "INR", amount: 4500 }, revisions: 2 },
      ),
    ).toEqual(["compensation", "revisions"]);
    expect(termsDiff(undefined, { revisions: 1 })).toEqual([]);
  });
  it("reads screening questions: * marks required, (yes/no) sets the kind, at most 10", () => {
    const q = questionsForm.parse(
      "* Which city are you in?\nHave you worked with hostels? (yes/no)\n\n" +
        Array(12).fill("Another question here").join("\n"),
    );
    expect(q[0]).toEqual({
      prompt: "Which city are you in?",
      required: true,
      kind: "text",
    });
    expect(q[1]).toEqual({
      prompt: "Have you worked with hostels?",
      required: false,
      kind: "yes_no",
    });
    expect(q).toHaveLength(10);
  });
  it("names the next step for the Creator", () => {
    expect(pendingAction("review", 1)).toMatch(/question/);
    expect(pendingAction("draft", 0)).toMatch(/Finish/);
    expect(pendingAction("submitted", 0)).toBeNull();
  });
});
