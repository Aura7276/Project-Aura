import { ReportView } from "@/features/monitor/views";
export const metadata = { title: "Report" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; rid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, rid } = await params;
  return <ReportView id={id} rid={rid} sp={await searchParams} />;
}
