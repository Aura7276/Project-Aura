import { studioContext } from "@/server/studio/service";
import { ContentStudio } from "@/features/content-studio/studio";
import {
  saveContent,
  versions,
  saveResource,
} from "@/features/content-studio/actions";
export const metadata = { title: "Content Studio" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { workspaceId, client } = await studioContext();
  const [library, inbox, resources] = await Promise.all([
    client.rpc("aura_content_read", { p_workspace: workspaceId }),
    client.rpc("aura_studio_ideas", { p_workspace: workspaceId, p_limit: 100 }),
    client.rpc("aura_content_resources", { p_workspace: workspaceId }),
  ]);
  return (
    <ContentStudio
      initial={library.data || []}
      initialResources={resources.data || []}
      resourceAction={saveResource}
      ideas={inbox.data?.items || []}
      offline={!!library.error}
      initialView={
        (await searchParams).view === "calendar" ? "Calendar" : "Library"
      }
      saveAction={saveContent}
      historyAction={versions}
    />
  );
}
