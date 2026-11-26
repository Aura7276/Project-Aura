import { ApplicationView } from "@/features/applications/creator";
export const metadata = { title: "Application" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ApplicationView id={(await params).id} sp={await searchParams} />;
}
