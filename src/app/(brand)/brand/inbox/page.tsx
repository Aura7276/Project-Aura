import { BrandInbox } from "@/features/applications/brand";
export const metadata = { title: "Invitations and negotiations" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BrandInbox sp={await searchParams} />;
}
