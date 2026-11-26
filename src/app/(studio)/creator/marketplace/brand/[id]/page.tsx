import { BrandView } from "@/features/marketplace/views";
export const metadata = { title: "Brand" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BrandView id={id} />;
}
