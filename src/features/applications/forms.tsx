"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useIdempotentForm } from "@/lib/use-idempotent-form";
import type { FormState } from "./actions";
import { saveDraft } from "./actions";

type Act = (prev: FormState, form: FormData) => Promise<FormState>;
export type Question = { id: string; prompt: string; required: boolean; kind: "text" | "yes_no" | "choice"; choices: string[]; max_length: number };
export type Account = { id: string; platform: string; handle: string; verification: string; followers: number | null };
export type Item = { id: string; title: string; kind?: string; visibility?: string };
export type Draft = { pitch?: string | null; account_id?: string | null; portfolio_ids?: string[]; kit_id?: string | null; kit_rates?: boolean; answers?: Record<string, string>; quote?: { currency: string; amount: number; note?: string } };

/**
 * The application form (F01–F06, F09). Drafts autosave two seconds after the last change and only the Creator can see them.
 * Sending always needs the explicit confirmation box, also for quick apply. The preview shows exactly what the Brand will receive.
 */
export function ApplyForm({
  action, campaign, applicationId, draft, questions, accounts, portfolio, kits, quickApply, negotiable, mode,
}: {
  action: Act; campaign: string; applicationId?: string; draft: Draft; questions: Question[]; accounts: Account[]; portfolio: Item[]; kits: Item[];
  quickApply: boolean; negotiable: boolean; mode: "new" | "edit";
}) {
  const { state, onSubmit, pending, ref } = useIdempotentForm(action);
  const s = state as FormState;
  const e = s?.errors ?? {};
  const [key] = useState(() => crypto.randomUUID());
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [v, setV] = useState({
    pitch: draft.pitch ?? "", account: draft.account_id ?? accounts[0]?.id ?? "", items: new Set(draft.portfolio_ids ?? []), kit: draft.kit_id ?? "",
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const autosave = () => {
    if (mode !== "new" || !ref.current) return;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!ref.current) return;
      const f = new FormData(ref.current);
      f.set("draft_key", key);
      const r = await saveDraft(null, f);
      dirty.current = false;
      if (r?.ok) {
        setSaved(new Date(r.savedAt ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setSaveError(null);
      } else setSaveError(r?.message ?? "Not saved.");
    }, 2000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const acc = accounts.find((a) => a.id === v.account);
  const minPitch = quickApply ? 0 : 50;
  const field = (name: string) => (e[name] ? { "aria-invalid": true as const, "aria-describedby": `ap-${name}-e` } : {});
  const err = (name: string) => (e[name] ? <p className="st-error" id={`ap-${name}-e`}>{e[name]}</p> : null);
  return (
    <form ref={ref} onSubmit={onSubmit} onChange={autosave} noValidate aria-label={mode === "new" ? "Application" : "Edit application"} className="ap-form">
      <input type="hidden" name="campaign" value={campaign} />
      <input type="hidden" name="draft_key" value={key} />
      {applicationId && <input type="hidden" name="id" value={applicationId} />}
      <div className="ap-cols">
        <div>
          <section className="st-card" aria-labelledby="ap-pitch-h">
            <h2 id="ap-pitch-h">Your pitch</h2>
            <div className="st-field">
              <label htmlFor="ap-pitch">Why you, for this campaign{quickApply ? " (optional: this campaign allows quick apply)" : ""}</label>
              <textarea id="ap-pitch" name="pitch" rows={7} maxLength={3000} defaultValue={v.pitch} onInput={(ev) => setV({ ...v, pitch: ev.currentTarget.value })} {...field("pitch")} />
              <p className="st-hint">{v.pitch.length} / 3000{minPitch ? ` · at least ${minPitch}` : ""}. Speak to the brief, your audience and the work you have already done.</p>
              {err("pitch")}
            </div>
          </section>
          <section className="st-card" aria-labelledby="ap-acc-h">
            <h2 id="ap-acc-h">Account you apply with</h2>
            {accounts.length === 0 ? (
              <p className="mk-banner">Add a social account first. <Link href="/creator/socials">Go to your accounts</Link>.</p>
            ) : (
              <fieldset {...field("account_id")}>
                <legend className="st-hint">The Brand sees its platform, handle, ownership status and your self-reported followers with their date. Nothing else.</legend>
                {accounts.map((a) => (
                  <label key={a.id} className="ap-choice">
                    <input type="radio" name="account_id" value={a.id} defaultChecked={a.id === v.account} onChange={() => setV({ ...v, account: a.id })} />
                    <span><b>{a.platform}</b> @{a.handle} <span className="mk-pill line">{a.verification === "verified" ? "Ownership verified" : "Not verified"}</span>{a.followers !== null ? ` · ${a.followers.toLocaleString("en-IN")} followers (self-reported)` : ""}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {err("account_id")}
          </section>
          {questions.length > 0 && (
            <section className="st-card" aria-labelledby="ap-q-h">
              <h2 id="ap-q-h">Screening questions</h2>
              <p className="st-hint">Questions marked required must be answered. Brands may not ask you to make new content for free.</p>
              {questions.map((q, i) => {
                const id = `ap-q-${i}`;
                const val = draft.answers?.[q.id] ?? "";
                return (
                  <div className="st-field" key={q.id}>
                    <label htmlFor={id}>{q.prompt}{q.required ? " (required)" : " (optional)"}</label>
                    {q.kind === "yes_no" || q.kind === "choice" ? (
                      <select id={id} name={`q_${q.id}`} defaultValue={val}>
                        <option value="">Choose…</option>
                        {(q.kind === "yes_no" ? ["yes", "no"] : q.choices).map((c) => <option key={c} value={c}>{c === "yes" ? "Yes" : c === "no" ? "No" : c}</option>)}
                      </select>
                    ) : (
                      <textarea id={id} name={`q_${q.id}`} rows={3} maxLength={q.max_length} defaultValue={val} />
                    )}
                  </div>
                );
              })}
              {err("answers")}
            </section>
          )}
          <section className="st-card" aria-labelledby="ap-att-h">
            <h2 id="ap-att-h">Work to share (optional)</h2>
            {portfolio.length === 0 ? (
              <p className="mk-sub">You have no public or restricted portfolio items. Private items are never shared. <Link href="/creator/portfolio">Open your portfolio</Link>.</p>
            ) : (
              <fieldset>
                <legend className="st-hint">Choose up to 12 portfolio items. Only the items you tick are shared.</legend>
                {portfolio.map((p) => (
                  <label key={p.id} className="ap-choice">
                    <input type="checkbox" name="portfolio" value={p.id} defaultChecked={v.items.has(p.id)} onChange={(ev) => { const n = new Set(v.items); if (ev.target.checked) n.add(p.id); else n.delete(p.id); setV({ ...v, items: n }); }} />
                    <span>{p.title} <span className="mk-sub">{p.visibility}</span></span>
                  </label>
                ))}
              </fieldset>
            )}
            {kits.length > 0 && (
              <>
                <div className="st-field">
                  <label htmlFor="ap-kit">Media kit (optional)</label>
                  <select id="ap-kit" name="kit_id" defaultValue={v.kit} onChange={(ev) => setV({ ...v, kit: ev.target.value })}>
                    <option value="">Do not attach a media kit</option>
                    {kits.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
                  </select>
                </div>
                <p><label><input type="checkbox" name="kit_rates" defaultChecked={!!draft.kit_rates} /> Include the rates from my media kit</label></p>
              </>
            )}
          </section>
          {negotiable && (
            <section className="st-card" aria-labelledby="ap-quote-h">
              <h2 id="ap-quote-h">Your quote (optional)</h2>
              <p className="st-hint">The Brand marked terms as negotiable. A quote is a starting point, not an agreement.</p>
              <div className="mk-row">
                <div className="st-field"><label htmlFor="ap-qc">Currency</label><select id="ap-qc" name="quote_currency" defaultValue={draft.quote?.currency ?? "INR"}>{["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}</select></div>
                <div className="st-field"><label htmlFor="ap-qa">Amount</label><input id="ap-qa" name="quote_amount" inputMode="decimal" defaultValue={draft.quote?.amount ?? ""} /></div>
              </div>
              <div className="st-field"><label htmlFor="ap-qn">What the quote covers</label><input id="ap-qn" name="quote_note" maxLength={300} defaultValue={draft.quote?.note ?? ""} /></div>
            </section>
          )}
        </div>
        <aside className="ap-aside" aria-labelledby="ap-prev-h">
          <section className="st-card ap-preview">
            <h2 id="ap-prev-h">What the Brand will see</h2>
            <dl className="mk-terms">
              <dt>Pitch</dt><dd>{v.pitch.trim() ? `${v.pitch.trim().slice(0, 140)}${v.pitch.trim().length > 140 ? "…" : ""}` : <span className="mk-sub">No pitch yet</span>}</dd>
              <dt>Account</dt><dd>{acc ? `${acc.platform} @${acc.handle}` : <span className="mk-sub">None chosen</span>}</dd>
              <dt>Portfolio</dt><dd>{v.items.size ? `${v.items.size} item${v.items.size === 1 ? "" : "s"}` : "None"}</dd>
              <dt>Media kit</dt><dd>{v.kit ? kits.find((k) => k.id === v.kit)?.title : "None"}</dd>
            </dl>
            <p className="mk-sub">Not shared: your other accounts, analytics, private portfolio items, notes, other applications and your contact details.</p>
            {mode === "new" && (
              <p className="ap-save" role="status" aria-live="polite">
                {saveError ? <span className="st-error">{saveError}</span> : saved ? `Draft saved at ${saved}` : "Drafts save automatically as you type."}
              </p>
            )}
            <p>
              <label className="ap-confirm">
                <input type="checkbox" name="confirm" {...field("confirm")} />{" "}
                {mode === "new" ? "I have checked this application and want to send it to the Brand." : "Send these changes to the Brand as a new version."}
              </label>
            </p>
            {err("confirm")}
            <button className="st-btn primary" style={{ width: "100%" }} disabled={pending} aria-busy={pending}>
              {pending ? "Sending…" : mode === "new" ? (quickApply ? "Quick apply" : "Send application") : "Send changes"}
            </button>
            <p role="status" aria-live="polite" className={s?.ok ? "st-ok" : "st-error"}>{s?.message}</p>
          </section>
        </aside>
      </div>
    </form>
  );
}

/** Proposal (F22–F24, F27): every field is part of the versioned terms both sides must confirm. */
export function ProposalForm({ action, id, w, base }: { action: Act; id: string; w?: string; base?: Record<string, string | number | undefined> }) {
  const { state, onSubmit, pending, ref } = useIdempotentForm(action);
  const s = state as FormState;
  const e = s?.errors ?? {};
  const f = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="st-field">
      <label htmlFor={`pr-${name}`}>{label}</label>
      <input id={`pr-${name}`} name={name} defaultValue={base?.[name] ?? ""} aria-invalid={e[name] ? true : undefined} aria-describedby={e[name] ? `pr-${name}-e` : undefined} {...props} />
      {e[name] && <p className="st-error" id={`pr-${name}-e`}>{e[name]}</p>}
    </div>
  );
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate aria-label="New proposal" className="ap-proposal">
      <input type="hidden" name="id" value={id} />
      {w && <input type="hidden" name="w" value={w} />}
      <div className="ap-grid">
        <div className="st-field"><label htmlFor="pr-currency">Currency</label><select id="pr-currency" name="currency" defaultValue={String(base?.currency ?? "INR")}>{["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}</select></div>
        {f("amount", "Compensation (money)", { inputMode: "decimal" })}
        {f("revisions", "Revision rounds", { inputMode: "numeric" })}
        {f("start_on", "Start date", { type: "date" })}
        {f("end_on", "End date", { type: "date" })}
        {f("usage_months", "Usage rights (months)", { inputMode: "numeric" })}
        {f("channels", "Rights channels (comma separated)")}
        {f("exclusivity_days", "Exclusivity (days)", { inputMode: "numeric" })}
        {f("valid_days", "Valid for (days, default 7)", { inputMode: "numeric" })}
      </div>
      <div className="st-field">
        <label htmlFor="pr-deliverables">Deliverables, one per line (for example “2 x reel”)</label>
        <textarea id="pr-deliverables" name="deliverables" rows={3} defaultValue={String(base?.deliverables ?? "")} />
      </div>
      <div className="st-field"><label htmlFor="pr-note">Note (optional)</label><textarea id="pr-note" name="note" rows={2} maxLength={1000} /></div>
      <button className="st-btn primary" disabled={pending} aria-busy={pending}>{pending ? "Sending…" : "Send proposal"}</button>
      <p role="status" aria-live="polite" className={s?.ok ? "st-ok" : "st-error"}>{s?.message}</p>
    </form>
  );
}
