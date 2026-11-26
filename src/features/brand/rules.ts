// M14 Brand onboarding: labels, the proposed evidence matrix, maturity questions, the setup checklist and the rule-based plan builder.
// Nothing here scores a Brand (F09). Plans are suggestions the Brand edits (F44).

export const businessTypes = {
  individual: "Individual owner",
  sole_proprietor: "Sole proprietor",
  startup: "Startup",
  small_business: "Small business",
  d2c: "D2C brand",
  company: "Company",
  enterprise: "Established enterprise",
  international: "International business",
} as const;
export type BusinessType = keyof typeof businessTypes;
export const stages = {
  idea: "Idea or pre-launch",
  launching: "Launching",
  growing: "Growing",
  established: "Established",
} as const;
export const experiences = {
  none: "New to creator marketing",
  some: "Tried it a few times",
  experienced: "Experienced",
} as const;
export const intents = {
  creator_marketing: "Work with Creators",
  owned_growth: "Grow our own social channels",
  both: "Both",
} as const;
export const objectives = {
  awareness: "Awareness",
  social_growth: "Social growth",
  content: "Content for our channels",
  engagement: "Engagement",
  conversion: "Sales or sign-ups",
} as const;
export type Objective = keyof typeof objectives;
export const teamSizes = {
  solo: "Just me",
  "2_10": "2 to 10",
  "11_50": "11 to 50",
  "51_200": "51 to 200",
  "200_plus": "More than 200",
} as const;
export const resources = {
  in_house_content: "In-house content",
  designer: "Designer",
  video: "Video production",
  photography: "Photography",
  social_manager: "Social media manager",
  paid_media: "Paid media",
  agency: "An agency",
} as const;
export const platforms = {
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  threads: "Threads",
  x: "X",
  other: "Other",
} as const;
export const goalKinds = objectives;
export const horizons = [7, 30, 90] as const;
export type Horizon = (typeof horizons)[number];

/** Evidence fields per business type (proposed matrix; mirrors aura_brand.setting 'evidence_matrix'). */
export const evidenceFields = {
  legal_name: "Registered legal name",
  registration_country: "Country of registration",
  registration_number:
    "Registration number (CIN, LLPIN, GSTIN, Udyam or company number)",
  registered_address: "Registered address",
  representative_name: "Representative's full name",
  representative_role: "Representative's role",
  id_document_type: "Identity document type",
  id_document_last4: "Last 4 characters of that document",
} as const;
export type EvidenceField = keyof typeof evidenceFields;
const company: EvidenceField[] = [
  "legal_name",
  "registration_number",
  "registered_address",
  "representative_name",
  "representative_role",
];
export const evidenceMatrix: Record<BusinessType, EvidenceField[]> = {
  individual: [
    "representative_name",
    "id_document_type",
    "id_document_last4",
    "registered_address",
  ],
  sole_proprietor: [
    "legal_name",
    "registration_number",
    "representative_name",
    "id_document_type",
    "id_document_last4",
    "registered_address",
  ],
  startup: company,
  small_business: company,
  d2c: company,
  company,
  enterprise: company,
  international: [
    "legal_name",
    "registration_country",
    "registration_number",
    "registered_address",
    "representative_name",
    "representative_role",
  ],
};
export const idDocuments = {
  passport: "Passport",
  national_id: "National identity card",
  driving_licence: "Driving licence",
  pan: "PAN card",
  aadhaar_masked: "Masked Aadhaar",
  other: "Other government document",
} as const;
export const caseStatus: Record<string, { label: string; detail: string }> = {
  draft: {
    label: "Draft",
    detail: "Only your team can see it. Submit it when every field is filled.",
  },
  submitted: {
    label: "With a reviewer",
    detail:
      "A platform reviewer is checking your details. You can keep using every private tool meanwhile.",
  },
  info_requested: {
    label: "More information needed",
    detail:
      "The reviewer asked for something. Update the case and submit it again.",
  },
  approved: {
    label: "Verified",
    detail:
      "You can publish campaigns, send invitations and enquiries, and publish your Brand profile.",
  },
  rejected: {
    label: "Not approved",
    detail:
      "Read the reason, then start a new case with corrected details or appeal once within 30 days.",
  },
  withdrawn: { label: "Withdrawn", detail: "You withdrew this case." },
};
export const caseKinds = {
  initial: "First verification",
  resubmission: "Resubmission",
  revalidation: "Revalidation of a legal identity change",
  appeal: "Appeal",
} as const;

