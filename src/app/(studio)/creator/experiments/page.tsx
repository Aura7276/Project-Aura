import { ExperimentsView } from "@/features/creator-analytics/views";
export const metadata = { title: "Growth Experiment Lab" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ExperimentsView sp={await searchParams} />;
}
