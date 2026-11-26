import { describe, expect, it } from "vitest";
import { compensationParts, deliverableCount, moneyText, positionsText, rightsText, categories } from "@/features/marketplace/rules";
import { assess } from "@/features/marketplace/assessment";
import { compareRows } from "@/features/marketplace/compare";
import { emptyReasons } from "@/features/marketplace/empty";
import { campaignForm, toContent } from "@/features/marketplace/schemas";
import { collaborationCategories } from "@/features/creator-onboarding/taxonomy";
import type { Card, Detail } from "@/features/marketplace/types";

const card = (over: Partial<Card> = {}): Card => ({
  id: "1", slug: "s", category: "paid", visibility: "public", version: 1, published_at: "2026-11-01", brand: { id: "b", name: "Tea Co" }, title: "Reels", summary: "Summary of the campaign here.",
  closes_at: new Date(Date.now() + 5 * 86_400_000).toISOString(), compensation: { money: { type: "range", currency: "INR", min: 5000, max: 9000 } }, deliverables: [{ type: "reel", quantity: 2 }],
  rights: { usage_months: 6, channels: ["organic"], exclusivity_days: 0 }, travel: null, positions: null, remote: true, countries: [], languages: [],
  eligibility: { eligible: true, hard: [], preferred: [], notes: [] }, bookmarked: false, invited: false, last_material_change: null, ...over,
});
const detail = (over: Partial<Detail> = {}): Detail => ({ ...card(), brief: "b", requirements: {}, preferred: {}, effort_note: null, starts_on: null, applicants: { status: "not_shared" }, brand_profile: { name: "Tea Co", verified: true, verified_since: null, published_campaigns: 1 }, updates: [], reported: false, ...over } as Detail);

describe("M10 honest terms", () => {
  it("keeps money, products, services, experiences and commission separate, and only money is guaranteed", () => {
    const parts = compensationParts({ money: { type: "fixed", currency: "INR", min: 4000 }, products: { description: "A hamper", value: 2000 }, commission: { rate_pct: 10 } });
    expect(parts.map((p) => [p.kind, p.guaranteed])).toEqual([["Money", true], ["Products", false], ["Commission", false]]);
    expect(parts[2].text).toMatch(/Not guaranteed/);
    expect(moneyText({ type: "range", currency: "INR", min: 5000, max: 9000, negotiable: true })).toMatch(/5,000.*9,000.*negotiable/);
    expect(moneyText({ type: "none" })).toBeNull();
  });
  it("labels undisclosed positions and negotiable rights instead of hiding them", () => {
    expect(positionsText(null)).toBe("Number of positions not disclosed"); expect(positionsText(3)).toBe("3 positions");
    expect(rightsText({ negotiable: true })).toMatch(/negotiable/); expect(rightsText({ usage_months: 6, channels: ["organic"], exclusivity_days: 30 })).toMatch(/Exclusivity: 30 days/);
    expect(deliverableCount([{ type: "reel", quantity: 2 }, { type: "story" }])).toBe(3);
  });
  it("uses the same six categories as Creator onboarding preferences", () => {
    expect(Object.keys(categories)).toHaveLength(collaborationCategories.length);
  });
});
describe("M10 rule-based review and comparison", () => {
  it("lists missing terms and questions without claiming AI or judging the Brand", () => {
    const a = assess(detail({ compensation: { products: { description: "A hamper" } }, rights: { negotiable: true }, travel: { required: true, covered: false } }));
    expect(a.missing).toEqual(expect.arrayContaining(["No guaranteed money is offered.", "Travel is required and costs are not stated as covered.", "The number of positions is not disclosed."]));
    expect(a.questions.join(" ")).toMatch(/retail value/); expect(a.limits[0]).toMatch(/not AI/);
    expect(JSON.stringify(a)).not.toMatch(/score|rating|scam|fraud/i);
  });
  it("compares facts row by row and never picks a winner", () => {
    const rows = compareRows([card(), card({ id: "2", category: "barter", compensation: { products: { description: "Shoes" } }, eligibility: { eligible: false, hard: [{ key: "followers", label: "x", status: "not_met", detail: null }], preferred: [], notes: [] } })]);
    expect(rows.map((r) => r.label)).toContain("Your eligibility");
    expect(rows.find((r) => r.label === "Your eligibility")!.values[1]).toMatch(/1 requirement/);
    expect(JSON.stringify(rows)).not.toMatch(/best|winner|score/i);
  });
  it("explains empty results and offers actions", () => {
    const e = emptyReasons({ filters: { q: "x" }, hidden: 2, belowThreshold: true, total: 0 });
    expect(e.reasons.join(" ")).toMatch(/business verification/); expect(e.reasons.join(" ")).toMatch(/2 campaigns are hidden/);
    expect(e.actions.map((a) => a.href)).toEqual(expect.arrayContaining(["/creator/marketplace/category/ugc", "/creator/marketplace/searches"]));
  });
});
describe("M10 Brand form", () => {
  const base = { category: "paid", visibility: "public", show_applicant_count: false, title: "Budget travel reels", summary: "A clear summary of the work we need.", brief: "x".repeat(60), deliverables: "2 x Reel on Instagram\nStory", closes_on: "2026-12-30", money_type: "range", currency: "INR", money_min: "5000", money_max: "9000", money_negotiable: false, whitelisting: false, rights_negotiable: false, travel_required: false, travel_covered: false, verified_ownership: false, beginner_friendly: false, remote: true };
  it("builds versioned content with parsed deliverables and separated compensation", () => {
    const p = campaignForm.safeParse(base); expect(p.success).toBe(true);
    const c = toContent(p.success ? p.data : (null as never));
    expect(c.deliverables).toEqual([{ type: "Reel", quantity: 2, platform: "instagram" }, { type: "Story", quantity: 1 }]);
    expect(c.compensation.money).toMatchObject({ type: "range", min: 5000, max: 9000 }); expect(c.compensation.products).toBeUndefined();
  });
  it("rejects a UGC follower minimum and an inverted range", () => {
    expect(campaignForm.safeParse({ ...base, category: "ugc", min_followers: "1000" }).success).toBe(false);
    expect(campaignForm.safeParse({ ...base, money_min: "9000", money_max: "10" }).success).toBe(false);
  });
});
