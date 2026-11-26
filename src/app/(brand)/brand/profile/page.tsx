import { ProfileView } from "@/features/brand/views";
export const metadata = { title: "Business profile" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProfileView sp={await searchParams} />;
}
