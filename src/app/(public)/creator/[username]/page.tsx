import { Discovery } from "@/components/public/discovery";
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  return <Discovery kind="creator" id={(await params).username} />;
}
