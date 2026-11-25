import { AccountsView } from "@/features/creator-analytics/views";
export const metadata = { title: "Account analytics" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AccountsView sp={await searchParams} />;
}
