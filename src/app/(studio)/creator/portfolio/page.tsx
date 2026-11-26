import { PortfolioView } from "@/features/creator-profile/studio";
export const metadata = { title: "Portfolio" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PortfolioView sp={await searchParams} />;
}
