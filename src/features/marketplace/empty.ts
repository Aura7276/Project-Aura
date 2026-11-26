// F35: an empty result always says why and what could help. Nothing is invented to fill the page.
export function emptyReasons(o: {
  filters: Record<string, unknown>;
  hidden: number;
  belowThreshold: boolean;
  total: number;
}): { reasons: string[]; actions: { label: string; href: string }[] } {
  const reasons: string[] = [];
  const actions: { label: string; href: string }[] = [];
  if (o.total === 0)
    reasons.push(
      "There are no live campaigns you can see right now. Campaigns appear only after a Brand has passed business verification.",
    );
  const active = Object.entries(o.filters).filter(
    ([, v]) => v !== undefined && v !== "" && v !== false,
  );
  if (active.length) {
    reasons.push(
      `${active.length} filter${active.length === 1 ? " is" : "s are"} narrowing the results.`,
    );
    actions.push({
      label: "Clear filters",
      href: "/creator/marketplace/explore",
    });
  }
  if (o.hidden > 0) {
    reasons.push(
      `${o.hidden} campaign${o.hidden === 1 ? " is" : "s are"} hidden by your preferences.`,
    );
    actions.push({
      label: "Review hidden Brands and categories",
      href: "/creator/marketplace/preferences",
    });
  }
  if (o.belowThreshold)
    actions.push({
      label: "Look at UGC campaigns, which have no follower minimum",
      href: "/creator/marketplace/category/ugc",
    });
  actions.push({
    label: "Save this search and get an alert when something matches",
    href: "/creator/marketplace/searches",
  });
  return { reasons, actions };
}
