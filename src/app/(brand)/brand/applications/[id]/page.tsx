import { BrandApplicationView } from "@/features/applications/brand";
export const metadata = { title: "Application" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <BrandApplicationView id={(await params).id} sp={await searchParams} />
  );
}