/** Maturity: five plain questions, three levels each. Answers describe where you are; they never add up to a score. */
export const maturityQuestions = [
  {
    key: "presence",
    label: "Your social presence",
    levels: {
      starting: "We have no or very little social presence",
      developing: "We post, but not regularly",
      established: "We post regularly and know what works",
    },
  },
  {
    key: "content",
    label: "Content production",
    levels: {
      starting: "We rarely make content",
      developing: "We make some content in-house",
      established: "We have a steady content process",
    },
  },
  {
    key: "creators",
    label: "Working with Creators",
    levels: {
      starting: "Never worked with Creators",
      developing: "A few collaborations",
      established: "Regular Creator programmes",
    },
  },
  {
    key: "measurement",
    label: "Measuring results",
    levels: {
      starting: "We do not track results yet",
      developing: "We look at likes and followers",
      established: "We track goals against targets",
    },
  },
  {
    key: "process",
    label: "Briefs and approvals",
    levels: {
      starting: "No written brief or guidelines",
      developing: "Some notes and examples",
      established: "Written guidelines and an approval process",
    },
  },
] as const;
export type MaturityKey = (typeof maturityQuestions)[number]["key"];
export type Level = "starting" | "developing" | "established";

export type BrandState = {
  workspace: {
    id: string;
    name: string;
    business_kind: string | null;
    verification: "pending" | "verified" | "revoked";
    status: string;
    onboarding: string;
  };
  role: string;
  profile: {
    public_name: string;
    business_type: BusinessType;
    country: string;
    industry: string | null;
    website: string | null;
    stage: keyof typeof stages;
    experience: keyof typeof experiences;
    intent: keyof typeof intents;
    objective: Objective;
    team_size: keyof typeof teamSizes | null;
    resources: (keyof typeof resources)[];
    agency_name: string | null;
    tagline: string | null;
    about: string | null;
    slug: string | null;
    published: boolean;
    published_at: string | null;
    onboarding_step: string;
    onboarding_completed_at: string | null;
  } | null;
  goals: {
    id: string;
    kind: Objective;
    metric: string;
    baseline: number | null;
    target: number | null;
    horizon_days: Horizon;
    note: string | null;
  }[];
  segments: {
    id: string;
    name: string;
    description: string | null;
    countries: string[];
    languages: string[];
    age_min: number | null;
    age_max: number | null;
    interests: string[];
    considerations: string | null;
    basis: "confirmed" | "hypothesis";
  }[];
  products: {
    id: string;
    kind: "product" | "service" | "experience";
    name: string;
    description: string | null;
    url: string | null;
    currency: string | null;
    price_min: number | null;
    price_max: number | null;
    claims: string[];
    segment_ids: string[];
    status: "active" | "archived";
  }[];
  guideline: {
    tone: string[];
    voice: string | null;
    dos: string[];
    donts: string[];
    colours: string[];
    visual: string | null;
    claims_rules: string | null;
    exclusions: string | null;
    disclosures: string | null;
  } | null;
  budget: {
    currency: string;
    range_min: number | null;
    range_max: number | null;
    period: "month" | "quarter" | "campaign";
    creator_share: number | null;
    note: string | null;
  } | null;
  creator_pref: {
    niches: string[];
    formats: string[];
    languages: string[];
    platforms: string[];
    countries: string[];
    experience: string[];
    ugc_interest: boolean;
    conflict_categories: string[];
    note: string | null;
  } | null;
  competitors: {
    id: string;
    name: string;
    website: string | null;
    note: string | null;
    conflict: boolean;
  }[];
  socials: {
    id: string;
    platform: keyof typeof platforms;
    handle: string;
    followers: number | null;
    observed_on: string | null;
    source: string;
  }[];
  maturity: Partial<Record<MaturityKey, Level>> | null;
  plan: {
    id: string;
    horizon_days: Horizon;
    title: string;
    detail: string | null;
    rule_key: string | null;
    edited: boolean;
    done_at: string | null;
  }[];
  verification:
    | (VerificationCase & {
        missing: EvidenceField[];
        can_appeal: boolean;
        events: {
          side: string;
          event: string;
          message: string | null;
          at: string;
        }[];
      })
    | null;
  cases: {
    id: string;
    kind: keyof typeof caseKinds;
    status: string;
    submitted_at: string | null;
    decided_at: string | null;
    decision_reason: string | null;
  }[];
  limits: { socials: number };
};
export type VerificationCase = {
  id: string;
  kind: keyof typeof caseKinds;
  status: string;
  business_type: BusinessType;
  legal_name: string | null;
  registration_country: string | null;
  registration_number: string | null;
  registered_address: string | null;
  representative_name: string | null;
  representative_role: string | null;
  id_document_type: keyof typeof idDocuments | null;
  id_document_last4: string | null;
  website: string | null;
  contact_email: string | null;
  note: string | null;
  decision_reason: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  appeal_reason: string | null;
};

