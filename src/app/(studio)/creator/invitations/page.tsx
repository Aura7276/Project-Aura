import { InvitationsView } from "@/features/applications/creator";
export const metadata = { title: "Invitations" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <InvitationsView sp={await searchParams} />;
}
