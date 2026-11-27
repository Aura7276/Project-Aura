import { AcceptInviteView } from "@/features/agency/views";
export const metadata = {
  title: "Agency access request",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <AcceptInviteView token={(await params).token} />;
}
