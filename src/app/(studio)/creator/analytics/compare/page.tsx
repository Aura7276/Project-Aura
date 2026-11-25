import { CompareView } from "@/features/creator-analytics/views";
export const metadata = { title: "Compare content" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CompareView sp={await searchParams} />;
}
