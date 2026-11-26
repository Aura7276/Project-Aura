import { AudiencesView } from "@/features/brand/views";
export const metadata = { title: "Customer groups" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AudiencesView sp={await searchParams} />;
}
