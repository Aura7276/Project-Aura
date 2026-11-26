import { UpdatesView } from "@/features/marketplace/views";
export const metadata = { title: "Campaign updates" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UpdatesView id={id} />;
}
