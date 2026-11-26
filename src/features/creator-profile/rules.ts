// M09 shared rules and labels. The database is authoritative; these mirror it for forms (drift is test-checked).
export const usernamePattern = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
/** Mirrors aura_profile.reserved_username: every Creator Studio segment under /creator/ plus system words. */
export const reservedUsernames = [
  "actions",
  "admin",
  "analytics",
  "api",
  "app",
  "aura",
  "auth",
  "brand",
  "brands",
  "campaign",
  "campaigns",
  "create",
  "creator",
  "creators",
  "dashboard",
  "edit",
  "experiments",
  "explore",
  "feedback",
  "grow",
  "help",
  "kit",
  "login",
  "logout",
  "marketplace",
  "me",
  "media-kit",
  "new",
  "notifications",
  "null",
  "official",
  "onboarding",
  "portfolio",
  "privacy",
  "profile",
  "progress",
  "rates",
  "recommendations",
  "register",
  "resources",
  "root",
  "search",
  "security",
  "services",
  "settings",
  "signin",
  "signup",
  "socials",
  "staff",
  "studio",
  "support",
  "system",
  "terms",
  "undefined",
  "workspaces",
  "www",
] as const;
export type UsernameCheck =
  { ok: true; value: string } | { ok: false; reason: string };
export function checkUsername(raw: string): UsernameCheck {
  const v = raw.trim().toLowerCase().replace(/^@+/, "");
  if (v.length < 3 || v.length > 30)
    return { ok: false, reason: "Use 3 to 30 characters." };
  if (!usernamePattern.test(v))
    return {
      ok: false,
      reason:
        "Use letters, numbers, dots, dashes or underscores, starting and ending with a letter or number.",
    };
  if (/[._-]{2}/.test(v))
    return {
      ok: false,
      reason: "Do not put two dots, dashes or underscores together.",
    };
  if ((reservedUsernames as readonly string[]).includes(v))
    return { ok: false, reason: "That word is reserved. Choose another." };
  return { ok: true, value: v };
}
export const themes = {
  ivory: "Ivory",
  midnight: "Midnight",
  sage: "Sage",
  peach: "Peach",
} as const;
export const covers = {
  aurora: "Aurora gradient",
  grid: "Fine grid",
  waves: "Soft waves",
  plain: "Plain",
} as const;
export const profileSections = {
  about: "About",
  portfolio: "Portfolio",
  case_studies: "Case studies",
  services: "Services",
  experience: "Experience",
  testimonials: "Testimonials",
  accounts: "Social accounts",
  availability: "Availability",
} as const;
export type ProfileSection = keyof typeof profileSections;
export const kitSections = {
  about: "About",
  accounts: "Social accounts",
  portfolio: "Portfolio",
  case_studies: "Case studies",
  services: "Services",
  packages: "Packages and rates",
  experience: "Experience",
  testimonials: "Testimonials",
  audience: "Audience",
  availability: "Availability",
  contact: "How to work with me",
} as const;
export type KitSection = keyof typeof kitSections;
export const kitTemplates = {
  editorial: "Editorial",
  classic: "Classic",
  compact: "Compact",
} as const;
export const portfolioKinds = {
  organic: "Organic content",
  commercial: "Commercial work",
  ugc_sample: "UGC sample",
  speculative: "Speculative or self-initiated",
  case_study: "Case study",
} as const;
export type PortfolioKind = keyof typeof portfolioKinds;
export const visibilities = {
  private: "Private (only you)",
  restricted: "Restricted (only people you send a restricted link)",
  public: "Public",
} as const;
export type Visibility = keyof typeof visibilities;
export const serviceKinds = {
  influencer: "Influencer",
  ugc: "UGC (user-generated content)",
  other: "Other",
} as const;
export const pricingModes = {
  quote: "Quote on request",
  fixed: "Fixed price",
  range: "Price range",
} as const;
export const availabilityLabels = {
  open: "Open to work",
  limited: "Limited availability",
  unavailable: "Not taking work",
} as const;
export const relationships = {
  brand_client: "Brand client",
  agency: "Agency",
  collaborator: "Collaborator",
  other: "Other",
} as const;
export const testimonialStatus = {
  pending: "Awaiting moderation",
  approved: "Approved",
  rejected: "Not approved",
  disputed: "Disputed, under review",
  removed: "Removed",
} as const;
export const rateNotice =
  "Rates are indicative. They are not an offer or a contract; terms are agreed separately for each collaboration.";
export const downloadNotice =
  "A downloaded PDF is a copy. Revoking a link stops the hosted version, but a copy someone already saved cannot be recalled.";
export const kitTokenPattern = /^[0-9a-f]{64}$/;
export const initials = (name: string | null | undefined) =>
  (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
export const money = (currency: string, n: number | null | undefined) =>
  n === null || n === undefined
    ? ""
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
