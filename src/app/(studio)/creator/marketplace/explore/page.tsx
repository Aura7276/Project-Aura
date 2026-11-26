import { ExploreView } from "@/features/marketplace/views";
export const metadata = { title: "Explore campaigns" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ExploreView sp={await searchParams} />;
}
