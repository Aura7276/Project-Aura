import { notFound } from "next/navigation";
import { ExploreView } from "@/features/marketplace/views";
import { categories, type Category } from "@/features/marketplace/rules";
export const metadata = { title: "Campaigns by type" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { type } = await params;
  if (!(type in categories)) notFound();
  return <ExploreView sp={await searchParams} category={type as Category} />;
}
