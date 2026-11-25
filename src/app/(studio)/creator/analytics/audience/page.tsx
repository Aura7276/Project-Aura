import { AudienceView } from "@/features/creator-analytics/views";
export const metadata = { title: "Audience" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AudienceView sp={await searchParams} />;
}
