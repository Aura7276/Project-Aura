import { AnalyticsView } from "@/features/creator-profile/studio";
export const metadata = { title: "Profile analytics" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AnalyticsView sp={await searchParams} />;
}
