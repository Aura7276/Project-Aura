import { BlockedView } from "@/features/applications/creator";
export const metadata = { title: "Blocked Brands" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BlockedView sp={await searchParams} />;
}
