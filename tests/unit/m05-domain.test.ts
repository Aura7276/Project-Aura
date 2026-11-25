import { describe, expect, it } from "vitest";
import { account, state } from "./creator-fixtures";
import {
  identityKey,
  normalizeHandle,
  platformCodes,
  platforms,
  validateAccountUrl,
  validateHandle,
} from "@/features/creator-social/catalogue";
import {
  metricCodes,
  metrics,
  metricsFor,
  sourceLabels,
  validateObservation,
} from "@/features/creator-social/metrics";
import { daysBetween, freshness } from "@/features/creator-social/freshness";
import {
  canTransition,
  claimTransitions,
  isOpenClaim,
  ownershipLabels,
  ownershipStates,
} from "@/features/creator-social/status";
import {
  accountSchema,
  contentObservationSchema,
  correctionSchema,
  decisionSchema,
  grantSchema,
  observationSchema,
} from "@/features/creator-social/schemas";
import {
  accountEligibility,
  paidInfluencerGate,
  trackedAccounts,
} from "@/features/creator-social/eligibility";
import {
  providerStatus,
  publishingAvailability,
  registeredProviders,
} from "@/features/creator-social/providers";
import { extractionAvailability } from "@/features/creator-social/extraction";
import {
  checkEvidenceFile,
  evidenceDisabledReason,
  evidencePath,
  evidenceUploadsEnabled,
  noScanner,
} from "@/features/creator-social/evidence";
import type { SocialAccount } from "@/features/creator-onboarding/types";

const acct = (
  n: number | null,
  o: Partial<SocialAccount> = {},
): SocialAccount =>
  account({
    self_reported_followers: n,
    observed_on: n === null ? null : "2026-11-01",
    ...o,
  });
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
]);

describe("M05 platform catalogue (F04, F05, F16)", () => {
  it("supports the six approved platforms, with Instagram first and YouTube second in integration order", () => {
    expect(platformCodes).toEqual([
      "instagram",
      "youtube",
      "facebook",
      "linkedin",
      "threads",
      "other",
    ]);
    expect(platforms.find((p) => p.integrationOrder === 1)?.code).toBe(
      "instagram",
    );
    expect(platforms.find((p) => p.integrationOrder === 2)?.code).toBe(
      "youtube",
    );
    expect(platforms.find((p) => p.code === "instagram")?.accountTypes).toEqual(
      ["personal", "creator", "business"],
    );
  });
  it("validates handles per platform and normalizes a leading @", () => {
    expect(normalizeHandle("  @@asha.rao ")).toBe("asha.rao");
    expect(validateHandle("instagram", "asha.rao").ok).toBe(true);
    expect(validateHandle("instagram", "a".repeat(31)).ok).toBe(false);
    expect(validateHandle("youtube", "bo").ok).toBe(false); // YouTube needs 3 or more characters
    expect(validateHandle("facebook", "abcd").ok).toBe(false);
    expect(validateHandle("instagram", "has space").ok).toBe(false);
    expect(validateHandle("nope", "abc").ok).toBe(false);
    expect(validateHandle("instagram", "").ok).toBe(false);
  });
  it("accepts only safe profile links that match the platform and never fetches them", () => {
    expect(
      validateAccountUrl("instagram", "https://www.instagram.com/asha").ok,
    ).toBe(true);
    expect(validateAccountUrl("other", "https://example.com/me").ok).toBe(true);
    expect(validateAccountUrl("instagram", "").ok).toBe(true);
    for (const bad of [
      "http://instagram.com/a",
      "https://instagram.com:8080/a",
      "https://127.0.0.1/a",
      "https://localhost/a",
      "https://user:pw@instagram.com/a",
      "https://evil.example/a",
      "javascript:alert(1)",
      "https://instagram/a",
      "https://[::1]/a",
    ])
      expect(validateAccountUrl("instagram", bad).ok, bad).toBe(false);
  });
  it("identity is provisional for handles and stable for provider ids", () => {
    expect(identityKey("instagram", "Asha.Rao")).toBe("instagram:h:asha.rao");
    expect(identityKey("instagram", "Asha.Rao", "17841400")).toBe(
      "instagram:id:17841400",
    );
    expect(identityKey("instagram", "new.handle", "17841400")).toBe(
      identityKey("instagram", "old.handle", "17841400"),
    ); // a rename does not change a provider identity
    expect(identityKey("instagram", "new.handle")).not.toBe(
      identityKey("instagram", "old.handle"),
    ); // but it does change a provisional one
  });
});

