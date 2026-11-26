import { describe, expect, it } from "vitest";
import {
  checkUsername,
  initials,
  money,
  reservedUsernames,
} from "@/features/creator-profile/rules";
import { steps } from "@/features/creator-profile/completeness";
import { suggestions } from "@/features/creator-profile/optimize";
import {
  itemSchema,
  packageSchema,
  serviceSchema,
  shareSchema,
  testimonialSchema,
  profileSchema,
} from "@/features/creator-profile/schemas";
import { kitPdf } from "@/features/creator-profile/pdf";
import { areas } from "@/features/creator-studio/nav";
import type {
  KitContent,
  ProfileState,
} from "@/features/creator-profile/types";

const state = (over: Partial<ProfileState> = {}): ProfileState => ({
  profile: {
    username: null,
    headline: null,
    about: null,
    theme: "ivory",
    cover: "aurora",
    section_order: [
      "about",
      "portfolio",
      "case_studies",
      "services",
      "experience",
      "testimonials",
      "accounts",
      "availability",
    ],
    show_follower_counts: false,
    show_branding: true,
    availability: "open",
    available_from: null,
    available_until: null,
    availability_note: null,
    published: false,
    published_at: null,
    listed: false,
    created_at: "",
    updated_at: "",
  },
  display_name: "Asha",
  qualifies: false,
  portfolio: [],
  services: [],
  packages: [],
  experience: [],
  testimonials: [],
  invites: [],
  accounts: [],
  content: [],
  aliases: [],
  ...over,
});
describe("M09 usernames", () => {
  it("normalizes and enforces the rules", () => {
    expect(checkUsername("@Asha.Rao")).toEqual({ ok: true, value: "asha.rao" });
    for (const bad of ["ab", "a..b", "-asha", "asha-", "a b", "x".repeat(31)])
      expect(checkUsername(bad).ok, bad).toBe(false);
  });
  it("reserves every Studio route reachable under /creator/", () => {
    const studioSegments = areas
      .flatMap((a) => a.items)
      .map((i) => i.href)
      .filter((h): h is string => !!h && h.startsWith("/creator/"))
      .map((h) => h.split("/")[2]);
    expect(studioSegments.length).toBeGreaterThan(5);
    for (const s of studioSegments) {
      expect(reservedUsernames as readonly string[]).toContain(s);
      expect(checkUsername(s).ok).toBe(false);
    }
  });
});
describe("M09 checklist and suggestions", () => {
  it("is a list of steps, never a percentage or score", () => {
    const list = steps(state());
    expect(list.length).toBe(10);
    expect(list.every((s) => !s.done)).toBe(true);
    expect(JSON.stringify(list)).not.toMatch(/%|score|rating/i);
    const done = steps(
      state({
        profile: {
          ...state().profile,
          username: "asha",
          headline: "Travel",
          published: true,
        },
      }),
    );
    expect(done.filter((s) => s.done).map((s) => s.id)).toEqual([
      "username",
      "headline",
      "publish",
    ]);
  });
  it("suggests from real records only and never claims AI", () => {
    const s = suggestions(
      state({
        portfolio: [
          {
            id: "1",
            kind: "organic",
            title: "A",
            description: null,
            link: null,
            content_ref: "c",
            studio_ref: null,
            brand_name: null,
            year: null,
            objective: null,
            approach: null,
            contribution: null,
            deliverables: [],
            outcomes: [],
            show_metrics: false,
            visibility: "private",
            featured: false,
            position: 0,
            created_at: "",
            updated_at: "",
          },
        ],
      }),
    );
    expect(s.map((x) => x.id)).toEqual(
      expect.arrayContaining(["about", "metrics", "private"]),
    );
    expect(JSON.stringify(s)).not.toMatch(/\bAI\b|score/);
    expect(
      suggestions(
        state({
          qualifies: true,
          profile: { ...state().profile, published: true, about: "x" },
        }),
      ).some((x) => x.id === "listed"),
    ).toBe(true);
  });
});
describe("M09 validation", () => {
  it("commercial work names the brand; links must be https", () => {
    const base = {
      kind: "commercial",
      title: "Paid reel",
      show_metrics: false,
      visibility: "public",
      featured: false,
    };
    expect(itemSchema.safeParse(base).success).toBe(false);
    expect(
      itemSchema.safeParse({ ...base, brand_name: "Tea Co" }).success,
    ).toBe(true);
    expect(
      itemSchema.safeParse({
        ...base,
        brand_name: "Tea Co",
        link: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(itemSchema.safeParse({ ...base, kind: "speculative" }).success).toBe(
      true,
    );
  });
  it("prices are consistent and rates are never public", () => {
    const s = {
      kind: "influencer",
      name: "Reel",
      pricing: "range",
      currency: "INR",
      visibility: "public",
      rates_visibility: "restricted",
    };
    expect(
      serviceSchema.safeParse({ ...s, price_min: "9000", price_max: "100" })
        .success,
    ).toBe(false);
    expect(
      serviceSchema.safeParse({ ...s, price_min: "5000", price_max: "9000" })
        .success,
    ).toBe(true);
    expect(
      serviceSchema.safeParse({
        ...s,
        rates_visibility: "public",
        price_min: "1",
        price_max: "2",
      }).success,
    ).toBe(false);
    expect(
      packageSchema.safeParse({
        service_kind: "ugc",
        name: "Bundle",
        currency: "INR",
        visibility: "public",
      }).success,
    ).toBe(false);
  });
  it("restricted links name a recipient; testimonials are substantive", () => {
    expect(
      shareSchema.safeParse({ kind: "restricted", include_rates: true })
        .success,
    ).toBe(false);
    expect(
      shareSchema.safeParse({
        kind: "restricted",
        recipient: "6d3f1c8e-2a4b-4c5d-8e9f-0a1b2c3d4e5f",
        include_rates: true,
      }).success,
    ).toBe(true);
    expect(
      testimonialSchema.safeParse({
        author_name: "Priya",
        relationship: "brand_client",
        body: "Great",
      }).success,
    ).toBe(false);
    expect(profileSchema.safeParse({ username: "socials" }).success).toBe(
      false,
    );
  });
});
describe("M09 media-kit PDF", () => {
  const kit = (rates: boolean): KitContent => ({
    kit: {
      name: "Travel 2026",
      audience: "Hospitality",
      template: "editorial",
      intro: "Hello",
    },
    creator: { display_name: "Asha Rao", username: "asha", theme: "ivory" },
    show_branding: true,
    restricted: rates,
    rates_included: rates,
    sections: [
      {
        key: "portfolio",
        items: [
          {
            ref_kind: "portfolio",
            ref_id: "1",
            kind: "speculative",
            title: "Concept ad",
            description: null,
            link: null,
            brand_name: null,
            year: null,
            featured: false,
            speculative: true,
            case_study: null,
            metrics: null,
          },
        ],
        text: null,
      },
      {
        key: "services",
        items: [
          {
            ref_kind: "service",
            ref_id: "2",
            kind: "influencer",
            name: "Reel",
            description: null,
            deliverables: [],
            pricing: rates
              ? { mode: "range", currency: "INR", min: 5000, max: 9000 }
              : { mode: "on_request" },
          },
        ],
        text: null,
      },
    ],
  });
  it("is a valid PDF that labels speculative work and shows rates only when the link includes them", () => {
    const pub = new TextDecoder().decode(kitPdf(kit(false)));
    expect(pub.startsWith("%PDF-1.4")).toBe(true);
    expect(pub).toContain("speculative, not commissioned");
    expect(pub).toContain("rates on request");
    expect(pub).not.toMatch(/5,000|9,000/);
    expect(pub).toContain("cannot be recalled");
    const priv = new TextDecoder().decode(kitPdf(kit(true)));
    expect(priv).toMatch(/5,000/);
    expect(priv).toContain("not an offer or a contract");
  });
  it("formats money and initials", () => {
    expect(money("INR", 5000)).toMatch(/5,000/);
    expect(money("INR", null)).toBe("");
    expect(initials("Asha Rao")).toBe("AR");
    expect(initials("")).toBe("?");
  });
});
