import { OverviewView } from "@/features/creator-analytics/views";
export const metadata = { title: "Analytics" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OverviewView sp={await searchParams} />;
}
