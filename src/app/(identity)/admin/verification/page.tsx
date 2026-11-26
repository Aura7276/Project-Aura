import { ReviewQueueView } from "@/features/brand/views";
export const metadata = { title: "Business verification" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReviewQueueView sp={await searchParams} />;
}
