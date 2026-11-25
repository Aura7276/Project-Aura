// Pure validation only. The backend never fetches user-entered URLs (no SSRF surface).
const hosts: Record<string, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  threads: ["threads.net", "www.threads.net", "threads.com", "www.threads.com"],
};
export const handlePattern = /^[A-Za-z0-9._-]{1,60}$/;
export function normalizeHandle(raw: string) {
  return raw.trim().replace(/^@+/, "");
}
export type UrlResult =
  { ok: true; url: string } | { ok: false; reason: string };
export function validateProfileUrl(platform: string, raw: string): UrlResult {
  const text = raw.trim();
  if (text.length > 300) return { ok: false, reason: "That link is too long." };
  if (!/^https:\/\//i.test(text))
    return { ok: false, reason: "Use a link that starts with https://." };
  if (!URL.canParse(text))
    return { ok: false, reason: "That does not look like a valid link." };
  const url = new URL(text);
  if (url.username || url.password)
    return {
      ok: false,
      reason: "Links cannot contain a username or password.",
    };
  if (url.port) return { ok: false, reason: "Links cannot specify a port." };
  const host = url.hostname.toLowerCase();
  if (
    /^\d+(\.\d+){3}$/.test(host) ||
    host.includes(":") ||
    host === "localhost" ||
    !host.includes(".")
  )
    return { ok: false, reason: "Use the public web address of the profile." };
  const allowed = hosts[platform];
  if (allowed && !allowed.includes(host))
    return {
      ok: false,
      reason: `That link is not a ${platform[0].toUpperCase() + platform.slice(1)} address.`,
    };
  url.hash = "";
  return { ok: true, url: url.toString() };
}
