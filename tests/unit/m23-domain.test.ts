// Unit tests for the M23 interface rules. Delegation itself is enforced and tested in the database (tests/db/m23_rls.sql).
import { describe, expect, it } from "vitest";
import {
  actionLabel,
  expiryText,
  feeKinds,
  money,
  neverDelegated,
  scopeInfo,
  scopeOrder,
  scopesText,
  totals,
} from "@/features/agency/rules";

describe("M23 delegated areas", () => {
  it("every area is explained for Brands and Creators, in a fixed order", () => {
    expect(scopeOrder).toEqual([
      "view",
      "profile",
      "campaigns",
      "applications",
      "content",
      "results",
      "assistant",
    ]);
    for (const s of scopeOrder) {
      expect(scopeInfo[s].brand.length, s).toBeGreaterThan(15);
      expect(scopeInfo[s].creator.length, s).toBeGreaterThan(15);
    }
    expect(scopeInfo.view.brand).toMatch(/No changes/);
    expect(scopeInfo.assistant.brand).toMatch(/assistant conversations/);
  });
  it("lists what is never delegated", () => {
    expect(neverDelegated.join(" ")).toMatch(/consent/);
    expect(neverDelegated.join(" ")).toMatch(/Deleting/);
    expect(neverDelegated.join(" ")).toMatch(/only you can/);
  });
  it("orders and names granted areas", () => {
    expect(scopesText(["content", "view"])).toBe("View, Content");
  });
});

describe("M23 activity and money", () => {
  it("turns function names into readable actions", () => {
    expect(actionLabel("aura_brand_content_create")).toBe("Content · create");
    expect(actionLabel("aura_brand_save_goal")).toBe(
      "Business profile · save goal",
    );
    expect(actionLabel("aura_apply_confirm")).toBe("Applications · confirm");
    expect(actionLabel("aura_studio_capture_idea")).toBe(
      "Studio · capture idea",
    );
  });
  it("never adds different currencies together and ignores cancelled fees", () => {
    const t = totals([
      { currency: "INR", amount: 1000, status: "paid" },
      { currency: "INR", amount: 500, status: "paid" },
      { currency: "USD", amount: 20, status: "paid" },
      { currency: "INR", amount: 900, status: "cancelled" },
    ]);
    expect(t).toEqual([money("INR", 1500), money("USD", 20)]);
    expect(
      totals([{ currency: "INR", amount: 10, status: "invoiced" }], "paid"),
    ).toEqual([]);
    expect(Object.keys(feeKinds)).toEqual([
      "retainer",
      "commission",
      "project_fee",
      "expense",
    ]);
  });
  it("describes access expiry plainly", () => {
    expect(expiryText(null)).toBe("No access");
    expect(
      expiryText({
        expires_at: "2027-01-01T00:00:00Z",
        days_left: 0,
        expired: true,
      }),
    ).toBe("Expired");
    expect(
      expiryText({
        expires_at: "2027-01-01T00:00:00Z",
        days_left: 3,
        expired: false,
      }),
    ).toBe("Ends in 3 days");
    expect(
      expiryText({
        expires_at: "2027-03-01T00:00:00Z",
        days_left: 90,
        expired: false,
      }),
    ).toBe("Until 1 Mar 2027");
  });
});
