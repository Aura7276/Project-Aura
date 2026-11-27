"use client";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  commandSchema,
  day,
  money,
  outstanding,
  type Command,
  type Ledger,
} from "./model";
export type Action = { type: Command["type"]; id?: string };
type Field = {
  key: string;
  label: string;
  type?: "date" | "url" | "textarea" | "money";
  options?: string[];
  optional?: boolean;
};
const amount: Field = { key: "amount", label: "Amount", type: "money" },
  date: Field = { key: "date", label: "Date", type: "date" },
  reason: Field = {
    key: "reason",
    label: "Reason and supporting basis",
    type: "textarea",
  },
  evidence: Field = {
    key: "evidence",
    label: "Redacted evidence link",
    type: "url",
    optional: true,
  };
const title: Field = { key: "title", label: "Title" },
  currency: Field = {
    key: "currency",
    label: "Original currency",
    options: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "KWD"],
  };
const fields: Record<Command["type"], Field[]> = {
  obligation: [
    title,
    { key: "client", label: "Client or platform" },
    {
      key: "category",
      label: "Income category",
      options: ["Direct client", "Freelance", "Platform income", "Other"],
    },
    amount,
    currency,
    date,
    { key: "due", label: "Payment due", type: "date" },
    { key: "terms", label: "Agreed payment terms", type: "textarea" },
  ],
  receipt: [
    { key: "payer", label: "Payer" },
    amount,
    currency,
    date,
    { key: "reference", label: "Payment reference", optional: true },
    { key: "method", label: "Payment method", optional: true },
    evidence,
  ],
  allocate: [],
  reverse: [reason],
  adjust: [
    {
      key: "kind",
      label: "Adjustment type",
      options: ["Credit", "Withholding", "Deduction", "Increase"],
    },
    amount,
    reason,
    evidence,
  ],
  dispute: [
    { key: "open", label: "Dispute status", options: ["Open", "Resolved"] },
    reason,
  ],
  expense: [
    title,
    { key: "category", label: "Expense category" },
    amount,
    currency,
    date,
    { key: "client", label: "Client or project", optional: true },
    {
      key: "hours",
      label: "Actual production hours",
      type: "money",
      optional: true,
    },
    evidence,
  ],
  voidExpense: [reason],
  invoice: [
    { key: "number", label: "Invoice number" },
    { key: "seller", label: "Your billing name and address", type: "textarea" },
    {
      key: "buyer",
      label: "Client billing name and address",
      type: "textarea",
    },
    { key: "notes", label: "Invoice notes", type: "textarea", optional: true },
  ],
  issue: [],
  cancelInvoice: [reason],
  target: [
    title,
    amount,
    currency,
    { key: "start", label: "Period starts", type: "date" },
    { key: "end", label: "Period ends", type: "date" },
  ],
  benefit: [
    title,
    { key: "partner", label: "Partner" },
    {
      key: "status",
      label: "Benefit status",
      options: ["Expected", "Received", "Returned"],
    },
    { key: "value", label: "Declared value", type: "money", optional: true },
    currency,
    date,
    evidence,
  ],
  commission: [
    title,
    { key: "partner", label: "Affiliate partner" },
    amount,
    currency,
    date,
    { key: "source", label: "Commission source and basis", type: "textarea" },
  ],
  commissionStatus: [
    {
      key: "status",
      label: "Commission status",
      options: ["Pending", "Confirmed", "Reversed", "Disputed", "Settled"],
    },
    { key: "note", label: "Evidence and context", type: "textarea" },
  ],
  forecast: [
    title,
    amount,
    currency,
    date,
    { key: "basis", label: "Forecast basis and uncertainty", type: "textarea" },
  ],
};
export const labels: Record<Command["type"], string> = {
  obligation: "Add income obligation",
  receipt: "Record payment",
  allocate: "Allocate receipt",
  reverse: "Reverse receipt",
  adjust: "Record adjustment",
  dispute: "Update dispute",
  expense: "Add expense",
  voidExpense: "Void expense",
  invoice: "Save invoice draft",
  issue: "Issue invoice",
  cancelInvoice: "Cancel invoice",
  target: "Save income goal",
  benefit: "Record barter benefit",
  commission: "Record commission",
  commissionStatus: "Update commission",
  forecast: "Add forecast",
};
export function CommercialForm({
  action,
  ledger,
  currencyCode,
  close,
  run,
}: {
  action: Action;
  ledger: Ledger;
  currencyCode: string;
  close: () => void;
  run: (c: Command, id: string) => Promise<string | null>;
}) {
  const target = ledger.targets.find((t) => t.id === action.id),
    invoice = ledger.invoices.find((i) => i.id === action.id),
    receipt = ledger.receipts.find((r) => r.id === action.id);
  const defaults: Record<string, string> =
    action.type === "invoice" && invoice
      ? {
          number: invoice.number,
          seller: invoice.seller,
          buyer: invoice.buyer,
          notes: invoice.notes,
        }
      : action.type === "target" && target
        ? { ...target }
        : {};
  const [currencyValue, setCurrency] = useState(
    receipt?.currency || defaults.currency || currencyCode,
  );
  const [rows, setRows] = useState<{ obligation: string; amount: string }[]>(
    [],
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const draftId = useRef(action.id || crypto.randomUUID()),
    retry = useRef<{ body: string; id: string } | null>(null);
  const choices = ledger.obligations.filter(
    (o) => o.currency === currencyValue && outstanding(ledger, o) > 0n,
  );
  async function submit(form: FormData) {
    const values = Object.fromEntries(form.entries());
    let raw: unknown = { ...values, type: action.type };
    switch (action.type) {
      case "receipt":
        raw = { ...values, type: action.type, allocations: rows };
        break;
      case "allocate":
        raw = { type: action.type, receipt: action.id, allocations: rows };
        break;
      case "reverse":
        raw = { ...values, type: action.type, receipt: action.id };
        break;
      case "adjust":
        raw = { ...values, type: action.type, obligation: action.id };
        break;
      case "dispute":
        raw = {
          ...values,
          type: action.type,
          obligation: action.id,
          open: values.open === "Open",
        };
        break;
      case "voidExpense":
        raw = { ...values, type: action.type, expense: action.id };
        break;
      case "invoice":
        raw = { ...values, type: action.type, id: draftId.current };
        break;
      case "target":
        raw = { ...values, type: action.type, id: draftId.current };
        break;
      case "issue":
      case "cancelInvoice":
        raw = { ...values, type: action.type, invoice: action.id };
        break;
      case "commissionStatus":
        raw = { ...values, type: action.type, commission: action.id };
        break;
    }
    const parsed = commandSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check your entries.");
      return;
    }
    const body = JSON.stringify(parsed.data);
    if (retry.current?.body !== body)
      retry.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const problem = await run(parsed.data, retry.current.id);
      if (problem) setError(problem);
      else close();
    } catch {
      setError("Connection interrupted. Your entries are preserved for retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="en-dialog">
        <DialogHeader>
          <DialogTitle>{labels[action.type]}</DialogTitle>
          <DialogDescription>
            {action.type === "receipt"
              ? "Record a payment received outside AURA. Your record is labelled self-reported."
              : action.type === "invoice"
                ? "Build a draft from an existing obligation. Review billing and applicable tax requirements before issuing."
                : action.type === "issue"
                  ? "Issuing protects this version and its number. Review the amount, billing information and applicable tax requirements."
                  : action.type === "reverse"
                    ? "The original receipt remains in your history. Its allocations will be reversed."
                    : "Private to your Creator workspace."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit}>
          <fieldset disabled={busy}>
            {action.type === "invoice" && (
              <label>
                Income obligation
                <select
                  required
                  name="obligation"
                  defaultValue={invoice?.obligation || ""}
                >
                  <option value="">Choose an obligation</option>
                  {ledger.obligations.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.title} · {money(o.amount, o.currency)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {fields[action.type].map((f) => (
              <label key={f.key}>
                {f.label}
                {f.optional && <small>Optional</small>}
                {f.options ? (
                  <select
                    name={f.key}
                    defaultValue={
                      defaults[f.key] ||
                      (f.key === "currency" ? currencyValue : f.options[0])
                    }
                    onChange={
                      f.key === "currency"
                        ? (e) => {
                            setCurrency(e.target.value);
                            setRows([]);
                          }
                        : undefined
                    }
                  >
                    {Array.from(
                      new Set([
                        ...f.options,
                        ...(f.key === "currency" ? [currencyValue] : []),
                      ]),
                    ).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.key}
                    required={!f.optional}
                    maxLength={3000}
                    rows={3}
                    defaultValue={defaults[f.key]}
                  />
                ) : (
                  <input
                    name={f.key}
                    required={!f.optional}
                    type={
                      f.type === "date"
                        ? "date"
                        : f.type === "url"
                          ? "url"
                          : "text"
                    }
                    inputMode={f.type === "money" ? "decimal" : undefined}
                    maxLength={f.type === "url" ? 2048 : 180}
                    defaultValue={
                      defaults[f.key] || (f.type === "date" ? day() : "")
                    }
                  />
                )}
              </label>
            ))}
            {(action.type === "receipt" || action.type === "allocate") && (
              <section className="en-allocation">
                <h3>Apply to obligations</h3>
                <p>Only obligations in {currencyValue} can be allocated.</p>
                {rows.map((row, i) => (
                  <div key={i}>
                    <select
                      aria-label={"Obligation " + (i + 1)}
                      value={row.obligation}
                      onChange={(e) =>
                        setRows((old) =>
                          old.map((r, j) =>
                            j === i ? { ...r, obligation: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">Choose obligation</option>
                      {choices.map((o) => (
                        <option value={o.id} key={o.id}>
                          {o.title} ·{" "}
                          {money(outstanding(ledger, o), o.currency)}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={"Allocation amount " + (i + 1)}
                      inputMode="decimal"
                      placeholder="Amount"
                      value={row.amount}
                      onChange={(e) =>
                        setRows((old) =>
                          old.map((r, j) =>
                            j === i ? { ...r, amount: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={"Remove allocation " + (i + 1)}
                      onClick={() =>
                        setRows((old) => old.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={rows.length >= 50 || !choices.length}
                  onClick={() =>
                    setRows((old) => [...old, { obligation: "", amount: "" }])
                  }
                >
                  Add allocation
                </button>
              </section>
            )}
            {[
              "issue",
              "reverse",
              "cancelInvoice",
              "voidExpense",
              "adjust",
            ].includes(action.type) && (
              <label className="en-confirm">
                <input type="checkbox" required /> I have reviewed and confirm
                this change.
              </label>
            )}
            <p role="alert" className="en-error">
              {error}
            </p>
            <footer>
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button className="en-primary" type="submit">
                {busy ? "Saving…" : labels[action.type]}
              </button>
            </footer>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