/** The setup checklist (F43, F45): progressive, never a percentage. */
export type Step = {
  key: string;
  label: string;
  done: boolean;
  href: string;
  why: string;
  required?: boolean;
};
export function checklist(s: BrandState): Step[] {
  const p = s.profile;
  return [
    {
      key: "basics",
      label: "Business basics",
      done: !!p,
      href: "/brand/onboarding",
      why: "Your name, business type, country and what you want from AURA.",
      required: true,
    },
    {
      key: "objective",
      label: "Primary objective and stage",
      done: !!p && p.onboarding_step !== "basics",
      href: "/brand/onboarding?step=objective",
      why: "Personalises your plan. You can change it any time.",
      required: true,
    },
    {
      key: "products",
      label: "First product or service",
      done: s.products.some((x) => x.status === "active"),
      href: "/brand/products",
      why: "Creators need to know what they would show.",
    },
    {
      key: "audiences",
      label: "Who your customers are",
      done: s.segments.length > 0,
      href: "/brand/audiences",
      why: "Matches you with Creators whose audience fits.",
    },
    {
      key: "goals",
      label: "A measurable goal",
      done: s.goals.length > 0,
      href: "/brand/goals",
      why: "Turns activity into results you can check.",
    },
    {
      key: "guidelines",
      label: "Brand voice and rules",
      done:
        !!s.guideline && (s.guideline.tone.length > 0 || !!s.guideline.voice),
      href: "/brand/guidelines",
      why: "Gives Creators clear do's and don'ts before they start.",
    },
    {
      key: "creators",
      label: "Creator preferences",
      done: !!s.creator_pref,
      href: "/brand/preferences/creators",
      why: "Defaults for future campaigns, never hard rules.",
    },
    {
      key: "verification",
      label: "Business verification",
      done: s.workspace.verification === "verified",
      href: "/brand/verification",
      why: "Needed before you publish campaigns, invite Creators or send enquiries.",
    },
    {
      key: "profile",
      label: "Public Brand profile",
      done: !!p?.published,
      href: "/brand/profile",
      why: "Optional. Private until you publish it.",
    },
  ];
}

export type PlanSuggestion = {
  rule_key: string;
  title: string;
  detail: string;
};
/**
 * Rule-based 7, 30 and 90-day plans (F44). Each suggestion names why it appears; nothing is invented about the Brand's data.
 * The database keeps the Brand's edited and completed items when the plan is regenerated.
 */
