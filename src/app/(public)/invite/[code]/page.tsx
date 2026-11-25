import { EntryHandoff } from "@/components/public/entry-handoff";
import { entryIntent } from "@/features/public-site/intent";
import { notFound } from "next/navigation";
import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = {
  title: "Creator invitation",
  referrer: "no-referrer" as const,
};
export default async function Invite({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!entryIntent("invite", code)) notFound();
  return (
    <Editorial
      title="Creator invitation"
      intro="Invitation verification and account registration are not available yet. Attribution has not been recorded."
    >
      <EntryHandoff kind="invite" value={code} />
      <PathLink href="/creators">Explore the Creator journey</PathLink>
    </Editorial>
  );
}
