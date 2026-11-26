import { InvitationView } from "@/features/applications/creator";
export const metadata = { title: "Invitation" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InvitationView id={(await params).id} sp={await searchParams} />;
}
