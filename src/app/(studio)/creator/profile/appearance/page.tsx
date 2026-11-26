import { AppearanceView } from "@/features/creator-profile/studio";
export const metadata = { title: "Appearance" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AppearanceView sp={await searchParams} />;
}
