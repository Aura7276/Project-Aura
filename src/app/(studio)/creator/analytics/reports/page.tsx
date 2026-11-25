import { ReportsView } from "@/features/creator-analytics/views";
export const metadata = { title: "Reports" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReportsView sp={await searchParams} />;
}
