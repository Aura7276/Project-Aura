import { AssistantSettingsView } from "@/features/brand-ai/views";
export const metadata = { title: "Assistant settings" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AssistantSettingsView sp={await searchParams} />;
}
