import "server-only";
import { eligible } from "@/server/auth/session";
import { actingId, delegationFor } from "@/server/agency/service";

/** The live delegation chosen with "Work for this client", if any. Display only: the database checks every call. */
export async function actingDelegation(kind: "brand" | "creator") {
  const id = await actingId();
  if (!id) return null;
  const { client } = await eligible();
  return delegationFor(client, id, kind);
}
