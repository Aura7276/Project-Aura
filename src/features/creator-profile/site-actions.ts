"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileApi } from "@/server/profile/service";
import { requestClient } from "@/server/database/client";
import { kitTokenPattern } from "./rules";
/** F31: the visitor chooses to let the Creator know which of their Brand workspaces viewed the kit. */
export async function shareVisit(f: FormData) {
  const token = String(f.get("token") ?? "");
  const ws = z.uuid().safeParse(f.get("workspace"));
  if (!kitTokenPattern.test(token)) redirect("/");
  // the database identifies the visitor from their session and records the visit only if they belong to that Brand workspace
  if (ws.success)
    await profileApi.publicKit(await requestClient(), token, ws.data);
  redirect(`/kit/${token}?shared=1`);
}
