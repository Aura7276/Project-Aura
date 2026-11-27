import { LearningView } from "@/features/brand-content/views";
export const metadata = { title: "Content performance" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LearningView sp={await searchParams} />;
}
