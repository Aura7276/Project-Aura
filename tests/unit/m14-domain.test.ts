import { describe, expect, it } from "vitest";
import {
  buildPlan,
  businessTypes,
  checklist,
  creatorSegments,
  evidenceFields,
  evidenceMatrix,
  maturityQuestions,
  type BrandState,
} from "@/features/brand/rules";

const base = (over: Partial<BrandState> = {}): BrandState => ({
  workspace: {
    id: "w",
    name: "Hostel Co",
    business_kind: "company",
    verification: "pending",
    status: "open",
    onboarding: "in_progress",
  },
  role: "owner",
  profile: {
    public_name: "Hostel Co",
    business_type: "d2c",
    country: "IN",
    industry: null,
    website: null,
    stage: "launching",
    experience: "none",
    intent: "both",
    objective: "awareness",
    team_size: null,
    resources: [],
    agency_name: null,
    tagline: null,
    about: null,
    slug: null,
    published: false,
    published_at: null,
    onboarding_step: "customers",
    onboarding_completed_at: null,
  },
  goals: [],
  segments: [],
  products: [],
  guideline: null,
  budget: null,
  creator_pref: null,
  competitors: [],
  socials: [],
  maturity: null,
  plan: [],
  verification: null,
  cases: [],
  limits: { socials: 10 },
  ...over,
});

describe("M14 setup checklist (F43, F45)", () => {
  it("is a list of steps, never a percentage, with only the basics required", () => {
    const steps = checklist(base());
    expect(steps.filter((s) => s.required).map((s) => s.key)).toEqual([
      "basics",
      "objective",
    ]);
    expect(JSON.stringify(steps)).not.toMatch(/%|score|percent/i);
  });
  it("marks verification and publication separately", () => {
    const s = base({
      workspace: { ...base().workspace, verification: "verified" },
    });
    const by = Object.fromEntries(checklist(s).map((x) => [x.key, x.done]));
    expect(by.verification).toBe(true);
    expect(by.profile).toBe(false);
  });
});
describe("M14 plans (F44, AC01)", () => {
  it("gives a Brand with zero social presence a useful first week", () => {
    const week = buildPlan(base(), 7).map((x) => x.rule_key);
    expect(week).toEqual(
      expect.arrayContaining([
        "p7_product",
        "p7_audience",
        "p7_verify",
        "p7_goal",
        "p7_socials",
      ]),
    );
  });
  it("drops steps that are already done and respects the chosen intent", () => {
    const s = base({
      products: [
        {
          id: "p",
          kind: "product",
          name: "Bed",
          description: null,
          url: null,
          currency: "INR",
          price_min: 1,
          price_max: 2,
          claims: [],
          segment_ids: [],
          status: "active",
        },
      ],
      workspace: { ...base().workspace, verification: "verified" },
      profile: { ...base().profile!, intent: "owned_growth" },
    });
    const week = buildPlan(s, 7).map((x) => x.rule_key);
    expect(week).not.toContain("p7_product");
    expect(week).not.toContain("p7_verify");
    expect(buildPlan(s, 30).map((x) => x.rule_key)).not.toContain("p30_pilot");
  });
  it("gives every suggestion a stable key and an explanation", () => {
    for (const h of [7, 30, 90] as const)
      for (const x of buildPlan(base(), h)) {
        expect(x.rule_key).toMatch(/^p(7|30|90)_[a-z]+$/);
        expect(x.detail.length).toBeGreaterThan(20);
      }
  });
});
describe("M14 rules", () => {
  it("covers every business type in the evidence matrix with known fields", () => {
    expect(Object.keys(evidenceMatrix).sort()).toEqual(
      Object.keys(businessTypes).sort(),
    );
    for (const fields of Object.values(evidenceMatrix))
      for (const f of fields) expect(evidenceFields).toHaveProperty(f);
    expect(evidenceMatrix.international).toContain("registration_country");
    expect(evidenceMatrix.individual).not.toContain("registration_number");
  });
  it("never asks for a full government id number", () => {
    expect(Object.keys(evidenceFields)).not.toContain("id_document_number");
    expect(evidenceFields.id_document_last4).toMatch(/Last 4/);
  });
  it("maturity has three descriptive levels per question and no numbers", () => {
    for (const q of maturityQuestions) {
      expect(Object.keys(q.levels)).toEqual([
        "starting",
        "developing",
        "established",
      ]);
      expect(JSON.stringify(q)).not.toMatch(/\d/);
    }
  });
  it("explains suitable Creator segments without ranking or a follower minimum for Brands (F28)", () => {
    const text = creatorSegments(base()).join(" ");
    expect(text).toMatch(/UGC/);
    expect(text).not.toMatch(/\b100 followers\b|rank|score/i);
  });
});
