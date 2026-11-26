import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classify, type ServiceError } from "@/server/creator/service";

type Rpc = Pick<SupabaseClient, "rpc">;
export type AReason = "confirm" | "locked" | "duplicate" | "capacity" | "eligibility" | "verification" | "stale" | "rate" | "reapply" | "invalid" | "custom_work" | "state" | "generic";
export type AResult<T> = { ok: true; value: T } | { ok: false; error: ServiceError; reason: AReason };
const reasonOf = (code: string | null, m: string): AReason => {
  if (/Confirm/i.test(m)) return "confirm";
  if (/locked/i.test(m)) return "locked";
  if (/new unpaid content/i.test(m)) return "custom_work";
  if (/Reapplication/i.test(m)) return "reapply";
  if (/verification required/i.test(m)) return "verification";
  if (/Not eligible|requirements/i.test(m)) return "eligibility";
  if (/positions are filled|not accepting more/i.test(m)) return "capacity";
  if (code === "40001") return "stale";
  if (code === "54000") return "rate";
  if (code === "23505") return "duplicate";
  if (code === "55000") return "state";
  if (code === "22023" || code === "23514") return "invalid";
  return "generic";
};
export const reasonText: Record<AReason, string> = {
  confirm: "Tick the confirmation box before sending.", locked: "The Brand has started reviewing, so the application can no longer be edited.", duplicate: "That already exists.",
  capacity: "There is no capacity left for this.", eligibility: "The mandatory requirements are not met, so this cannot go ahead.", verification: "This needs an approved business verification.",
  stale: "The proposal changed. Review the current version before confirming.", rate: "You have reached today's limit. Please try again later.", reapply: "Reapplying is not allowed for this campaign.",
  invalid: "Some of that is missing or does not fit. Please check it.", custom_work: "Screening questions cannot ask Creators to make new content for free. Ask about existing work instead.",
  state: "That is not possible at this stage.", generic: "We could not do that. Nothing was lost, so please try again.",
};
async function call<T>(c: Rpc, fn: string, args: Record<string, unknown>): Promise<AResult<T>> {
  const { data, error } = await c.rpc(fn, args);
  if (error || data === null || data === undefined) {
    const code = (error as { code?: string } | null)?.code ?? null;
    return { ok: false, error: classify(error), reason: reasonOf(code, (error as { message?: string } | null)?.message ?? "") };
  }
  return { ok: true, value: data as T };
}
type J = Record<string, unknown>;
export const apply = {
  form: (c: Rpc, ws: string, campaign: string) => call<J>(c, "aura_apply_form", { p_workspace: ws, p_campaign: campaign }),
  saveDraft: (c: Rpc, ws: string, request: string, campaign: string, content: J) => call<{ id: string; saved_at: string }>(c, "aura_apply_save_draft", { p_workspace: ws, p_request: request, p_campaign: campaign, p_content: content }),
  deleteDraft: (c: Rpc, ws: string, id: string) => call<J>(c, "aura_apply_delete_draft", { p_workspace: ws, p_application: id }),
  submit: (c: Rpc, ws: string, id: string, confirm: boolean) => call<{ id: string; status: string }>(c, "aura_apply_submit", { p_workspace: ws, p_application: id, p_confirm: confirm }),
  edit: (c: Rpc, ws: string, id: string, content: J, confirm: boolean) => call<J>(c, "aura_apply_edit", { p_workspace: ws, p_application: id, p_content: content, p_confirm: confirm }),
  withdraw: (c: Rpc, ws: string, id: string, confirm: boolean) => call<J>(c, "aura_apply_withdraw", { p_workspace: ws, p_application: id, p_confirm: confirm }),
  answer: (c: Rpc, ws: string, id: string, answer: string) => call<J>(c, "aura_apply_answer", { p_workspace: ws, p_clarification: id, p_answer: answer }),
  creator: (c: Rpc, ws: string) => call<J>(c, "aura_apply_creator", { p_workspace: ws }),
  application: (c: Rpc, ws: string, id: string) => call<J>(c, "aura_apply_application", { p_workspace: ws, p_application: id }),
  invitation: (c: Rpc, ws: string, id: string) => call<J>(c, "aura_apply_invitation", { p_workspace: ws, p_invitation: id }),
  enquiry: (c: Rpc, ws: string, id: string) => call<J>(c, "aura_apply_enquiry", { p_workspace: ws, p_enquiry: id }),
  respondInvitation: (c: Rpc, ws: string, id: string, action: string, text: string | null) => call<{ collaboration_id: string | null }>(c, "aura_apply_respond_invitation", { p_workspace: ws, p_invitation: id, p_action: action, p_text: text }),
  respondEnquiry: (c: Rpc, ws: string, id: string, action: string, reply: string | null) => call<J>(c, "aura_apply_respond_enquiry", { p_workspace: ws, p_enquiry: id, p_action: action, p_reply: reply }),
  block: (c: Rpc, ws: string, brand: string, on: boolean) => call<J>(c, "aura_apply_block", { p_workspace: ws, p_brand: brand, p_on: on }),
  report: (c: Rpc, ws: string, kind: string, id: string, reason: string, details: string) => call<J>(c, "aura_apply_report", { p_workspace: ws, p_kind: kind, p_target: id, p_reason: reason, p_details: details }),
  negotiation: (c: Rpc, ws: string, id: string) => call<J>(c, "aura_apply_negotiation", { p_workspace: ws, p_collab: id }),
  propose: (c: Rpc, ws: string, id: string, terms: J, note: string | null, days: number | null) => call<J>(c, "aura_apply_propose", { p_workspace: ws, p_collab: id, p_terms: terms, p_note: note, p_valid_days: days }),
  confirm: (c: Rpc, ws: string, id: string, version: number) => call<{ both_confirmed: boolean }>(c, "aura_apply_confirm", { p_workspace: ws, p_collab: id, p_version: version }),
  message: (c: Rpc, ws: string, id: string, body: string) => call<J>(c, "aura_apply_message", { p_workspace: ws, p_collab: id, p_body: body }),
  read: (c: Rpc, ws: string) => call<J>(c, "aura_apply_read", { p_workspace: ws }),
  rules: (c: Rpc, ws: string, campaign: string) => call<J>(c, "aura_apply_rules", { p_workspace: ws, p_campaign: campaign }),
  setRules: (c: Rpc, ws: string, campaign: string, rules: J, questions: unknown[] | null) => call<J>(c, "aura_apply_set_rules", { p_workspace: ws, p_campaign: campaign, p_rules: rules, p_questions: questions }),
  campaignApplications: (c: Rpc, ws: string, campaign: string) => call<J>(c, "aura_apply_campaign_applications", { p_workspace: ws, p_campaign: campaign }),
  brandApplication: (c: Rpc, ws: string, id: string) => call<J>(c, "aura_apply_brand_application", { p_workspace: ws, p_application: id }),
  decide: (c: Rpc, ws: string, id: string, action: string, feedback: string | null) => call<J>(c, "aura_apply_decide", { p_workspace: ws, p_application: id, p_action: action, p_feedback: feedback }),
  ask: (c: Rpc, ws: string, id: string, question: string) => call<J>(c, "aura_apply_ask", { p_workspace: ws, p_application: id, p_question: question }),
  invite: (c: Rpc, ws: string, campaign: string, creator: string, message: string) => call<J>(c, "aura_apply_invite", { p_workspace: ws, p_campaign: campaign, p_creator: creator, p_message: message }),
  enquire: (c: Rpc, ws: string, creator: string, campaign: string | null, message: string) => call<J>(c, "aura_apply_enquire", { p_workspace: ws, p_creator: creator, p_campaign: campaign, p_message: message }),
  brand: (c: Rpc, ws: string) => call<J>(c, "aura_apply_brand", { p_workspace: ws }),
  brandAnswer: (c: Rpc, ws: string, id: string, answer: string) => call<J>(c, "aura_apply_brand_answer", { p_workspace: ws, p_invitation: id, p_answer: answer }),
  reportQueue: (c: Rpc) => call<J[]>(c, "aura_apply_report_queue", {}),
  decideReport: (c: Rpc, id: string, decision: string, reason: string) => call<J>(c, "aura_apply_decide_report", { p_report: id, p_decision: decision, p_reason: reason }),
};
