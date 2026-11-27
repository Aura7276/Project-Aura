import { CompareView } from "@/features/selection/panels";
export const metadata = { title: "Compare candidates" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CompareView id={(await params).id} sp={await searchParams} />;
}
