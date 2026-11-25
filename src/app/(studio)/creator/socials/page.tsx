import { ListView } from "@/features/creator-social/views";
export const metadata = { title: "Social accounts" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ListView sp={await searchParams} />;
}
