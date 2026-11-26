import { EditView } from "@/features/creator-profile/studio";
export const metadata = { title: "Profile details" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EditView sp={await searchParams} />;
}
