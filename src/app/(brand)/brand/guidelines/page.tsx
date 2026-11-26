import { GuidelinesView } from "@/features/brand/views";
export const metadata = { title: "Guidelines" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <GuidelinesView sp={await searchParams} />;
}
