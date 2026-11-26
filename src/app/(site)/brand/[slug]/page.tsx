import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicBrandPage } from "@/features/brand/public";
import type { PublicBrand } from "@/server/brand/service";
import { safePublic } from "@/server/profile/service";

// Read live on every request: publication, verification and workspace status are re-checked by the database each time.
const load = cache(async (slug: string) => {
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return null;
  const r = await safePublic(async (c) =>
    c.rpc("aura_brand_public", { p_slug: slug }),
  );
  const d = r?.data as { found: boolean; profile?: PublicBrand } | undefined;
  return d?.found && d.profile ? d.profile : null;
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const b = await load((await params).slug);
  if (!b)
    return {
      title: "Brand not found",
      robots: { index: false, follow: false },
    };
  return {
    title: `${b.name} · Brand on AURA`,
    description: b.tagline ?? undefined,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const b = await load((await params).slug);
  if (!b) notFound();
  return (
    <main id="profile" className="bp-page">
      <PublicBrandPage b={b} />
    </main>
  );
}
