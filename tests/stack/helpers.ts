import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
export type Seed = {
  user_id: string;
  session_id: string;
  workspace_id: string;
  cookie_name: string;
  cookie_value: string;
};
const stack = "http://127.0.0.1:54331";
/** Creates a confirmed user (with the real M02 identity and workspace functions) in the local test stack. */
export async function seedUser(
  request: APIRequestContext,
  email: string,
  name = "Asha Rao",
  kind: "creator" | "brand" = "creator",
  opts: { mfa?: boolean; admin?: boolean } = {},
): Promise<Seed> {
  const r = await request.post(`${stack}/__test/user`, {
    data: { email, name, country: "IN", kind, ...opts },
  });
  return (await r.json()) as Seed;
}
export async function signedIn(context: BrowserContext, seed: Seed) {
  await context.clearCookies();
  await context.addCookies([
    {
      name: seed.cookie_name,
      value: seed.cookie_value,
      url: "http://127.0.0.1:3103",
    },
  ]);
}

/**
 * M14: verifies a seeded Brand ("Brand Co", a company) through the real flow: the two required onboarding steps, a verification case with
 * the company evidence, the declaration, and approval by a reviewer on /admin/verification.
 */
export async function verifyBrand(bp: Page, rp: Page, workspaceId: string) {
  await bp.goto(`/brand/onboarding?w=${workspaceId}`);
  const basics = bp.getByRole("form", { name: "Business basics" });
  if (await basics.isVisible()) {
    await basics.getByRole("button", { name: "Continue" }).click();
    await bp
      .getByRole("form", { name: "Objective and stage" })
      .getByRole("button", { name: "Continue" })
      .click();
    await expect(
      bp.getByRole("heading", { name: "Who buys from you?" }),
    ).toBeVisible();
  }
  await bp.goto(`/brand/verification?w=${workspaceId}`);
  const f = bp.getByRole("form", { name: "Verification details" });
  await f.getByLabel(/^Registered legal name/).fill("Brand Co Private Limited");
  await f.getByLabel(/^Registration number/).fill("U74999MH2020PTC123456");
  await f
    .getByLabel(/^Registered address/)
    .fill("4 Marine Drive, Mumbai 400002");
  await f.getByLabel(/^Representative's full name/).fill("Asha Mehta");
  await f.getByLabel(/^Representative's role/).fill("Director");
  await f.getByRole("button", { name: "Save draft" }).click();
  await expect(bp.getByText("Draft saved.")).toBeVisible();
  const sub = bp.getByRole("form", { name: "Submit for review" });
  await sub.getByLabel(/I confirm these details are true/).check();
  await sub.getByRole("button", { name: "Submit for review" }).click();
  await expect(bp.getByText("With a reviewer").first()).toBeVisible();
  await rp.goto("/admin/verification");
  await rp
    .locator(`li[data-workspace="${workspaceId}"]`)
    .getByRole("link")
    .click();
  await rp
    .getByLabel("Reason (shown to the Brand)")
    .fill("Company registration and director checked.");
  await rp.getByRole("button", { name: "Record decision" }).click();
  await expect(rp.getByText("Decision recorded.")).toBeVisible();
}
