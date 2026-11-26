"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileApi } from "@/server/profile/service";
import { eligible } from "@/server/auth/session";
import { kitTokenPattern } from "./rules";
/** F31: the visitor chooses to let the Creator know which of their Brand workspaces viewed the kit. */
export async function shareVisit(f: FormData) {
  const token = String(f.get("token") ?? "");
  const ws = z.uuid().safeParse(f.get("workspace"));
  if (!kitTokenPattern.test(token)) redirect("/");
  const { client } = await eligible();
  if (ws.success) await profileApi.publicKit(client, token, ws.data);
  redirect(`/kit/${token}?shared=1`);
}
