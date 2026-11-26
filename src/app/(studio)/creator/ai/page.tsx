import { studioContext } from "@/server/studio/service";
import { GrowthStudio } from "@/features/growth-assistant/studio";
import * as commands from "@/features/growth-assistant/actions";
export const metadata = { title: "Growth Studio" };
export default async function Page() {
  const { client, workspaceId } = await studioContext();
  const { data, error } = await client.rpc("aura_growth_state", {
    p_workspace: workspaceId,
  });
  return (
    <GrowthStudio
      initial={error ? { drafts: [], memory: null } : data}
      commands={error ? undefined : commands}
      offline={!!error}
      provider={Boolean(
        process.env.AURA_AI_ENDPOINT &&
        process.env.AURA_AI_API_KEY &&
        process.env.AURA_AI_MODEL,
      )}
    />
  );
}
