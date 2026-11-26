import type { ProfileState } from "./types";
// Rule-based suggestions from your own records. Not AI (M07 is not available), no score, and nothing is changed for you.
export type Suggestion = {
  id: string;
  title: string;
  detail: string;
  href: string;
};
export function suggestions(s: ProfileState): Suggestion[] {
  const out: Suggestion[] = [];
  const p = s.profile;
  if (p.headline && p.headline.length > 90)
    out.push({
      id: "headline-long",
      title: "Shorten your headline",
      detail: `It is ${p.headline.length} characters. Under about 90 reads in one line on a phone.`,
      href: "/creator/profile/edit",
    });
  if (!p.about)
    out.push({
      id: "about",
      title: "Add an about section",
      detail: "Your profile has no description of what you make.",
      href: "/creator/profile/edit",
    });
  const featured = s.portfolio.filter(
    (i) => i.featured && i.visibility === "public",
  );
  if (s.portfolio.some((i) => i.visibility === "public") && !featured.length)
    out.push({
      id: "featured",
      title: "Feature your strongest piece",
      detail: "Featured items appear first.",
      href: "/creator/portfolio",
    });
  if (s.portfolio.some((i) => i.content_ref && !i.show_metrics))
    out.push({
      id: "metrics",
      title: "Consider showing recorded metrics on a piece",
      detail:
        "You recorded numbers for some items. Showing them is optional; each shows its source and date.",
      href: "/creator/portfolio",
    });
  const privateOnly =
    s.portfolio.length > 0 &&
    s.portfolio.every((i) => i.visibility === "private");
  if (privateOnly)
    out.push({
      id: "private",
      title: "Every portfolio item is private",
      detail:
        "Nothing will appear on your profile until you make an item public or restricted.",
      href: "/creator/portfolio",
    });
  if (
    s.services.some((x) => x.pricing === "quote") &&
    s.services.every((x) => x.pricing === "quote")
  )
    out.push({
      id: "rates",
      title: "Add an indicative range to a service",
      detail:
        "Rates stay private. You can include them in restricted media-kit links only.",
      href: "/creator/services",
    });
  if (p.published && !p.listed && s.qualifies)
    out.push({
      id: "listed",
      title: "Your profile can appear in discovery",
      detail: "You have a qualifying account. Discovery is optional.",
      href: "/creator/profile/privacy",
    });
  if (p.availability === "unavailable" && !p.available_from)
    out.push({
      id: "availability",
      title: "Say when you are available again",
      detail: "A date helps brands plan.",
      href: "/creator/profile/availability",
    });
  if (s.testimonials.some((t) => t.status === "approved" && !t.displayed))
    out.push({
      id: "testimonial",
      title: "You have an approved testimonial you are not showing",
      detail: "Showing it is your choice.",
      href: "/creator/profile/reviews",
    });
  return out;
}
