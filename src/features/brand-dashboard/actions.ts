"use server";
import { z } from "zod";
import { eligible } from "@/server/auth/session";
import { commandSchema, type Command, type Home } from "./model";
export async function saveBrandHome(
  workspace: string,
  command: Command,
  request: string,
  revision: number,
): Promise<{ home?: Home; error?: string }> {
  const value = commandSchema.safeParse(command);
  if (
    !value.success ||
    !z.uuid().safeParse(workspace).success ||
    !z.uuid().safeParse(request).success ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    return { error: "Check your entries and required fields." };
  const { client } = await eligible();
  const { data, error } = await client.rpc("aura_brand_home_command", {
    p_workspace: workspace,
    p_request: request,
    p_expected: revision,
    p_command: value.data,
  });
  return error
    ? {
        error:
          error.code === "40001"
            ? "This workspace changed. Copy your edits and reload before continuing."
            : "Could not save. Check your role and workspace connection.",
      }
    : { home: data as Home };
}
