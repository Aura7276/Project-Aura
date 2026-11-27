import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eligible } from "@/server/auth/session";

type Rpc = Pick<SupabaseClient, "rpc">;
/** The signed-in person's Agency workspace (any member). Owners and admins need MFA for changes (enforced in the database). */
export async function agencyContext(preferred?: string) {
  const ctx = await eligible();
  const { data, error } = await ctx.client.rpc("aura_workspaces");
  if (error) throw new Error("Unable to load workspaces");
  const list = (
    data as {
      id: string;
      name: string;
      kind: string;
      role: string;
      status: string;
      verification: string;
    }[]
  ).filter((w) => w.kind === "agency" && w.status !== "suspended");
  const w = list.find((x) => x.id === preferred) ?? list[0];
  if (!w) redirect("/workspaces");
  return {
    client: ctx.client as Rpc,
    workspaceId: w.id,
    name: w.name,
    role: w.role,
    agencies: list,
    userId: ctx.user.id,
  };
}