describe("M05 metric dictionary, provenance and validation (F10, F12, provenance)", () => {
  it("defines the sixteen metrics with units, scope and shape", () => {
    expect(metricCodes).toHaveLength(16);
    expect(metrics.filter((m) => m.scope === "account")).toHaveLength(8);
    expect(metrics.filter((m) => m.scope === "content")).toHaveLength(8);
    expect(metrics.find((m) => m.code === "watch_time_seconds")?.unit).toBe(
      "seconds",
    );
    expect(metricsFor("youtube", "content").map((m) => m.code)).not.toContain(
      "saves",
    );
    expect(metricsFor("instagram", "content").map((m) => m.code)).toContain(
      "saves",
    );
  });
  it("keeps provenance classes distinct and never labels self-reported data as provider-verified", () => {
    expect(Object.keys(sourceLabels)).toEqual([
      "manual",
      "screenshot_supported",
      "ai_confirmed",
      "provider",
    ]);
    for (const k of ["manual", "screenshot_supported", "ai_confirmed"] as const)
      expect(sourceLabels[k].label.toLowerCase()).not.toMatch(
        /verified by|from the platform/,
      );
    expect(sourceLabels.screenshot_supported.detail).toMatch(
      /not independently verified/i,
    );
    expect(sourceLabels.ai_confirmed.detail).toMatch(
      /not independently verified/i,
    );
  });
  const base = {
    platform: "instagram",
    observedOn: "2026-11-20",
    today: "2026-11-25",
  };
  it("validates a single-date metric, a period metric, ranges and platform support", () => {
    expect(
      validateObservation({ ...base, metric: "followers", value: 0 }).ok,
    ).toBe(true); // a real zero is valid
    expect(
      validateObservation({ ...base, metric: "followers", value: -1 }).ok,
    ).toBe(false);
    expect(
      validateObservation({
        ...base,
        metric: "followers",
        value: 5,
        periodStart: "2026-11-01",
        periodEnd: "2026-11-20",
      }).ok,
    ).toBe(false);
    expect(validateObservation({ ...base, metric: "reach", value: 5 }).ok).toBe(
      false,
    );
    expect(
      validateObservation({
        ...base,
        metric: "reach",
        value: 5,
        periodStart: "2026-11-13",
        periodEnd: "2026-11-20",
      }).ok,
    ).toBe(true);
    expect(
      validateObservation({
        ...base,
        metric: "reach",
        value: 5,
        periodStart: "2026-11-13",
        periodEnd: "2026-11-22",
      }).ok,
    ).toBe(false);
    expect(
      validateObservation({
        ...base,
        metric: "audience_growth",
        value: -12,
        periodStart: "2026-11-13",
        periodEnd: "2026-11-20",
      }).ok,
    ).toBe(true); // growth can be negative
    expect(
      validateObservation({
        ...base,
        platform: "youtube",
        metric: "reach",
        value: 5,
        periodStart: "2026-11-13",
        periodEnd: "2026-11-20",
      }).ok,
    ).toBe(false);
    expect(
      validateObservation({
        ...base,
        metric: "followers",
        value: 5,
        observedOn: "2026-12-01",
      }).ok,
    ).toBe(false);
    expect(validateObservation({ ...base, metric: "views", value: 5 }).ok).toBe(
      false,
    ); // a content metric is not an account metric
  });
});

describe("M05 freshness (F12)", () => {
  const today = "2026-11-25";
  it("is metric-specific, not one universal threshold", () => {
    expect(freshness("followers", "instagram", "2026-11-12", today).state).toBe(
      "current",
    ); // 13 days: within the 14-day default
    expect(freshness("followers", "instagram", "2026-11-09", today).state).toBe(
      "stale",
    ); // 16 days
    expect(freshness("reach", "instagram", "2026-11-09", today).state).toBe(
      "current",
    ); // 16 days is fine for a 30-day metric
  });
  it("distinguishes unknown from unavailable and never calls disconnected data current", () => {
    expect(freshness("followers", "instagram", null, today)).toMatchObject({
      state: "unknown",
      days: null,
    });
    expect(freshness("saves", "youtube", null, today).state).toBe(
      "unavailable",
    );
    const d = freshness("followers", "instagram", "2026-11-24", today, {
      disconnected: true,
    });
    expect(d.state).toBe("stale");
    expect(d.label).toMatch(/Historical/);
    expect(d.recommendation).toMatch(/disconnected/i);
    expect(freshness("followers", "instagram", today, today).label).toBe(
      "Recorded today",
    );
  });
  it("counts days between dates without time-of-day drift", () => {
    expect(daysBetween("2026-11-01", "2026-11-25")).toBe(24);
    expect(daysBetween("2026-11-25", "2026-11-25")).toBe(0);
  });
});

