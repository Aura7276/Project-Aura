import { expect, it } from "vitest";
import {
  identitySchema,
  safeContext,
  isRecentMfa,
} from "@/features/auth/validation";
it("requires adult confirmation and accepts an international profile without a phone", () => {
  const profile = { name: "Fixture", country: "br", mobile: "", adult: "on" };
  expect(identitySchema.parse(profile).country).toBe("BR");
  expect(identitySchema.safeParse({ ...profile, adult: "" }).success).toBe(
    false,
  );
});
it("bounds return context to internal identifiers", () => {
  expect(safeContext("campaign", "/login")).toBeNull();
  expect(safeContext("invite", "sample")).toEqual({
    kind: "invite",
    value: "sample",
  });
});
it("requires a recent authenticator verification", () => {
  expect(isRecentMfa([{ method: "totp", timestamp: 100 }], 400000)).toBe(true);
  expect(isRecentMfa([{ method: "totp", timestamp: 100 }], 401000)).toBe(false);
});
