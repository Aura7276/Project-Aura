import { notFound } from "next/navigation";
import { ClientAccessView } from "@/features/agency/views";
import { brandContext } from "@/server/market/service";
export const metadata = { title: "Agencies" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const b = await brandContext(typeof sp.w === "string" ? sp.w : undefined);
  if (b.acting) notFound(); // only the Brand's own people manage Agency access
  return <ClientAccessView kind="brand" ws={b.workspaceId} sp={sp} />;
}
