import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { providerSchema } from "../../src/config/environment";
import { specimenTitle } from "../../src/validation/specimen";
import { Button } from "../../src/components/ui/button";
import { Input } from "../../src/components/ui/input";
const key = "sb_publishable_test_fixture";
describe("provider configuration", () => {
  for (const url of ["http://127.0.0.1:54321", "https://staging.example.org"]) {
    it("accepts " + url, () => {
      expect(
        providerSchema.safeParse({
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        }).success,
      ).toBe(true);
    });
  }
  for (const url of [
    "http://staging.example.org",
    "https://user@staging.example.org",
    "https://staging.example.org/extra",
    "invalid",
  ]) {
    it("rejects " + url, () => {
      expect(
        providerSchema.safeParse({
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        }).success,
      ).toBe(false);
    });
  }
  it("rejects missing configuration and secret key types", () => {
    expect(providerSchema.safeParse({}).success).toBe(false);
    expect(
      providerSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.org",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test_fixture",
      }).success,
    ).toBe(false);
  });
});
it("trims titles and enforces both limits", () => {
  expect(specimenTitle.parse("  Aa ")).toBe("Aa");
  expect(specimenTitle.safeParse(" ").success).toBe(false);
  expect(specimenTitle.safeParse("a".repeat(61)).success).toBe(false);
});
it("preserves native disabled button semantics", () => {
  expect(renderToStaticMarkup(<Button disabled>Apply</Button>)).toContain(
    'disabled=""',
  );
});
it("associates input with validation text", () => {
  expect(
    renderToStaticMarkup(<Input aria-invalid aria-describedby="problem" />),
  ).toContain('aria-describedby="problem"');
});
