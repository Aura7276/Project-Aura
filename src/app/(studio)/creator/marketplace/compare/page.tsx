import { CompareView } from "@/features/marketplace/views";
export const metadata = { title: "Compare campaigns" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CompareView sp={await searchParams} />;
}
