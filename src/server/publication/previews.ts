import "server-only";
import { z } from "zod";
import { providerConfig } from "@/config/environment";
const slug = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const creator = z.object({
  slug,
  display_name: z.string().min(1),
  bio: z.string().nullable(),
});
const campaign = z.object({
  slug,
  title: z.string().min(1),
  summary: z.string().nullable(),
});
type Item = { slug: string; title: string; summary: string | null };
export async function publicPreviews(
  kind: "creator" | "campaign",
  id?: string,
): Promise<{ available: boolean; items: Item[] }> {
  if (id !== undefined && !slug.safeParse(id).success)
    return { available: true, items: [] };
  if (process.env.AURA_PUBLIC_PROJECTIONS_ENABLED !== "true")
    return { available: false, items: [] };
  try {
    const { url, key } = providerConfig();
    const creators = kind === "creator";
    const endpoint = new URL(
      "/rest/v1/" +
        (creators
          ? "m01_public_creator_previews"
          : "m01_public_campaign_previews"),
      url,
    );
    endpoint.searchParams.set(
      "select",
      creators ? "slug,display_name,bio" : "slug,title,summary",
    );
    endpoint.searchParams.set("order", "slug.asc");
    endpoint.searchParams.set("limit", id ? "1" : "24");
    if (id) endpoint.searchParams.set("slug", "eq." + id);
    const response = await fetch(endpoint, {
      headers: { apikey: key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { available: false, items: [] };
    const data: unknown = await response.json();
    return {
      available: true,
      items: creators
        ? creator
            .array()
            .parse(data)
            .map((c) => ({
              slug: c.slug,
              title: c.display_name,
              summary: c.bio,
            }))
        : campaign.array().parse(data),
    };
  } catch {
    return { available: false, items: [] };
  }
}
