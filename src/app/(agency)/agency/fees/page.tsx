import { FeesView } from "@/features/agency/views";
export const metadata = { title: "Fees" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <FeesView sp={await searchParams} />;
}
