import { ReuseView } from "@/features/brand-content/views";
export const metadata = { title: "Creator content" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReuseView sp={await searchParams} />;
}
