import { CreatorPrefsView } from "@/features/brand/views";
export const metadata = { title: "Creator preferences" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CreatorPrefsView sp={await searchParams} />;
}
