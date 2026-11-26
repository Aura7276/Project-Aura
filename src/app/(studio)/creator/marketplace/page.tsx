import { ForYouView } from "@/features/marketplace/views";
export const metadata = { title: "Campaigns for you" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ForYouView sp={await searchParams} />;
}
