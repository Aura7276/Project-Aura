"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requestClient } from "@/server/database/client";
import {
  actor,
  eligible,
  captureContext,
  consumeContext,
  configured,
} from "@/server/auth/session";
import {
  callbackOrigin,
  emailSchema,
  passwordSchema,
  identitySchema,
  isRecentMfa,
} from "./validation";
const value = (f: FormData, k: string) => String(f.get(k) ?? "");
function stop(path: string, notice: string): never {
  redirect(path + "?notice=" + notice);
}
async function publicClient(path: string) {
  if (!configured()) stop(path, "provider");
  return requestClient();
}
export async function register(f: FormData) {
  const email = emailSchema.safeParse(value(f, "email"));
  const pass = passwordSchema.safeParse(value(f, "password"));
  const info = identitySchema.safeParse(Object.fromEntries(f));
  if (
    !email.success ||
    !pass.success ||
    !info.success ||
    pass.data !== value(f, "confirm")
  )
    stop("/register", "input");
  await captureContext(f.get("kind"), f.get("value"));
  const client = await publicClient("/register");
  const { error } = await client.auth.signUp({
    email: email.data,
    password: pass.data,
    options: {
      emailRedirectTo: callbackOrigin() + "/auth/callback",
      data: {
        name: info.data.name,
        country: info.data.country,
        mobile: info.data.mobile,
        adult: true,
      },
    },
  });
  if (error && error.code !== "user_already_exists")
    stop("/register", error.status === 429 ? "rate" : "failed");
  redirect("/verify-email");
}
export async function login(f: FormData) {
  await captureContext(f.get("kind"), f.get("value"));
  const client = await publicClient("/login");
  const email = emailSchema.safeParse(value(f, "email"));
  if (!email.success || !value(f, "password")) stop("/login", "input");
  const { error } = await client.auth.signInWithPassword({
    email: email.data,
    password: value(f, "password"),
  });
  if (error) {
    console.warn(
      JSON.stringify({ category: "security", event: "login_denied" }),
    );
    stop("/login", error.status === 429 ? "rate" : "credentials");
  }
  redirect("/account/continue");
}
export async function google(f: FormData) {
  await captureContext(f.get("kind"), f.get("value"));
  const client = await publicClient("/login");
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackOrigin() + "/auth/callback",
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) stop("/login", "oauth");
  redirect(data.url);
}
export async function resend(f: FormData) {
  const client = await publicClient("/verify-email");
  const email = emailSchema.safeParse(value(f, "email"));
  if (!email.success) stop("/verify-email", "input");
  const { error } = await client.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: callbackOrigin() + "/auth/callback" },
  });
  if (error?.status === 429) stop("/verify-email", "rate");
  stop("/verify-email", "requested");
}
export async function recover(f: FormData) {
  const client = await publicClient("/forgot-password");
  const email = emailSchema.safeParse(value(f, "email"));
  if (!email.success) stop("/forgot-password", "input");
  const { error } = await client.auth.resetPasswordForEmail(email.data, {
    redirectTo: callbackOrigin() + "/reset-password",
  });
  if (error?.status === 429) stop("/forgot-password", "rate");
  stop("/forgot-password", "requested");
}
export async function verifyEmail(f: FormData) {
  const client = await publicClient("/verify-email");
  const { error } = await client.auth.verifyOtp({
    type: "signup",
    token_hash: value(f, "token"),
  });
  if (error) stop("/verify-email", "token");
  redirect("/account/continue");
}
export async function resetPassword(f: FormData) {
  const password = passwordSchema.safeParse(value(f, "password"));
  if (!password.success || password.data !== value(f, "confirm"))
    stop("/reset-password", "input");
  const client = await publicClient("/reset-password");
  const { error } = await client.auth.verifyOtp({
    type: "recovery",
    token_hash: value(f, "token"),
  });
  if (error) stop("/forgot-password", "token");
  const result = await client.auth.updateUser({ password: password.data });
  if (result.error) stop("/forgot-password", "failed");
  const signedOut = await client.auth.signOut({ scope: "global" });
  if (signedOut.error) stop("/security", "revoke");
  stop("/login", "changed");
}
export async function completeIdentity(f: FormData) {
  const { client } = await actor();
  const info = identitySchema.safeParse(Object.fromEntries(f));
  if (!info.success) stop("/identity", "input");
  const { name, country, mobile } = info.data;
  const { error } = await client.rpc("aura_complete_identity", {
    p_name: name,
    p_country: country,
    p_mobile: mobile,
    p_adult: true,
  });
  if (error) stop("/identity", "failed");
  redirect("/account/continue");
}
export async function resume() {
  const { client, state } = await eligible();
  const ctx = await consumeContext();
  if (ctx?.kind === "campaign") redirect("/campaign/" + ctx.value);
  if (ctx?.kind === "invite") {
    const { data, error } = await client.rpc("aura_attribute_referral", {
      p_code: ctx.value,
    });
    if (error || !data) stop("/workspaces", "invite");
  }
  redirect(
    state.last_workspace
      ? "/workspaces/" + state.last_workspace
      : "/workspaces",
  );
}
export async function createWorkspace(f: FormData) {
  const { client, state } = await eligible();
  const kind = value(f, "kind");
  if (kind === "brand" && !state.strong) redirect("/mfa");
  const args = z
    .object({
      p_kind: z.enum(["creator", "brand"]),
      p_request: z.uuid(),
      p_name: z.string().trim().min(1).max(100),
      p_business: z
        .enum(["company", "startup", "individual", "small_business"])
        .nullable(),
    })
    .safeParse({
      p_kind: kind,
      p_request: value(f, "request"),
      p_name: value(f, "name"),
      p_business: kind === "brand" ? value(f, "business") : null,
    });
  if (!args.success) stop("/workspaces", "input");
  const { data, error } = await client.rpc("aura_create_workspace", args.data);
  if (error || !data) stop("/workspaces", "failed");
  redirect("/workspaces/" + data);
}
export async function chooseWorkspace(f: FormData) {
  const { client } = await eligible();
  const id = value(f, "workspace");
  if (!z.uuid().safeParse(id).success) stop("/workspaces", "restricted");
  const { error } = await client.rpc("aura_select_workspace", {
    p_workspace: id,
    p_begin: f.get("begin") === "yes",
  });
  if (error) stop("/workspaces", "restricted");
  redirect("/workspaces/" + id);
}
export async function acceptInvitation(f: FormData) {
  const { client } = await eligible();
  const token = value(f, "token");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) stop("/workspaces", "invite");
  const { data, error } = await client.rpc("aura_accept_invitation", {
    p_token: token,
  });
  if (error || !data) stop("/workspaces", "invite");
  redirect("/workspaces/" + data);
}
export async function logout(f: FormData) {
  const client = await publicClient("/login");
  const global = f.get("scope") === "global";
  if (global) await eligible();
  const { error } = await client.auth.signOut({
    scope: global ? "global" : "local",
  });
  if (error) stop("/login", "revoke");
  redirect("/login");
}
export async function challenge(f: FormData) {
  const { client } = await actor();
  const code = value(f, "code");
  if (!/^\d{6}$/.test(code)) stop("/mfa", "input");
  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId: value(f, "factor"),
    code,
  });
  if (error) stop("/mfa", "challenge");
  redirect("/account/continue");
}
export async function enroll() {
  const { client, state } = await actor();
  if (!state.profile) redirect("/identity");
  const { data: list, error: failed } = await client.auth.mfa.listFactors();
  if (failed || !list) stop("/mfa", "failed");
  if (list.totp.length && !state.strong) stop("/mfa", "challenge");
  for (const old of list.all.filter(
    (f) => f.status === "unverified" && f.factor_type === "totp",
  ))
    await client.auth.mfa.unenroll({ factorId: old.id });
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "AURA " + new Date().toISOString(),
  });
  if (error || !data) stop("/mfa", "failed");
  return { id: data.id, secret: data.totp.secret };
}
export async function removeFactor(f: FormData) {
  const { client, state } = await eligible();
  const claims = await client.auth.getClaims();
  if (!state.strong || !isRecentMfa(claims.data?.claims.amr))
    stop("/mfa", "recent");
  const { data } = await client.auth.mfa.listFactors();
  if (!data || !data.totp.some((x) => x.id === value(f, "factor")))
    stop("/mfa", "failed");
  const { data: mandatory, error } = await client.rpc("aura_privileged_mfa");
  if (error || (mandatory && data.totp.length < 2)) stop("/mfa", "required");
  if ((await client.auth.mfa.unenroll({ factorId: value(f, "factor") })).error)
    stop("/mfa", "failed");
  redirect("/security");
}
export async function changePassword(f: FormData) {
  const { client } = await eligible();
  const pass = passwordSchema.safeParse(value(f, "password"));
  if (
    !pass.success ||
    pass.data !== value(f, "confirm") ||
    !value(f, "current")
  )
    stop("/security", "input");
  const { error } = await client.auth.updateUser({
    password: pass.data,
    current_password: value(f, "current"),
  });
  if (error) stop("/security", "failed");
  if ((await client.auth.signOut({ scope: "global" })).error)
    stop("/security", "revoke");
  stop("/login", "changed");
}
export async function phone(f: FormData) {
  const { client, user } = await eligible();
  if (process.env.AURA_SMS_ENABLED !== "true") stop("/security", "sms");
  const number = value(f, "phone");
  if (!/^\+[1-9]\d{6,14}$/.test(number)) stop("/security", "input");
  const code = value(f, "code");
  const claims = await client.auth.getClaims();
  const recent =
    Array.isArray(claims.data?.claims.amr) &&
    claims.data.claims.amr.some(
      (a) =>
        typeof a === "object" &&
        a.timestamp >= Date.now() / 1000 - 300 &&
        a.timestamp <= Date.now() / 1000 &&
        ["password", "oauth", "totp"].includes(a.method),
    );
  if (!code && !recent) stop("/security", "reauth");
  const { error } = code
    ? await client.auth.verifyOtp({
        type: "phone_change",
        phone: number,
        token: code,
      })
    : await client.auth.updateUser({
        phone: number,
        current_password: value(f, "current"),
      });
  if (error || !user) stop("/security", "failed");
  stop("/security", code ? "updated" : "requested");
}
