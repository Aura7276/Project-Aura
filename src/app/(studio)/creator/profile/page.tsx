import { HubView } from "@/features/creator-profile/studio";
export const metadata = { title: "Profile and media kit" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <HubView sp={await searchParams} />;
}