describe("M05 ownership state machine (F05, F06)", () => {
  it("has the eight proposed ownership states, each with a plain-language label", () => {
    expect(ownershipStates).toEqual([
      "unverified",
      "challenge_pending",
      "evidence_submitted",
      "under_review",
      "verified",
      "rejected",
      "disputed",
      "revoked",
    ]);
    for (const s of ownershipStates)
      expect(ownershipLabels[s].label.length).toBeGreaterThan(3);
    expect(ownershipLabels.verified.detail).toMatch(/still self-reported/i);
  });
  it("only a reviewer can approve, reject or revoke; a Creator can never verify their own claim", () => {
    for (const from of [
      "under_review",
      "evidence_submitted",
      "disputed",
    ] as const) {
      expect(canTransition(from, "verified", "creator")).toBe(false);
      expect(canTransition(from, "verified", "system")).toBe(false);
    }
    expect(canTransition("under_review", "verified", "reviewer")).toBe(true);
    expect(canTransition("verified", "revoked", "reviewer")).toBe(true);
    expect(canTransition("challenge_pending", "verified", "reviewer")).toBe(
      false,
    ); // evidence or review must come first
    expect(canTransition("rejected", "verified", "reviewer")).toBe(false);
    expect(
      claimTransitions
        .filter((t) => t.to === "verified")
        .every((t) => t.by === "reviewer"),
    ).toBe(true);
  });
  it("a disputed claim can only be approved by a reviewer and only by explicitly replacing the existing owner", () => {
    const t = claimTransitions.find(
      (x) => x.from === "disputed" && x.to === "verified",
    )!;
    expect(t.by).toBe("reviewer");
    expect(t.via).toMatch(/explicit replace/);
    expect(isOpenClaim("disputed")).toBe(true);
    expect(isOpenClaim("verified")).toBe(false);
    expect(isOpenClaim("revoked")).toBe(false);
  });
});

describe("M05 schemas and server-side validation", () => {
  it("accepts a personal Instagram account with a follower count and defaults the observation date", () => {
    const r = accountSchema.safeParse({
      platform: "instagram",
      handle: "@asha",
      account_type: "personal",
      visibility: "private",
      followers: "60",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.handle).toBe("asha");
      expect(r.data.followers).toBe(60);
      expect(r.data.visibility).toBe("private");
    }
    expect(
      accountSchema.safeParse({
        platform: "instagram",
        handle: "asha",
        followers: "0",
      }).success,
    ).toBe(true); // zero is allowed
  });
  it("rejects bad handles, unsafe links, account types on other platforms and negative or fractional followers", () => {
    expect(
      accountSchema.safeParse({ platform: "instagram", handle: "a b" }).success,
    ).toBe(false);
    expect(
      accountSchema.safeParse({
        platform: "instagram",
        handle: "asha",
        profile_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      accountSchema.safeParse({
        platform: "youtube",
        handle: "ashachan",
        account_type: "personal",
      }).success,
    ).toBe(false);
    expect(
      accountSchema.safeParse({
        platform: "instagram",
        handle: "asha",
        followers: "-1",
      }).success,
    ).toBe(false);
    expect(
      accountSchema.safeParse({
        platform: "instagram",
        handle: "asha",
        followers: "1.5",
      }).success,
    ).toBe(false);
    expect(
      accountSchema.safeParse({ platform: "myspace", handle: "asha" }).success,
    ).toBe(false);
  });
  it("account observations need a real account id, a known account metric and an ISO date", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      observationSchema.safeParse({
        account: id,
        metric: "followers",
        value: "0",
        observed_on: "2026-11-20",
      }).success,
    ).toBe(true);
    expect(
      observationSchema.safeParse({
        account: "x",
        metric: "followers",
        value: "1",
        observed_on: "2026-11-20",
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        account: id,
        metric: "views",
        value: "1",
        observed_on: "2026-11-20",
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        account: id,
        metric: "followers",
        value: "abc",
        observed_on: "2026-11-20",
      }).success,
    ).toBe(false);
  });
  it("content observations need a link or identifier and keep lifetime and window totals consistent", () => {
    const base = {
      account: "11111111-1111-4111-8111-111111111111",
      metric: "views",
      value: "10",
      observed_on: "2026-11-20",
    };
    expect(
      contentObservationSchema.safeParse({
        ...base,
        window: "lifetime",
        url: "https://www.youtube.com/watch?v=a",
      }).success,
    ).toBe(true);
    expect(
      contentObservationSchema.safeParse({ ...base, window: "lifetime" })
        .success,
    ).toBe(false);
    expect(
      contentObservationSchema.safeParse({
        ...base,
        window: "window",
        external_id: "a",
      }).success,
    ).toBe(false);
    expect(
      contentObservationSchema.safeParse({
        ...base,
        window: "window",
        external_id: "a",
        period_start: "2026-11-10",
        period_end: "2026-11-20",
      }).success,
    ).toBe(true);
    expect(
      contentObservationSchema.safeParse({
        ...base,
        window: "lifetime",
        external_id: "a",
        period_start: "2026-11-10",
        period_end: "2026-11-20",
      }).success,
    ).toBe(false);
  });
  it("corrections need a reason; grants need allowlisted fields and a purpose; decisions need a reason", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      correctionSchema.safeParse({ observation: id, value: "5", reason: "ok" })
        .success,
    ).toBe(false);
    expect(
      correctionSchema.safeParse({
        observation: id,
        value: "5",
        reason: "Typo in my entry",
      }).success,
    ).toBe(true);
    expect(
      grantSchema.safeParse({
        account: id,
        recipient: id,
        fields: ["reach"],
        purpose: "Campaign review",
      }).success,
    ).toBe(true);
    expect(
      grantSchema.safeParse({
        account: id,
        recipient: id,
        fields: ["evidence"],
        purpose: "Campaign review",
      }).success,
    ).toBe(false);
    expect(
      grantSchema.safeParse({
        account: id,
        recipient: id,
        fields: [],
        purpose: "Campaign review",
      }).success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({ claim: id, decision: "approved", reason: "x" })
        .success,
    ).toBe(false);
    expect(
      decisionSchema.safeParse({
        claim: id,
        decision: "approved",
        reason: "Code seen in the bio",
      }).success,
    ).toBe(true);
    expect(
      decisionSchema.safeParse({
        claim: id,
        decision: "deleted",
        reason: "Code seen in the bio",
      }).success,
    ).toBe(false);
  });
});

