import type { Category, Compensation, Deliverable, Rights } from "./rules";
export type Check = {
  key: string;
  label: string;
  status: "met" | "not_met" | "unknown";
  detail: string | null;
};
export type Eligibility = {
  eligible: boolean;
  hard: Check[];
  preferred: { key: string; label: string; status: "met" | "not_met" }[];
  notes: string[];
};
export type Card = {
  id: string;
  slug: string;
  category: Category;
  visibility: "public" | "restricted" | "invite_only";
  version: number;
  published_at: string;
  brand: { id: string; name: string };
  title: string;
  summary: string;
  closes_at: string;
  compensation: Compensation;
  deliverables: Deliverable[];
  rights: Rights;
  travel: { required?: boolean; covered?: boolean } | null;
  positions: number | null;
  remote: boolean;
  countries: string[];
  languages: string[];
  eligibility: Eligibility;
  bookmarked: boolean;
  invited: boolean;
  last_material_change: string | null;
  factors?: string[];
};
export type Detail = Card & {
  brief: string;
  requirements: Record<string, unknown>;
  preferred: Record<string, unknown>;
  effort_note: string | null;
  starts_on: string | null;
  applicants: { status: "unavailable" | "not_shared"; reason?: string };
  brand_profile: {
    name: string;
    verified: boolean;
    verified_since: string | null;
    published_campaigns: number;
  };
  updates: {
    version: number;
    published_at: string;
    material: boolean;
    changes: string[];
  }[];
  reported: boolean;
};
export type Feed = {
  items: Card[];
  hidden_count: number;
  below_threshold: boolean;
  preferences: string[];
};
export type Lists = {
  saved: (Card | { id: string; unavailable: true; title: string })[];
  recent: Card[];
  searches: {
    id: string;
    name: string;
    filters: Record<string, unknown>;
    alert: boolean;
    created_at: string;
  }[];
  hidden: { kind: "brand" | "category"; value: string; label: string }[];
  notifications: {
    id: string;
    kind: string;
    campaign_id: string;
    title: string;
    detail: string | null;
    created_at: string;
    read: boolean;
  }[];
  deadlines: Card[];
};
export type BrandCampaign = {
  id: string;
  slug: string;
  category: Category;
  visibility: Card["visibility"];
  status: "draft" | "in_review" | "published" | "paused" | "closed" | "removed";
  draft_version: number;
  published_version: number | null;
  show_applicant_count: boolean;
  risk_flags: string[];
  review_note: string | null;
  draft: Record<string, unknown>;
  live: Record<string, unknown> | null;
  errors: string[];
  verified: boolean;
  pending_changes: string[] | null;
  versions: {
    version: number;
    published_at: string | null;
    material: boolean;
    changes: string[];
  }[];
  invited: { workspace: string; name: string; invited_at: string }[];
};
