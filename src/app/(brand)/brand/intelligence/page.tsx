import { IntelligenceView } from "@/features/brand/views";
export const metadata = { title: "Brand brief" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <IntelligenceView sp={await searchParams} />;
}
