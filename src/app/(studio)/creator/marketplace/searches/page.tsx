import { SearchesView } from "@/features/marketplace/views";
export const metadata = { title: "Saved searches" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SearchesView sp={await searchParams} />;
}
