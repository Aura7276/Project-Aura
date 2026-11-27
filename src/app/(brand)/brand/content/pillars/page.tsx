import { PillarsView } from "@/features/brand-content/views";
export const metadata = { title: "Content pillars" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PillarsView sp={await searchParams} />;
}
