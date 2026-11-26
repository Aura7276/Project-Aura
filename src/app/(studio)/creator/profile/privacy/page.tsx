import { PrivacyView } from "@/features/creator-profile/studio";
export const metadata = { title: "Privacy and visibility" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PrivacyView sp={await searchParams} />;
}