describe("M05 eligibility (F03, F08, AC02 of M03/M04 preserved)", () => {
  const e = (accounts: SocialAccount[], extra = {}) =>
    accountEligibility(state({ social_accounts: accounts, ...extra }));
  it("no accounts: growth stays available and nothing is claimed", () => {
    expect(e([]).standardInfluencer.status).toBe("not_yet");
    expect(e([]).socialOwnership.status).toBe("no_accounts");
    expect(e([]).paidInfluencer.ownershipSatisfied).toBe(false);
  });
  it("99 followers does not meet the threshold; 100 does; two accounts of 60 never add up", () => {
    expect(e([acct(99)]).standardInfluencer.status).toBe("not_yet");
    expect(e([acct(100)]).standardInfluencer.status).toBe(
      "meets_follower_rule_unverified",
    );
    expect(
      e([
        acct(60, { handle: "a" }),
        acct(60, { handle: "b", platform: "youtube", account_type: null }),
      ]).standardInfluencer.status,
    ).toBe("not_yet");
  });
  it("a Brand or company page is not a relevant individual account", () => {
    expect(
      e([acct(9000, { ownership_scope: "brand_or_company" })])
        .standardInfluencer.status,
    ).toBe("not_yet");
  });
  it("removed and archived accounts are excluded and eligibility is re-evaluated", () => {
    expect(
      e([acct(500, { lifecycle: "removed" })]).standardInfluencer.status,
    ).toBe("not_yet");
    expect(
      e([acct(500, { lifecycle: "archived" })]).standardInfluencer.status,
    ).toBe("not_yet");
    expect(
      e([acct(500, { lifecycle: "active" })]).standardInfluencer.status,
    ).toBe("meets_follower_rule_unverified");
    expect(
      trackedAccounts([
        acct(1, { lifecycle: "removed" }),
        acct(2, { lifecycle: "disconnected" }),
        acct(3),
      ]),
    ).toHaveLength(2);
  });
  it("follower count alone never grants ownership or commercial verification", () => {
    const x = e([acct(5000)]);
    expect(x.paidInfluencer.ownershipSatisfied).toBe(false);
    expect(x.paidInfluencer.text).toMatch(/verified ownership/);
    expect(x.commercialVerification.status).toBe(
      "required_before_commercial_activity",
    );
    expect(JSON.stringify(x)).not.toMatch(/commercially verified/i);
  });
  it("paid influencer collaborations require verified ownership of a qualifying account; UGC is separate", () => {
    expect(
      paidInfluencerGate([acct(99, { verification: "verified" })]),
    ).toEqual({
      allowed: false,
      reasons: ["No relevant individual account with 100 or more followers."],
    });
    expect(paidInfluencerGate([acct(150)]).reasons).toEqual([
      "Ownership of a qualifying account is not verified.",
    ]);
    expect(
      paidInfluencerGate([acct(150, { verification: "under_review" })]).allowed,
    ).toBe(false);
    expect(
      paidInfluencerGate([acct(150, { verification: "verified" })]).allowed,
    ).toBe(true);
    expect(
      paidInfluencerGate([
        acct(150, { verification: "verified", lifecycle: "removed" }),
      ]).allowed,
    ).toBe(false);
    expect(
      paidInfluencerGate([
        acct(150, {
          verification: "verified",
          ownership_scope: "brand_or_company",
        }),
      ]).allowed,
    ).toBe(false);
    expect(
      paidInfluencerGate([
        acct(60, { handle: "a", verification: "verified" }),
        acct(60, {
          handle: "b",
          platform: "youtube",
          account_type: null,
          verification: "verified",
        }),
      ]).allowed,
    ).toBe(false); // never summed
    const ugc = e([], {
      collaborations: [{ category: "ugc", interested: true }],
    });
    expect(ugc.ugc.status).toBe("needs_assessment");
    expect(ugc.standardInfluencer.status).toBe("not_yet");
  });
  it("private accounts keep growth access and are told about discovery and commercial limits", () => {
    const x = e([acct(200, { visibility: "private" })]);
    expect(x.privateAccounts).toMatchObject({ count: 1 });
    expect(x.privateAccounts.text).toMatch(/growth tools/);
    expect(x.standardInfluencer.status).toBe("meets_follower_rule_unverified");
    expect(e([acct(200)]).privateAccounts.text).toBeNull();
  });
});

