import { MonitorView } from "@/features/monitor/views";
export const metadata = { title: "Monitor" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MonitorView id={(await params).id} sp={await searchParams} />;
}
