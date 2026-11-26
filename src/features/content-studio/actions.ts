"use server";
import { z } from "zod";
import { studioContext } from "@/server/studio/service";
import { itemSchema, type Item, type Version } from "./model";
export async function saveContent(item: Item, revision: number) {
  const value = itemSchema.safeParse(item);
  if (!value.success || !Number.isSafeInteger(revision) || revision < 0)
    return { error: "Check the title, dates, links and field lengths." };
  const { client, workspaceId } = await studioContext();
  const { data, error } = await client.rpc("aura_content_save", {
    p_workspace: workspaceId,
    p_item: value.data,
    p_expected: revision,
  });
  if (error)
    return {
      error: error.message.includes("Revision conflict")
        ? "This draft changed elsewhere. Copy your edits before reloading."
        : "Could not save. Your edits are still here.",
    };
  return { revision: Number(data) };
}
export async function versions(id: string): Promise<Version[]> {
  if (!z.uuid().safeParse(id).success) throw Error("Invalid draft");
  const { client, workspaceId } = await studioContext();
  const { data, error } = await client.rpc("aura_content_read", {
    p_workspace: workspaceId,
    p_item: id,
  });
  if (error) throw Error("History unavailable");
  return data as Version[];
}
import { resourceSchema, type Resource } from "./resources-model";
export async function saveResource(
  input: Resource,
): Promise<{ error?: string }> {
  const value = resourceSchema.safeParse(input);
  if (!value.success) return { error: "Check the reference details." };
  const { client, workspaceId } = await studioContext();
  const { error } = await client.rpc("aura_content_resource_save", {
    p_workspace: workspaceId,
    p_resource: value.data,
  });
  return error ? { error: "Could not save the reference." } : {};
}