describe("M05 provider, publishing, extraction and evidence contracts", () => {
  it("no provider is registered, so nothing can be reported as connected or synchronized", () => {
    expect(registeredProviders).toHaveLength(0);
    expect(providerStatus("instagram")).toMatchObject({ available: false });
    expect(providerStatus("instagram").reason).toMatch(/manual tracking/);
  });
  it("publishing is unavailable and always needs explicit approval", () => {
    expect(publishingAvailability().available).toBe(false);
    expect(publishingAvailability().reason).toMatch(/explicit approval/);
  });
  it("screenshot extraction is unavailable without a provider and does not pretend otherwise", () => {
    const a = extractionAvailability();
    expect(a.available).toBe(false);
    expect(a.available === false && a.reason).toMatch(/Type your numbers/);
  });
  it("evidence uploads are off by default; files are validated by signature, MIME and size; names are generated", () => {
    expect(evidenceUploadsEnabled({})).toBe(false);
    expect(
      evidenceUploadsEnabled({ AURA_SOCIAL_EVIDENCE_UPLOADS: "enabled" }),
    ).toBe(true);
    expect(noScanner).toBeNull();
    expect(
      checkEvidenceFile(
        { size: 100, declaredMime: "image/png", head: png },
        false,
      ),
    ).toEqual({ ok: false, reason: evidenceDisabledReason });
    expect(
      checkEvidenceFile(
        { size: 100, declaredMime: "image/png", head: png },
        true,
      ).ok,
    ).toBe(true);
    expect(
      checkEvidenceFile(
        {
          size: 100,
          declaredMime: "image/png",
          head: new Uint8Array([0x4d, 0x5a, 0, 0]),
        },
        true,
      ).ok,
    ).toBe(false); // executable renamed
    expect(
      checkEvidenceFile(
        {
          size: 100,
          declaredMime: "image/svg+xml",
          head: new TextEncoder().encode("<svg onload=alert(1)>"),
        },
        true,
      ).ok,
    ).toBe(false); // active content
    expect(
      checkEvidenceFile(
        { size: 100, declaredMime: "image/jpeg", head: png },
        true,
      ).ok,
    ).toBe(false); // MIME does not match content
    expect(
      checkEvidenceFile(
        { size: 6 * 1024 * 1024, declaredMime: "image/png", head: png },
        true,
      ).ok,
    ).toBe(false);
    const path = evidencePath(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "image/png",
      "33333333-3333-4333-8333-333333333333",
    );
    expect(path).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png",
    );
    expect(evidencePath("a", "b", "application/x-msdownload")).toBeNull();
  });
});
