import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const env = process.env;
if (env.AURA_DISPOSABLE_AUTH_TEST !== "true")
  throw Error(
    "Set AURA_DISPOSABLE_AUTH_TEST=true only for a disposable local or staging project.",
  );
async function identity(prefix) {
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email: env[prefix + "_EMAIL"],
    password: env[prefix + "_PASSWORD"],
  });
  assert.ok(!error && data.user, "Verified test identity must sign in");
  return { client, id: data.user.id };
}
async function run() {
  const a = await identity("AURA_TEST_A"),
    b = await identity("AURA_TEST_B");
  try {
    assert.notEqual(a.id, b.id);
    for (const { client } of [a, b]) {
      const result = await client.rpc("aura_complete_identity", {
        p_name: "Isolation test fixture",
        p_country: "IN",
        p_adult: true,
        p_mobile: "",
      });
      assert.equal(result.error, null);
    }
    const workspace = await a.client.rpc("aura_create_workspace", {
      p_request: crypto.randomUUID(),
      p_kind: "creator",
      p_name: "Isolation test workspace",
      p_business: null,
    });
    assert.equal(workspace.error, null);
    assert.ok(workspace.data);
    const list = await b.client.rpc("aura_workspaces");
    assert.equal(list.error, null);
    assert.ok(list.data.every((w) => w.id !== workspace.data));
    const denied = await b.client.rpc("aura_select_workspace", {
      p_workspace: workspace.data,
      p_begin: false,
    });
    assert.equal(denied.error?.code, "42501");
    console.log(
      "Two independent authenticated identities: list isolation and denied selection verified.",
    );
  } finally {
    await Promise.all([
      a.client.auth.signOut({ scope: "local" }),
      b.client.auth.signOut({ scope: "local" }),
    ]);
  }
}
await run();
