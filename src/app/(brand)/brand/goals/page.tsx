import { GoalsView } from "@/features/brand/views";
export const metadata = { title: "Goals" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <GoalsView sp={await searchParams} />;
}
