import { ApplicationsHome } from "@/features/applications/creator";
export const metadata = { title: "Applications and invitations" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ApplicationsHome sp={await searchParams} />;
}
