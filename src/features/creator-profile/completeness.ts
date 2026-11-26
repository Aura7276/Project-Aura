import type { ProfileState } from "./types";
// A checklist of concrete next steps, not a score. Nothing here is shown publicly or summarized as a percentage.
export type Step = {
  id: string;
  label: string;
  done: boolean;
  href: string;
  why: string;
};
export function steps(s: ProfileState): Step[] {
  const p = s.profile;
  const publicItems = s.portfolio.filter((i) => i.visibility === "public");
  return [
    {
      id: "username",
      label: "Choose your username",
      done: !!p.username,
      href: "/creator/profile/edit",
      why: "It becomes your profile address.",
    },
    {
      id: "headline",
      label: "Write a one-line headline",
      done: !!p.headline,
      href: "/creator/profile/edit",
      why: "Brands read this first.",
    },
    {
      id: "about",
      label: "Write an about section",
      done: (p.about ?? "").length >= 80,
      href: "/creator/profile/edit",
      why: "Say what you make and for whom, in your own words.",
    },
    {
      id: "portfolio",
      label: "Add three public portfolio pieces",
      done: publicItems.length >= 3,
      href: "/creator/portfolio/new",
      why: "Real examples matter more than claims.",
    },
    {
      id: "case",
      label: "Add a case study",
      done: s.portfolio.some((i) => i.kind === "case_study"),
      href: "/creator/portfolio/new?kind=case_study",
      why: "Show your objective, approach and what you contributed.",
    },
    {
      id: "service",
      label: "Describe a service",
      done: s.services.length > 0,
      href: "/creator/services",
      why: "Brands need to know what they can ask for.",
    },
    {
      id: "accounts",
      label: "Show a social account on your profile",
      done: s.accounts.some((a) => a.sharing_visibility === "published"),
      href: "/creator/socials",
      why: "Choose which accounts appear. Metrics stay private unless you share them.",
    },
    {
      id: "verify",
      label: "Verify ownership of an account",
      done: s.accounts.some((a) => a.verification === "verified"),
      href: "/creator/socials",
      why: "A specific indicator, shown only for the verified account.",
    },
    {
      id: "testimonial",
      label: "Invite a testimonial",
      done: s.invites.length > 0 || s.testimonials.length > 0,
      href: "/creator/profile/reviews",
      why: "Only real people you worked with can write one.",
    },
    {
      id: "publish",
      label: "Publish your profile",
      done: p.published,
      href: "/creator/profile",
      why: "It stays private until you publish.",
    },
  ];
}
