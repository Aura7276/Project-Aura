import { toPdf } from "@/features/creator-analytics/exports";
import { downloadNotice, kitSections, money, rateNotice } from "./rules";
import type {
  KitContent,
  PublicItem,
  PublicPackage,
  PublicService,
} from "./types";
/** A text-only PDF of exactly what the link shows: same filtering, same rates rule. */
export function kitPdf(c: KitContent): Uint8Array {
  const L: string[] = [
    c.kit.name + (c.kit.audience ? ` (${c.kit.audience})` : ""),
    "",
  ];
  if (c.kit.intro) L.push(c.kit.intro, "");
  for (const s of c.sections) {
    const items = s.items as Record<string, unknown>[];
    const t = s.text as Record<string, string> | string | null;
    const body: string[] = [];
    if (s.key === "about" && t && typeof t === "object") {
      if (t.headline) body.push(t.headline);
      if (t.about) body.push(...String(t.about).split("\n"));
    }
    if (s.key === "contact" && typeof t === "string") body.push(t);
    if (s.key === "availability" && t && typeof t === "object")
      body.push(
        `Status: ${t.status}${t.from ? ` from ${t.from}` : ""}${t.until ? ` until ${t.until}` : ""}${t.note ? `. ${t.note}` : ""}`,
      );
    for (const it of items) {
      if (s.key === "portfolio" || s.key === "case_studies") {
        const i = it as unknown as PublicItem;
        body.push(
          `- ${i.title}${i.brand_name ? ` (${i.brand_name})` : ""}${i.speculative ? " [speculative, not commissioned]" : ""}`,
        );
        if (i.description) body.push(`  ${i.description}`);
        i.metrics?.forEach((m) =>
          body.push(
            `  ${m.metric}: ${m.value} (${m.window === "lifetime" ? `lifetime as of ${m.observed_on}` : `${m.period_start} to ${m.period_end}`}, ${m.source === "manual" ? "self-reported" : m.source})`,
          ),
        );
      } else if (s.key === "services") {
        const v = it as unknown as PublicService;
        body.push(
          `- ${v.name}: ${v.pricing.mode === "on_request" || v.pricing.mode === "quote" ? "rates on request" : v.pricing.mode === "fixed" ? money(v.pricing.currency, v.pricing.min) : `${money(v.pricing.currency, v.pricing.min)} to ${money(v.pricing.currency, v.pricing.max)}`}`,
        );
      } else if (s.key === "packages") {
        const k = it as unknown as PublicPackage;
        body.push(
          `- ${k.name}: ${k.deliverables.map((d) => `${d.quantity} x ${d.item}`).join(", ")}${k.price && k.price.min !== null ? ` - ${money(k.price.currency, k.price.min)}${k.price.max !== null && k.price.max !== k.price.min ? ` to ${money(k.price.currency, k.price.max)}` : ""}` : ""}`,
        );
        if (k.terms) body.push(`  Terms: ${k.terms}`);
      } else if (s.key === "accounts")
        body.push(
          `- ${it.platform} @${it.handle}: ownership ${it.ownership === "verified" ? "verified" : "not verified"}${it.followers ? `, ${(it.followers as { value: number }).value} followers self-reported on ${(it.followers as { observed_on: string }).observed_on}` : ""}`,
        );
      else if (s.key === "experience")
        body.push(
          `- ${it.role ? `${it.role}, ` : ""}${it.organisation} (${[it.year_from, it.year_to].filter(Boolean).join("-") || "dates not given"}, self-reported)`,
        );
      else if (s.key === "testimonials")
        body.push(`- "${it.body}" - ${it.author_name}`);
      else if (s.key === "audience")
        body.push(
          `- ${it.dimension}: ${(it.buckets as { bucket: string; share: number }[]).map((b) => `${b.bucket} ${b.share}%`).join(", ")} (observed ${it.observed_on})`,
        );
    }
    if (body.length) L.push(kitSections[s.key].toUpperCase(), ...body, "");
  }
  if (c.rates_included) L.push(rateNotice);
  L.push(downloadNotice, c.show_branding ? "Created with AURA" : "");
  return toPdf(`${c.creator.display_name} - media kit`, L);
}
