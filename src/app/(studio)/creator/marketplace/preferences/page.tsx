import { PreferencesView } from "@/features/marketplace/views";
export const metadata = { title: "Marketplace preferences" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PreferencesView sp={await searchParams} />;
}
