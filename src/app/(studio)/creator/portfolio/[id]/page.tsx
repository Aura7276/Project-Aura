import { notFound } from "next/navigation";
import { PortfolioItemView } from "@/features/creator-profile/studio";
export const metadata = { title: "Portfolio piece" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  return <PortfolioItemView id={id} sp={await searchParams} />;
}
