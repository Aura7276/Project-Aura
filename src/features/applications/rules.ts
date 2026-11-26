// M11 labels. Selection, interest and confirmation are never described as an agreement (F31).
export const appStatus: Record<string, { label: string; detail: string }> = {
  draft: { label: "Draft", detail: "Only you can see it. It is saved as you type." },
  submitted: { label: "Submitted", detail: "Sent. You can still edit it until the Brand starts reviewing." },
  review: { label: "In review", detail: "The Brand is reviewing it. It is now locked." },
  clarification: { label: "Question from the Brand", detail: "Answer the question below." },
  shortlisted: { label: "Shortlisted", detail: "You are on the shortlist. This is not a selection." },
  waitlisted: { label: "Waitlisted", detail: "You may be considered if a place opens. This is not a guarantee." },
  selected: { label: "Selected", detail: "The Brand selected you. Nothing is binding until an agreement is accepted." },
  rejected: { label: "Not selected", detail: "The Brand chose other creators this time." },
  withdrawn: { label: "Withdrawn", detail: "You withdrew this application." },
  expired: { label: "Expired", detail: "The campaign closed before a decision." },
  cancelled: { label: "Cancelled", detail: "The campaign was cancelled." },
  converted: { label: "Moved to agreement", detail: "Handed over to the agreement step." },
};
export const collabStatus: Record<string, string> = { prospective: "Prospective", negotiating: "Negotiating", ready_for_agreement: "Ready for an agreement (not yet binding)", cancelled: "Closed" };
export const invitationStatus: Record<string, string> = { sent: "Waiting for your answer", interested: "You are interested", declined: "Declined", expired: "Expired", withdrawn: "Withdrawn" };
export const reportReasons = { harassment: "Harassment or pressure", unpaid_custom_work: "Asks for unpaid custom work", fee_requested: "Asks me to pay", misleading: "Misleading", spam: "Spam", other: "Something else" } as const;
export type Terms = { money?: { currency: string; amount: number }; deliverables?: { type: string; quantity: number }[]; start_on?: string; end_on?: string; revisions?: number; rights?: { usage_months?: number; channels?: string[]; exclusivity_days?: number } };
export const money = (m?: { currency: string; amount: number }) => (m ? new Intl.NumberFormat("en-IN", { style: "currency", currency: m.currency, maximumFractionDigits: 0 }).format(m.amount) : "Not stated");
export function termsLines(t: Terms): string[] {
  return [
    `Compensation: ${money(t.money)}`,
    `Deliverables: ${t.deliverables?.length ? t.deliverables.map((d) => `${d.quantity} × ${d.type}`).join(", ") : "not stated"}`,
    `Timing: ${t.start_on || t.end_on ? `${t.start_on ?? "?"} to ${t.end_on ?? "?"}` : "not stated"}`,
    `Revisions: ${t.revisions ?? "not stated"}`,
    `Rights: ${t.rights?.usage_months ? `${t.rights.usage_months} months` : "not stated"}${t.rights?.channels?.length ? ` on ${t.rights.channels.join(", ")}` : ""}${t.rights?.exclusivity_days ? `, ${t.rights.exclusivity_days} days exclusivity` : ", no exclusivity"}`,
  ];
}
/** What changed between two proposals, field by field. */
export function termsDiff(a: Terms | undefined, b: Terms): string[] {
  if (!a) return [];
  const keys: (keyof Terms)[] = ["money", "deliverables", "start_on", "end_on", "revisions", "rights"];
  return keys.filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)).map((k) => ({ money: "compensation", deliverables: "deliverables", start_on: "start date", end_on: "end date", revisions: "revisions", rights: "rights" })[k]);
}
export const pendingAction = (status: string, pending: number) =>
  pending > 0 ? "Answer the Brand's question" : status === "draft" ? "Finish and send your application" : status === "selected" ? "Wait for the agreement step" : null;
