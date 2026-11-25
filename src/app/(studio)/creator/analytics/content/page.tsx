import { ContentView } from "@/features/creator-analytics/views";
export const metadata = { title: "Content analytics" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContentView sp={await searchParams} />;
}
