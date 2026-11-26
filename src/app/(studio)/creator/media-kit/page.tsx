import { KitsView } from "@/features/creator-profile/studio";
export const metadata = { title: "Media kits" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <KitsView sp={await searchParams} />;
}
