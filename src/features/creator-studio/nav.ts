// Centralized, typed Creator Studio navigation. `available` items resolve to real routes (test-enforced);
// `planned` items have no href and are rendered as honest readiness states, never as links.
export type NavStatus = "available" | "planned";
export type NavItem = {
  id: string;
  label: string;
  href: string | null;
  module: string;
  status: NavStatus;
  note?: string;
};
export type AreaId = "home" | "grow" | "create" | "collaborate" | "studio";
export type NavArea = {
  id: AreaId;
  label: string;
  href: string;
  icon: "house" | "sprout" | "pen" | "handshake" | "user";
  summary: string;
  items: NavItem[];
};
const ok = (
  id: string,
  label: string,
  href: string,
  module: string,
  note?: string,
): NavItem => ({ id, label, href, module, status: "available", note });
const planned = (
  id: string,
  label: string,
  module: string,
  note: string,
): NavItem => ({ id, label, href: null, module, status: "planned", note });
export const areas: NavArea[] = [
  {
    id: "home",
    label: "Home",
    href: "/creator/dashboard",
    icon: "house",
    summary: "Today’s priorities and your progress.",
    items: [ok("dashboard", "Dashboard", "/creator/dashboard", "M04")],
  },
  {
    id: "grow",
    label: "Grow",
    href: "/creator/grow",
    icon: "sprout",
    summary: "Actions, goals and your growth plan.",
    items: [
      ok("actions", "Daily actions", "/creator/actions", "M04"),
      ok("progress", "Progress", "/creator/progress", "M04"),
      ok(
        "accounts",
        "Social accounts",
        "/creator/socials",
        "M05",
        "Self-reported metrics, ownership verification and history.",
      ),
      ok(
        "analytics",
        "Analytics",
        "/creator/analytics",
        "M06",
        "Works from the numbers you record. No connected account is needed.",
      ),
      ok(
        "experiments",
        "Experiments",
        "/creator/experiments",
        "M06",
        "Test an idea and record what you learn.",
      ),
      ok(
        "assistant",
        "Growth Studio",
        "/creator/ai",
        "M07",
        "Draft and refine your next creative move.",
      ),
    ],
  },
  {
    id: "create",
    label: "Create",
    href: "/creator/create",
    icon: "pen",
    summary: "Capture ideas and plan content.",
    items: [
      ok("ideas", "Idea capture", "/creator/create", "M04"),
      ok("studio", "Content Studio", "/creator/content", "M08"),
      ok(
        "calendar",
        "Content calendar",
        "/creator/content?view=calendar",
        "M08",
      ),
    ],
  },
  {
    id: "collaborate",
    label: "Collaborate",
    href: "/creator/recommendations",
    icon: "handshake",
    summary: "Opportunities and eligibility.",
    items: [
      ok(
        "recommendations",
        "Recommendations",
        "/creator/recommendations",
        "M04",
      ),
      ok(
        "marketplace",
        "Campaign marketplace",
        "/creator/marketplace",
        "M10",
        "Campaigns from verified Brands, with eligibility explained.",
      ),
      ok(
        "applications",
        "Applications and invitations",
        "/creator/applications",
        "M11",
        "Your applications, invitations, enquiries and negotiations.",
      ),
      planned(
        "collaborations",
        "Collaborations",
        "M12",
        "Deliverables and deadlines.",
      ),
    ],
  },
  {
    id: "studio",
    label: "My Studio",
    href: "/creator/studio",
    icon: "user",
    summary: "Profile, preferences and account.",
    items: [
      ok(
        "profile",
        "Profile and preferences",
        "/onboarding/creator/profile",
        "M03",
      ),
      ok(
        "dashboard-settings",
        "Dashboard settings",
        "/creator/settings/dashboard",
        "M04",
      ),
      ok("security", "Account security", "/security", "M02"),
      ok("workspaces", "Switch workspace", "/workspaces", "M02"),
      ok(
        "media-kit",
        "Profile and media kit",
        "/creator/profile",
        "M09",
        "Your creator website, portfolio, services and media kits. Private until you publish.",
      ),
      ok("portfolio", "Portfolio", "/creator/portfolio", "M09"),
      ok("kits", "Media kits", "/creator/media-kit", "M09"),
      planned(
        "earnings",
        "Earnings and commercial",
        "M13",
        "Commercial records appear here once they exist.",
      ),
    ],
  },
];
export const accountItems = areas
  .find((a) => a.id === "studio")!
  .items.filter((i) =>
    ["security", "workspaces", "dashboard-settings"].includes(i.id),
  );
export function areaFor(pathname: string): AreaId {
  const all = areas.flatMap((a) =>
    a.items
      .filter((i) => i.href)
      .map((i) => ({ area: a.id, href: i.href as string })),
  );
  const hit = all
    .filter((x) => pathname === x.href || pathname.startsWith(x.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (hit) return hit.area;
  if (pathname.startsWith("/creator/settings")) return "studio";
  return areas.find((a) => pathname === a.href)?.id ?? "home";
}
export const isInternalPath = (href: string) =>
  /^\/(?!\/)[A-Za-z0-9/_#?=&.-]{0,150}$/.test(href);
