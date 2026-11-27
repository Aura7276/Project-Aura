import "server-only";
import { eligible } from "@/server/auth/session";
import type { Workspace } from "@/features/collaborations/model";
export async function collaborationList(): Promise<{
  items: Workspace[];
  unavailable: boolean;
}> {
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_collaboration_list");
  return { items: error ? [] : (data as Workspace[]), unavailable: !!error };
}
export async function collaborationWorkspace(
  id: string,
): Promise<Workspace | null> {
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_collaboration_read", {
    p_id: id,
  });
  return error ? null : (data as Workspace);
}
