import { ApprovalsView } from "@/features/agency/views";
export const metadata = { title: "Approvals" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ApprovalsView sp={await searchParams} />;
}
