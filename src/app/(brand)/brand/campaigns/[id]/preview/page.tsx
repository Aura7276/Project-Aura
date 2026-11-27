import { PreviewView } from "@/features/campaigns/views";
export const metadata = { title: "Campaign preview" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PreviewView id={(await params).id} sp={await searchParams} />;
}
