import { PlanView } from "@/features/brand/views";
export const metadata = { title: "Growth plan" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PlanView sp={await searchParams} />;
}
