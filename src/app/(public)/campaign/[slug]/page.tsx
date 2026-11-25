import { Discovery } from "@/components/public/discovery";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <Discovery kind="campaign" id={(await params).slug} />;
}
