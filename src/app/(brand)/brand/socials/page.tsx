import { SocialsView } from "@/features/brand/views";
export const metadata = { title: "Social accounts" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SocialsView sp={await searchParams} />;
}
