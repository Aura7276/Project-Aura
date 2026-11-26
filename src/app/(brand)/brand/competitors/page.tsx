import { CompetitorsView } from "@/features/brand/views";
export const metadata = { title: "Competitors" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CompetitorsView sp={await searchParams} />;
}
