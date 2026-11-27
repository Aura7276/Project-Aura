import { describe, expect, it } from "vitest";
import {
  errorStep,
  readiness,
  rolloutLabel,
  stepFields,
  steps,
  suggestedBrief,
} from "@/features/campaigns/rules";
import type { BrandCampaign } from "@/features/marketplace/types";

const camp = (over: Partial<BrandCampaign> = {}): BrandCampaign => ({
  id: "c",
  slug: "s",
  category: "paid",
  visibility: "public",
  status: "draft",
  draft_version: 1,
  published_version: null,
  show_applicant_count: false,
  risk_flags: [],
  review_note: null,
  draft: { positions: 2 },
  live: null,
  errors: [],
  verified: true,
  pending_changes: null,
  versions: [],
  invited: [],
  ...over,
});
const labels = { title: "a title", money: "a valid amount or range" };
const roll = {
  paid: "live",
  ugc: "live",
  barter: "live",
  event: "planned",
  ambassador: "planned",
  affiliate: "planned",
} as const;

describe("M17 builder", () => {
  it("has six steps ending with preview and publish", () => {
    expect(steps.map((s) => s.key)).toEqual([
      "objective",
      "brief",
      "deliverables",
      "compensation",
      "eligibility",
      "review",
    ]);
  });
  it("assigns every M10 validation error to a step that can fix it", () => {
    for (const [, step] of Object.entries(errorStep))
      expect(steps.map((s) => s.key)).toContain(step);
    for (const k of [
      "title",
      "money",
      "deliverables",
      "rights",
      "ugc_no_follower_minimum",
    ])
      expect(errorStep).toHaveProperty(k);
  });
  it("never edits a field in two steps", () => {
    const all = Object.values(stepFields).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
describe("M17 readiness", () => {
  it("is ready only when verified, the type is live and every term is complete", () => {
    expect(readiness(camp(), roll, labels, 0).every((x) => x.ok)).toBe(true);
    expect(
      readiness(camp({ verified: false }), roll, labels, 0).find(
        (x) => x.key === "verified",
      )?.ok,
    ).toBe(false);
    expect(
      readiness(camp({ category: "event" }), roll, labels, 0).find(
        (x) => x.key === "type",
      )?.ok,
    ).toBe(false);
  });
  it("links each missing term to its step", () => {
    const r = readiness(camp({ errors: ["title", "money"] }), roll, labels, 0);
    expect(r.filter((x) => !x.ok).map((x) => [x.text, x.step])).toEqual([
      ["Add a title", "brief"],
      ["Add a valid amount or range", "compensation"],
    ]);
  });
  it("flags positions below the Creators already selected", () => {
    expect(
      readiness(camp(), roll, labels, 3).find((x) => x.key === "positions")
        ?.step,
    ).toBe("deliverables");
  });
  it("labels planned types as draft only", () => {
    expect(rolloutLabel(roll, "affiliate")).toMatch(/Draft only/);
    expect(rolloutLabel(roll, "ugc")).toBe("Live");
  });
});
describe("M17 suggested brief", () => {
  it("uses only what the Brand confirmed and invents nothing", () => {
    const b = suggestedBrief({
      brand: "Hostel Co",
      objective: "Content for our channels",
      products: [{ name: "Dorm bed", claims: ["Free breakfast"] }],
      audiences: ["Backpackers"],
      donts: ["No price promises"],
      disclosures: "#ad",
    });
    expect(b).toContain(
      "Hostel Co is looking for Creators to help with content for our channels.",
    );
    expect(b).toContain("You may say: Free breakfast.");
    expect(b).toContain("Please avoid: No price promises.");
    expect(b).toContain("Required disclosure: #ad.");
    expect(suggestedBrief({ products: [], audiences: [] })).toBe("");
  });
});
