import { expect, test } from "@playwright/test";

test("production hides the onboarding preview and its fixtures", async ({
  request,
}) => {
  for (const path of [
    "/dev/onboarding-preview/identity",
    "/dev/onboarding-preview/summary",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(await response.text()).not.toContain("Illustrative Creator");
  }
});
test("production redirects anonymous onboarding requests to sign-in, uncached and with a nonce CSP", async ({
  request,
}) => {
  for (const path of [
    "/onboarding/creator",
    "/onboarding/creator/goals",
    "/onboarding/creator/complete",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBeGreaterThanOrEqual(300);
    expect(response.status(), path).toBeLessThan(400);
    expect(response.headers().location, path).toMatch(/\/login/);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["content-security-policy"]).toMatch(
      /'nonce-[^']+'/,
    );
    expect(response.headers()["content-security-policy"]).not.toContain(
      "unsafe-eval",
    );
  }
});
