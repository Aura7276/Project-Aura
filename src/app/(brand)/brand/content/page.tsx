import { ContentHome } from "@/features/brand-content/views";
export const metadata = { title: "Content" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContentHome sp={await searchParams} />;
}
