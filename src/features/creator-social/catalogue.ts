// Configurable platform catalogue. Mirrors aura_social.platform (drift is test-checked). Platforms do not share identical
// metrics or account types: nothing here assumes they do.
export type PlatformCode =
  "instagram" | "youtube" | "facebook" | "linkedin" | "threads" | "other";
export type Platform = {
  code: PlatformCode;
  label: string;
  handlePattern: RegExp;
  hosts: readonly string[];
  accountTypes: readonly string[];
  integrationOrder: number | null;
  handleHint: string;
};
export const platforms: readonly Platform[] = [
  {
    code: "instagram",
    label: "Instagram",
    handlePattern: /^[A-Za-z0-9._]{1,30}$/,
    hosts: ["instagram.com", "www.instagram.com"],
    accountTypes: ["personal", "creator", "business"],
    integrationOrder: 1,
    handleHint: "Up to 30 letters, numbers, dots or underscores.",
  },
  {
    code: "youtube",
    label: "YouTube",
    handlePattern: /^[A-Za-z0-9._-]{3,60}$/,
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
    accountTypes: [],
    integrationOrder: 2,
    handleHint: "3 to 60 letters, numbers, dots, dashes or underscores.",
  },
  {
    code: "facebook",
    label: "Facebook",
    handlePattern: /^[A-Za-z0-9.]{5,50}$/,
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com"],
    accountTypes: [],
    integrationOrder: null,
    handleHint: "5 to 50 letters, numbers or dots.",
  },
  {
    code: "linkedin",
    label: "LinkedIn",
    handlePattern: /^[A-Za-z0-9-]{3,100}$/,
    hosts: ["linkedin.com", "www.linkedin.com"],
    accountTypes: [],
    integrationOrder: null,
    handleHint: "3 to 100 letters, numbers or dashes.",
  },
  {
    code: "threads",
    label: "Threads",
    handlePattern: /^[A-Za-z0-9._]{1,30}$/,
    hosts: ["threads.net", "www.threads.net", "threads.com", "www.threads.com"],
    accountTypes: [],
    integrationOrder: null,
    handleHint: "Up to 30 letters, numbers, dots or underscores.",
  },
  {
    code: "other",
    label: "Other link",
    handlePattern: /^[A-Za-z0-9._-]{1,60}$/,
    hosts: [],
    accountTypes: [],
    integrationOrder: null,
    handleHint: "Up to 60 letters, numbers, dots, dashes or underscores.",
  },
];
export const platformCodes = platforms.map((p) => p.code) as string[];
export const platformOf = (code: string) =>
  platforms.find((p) => p.code === code);
export const platformLabel = (code: string) => platformOf(code)?.label ?? code;
export const normalizeHandle = (raw: string) => raw.trim().replace(/^@+/, "");
export type Check = { ok: true } | { ok: false; reason: string };
export function validateHandle(platform: string, raw: string): Check {
  const p = platformOf(platform);
  if (!p) return { ok: false, reason: "Choose a platform." };
  const h = normalizeHandle(raw);
  if (!h) return { ok: false, reason: "Enter the username." };
  return p.handlePattern.test(h)
    ? { ok: true }
    : { ok: false, reason: p.handleHint };
}
/** Validated, never fetched. https only, no credentials, no port, no IP or single-label host, and known platforms must match their own hosts. */
export function validateAccountUrl(platform: string, raw: string): Check {
  const text = raw.trim();
  if (!text) return { ok: true };
  if (text.length > 300) return { ok: false, reason: "That link is too long." };
  if (!/^https:\/\//i.test(text) || !URL.canParse(text))
    return { ok: false, reason: "Use a link that starts with https://." };
  const u = new URL(text);
  if (u.username || u.password)
    return {
      ok: false,
      reason: "Links cannot contain a username or password.",
    };
  if (u.port) return { ok: false, reason: "Links cannot specify a port." };
  const host = u.hostname.toLowerCase();
  if (
    /^\d+(\.\d+){3}$/.test(host) ||
    host.includes(":") ||
    host === "localhost" ||
    !host.includes(".")
  )
    return { ok: false, reason: "Use the public web address of the profile." };
  const p = platformOf(platform);
  if (p && p.hosts.length && !p.hosts.includes(host))
    return { ok: false, reason: `That link is not a ${p.label} address.` };
  return { ok: true };
}
/** Handle-based identity is PROVISIONAL: a rename or a reassigned handle is not proof. A provider id (M05 adapters) is the stable identity. */
export const identityKey = (
  platform: string,
  handle: string,
  providerId?: string | null,
) =>
  providerId
    ? `${platform}:id:${providerId}`
    : `${platform}:h:${handle.toLowerCase()}`;
export const instagramAccountTypes = [
  ["personal", "Personal"],
  ["creator", "Creator"],
  ["business", "Business"],
] as const;
