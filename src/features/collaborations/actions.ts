"use server";
import { z } from "zod";
import { eligible } from "@/server/auth/session";
import { commandSchema, type Command, type Workspace } from "./model";
export async function executeCollaboration(
  id: string,
  command: Command,
  request: string,
  revision: number,
): Promise<{ workspace?: Workspace; error?: string }> {
  const parsed = commandSchema.safeParse(command);
  if (
    !parsed.success ||
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(request).success ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    return { error: "Check the required fields, dates and links." };
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_collaboration_command", {
    p_id: id,
    p_request: request,
    p_expected: revision,
    p_command: parsed.data,
  });
  if (error) {
    if (error.code === "40001")
      return {
        error:
          "This workspace changed. Copy your edits, then reload to review the latest version.",
      };
    if (error.code === "42501")
      return { error: "Your current role cannot perform this action." };
    return {
      error:
        "The action could not be saved. Check the current agreement, stage and permissions, then retry.",
    };
  }
  return { workspace: data as Workspace };
}
