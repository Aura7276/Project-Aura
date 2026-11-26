import Link from "next/link";
import { EntityForm } from "@/features/creator-profile/forms";
import { appStatus, collabStatus, invitationStatus, reportReasons, termsDiff, termsLines, type Terms } from "./rules";
import * as act from "./actions";
import { ProposalForm } from "./forms";

export type SP = Record<string, string | string[] | undefined>;
export const one = (sp: SP, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
export const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "");
export const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
export function Status({ s, kind = "app" }: { s: string; kind?: "app" | "collab" | "invitation" }) {
  const label = kind === "app" ? (appStatus[s]?.label ?? s) : kind === "collab" ? (collabStatus[s] ?? s) : (invitationStatus[s] ?? s);
  return <span className="ap-status" data-s={s}>{label}</span>;
}
const eventText: Record<string, string> = {
  submitted: "Application sent", edited: "Changes sent as a new version", withdrawn: "Withdrawn", review: "Brand started reviewing (locked)", shortlisted: "Shortlisted", waitlisted: "Waitlisted",
  selected: "Selected (not an agreement)", rejected: "Not selected", clarification_requested: "The Brand asked a question", clarification_answered: "You answered", proposal: "Proposal sent", confirmed: "Proposal confirmed",
  invitation_interested: "Interest expressed", invitation_decline: "Invitation declined", invitation_clarify: "Question about the invitation",
};
export function Timeline({ items }: { items: { event: string; side: string; at: string }[] }) {
  if (!items.length) return <p className="mk-sub">Nothing has happened yet.</p>;
  return (
    <ol className="ap-timeline">
      {items.map((h, i) => (
        <li key={i}>
          <b>{eventText[h.event] ?? h.event.replace(/_/g, " ")}</b> <span className="mk-sub">· {h.side} · {when(h.at)}</span>
        </li>
      ))}
    </ol>
  );
}
const stepOrder = ["submitted", "review", "shortlisted", "selected"];
export function Steps({ status }: { status: string }) {
  const s = status === "clarification" ? "review" : status === "waitlisted" ? "shortlisted" : status;
  const at = stepOrder.indexOf(s);
  const steps: [string, string][] = [["submitted", "Sent"], ["review", "In review"], ["shortlisted", "Shortlist"], ["selected", "Selected"], ["agreement", "Agreement (M12)"]];
  return (
    <ol className="ap-steps" aria-label="Progress">
      {steps.map(([k, l], i) => (
        <li key={k} aria-current={i === at ? "step" : undefined} className={at >= 0 && i < at ? "done" : undefined}>{l}</li>
      ))}
    </ol>
  );
}
export function Notice({ sp, extra }: { sp: SP; extra?: Record<string, string> }) {
  const msgs: Record<string, string> = {
    sent: "Application sent. You can still change it until the Brand starts reviewing.", withdrawn: "Withdrawn. The Brand was told.", deleted: "Draft deleted.",
    interested: "Interest sent. This is not an agreement: agree the terms below first.", confirmed: "You confirmed this version. Waiting for the other side.",
    ready: "Both sides confirmed the same version. It is ready for an agreement, which is not binding until it is accepted (M12).", blocked: "Saved.", ...extra,
  };
  const k = Object.keys(msgs).find((x) => sp[x]);
  const notice = one(sp, "notice");
  const nText: Record<string, string> = { stale: "The proposal changed before you confirmed. Review the current version.", confirm: "Tick the box to confirm this exact version.", state: "That is not possible at this stage.", eligibility: "The Creator no longer meets the mandatory requirements, so it cannot become ready for an agreement." };
  if (notice) return <p role="status" aria-live="polite" className="st-error">{nText[notice] ?? "We could not do that. Please try again."}</p>;
  return <p role="status" aria-live="polite" className="st-ok">{k ? msgs[k] : ""}</p>;
}
export function ReportBox({ kind, id, w, label }: { kind: "invitation" | "enquiry" | "message"; id: string; w?: string; label: string }) {
  return (
    <details className="ap-report">
      <summary>{label}</summary>
      <EntityForm action={act.reportItem} label={label} idPrefix={`rp-${id.slice(0, 8)}`} submit="Send report"
        fields={[
          { name: "id", label: "", type: "hidden", value: id }, { name: "kind", label: "", type: "hidden", value: kind }, ...(w ? [{ name: "w", label: "", type: "hidden" as const, value: w }] : []),
          { name: "reason", label: "What is wrong?", type: "select", required: true, options: { "": "Choose…", ...reportReasons } },
          { name: "details", label: "Details", type: "textarea", max: 1000, rows: 3 },
        ]} />
    </details>
  );
}
export type Negotiation = {
  id: string; side: "creator" | "brand"; status: string; campaign_id: string; campaign: string; brand: string; creator: string; negotiable: boolean;
  campaign_terms: { compensation?: { money?: { type: string; currency: string; min?: number; max?: number } }; deliverables?: { type: string; platform?: string; quantity: number }[]; rights?: { usage_months?: number; exclusivity_days?: number } } | null;
  current: { version: number; side: string; terms: Terms; note: string | null; expires_at: string; confirmed_by: string[] } | null;
  proposals: { version: number; side: string; status: string; terms: Terms; note: string | null; created_at: string; expires_at: string; confirmed_by: string[] }[];
  messages: { id: string; side: string; body: string; created_at: string }[];
  conflicts: { campaign: string; start_on: string; end_on: string }[];
};
/** The negotiation workspace, shared by both sides (F22–F27, F30, F31, AC05). */
export function NegotiationBody({ n, w, sp }: { n: Negotiation; w?: string; sp: SP }) {
  const me = n.side;
  const other = me === "creator" ? n.brand : n.creator;
  const cur = n.current;
  const prev = cur ? n.proposals.find((p) => p.version === cur.version - 1) : undefined;
  const changed = cur ? termsDiff(prev?.terms, cur.terms) : [];
  const mine = cur?.confirmed_by.includes(me);
  const theirs = cur?.confirmed_by.some((s) => s !== me);
  const open = ["prospective", "negotiating"].includes(n.status);
  const ct = n.campaign_terms;
  const m = ct?.compensation?.money;
  const base = cur
    ? { currency: cur.terms.money?.currency, amount: cur.terms.money?.amount, revisions: cur.terms.revisions, start_on: cur.terms.start_on, end_on: cur.terms.end_on, usage_months: cur.terms.rights?.usage_months, channels: cur.terms.rights?.channels?.join(", "), exclusivity_days: cur.terms.rights?.exclusivity_days, deliverables: cur.terms.deliverables?.map((d) => `${d.quantity} x ${d.type}`).join("\n") }
    : { currency: m?.currency ?? "INR", amount: m?.min, usage_months: ct?.rights?.usage_months, exclusivity_days: ct?.rights?.exclusivity_days, deliverables: ct?.deliverables?.map((d) => `${d.quantity} x ${d.type}`).join("\n"), revisions: 1 };
  return (
    <>
      <p><Status s={n.status} kind="collab" /> <span className="mk-sub">with {other}</span></p>
      <Notice sp={sp} />
      {n.status === "ready_for_agreement" && (
        <p className="mk-banner ok">Both sides confirmed version {n.proposals.find((p) => p.confirmed_by.length === 2)?.version}. The agreement is prepared in the next step (M12). Nothing is binding until that agreement is accepted.</p>
      )}
      {n.conflicts.length > 0 && (
        <p className="mk-banner" role="note">Dates overlap with {n.conflicts.map((c) => `${c.campaign} (${c.start_on} to ${c.end_on})`).join(", ")}. This is a warning only; check that you can deliver both.</p>
      )}
      <div className="ap-cols">
        <div>
          <section className="st-card" aria-labelledby="ng-cur">
            <h2 id="ng-cur">{cur ? `Current proposal · version ${cur.version}` : "No proposal yet"}</h2>
            {cur ? (
              <div className="ap-version current">
                <p className="mk-sub">Proposed by {cur.side === me ? "you" : other} · valid until {day(cur.expires_at)}</p>
                <ul className="ap-terms">{termsLines(cur.terms).map((l) => <li key={l}>{l}</li>)}</ul>
                {cur.note && <p>“{cur.note}”</p>}
                {changed.length > 0 && <p className="mk-sub">Changed from version {prev?.version}: {changed.join(", ")}.</p>}
                <p>
                  {mine ? <span className="mk-pill ok">You confirmed</span> : <span className="mk-pill unk">You have not confirmed</span>}{" "}
                  {theirs ? <span className="mk-pill ok">{other} confirmed</span> : <span className="mk-pill unk">{other} has not confirmed</span>}
                </p>
                {open && !mine && (
                  <form action={act.confirmProposal}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="version" value={cur.version} />
                    {w && <input type="hidden" name="w" value={w} />}
                    <p><label className="ap-confirm"><input type="checkbox" name="agree" /> I confirm exactly version {cur.version} as written above.</label></p>
                    <button className="st-btn primary">Confirm version {cur.version}</button>
                  </form>
                )}
                <p className="mk-sub">Confirming is not an agreement. Any new proposal resets both confirmations.</p>
              </div>
            ) : (
              <p className="mk-sub">Start with the campaign terms or propose your own{n.negotiable ? "" : " (the Brand did not mark terms as negotiable, so expect the published terms)"}.</p>
            )}
          </section>
          {open && (
            <section className="st-card" aria-labelledby="ng-new">
              <h2 id="ng-new">{cur ? "Counter-proposal" : "Make a proposal"}</h2>
              <ProposalForm action={act.propose} id={n.id} w={w} base={base} />
            </section>
          )}
          {n.proposals.length > 1 && (
            <section className="st-card" aria-labelledby="ng-hist">
              <h2 id="ng-hist">Earlier versions</h2>
              {n.proposals.filter((p) => p.version !== cur?.version).map((p) => (
                <details key={p.version} className="ap-version">
                  <summary>Version {p.version} · {p.side === me ? "you" : other} · {p.status} · {day(p.created_at)}</summary>
                  <ul className="ap-terms">{termsLines(p.terms).map((l) => <li key={l}>{l}</li>)}</ul>
                </details>
              ))}
            </section>
          )}
        </div>
        <aside className="ap-aside">
          <section className="st-card" aria-labelledby="ng-msg">
            <h2 id="ng-msg">Messages</h2>
            <p className="mk-sub">Short messages only. Terms count only when they are in a proposal.</p>
            {n.messages.length === 0 ? <p className="mk-sub">No messages yet.</p> : (
              <ul className="ap-thread">
                {n.messages.map((x) => (
                  <li key={x.id} className={`ap-msg${x.side === me ? " mine" : ""}`}>
                    <small>{x.side === me ? "You" : other} · {when(x.created_at)}</small>
                    {x.body}
                    {x.side !== me && <ReportBox kind="message" id={x.id} w={w} label="Report message" />}
                  </li>
                ))}
              </ul>
            )}
            <EntityForm action={act.sendMessage} label="Send a message" idPrefix="msg" submit="Send"
              fields={[{ name: "id", label: "", type: "hidden", value: n.id }, ...(w ? [{ name: "w", label: "", type: "hidden" as const, value: w }] : []), { name: "body", label: "Message", type: "textarea", max: 2000, rows: 3, required: true }]} />
          </section>
        </aside>
      </div>
    </>
  );
}
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mk-empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export { Link };
