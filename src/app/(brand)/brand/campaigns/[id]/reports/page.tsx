import { ReportsView } from "@/features/monitor/views";
export const metadata = { title: "Reports" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReportsView id={(await params).id} sp={await searchParams} />;
}
