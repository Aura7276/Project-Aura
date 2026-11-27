import { ActivityView } from "@/features/agency/views";
export const metadata = { title: "Activity" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ActivityView sp={await searchParams} />;
}
