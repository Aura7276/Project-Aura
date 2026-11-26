import { BrandCampaignView } from "@/features/marketplace/brand";
export const metadata = { title: "Campaign" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <BrandCampaignView id={id} sp={await searchParams} />;
}
