import { ProfileView } from "@/features/agency/views";
export const metadata = { title: "Profile and verification" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProfileView sp={await searchParams} />;
}
