"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCheck } from "lucide-react";
import {
  reportPayment,
  importConfirmedReport,
  type SharedPayments,
} from "./shared-actions";
import { money, day } from "./model";
import "./earnings.css";
export function CollaborationPayments({
  id,
  initial,
}: {
  id: string;
  initial: SharedPayments;
}) {
  const [data, setData] = useState(initial),
    [adding, setAdding] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState<{ id: string; type: string } | null>(null);
  const request = useRef<{ body: string; id: string } | null>(null),
    importRequests = useRef<Record<string, string>>({});
  async function send(command: unknown) {
    const body = JSON.stringify(command);
    if (request.current?.body !== body)
      request.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const result = await reportPayment(id, command, request.current.id);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      if (result.data) setData(result.data);
      setAdding(false);
      setReview(null);
      setMessage("Payment record saved.");
    } catch {
      setMessage("Connection interrupted. Retry when connected.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="en">
      <Link href={"/collaborations/" + id} className="en-back">
        <ArrowLeft size={16} />
        Back to collaboration
      </Link>
      <header className="en-header">
        <div>
          <span className="en-eyebrow">{data.title}</span>
          <h1>Payment records</h1>
        </div>
        <button
          className="en-primary"
          disabled={busy || !data.manage}
          onClick={() => setAdding(true)}
        >
          <Plus />
          Record payment
        </button>
      </header>
      <p className="en-muted">
        External payments reported by each party. Creator expenses stay private.
      </p>
      <p role="status" className="en-notice">
        {message}
      </p>
      {adding && (
        <form
          className="en-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send({
              type: "report",
              ...Object.fromEntries(new FormData(e.currentTarget)),
            });
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Amount
              <input name="amount" required inputMode="decimal" />
            </label>
            <label>
              Currency
              <input
                name="currency"
                required
                defaultValue="INR"
                maxLength={3}
                pattern="[A-Z]{3}"
              />
            </label>
            <label>
              Actual payment date
              <input name="date" type="date" required defaultValue={day()} />
            </label>
            <label>
              Reference · optional
              <input name="reference" maxLength={180} />
            </label>
            <label>
              Redacted evidence URL · optional
              <input name="evidence" type="url" />
            </label>
            <label>
              Payment context
              <textarea name="note" required maxLength={3000} />
            </label>
            <button className="en-primary" type="submit">
              Save payment report
            </button>
            <button type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </fieldset>
        </form>
      )}
      {data.reports.map((r) => (
        <article className="en-shared-report" key={r.id}>
          <header>
            <span className="en-status">{r.status}</span>
            <span>
              {r.side === "creator" ? "Creator-reported" : "Brand-reported"}
            </span>
            <strong>{money(r.amount, r.currency)}</strong>
          </header>
          <p>{r.note}</p>
          <small>
            {r.date} · {r.reference || "No reference recorded"}
          </small>
          {r.evidence && (
            <a href={r.evidence} target="_blank" rel="noreferrer">
              Evidence ↗
            </a>
          )}
          {r.response && <blockquote>{r.response}</blockquote>}
          <footer>
            {data.manage && r.side !== data.side && r.status === "Reported" && (
              <button
                disabled={busy}
                onClick={() => setReview({ id: r.id, type: "respond" })}
              >
                Confirm or dispute
              </button>
            )}
            {data.manage &&
              r.side === data.side &&
              ["Reported", "Confirmed", "Disputed"].includes(r.status) && (
                <button
                  disabled={busy}
                  onClick={() => setReview({ id: r.id, type: "reverse" })}
                >
                  Request reversal
                </button>
              )}
            {data.manage &&
              r.side !== data.side &&
              r.status === "Reversal requested" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    setReview({ id: r.id, type: "confirmReversal" })
                  }
                >
                  Confirm reversal
                </button>
              )}
            {data.side === "creator" && r.status === "Confirmed" && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const requestId =
                      importRequests.current[r.id] || crypto.randomUUID();
                    importRequests.current[r.id] = requestId;
                    const result = await importConfirmedReport(
                      id,
                      r.id,
                      requestId,
                    );
                    setMessage(
                      result.error ||
                        "Added to your private ledger for allocation.",
                    );
                  } catch {
                    setMessage("Import interrupted. Retry when connected.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <CheckCheck size={14} />
                Add confirmed receipt to my ledger
              </button>
            )}
          </footer>
          {review?.id === r.id && (
            <form
              className="en-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send({
                  type: review.type,
                  report: r.id,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                });
              }}
            >
              <fieldset disabled={busy}>
                {review.type === "respond" && (
                  <label>
                    Decision
                    <select name="decision">
                      <option>Confirmed</option>
                      <option>Disputed</option>
                    </select>
                  </label>
                )}
                <label>
                  Reason or confirmation note
                  <textarea name="note" required maxLength={3000} />
                </label>
                <label className="en-confirm">
                  <input type="checkbox" required /> I confirm this record
                  update.
                </label>
                <button type="submit">Confirm update</button>
                <button type="button" onClick={() => setReview(null)}>
                  Cancel
                </button>
              </fieldset>
            </form>
          )}
        </article>
      ))}
      {!data.reports.length && (
        <div className="en-empty">
          <h3>Start with a real payment.</h3>
          <p>
            Record a payment made outside AURA for the other party to confirm.
          </p>
        </div>
      )}
    </div>
  );
}
