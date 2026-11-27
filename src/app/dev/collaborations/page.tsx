import { notFound } from "next/navigation";
import { CollaborationRoom } from "@/features/collaborations/room";
import { previewWorkspace } from "@/features/collaborations/fixtures";
export const metadata = { title: "Collaboration preview" };
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main>
      <CollaborationRoom initial={previewWorkspace} preview />
    </main>
  );
}
