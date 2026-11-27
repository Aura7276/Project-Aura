import { collaborationList } from "@/server/collaborations/service";
import { CollaborationList } from "@/features/collaborations/list";
export const metadata = { title: "Collaborations" };
export default async function Page() {
  const data = await collaborationList();
  return (
    <main>
      <CollaborationList {...data} />
    </main>
  );
}
