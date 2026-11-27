import { notFound } from "next/navigation";
import { z } from "zod";
import { collaborationWorkspace } from "@/server/collaborations/service";
import { executeCollaboration } from "@/features/collaborations/actions";
import { CollaborationRoom } from "@/features/collaborations/room";
export const metadata = { title: "Collaboration workspace" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const initial = await collaborationWorkspace(id);
  if (!initial)
    return (
      <main style={{ padding: 40 }}>
        <h1>Workspace unavailable</h1>
        <p>Your access or the connection may have changed.</p>
        <a href="/collaborations">Return to collaborations</a>
      </main>
    );
  return (
    <main>
      <CollaborationRoom
        initial={initial}
        execute={executeCollaboration.bind(null, id)}
      />
    </main>
  );
}
