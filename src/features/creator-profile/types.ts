import type {
  KitSection,
  PortfolioKind,
  ProfileSection,
  Visibility,
} from "./rules";
export type Profile = {
  username: string | null;
  headline: string | null;
  about: string | null;
  theme: "ivory" | "midnight" | "sage" | "peach";
  cover: "aurora" | "grid" | "waves" | "plain";
  section_order: ProfileSection[];
  show_follower_counts: boolean;
  show_branding: boolean;
  availability: "open" | "limited" | "unavailable";
  available_from: string | null;
  available_until: string | null;
  availability_note: string | null;
  published: boolean;
  published_at: string | null;
  listed: boolean;
  created_at: string;
  updated_at: string;
};
export type Outcome = {
  statement: string;
  source: "self_reported" | "observation";
  observation_id?: string;
};
export type PortfolioItem = {
  id: string;
  kind: PortfolioKind;
  title: string;
  description: string | null;
  link: string | null;
  content_ref: string | null;
  studio_ref: string | null;
  brand_name: string | null;
  year: number | null;
  objective: string | null;
  approach: string | null;
  contribution: string | null;
  deliverables: string[];
  outcomes: Outcome[];
  show_metrics: boolean;
  visibility: Visibility;
  featured: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};
export type Service = {
  id: string;
  kind: "influencer" | "ugc" | "other";
  name: string;
  description: string | null;
  deliverables: string[];
  pricing: "fixed" | "range" | "quote";
  currency: string;
  price_min: number | null;
  price_max: number | null;
  visibility: Visibility;
  rates_visibility: "private" | "restricted";
  position: number;
};
export type Package = {
  id: string;
  service_kind: "influencer" | "ugc" | "other";
  name: string;
  description: string | null;
  deliverables: { item: string; quantity: number }[];
  currency: string;
  price_min: number | null;
  price_max: number | null;
  turnaround_days: number | null;
  revisions: number | null;
  usage_rights: string | null;
  terms: string | null;
  visibility: "private" | "restricted";
};
export type Experience = {
  id: string;
  organisation: string;
  role: string | null;
  year_from: number | null;
  year_to: number | null;
  description: string | null;
  evidence_url: string | null;
  provenance: "self_reported";
  visibility: Visibility;
};
export type Testimonial = {
  id: string;
  author_name: string;
  author_role: string | null;
  relationship: string;
  body: string;
  status: "pending" | "approved" | "rejected" | "disputed" | "removed";
  displayed: boolean;
  decision_reason: string | null;
  created_at: string;
};
export type Invite = {
  id: string;
  label: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};
export type AccountRef = {
  id: string;
  platform: string;
  handle: string;
  verification: string;
  sharing_visibility: "private" | "published";
  followers: number | null;
  observed_on: string | null;
  lifecycle: string;
};
export type ProfileState = {
  profile: Profile;
  display_name: string | null;
  qualifies: boolean;
  portfolio: PortfolioItem[];
  services: Service[];
  packages: Package[];
  experience: Experience[];
  testimonials: Testimonial[];
  invites: Invite[];
  accounts: AccountRef[];
  content: { id: string; title: string; platform: string }[];
  aliases: { username: string; expires_at: string }[];
};
// Public projections
export type PublicItem = {
  ref_kind: "portfolio";
  ref_id: string;
  kind: PortfolioKind;
  title: string;
  description: string | null;
  link: string | null;
  brand_name: string | null;
  year: number | null;
  featured: boolean;
  speculative: boolean;
  case_study: {
    objective: string | null;
    approach: string | null;
    contribution: string | null;
    deliverables: string[];
    outcomes: Outcome[];
  } | null;
  metrics:
    | {
        metric: string;
        value: number;
        window: string;
        period_start: string | null;
        period_end: string | null;
        observed_on: string;
        source: string;
      }[]
    | null;
};
export type PublicService = {
  ref_kind: "service";
  ref_id: string;
  kind: string;
  name: string;
  description: string | null;
  deliverables: string[];
  pricing:
    | { mode: "on_request" }
    | {
        mode: "fixed" | "range" | "quote";
        currency: string;
        min: number | null;
        max: number | null;
      };
};
export type PublicPackage = {
  ref_kind: "package";
  ref_id: string;
  service_kind: string;
  name: string;
  description: string | null;
  deliverables: { item: string; quantity: number }[];
  turnaround_days: number | null;
  revisions: number | null;
  usage_rights: string | null;
  terms: string | null;
  price: { currency: string; min: number | null; max: number | null } | null;
};
export type PublicAccount = {
  ref_kind: "account";
  ref_id: string;
  platform: string;
  handle: string;
  ownership: "verified" | "self_reported";
  followers: {
    value: number;
    observed_on: string;
    source: "self_reported";
  } | null;
};
export type PublicExperience = {
  organisation: string;
  role: string | null;
  year_from: number | null;
  year_to: number | null;
  description: string | null;
  evidence_url?: string | null;
  provenance: "self_reported";
};
export type PublicTestimonial = {
  author_name: string;
  author_role: string | null;
  relationship: string;
  body: string;
  date: string;
};
export type PublicProfile = {
  username: string;
  display_name: string;
  headline: string | null;
  about: string | null;
  theme: Profile["theme"];
  cover: Profile["cover"];
  section_order: ProfileSection[];
  show_branding: boolean;
  niche: string | null;
  availability: {
    status: Profile["availability"];
    from: string | null;
    until: string | null;
    note: string | null;
  };
  discoverable: boolean;
  accounts: PublicAccount[];
  portfolio: PublicItem[];
  case_studies: PublicItem[];
  services: PublicService[];
  experience: PublicExperience[];
  testimonials: PublicTestimonial[];
};
export type KitContent = {
  kit: {
    name: string;
    audience: string | null;
    template: "editorial" | "classic" | "compact";
    intro: string | null;
  };
  creator: {
    display_name: string;
    username: string | null;
    theme: Profile["theme"];
  };
  show_branding: boolean;
  restricted: boolean;
  rates_included: boolean;
  sections: { key: KitSection; items: unknown[]; text: unknown }[];
};
export type Kit = {
  id: string;
  name: string;
  audience: string | null;
  template: KitContent["kit"]["template"];
  intro: string | null;
  contact_note: string | null;
  created_at: string;
  updated_at: string;
  sections: {
    key: KitSection;
    position: number;
    enabled: boolean;
    item_ids: string[] | null;
  }[];
  versions: {
    id: string;
    version: number;
    note: string | null;
    created_at: string;
  }[];
  shares: {
    id: string;
    kind: "public" | "restricted";
    recipient: string | null;
    version_id: string | null;
    include_rates: boolean;
    label: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
    active: boolean;
    views: number;
    brand_visits: number;
  }[];
};
