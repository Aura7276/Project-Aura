import { ReportQueueView } from "@/features/applications/brand";
export const metadata = { title: "Application reports" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReportQueueView sp={await searchParams} />;
}
