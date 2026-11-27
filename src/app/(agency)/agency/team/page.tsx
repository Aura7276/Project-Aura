import { TeamView } from "@/features/agency/views";
export const metadata = { title: "Team" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <TeamView sp={await searchParams} />;
}
