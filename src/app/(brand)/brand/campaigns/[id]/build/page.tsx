import { BuilderView } from "@/features/campaigns/views";
export const metadata = { title: "Campaign builder" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BuilderView id={(await params).id} sp={await searchParams} />;
}
