import { AssistantView } from "@/features/brand-ai/views";
export const metadata = { title: "Assistant" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AssistantView sp={await searchParams} />;
}
