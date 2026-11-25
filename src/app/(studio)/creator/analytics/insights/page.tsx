import { InsightsView } from "@/features/creator-analytics/views";
export const metadata = { title: "Insights" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InsightsView sp={await searchParams} />;
}
