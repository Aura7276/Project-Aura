import { ItemView } from "@/features/brand-content/views";
export const metadata = { title: "Content" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ItemView id={(await params).id} sp={await searchParams} />;
}
