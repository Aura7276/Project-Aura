import { ExperimentNewView } from "@/features/creator-analytics/views";
export const metadata = { title: "Plan an experiment" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ExperimentNewView sp={await searchParams} />;
}
