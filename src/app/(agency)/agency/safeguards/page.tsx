import { SafeguardsView } from "@/features/agency/views";
export const metadata = { title: "Safeguards" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SafeguardsView sp={await searchParams} />;
}
