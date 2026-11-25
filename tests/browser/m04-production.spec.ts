import { expect, test } from "@playwright/test";

test("production hides the Creator Studio preview and its fixtures", async ({
  request,
}) => {
  for (const path of [
    "/dev/studio-preview/dashboard",
    "/dev/studio-preview/progress?situation=below100",
  ]) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(404);
    expect(await r.text()).not.toContain("Illustrative Creator");
  }
});
test("production redirects anonymous Creator Studio requests to sign-in, uncached and with a nonce CSP", async ({
  request,
}) => {
  for (const path of [
    "/creator",
    "/creator/dashboard",
    "/creator/actions",
    "/creator/progress",
    "/creator/recommendations",
    "/creator/settings/dashboard",
    "/creator/search?q=zebra",
    "/creator/notifications",
  ]) {
    const r = await request.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBeGreaterThanOrEqual(300);
    expect(r.status(), path).toBeLessThan(400);
    expect(r.headers().location, path).toMatch(/\/login/);
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect(r.headers()["content-security-policy"]).toMatch(/'nonce-[^']+'/);
    expect(r.headers()["content-security-policy"]).not.toContain("unsafe-eval");
    // The framework's redirect payload echoes the caller's own request URL (JSON-escaped). That is not tenant data, so the
    // meaningful checks are that nothing is reflected as raw markup and no Creator data is present for an anonymous caller.
    const body = await r.text();
    expect(body).not.toMatch(
      /Illustrative Creator|Today’s actions|Creator Studio sidebar/,
    );
  }
  const probe = await request.get(
    "/creator/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    { maxRedirects: 0 },
  );
  expect(probe.status()).toBeLessThan(400);
  expect(await probe.text()).not.toContain("<script>alert(1)</script>"); // never reflected as raw markup
});
