import { PortfolioNewView } from "@/features/creator-profile/studio";
export const metadata = { title: "Add to portfolio" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PortfolioNewView sp={await searchParams} />;
}
