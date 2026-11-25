import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requestClient } from "@/server/database/client";
import { providerConfig } from "@/config/environment";
import { safeContext } from "@/features/auth/validation";
export function configured() {
  try {
    providerConfig();
    return true;
  } catch {
    return false;
  }
}
export async function actor() {
  if (!configured()) redirect("/login?notice=provider");
  const client = await requestClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at)
    redirect("/login?notice=session");
  const { data: state, error: denied } = await client.rpc(
    "aura_identity_state",
  );
  if (denied || !state) redirect("/login?notice=restricted");
  return { client, user: data.user, state };
}
export async function eligible() {
  const ctx = await actor();
  if (!ctx.state.profile) redirect("/identity");
  if (ctx.state.mfa_required && !ctx.state.strong) redirect("/mfa");
  return ctx;
}
const cookie = "aura-entry";
export async function captureContext(kind: unknown, value: unknown) {
  const intent = safeContext(kind, value);
  if (intent)
    (await cookies()).set(
      cookie,
      JSON.stringify({ ...intent, until: Date.now() + 3600000 }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      },
    );
}
export async function consumeContext() {
  const jar = await cookies();
  const raw = jar.get(cookie)?.value;
  if (!raw) return null;
  jar.delete(cookie);
  try {
    const entry = JSON.parse(raw);
    return Number.isFinite(entry.until) &&
      entry.until > Date.now() &&
      entry.until <= Date.now() + 3600000
      ? safeContext(entry.kind, entry.value)
      : null;
  } catch {
    return null;
  }
}
