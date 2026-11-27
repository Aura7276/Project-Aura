import { CampaignsHomeView } from "@/features/campaigns/views";
export const metadata = { title: "Campaigns" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CampaignsHomeView sp={await searchParams} />;
}
