import { notFound } from "next/navigation";
import { ClientAccessView } from "@/features/agency/views";
import { creatorContext } from "@/server/creator/service";
export const metadata = { title: "Agencies" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const c = await creatorContext();
  if (c.acting) notFound(); // only the Creator manages Agency access
  return (
    <ClientAccessView
      kind="creator"
      ws={c.workspaceId}
      sp={await searchParams}
    />
  );
}
