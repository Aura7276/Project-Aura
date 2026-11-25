"use server";
import { redirect } from "next/navigation";
import { eligible } from "@/server/auth/session";
import { social } from "@/server/social/service";
import { decisionSchema } from "./schemas";
/** The database requires a Platform Admin, a granted reviewer and an MFA session, and rejects self-approval. Failures show a generic notice. */
export async function decideClaim(form: FormData) {
  const { client } = await eligible();
  const p = decisionSchema.safeParse({
    claim: String(form.get("claim") ?? ""),
    decision: String(form.get("decision") ?? ""),
    reason: String(form.get("reason") ?? ""),
    replace: form.get("replace_existing") === "on",
  });
  let notice = "decided=1";
  if (!p.success) notice = "notice=invalid";
  else {
    const r = await social.decide(
      client,
      p.data.claim,
      p.data.decision,
      p.data.reason,
      p.data.replace,
    );
    if (!r.ok) notice = "notice=denied";
  }
  redirect(`/admin/social-review?${notice}`);
}
