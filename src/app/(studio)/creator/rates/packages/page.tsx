import { PackagesView } from "@/features/creator-profile/studio";
export const metadata = { title: "Packages" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PackagesView sp={await searchParams} />;
}
