import { SavedView } from "@/features/marketplace/views";
export const metadata = { title: "Saved campaigns" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SavedView sp={await searchParams} kind="saved" />;
}
