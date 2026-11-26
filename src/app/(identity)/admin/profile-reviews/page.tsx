import { notFound } from "next/navigation";
import { eligible } from "@/server/auth/session";
import { ModerationView } from "@/features/creator-profile/studio";
export const metadata = {
  title: "Testimonial moderation",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await eligible();
  const admin = await client.rpc("aura_is_admin");
  if (admin.error || admin.data !== true) notFound();
  return <ModerationView sp={await searchParams} />;
}
