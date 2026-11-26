import { ApplyView } from "@/features/applications/creator";
export const metadata = { title: "Apply" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ApplyView id={(await params).id} />;
}
