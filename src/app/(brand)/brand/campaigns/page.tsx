import { BrandHome } from "@/features/marketplace/brand";
export const metadata = { title: "Campaigns" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BrandHome sp={await searchParams} />;
}
