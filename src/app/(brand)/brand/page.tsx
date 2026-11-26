import { BrandHomeView } from "@/features/brand/views";
export const metadata = { title: "Brand home" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BrandHomeView sp={await searchParams} />;
}
