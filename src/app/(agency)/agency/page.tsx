import { AgencyHome } from "@/features/agency/views";
export const metadata = { title: "Agency Studio" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AgencyHome sp={await searchParams} />;
}
