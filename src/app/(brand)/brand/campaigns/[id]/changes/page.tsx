import { ChangesView } from "@/features/campaigns/views";
export const metadata = { title: "Campaign changes" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ChangesView id={(await params).id} sp={await searchParams} />;
}
