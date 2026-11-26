import { CampaignApplicationsView } from "@/features/applications/brand";
export const metadata = { title: "Applications" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CampaignApplicationsView id={(await params).id} sp={await searchParams} />;
}
