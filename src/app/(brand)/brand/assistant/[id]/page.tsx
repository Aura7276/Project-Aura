import { ConversationView } from "@/features/brand-ai/views";
export const metadata = { title: "Assistant conversation" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ConversationView id={(await params).id} sp={await searchParams} />;
}