export function buildPlan(s: BrandState, horizon: Horizon): PlanSuggestion[] {
  const p = s.profile;
  const out: PlanSuggestion[] = [];
  const add = (rule_key: string, title: string, detail: string) =>
    out.push({ rule_key, title, detail });
  const m = s.maturity ?? {};
  const creators = p?.intent !== "owned_growth";
  const owned = p?.intent !== "creator_marketing";
  if (horizon === 7) {
    if (!s.products.length)
      add(
        "p7_product",
        "Add your first product or service",
        "Creators need a clear thing to show. Add a name, price range and two claims you can stand behind.",
      );
    if (!s.segments.length)
      add(
        "p7_audience",
        "Describe one customer group",
        "Write who buys today and why. Mark it as a hypothesis until you have checked it.",
      );
    if (!s.guideline?.voice)
      add(
        "p7_voice",
        "Write your brand voice in five lines",
        "How you sound, three words you would use and three you never would.",
      );
    if (s.workspace.verification !== "verified")
      add(
        "p7_verify",
        "Start business verification",
        "Takes a few minutes. You keep using every private tool while a reviewer checks it.",
      );
    if (!s.goals.length)
      add(
        "p7_goal",
        "Set one measurable goal",
        "Pick one number for the next 30 days, for example profile visits or enquiries.",
      );
    if (owned && !s.socials.length)
      add(
        "p7_socials",
        "Add the social accounts you already have",
        "Even with zero followers: it gives you a starting point to measure from.",
      );
  }
  if (horizon === 30) {
    if (creators) {
      add(
        "p30_pilot",
        "Plan a small pilot with 2 or 3 Creators",
        m.creators === "established"
          ? "Reuse what worked before, but test one new Creator segment."
          : "Start small: one product, one clear deliverable each, and honest terms.",
      );
      if (s.creator_pref?.ugc_interest !== false)
        add(
          "p30_ugc",
          "Try one UGC brief",
          "UGC Creators make content for your channels without needing a large following.",
        );
    }
    if (owned)
      add(
        "p30_rhythm",
        m.presence === "established"
          ? "Review your posting rhythm"
          : "Post twice a week for four weeks",
        "Consistency matters more than volume. Keep it realistic for your team.",
      );
    if (m.measurement !== "established")
      add(
        "p30_measure",
        "Record your baseline numbers",
        "Write down today's followers, visits or sales so you can see change.",
      );
    if (!s.guideline?.dos.length)
      add(
        "p30_rules",
        "List your do's and don'ts for Creators",
        "Approved claims, words to avoid and required disclosures.",
      );
  }
  if (horizon === 90) {
    add(
      "p90_review",
      "Review what worked against your goals",
      "Compare each goal's target with what happened, and keep or drop each activity.",
    );
    if (creators)
      add(
        "p90_repeat",
        "Turn your best pilot into a repeat collaboration",
        "Work again with Creators who delivered, with clearer briefs.",
      );
    if (m.process !== "established")
      add(
        "p90_process",
        "Write a one-page brief template",
        "So every campaign starts with the same clear information.",
      );
    if (owned)
      add(
        "p90_content",
        "Build a library of approved content",
        "Keep the posts and clips you have rights to reuse in one place.",
      );
  }
  return out;
}

/** F28: plain explanations of Creator segments that suit the Brand. Explanations only, no ranking. */
export function creatorSegments(s: BrandState): string[] {
  const out: string[] = [];
  const p = s.profile;
  const prefs = s.creator_pref;
  if (!p) return out;
  if (prefs?.ugc_interest !== false)
    out.push(
      "UGC Creators: they make content for your own channels and ads. Their follower count does not matter, only the quality of their work.",
    );
  if (p.objective === "awareness" || p.objective === "social_growth")
    out.push(
      "Emerging Creators in your niche: smaller audiences often trust them more, and they are usually more affordable for a first pilot.",
    );
  if (p.objective === "conversion")
    out.push(
      "Creators whose audience matches your customers: check their audience location and language, not just their reach.",
    );
  if (p.experience === "none")
    out.push(
      "Creators open to beginners: look for clear rates and a public portfolio so you know what to expect.",
    );
  if (prefs?.countries.length)
    out.push(
      `Creators in ${prefs.countries.join(", ")}: you chose these countries as a default.`,
    );
  return out;
}
export const money = (n: number | null | undefined, currency = "INR") =>
  n === null || n === undefined
    ? ""
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
