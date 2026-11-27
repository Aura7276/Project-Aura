"use server";
import { z } from "zod";
import { studioContext } from "@/server/studio/service";
import { commandSchema, type Command, type Ledger } from "./model";
export async function executeCommercial(
  command: Command,
  request: string,
  revision: number,
): Promise<{ ledger?: Ledger; error?: string }> {
  const value = commandSchema.safeParse(command);
  if (
    !value.success ||
    !z.uuid().safeParse(request).success ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    return { error: "Check the amounts, currencies and required fields." };
  const { client, workspaceId } = await studioContext();
  const { data, error } = await client.rpc("aura_commercial_command", {
    p_workspace: workspaceId,
    p_request: request,
    p_expected: revision,
    p_command: value.data,
  });
  if (error)
    return {
      error:
        error.code === "40001"
          ? "The ledger changed. Copy your entries and reload before continuing."
          : "Could not save. Check the outstanding balance, record status and payment reference.",
    };
  return { ledger: data as Ledger };
}
