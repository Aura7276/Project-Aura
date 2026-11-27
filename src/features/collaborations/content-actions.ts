"use server";
import { z } from "zod";
import { eligible } from "@/server/auth/session";
import type { ContentOption } from "./share-content";
export async function contentOptions(
  id: string,
): Promise<{ items?: ContentOption[]; error?: string }> {
  if (!z.uuid().safeParse(id).success)
    return { error: "Invalid collaboration." };
  const { client } = await eligible();
  const { data, error } = await client.rpc(
    "aura_collaboration_content_options",
    { p_id: id },
  );
  return error
    ? { error: "Your Content Studio is unavailable for this collaboration." }
    : { items: data as ContentOption[] };
}
