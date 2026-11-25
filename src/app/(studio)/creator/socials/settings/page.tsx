import { SettingsView } from "@/features/creator-social/views";
export const metadata = { title: "Social settings" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SettingsView sp={await searchParams} />;
}
