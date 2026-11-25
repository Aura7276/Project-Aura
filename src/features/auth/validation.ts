import { z } from "zod";
export const identitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  adult: z.literal("on"),
  mobile: z.string().regex(/^(?:\+[1-9]\d{6,14})?$/),
});
export const passwordSchema = z.string().min(12).max(128);
export const emailSchema = z.email().max(254);
export function callbackOrigin() {
  const value =
    process.env.AURA_SITE_URL ??
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3101" : "");
  const url = new URL(value);
  if (
    url.origin !== value ||
    !(
      url.protocol === "https:" ||
      (["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.protocol === "http:")
    )
  )
    throw Error("Invalid site origin");
  return url.origin;
}
export function safeContext(kind: unknown, value: unknown) {
  return (kind === "campaign" || kind === "invite") &&
    typeof value === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(value)
    ? { kind, value }
    : null;
}
export function isRecentMfa(amr: unknown, now = Date.now()) {
  return (
    Array.isArray(amr) &&
    amr.some(
      (a) =>
        a?.method === "totp" &&
        typeof a.timestamp === "number" &&
        now / 1000 >= a.timestamp &&
        now / 1000 - a.timestamp <= 300,
    )
  );
}
