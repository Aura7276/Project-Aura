export const destinations = {
  creators: ["For Creators", "M01"],
  brands: ["For Brands", "M01"],
  agencies: ["For Agencies", "M01"],
  discovery: ["Discover creators", "M01 / M09"],
  campaigns: ["Discover campaigns", "M01 / M10"],
  guides: ["Creator guides", "M01"],
  tips: ["Growth tips", "M01"],
  resources: ["Brand resources", "M01"],
  pricing: ["Pricing", "M01 / M27"],
  login: ["Log in", "M02"],
  register: ["Get started", "M02"],
  about: ["About AURA", "M01"],
  contact: ["Contact", "M01"],
  support: ["Support centre", "M01"],
  privacy: ["Privacy", "Legal review"],
  terms: ["Terms", "Legal review"],
} as const;
export type Destination = keyof typeof destinations;
export const groups = {
  Explore: ["discovery", "campaigns"],
  Resources: ["guides", "tips", "resources", "support"],
} as const;
export const footerGroups = {
  Creators: ["creators"],
  Brands: ["brands"],
  Agencies: ["agencies"],
  Explore: groups.Explore,
  Resources: ["guides", "tips", "resources"],
  Company: ["about", "pricing"],
  Support: ["contact", "support"],
  Legal: ["privacy", "terms"],
} as const satisfies Record<string, readonly Destination[]>;
export function implementedDestination(id: Destination) {
  return id === "creators" || id === "brands";
}
export function destinationPath(id: Destination) {
  return implementedDestination(id) ? "/" + id : "/readiness/" + id;
}
export function isDestination(id: string): id is Destination {
  return Object.hasOwn(destinations, id);
}
