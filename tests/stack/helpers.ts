import type { APIRequestContext, BrowserContext } from "@playwright/test";
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
): Promise<Seed> {
  const r = await request.post(`${stack}/__test/user`, {
    data: { email, name, country: "IN", kind },
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
