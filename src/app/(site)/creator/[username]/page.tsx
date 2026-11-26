import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { ProfileSite } from "@/features/creator-profile/site";
import { usernamePattern } from "@/features/creator-profile/rules";
import { profileApi, publicClient } from "@/server/profile/service";

// Read live on every request: publication, item visibility and workspace status are re-checked by the database each time.
const load = cache(async (username: string) => {
  const name = username.toLowerCase();
  if (!usernamePattern.test(name)) return null;
  const r = await profileApi.publicProfile(await publicClient(), name);
  return r.ok ? r.value : null;
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const r = await load((await params).username);
  if (!r?.found || !r.profile)
    return {
      title: "Profile not found",
      robots: { index: false, follow: false },
    };
  const p = r.profile;
  return {
    title: `${p.display_name} · Creator on AURA`,
    description: p.headline ?? undefined,
    robots: { index: p.discoverable, follow: p.discoverable },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const r = await load(username);
  if (r?.redirect) permanentRedirect(`/creator/${r.redirect}`);
  if (!r?.found || !r.profile) notFound();
  return <ProfileSite p={r.profile} />;
}
