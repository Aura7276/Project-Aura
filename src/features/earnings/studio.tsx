"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Download,
  FileText,
  Flag,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CommercialForm, labels, type Action } from "./form";
import { previewTransition } from "./preview-transition";
import { exportInvoice, exportLedger } from "./export";
import {
  allocated,
  adjusted,
  outstanding,
  unallocated,
  units,
  money,
  day,
  inPeriod,
  type Ledger,
  type Execute,
  type Command,
  type Obligation,
  type Invoice,
} from "./model";
import "./earnings.css";
const tabs = [
  "Overview",
  "Ledger",
  "Payments",
  "Invoices",
  "Expenses",
  "Goals",
  "Registers",
  "Reports",
] as const;
type Tab = (typeof tabs)[number];
function period(name: string): [string, string] {
  const today = day(),
    year = Number(today.slice(0, 4)),
    month = Number(today.slice(5, 7));
  if (name === "All time") return ["", ""];
  if (name === "This year") return [year + "-01-01", year + "-12-31"];
  if (name === "Financial year") {
    const y = month < 4 ? year - 1 : year;
    return [y + "-04-01", y + 1 + "-03-31"];
  }
  if (name === "This quarter") {
    const m = Math.floor((month - 1) / 3) * 3 + 1;
    const end = new Date(year, m + 2, 0).getDate();
    return [
      year + "-" + String(m).padStart(2, "0") + "-01",
      year + "-" + String(m + 2).padStart(2, "0") + "-" + end,
    ];
  }
  const end = new Date(year, month, 0).getDate();
  return [today.slice(0, 7) + "-01", today.slice(0, 7) + "-" + end];
}
function date(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
function safeLink(url: string) {
  return /^https?:\/\/[^\s]+$/i.test(url) ? url : undefined;
}
function Status({ o, l }: { o: Obligation; l: Ledger }) {
  const balance = outstanding(l, o);
  return (
    <span
      className={
        "en-status " + (balance === 0n ? "good" : o.due < day() ? "late" : "")
      }
    >
      {balance === 0n ? "Settled" : o.due < day() ? "Overdue" : "Outstanding"}
      {o.disputed && " · Disputed"}
    </span>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="en-empty">
      <FolderOpen />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
export function EarningsStudio({
  initial,
  execute,
  preview = false,
  offline = false,
  initialTab = "Overview",
}: {
  initial: Ledger;
  execute?: Execute;
  preview?: boolean;
  offline?: boolean;
  initialTab?: Tab;
}) {
  const [ledger, setLedger] = useState(initial),
    [tab, setTab] = useState<Tab>(initialTab),
    [currency, setCurrency] = useState("INR"),
    [periodName, setPeriodName] = useState("This month"),
    [range, setRange] = useState<[string, string]>(() => period("This month")),
    [query, setQuery] = useState(""),
    [action, setAction] = useState<Action | null>(null),
    [selected, setSelected] = useState<Obligation | null>(null),
    [invoice, setInvoice] = useState<Invoice | null>(null),
    [notice, setNotice] = useState(""),
    [register, setRegister] = useState("Barter"),
    [followUp, setFollowUp] = useState("");
  const current = useRef(initial);
  const currencies = Array.from(
    new Set([
      "INR",
      ...ledger.obligations.map((o) => o.currency),
      ...ledger.receipts.map((o) => o.currency),
      ...ledger.expenses.map((o) => o.currency),
      ...ledger.targets.map((o) => o.currency),
    ]),
  );
  const [start, end] = range;
  const obligations = ledger.obligations.filter(
    (o) =>
      o.currency === currency &&
      inPeriod(o.date, start, end) &&
      (o.title + " " + o.client).toLowerCase().includes(query.toLowerCase()),
  );
  const receipts = ledger.receipts.filter(
    (r) =>
      r.currency === currency &&
      inPeriod(r.date, start, end) &&
      (r.payer + " " + r.reference).toLowerCase().includes(query.toLowerCase()),
  );
  const expenses = ledger.expenses.filter(
    (e) =>
      e.currency === currency &&
      inPeriod(e.date, start, end) &&
      (e.title + " " + e.category).toLowerCase().includes(query.toLowerCase()),
  );
  const received = ledger.receipts
    .filter(
      (r) =>
        !r.reversed && r.currency === currency && inPeriod(r.date, start, end),
    )
    .reduce((s, r) => s + units(r.amount), 0n);
  const spent = ledger.expenses
    .filter(
      (e) =>
        !e.voided && e.currency === currency && inPeriod(e.date, start, end),
    )
    .reduce((s, e) => s + units(e.amount), 0n);
  const open = ledger.obligations
    .filter((o) => o.currency === currency && outstanding(ledger, o) > 0n)
    .sort((a, b) => a.due.localeCompare(b.due));
  const balance = open.reduce((s, o) => s + outstanding(ledger, o), 0n),
    overdue = open
      .filter((o) => o.due < day())
      .reduce((s, o) => s + outstanding(ledger, o), 0n);
  const agreed = ledger.obligations
    .filter((o) => o.currency === currency && inPeriod(o.date, start, end))
    .reduce((s, o) => s + adjusted(ledger, o), 0n);
  async function run(c: Command, id: string): Promise<string | null> {
    try {
      if (preview) {
        const next = previewTransition(current.current, c);
        current.current = next;
        setLedger(next);
        setNotice(
          "Preview updated. These records are illustrative and temporary.",
        );
        return null;
      }
      if (!execute || offline)
        return "The commercial workspace is unavailable.";
      const result = await execute(c, id, current.current.revision);
      if (result.error) return result.error;
      if (!result.ledger) return "The record could not be saved.";
      current.current = result.ledger;
      setLedger(result.ledger);
      setNotice("Saved to your private ledger.");
      return null;
    } catch (error) {
      return preview && error instanceof Error
        ? error.message
        : "Connection interrupted. Retry when connected.";
    }
  }
  function create(type: Command["type"], id?: string) {
    setSelected(null);
    setInvoice(null);
    setAction({ type, id });
  }
  const latestSelected = selected
    ? ledger.obligations.find((o) => o.id === selected.id)
    : null;
  return (
    <div className="en">
      <header className="en-header">
        <div className="en-heading">
          <span className="en-mark">
            <Wallet />
          </span>
          <div>
            <span className="en-eyebrow">Your business</span>
            <h1>Earnings</h1>
          </div>
        </div>
        <span className="en-private">
          <ShieldCheck />
          Private workspace
        </span>
        <button
          className="en-primary"
          disabled={offline}
          onClick={() => create("obligation")}
        >
          <Plus />
          Add income
        </button>
      </header>
      {preview && (
        <div className="en-preview">
          Development preview · fictional clients and financial records ·
          changes are temporary
        </div>
      )}
      {offline && (
        <p role="alert" className="en-alert">
          Your commercial records are unavailable. Reconnect to load your
          ledger.
        </p>
      )}
      <nav className="en-nav" aria-label="Commercial workspace">
        {tabs.map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="en-toolbar">
        <label className="en-search">
          <Search />
          <input
            aria-label="Search commercial records"
            placeholder="Search your records"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div>
          <select
            aria-label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Reporting period"
            value={periodName}
            onChange={(e) => {
              setPeriodName(e.target.value);
              if (e.target.value !== "Custom") setRange(period(e.target.value));
            }}
          >
            {[
              "This month",
              "This quarter",
              "This year",
              "Financial year",
              "All time",
              "Custom",
            ].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      {periodName === "Custom" && (
        <div className="en-custom">
          <label>
            From
            <input
              type="date"
              value={start}
              onChange={(e) => setRange([e.target.value, end])}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={end}
              onChange={(e) => setRange([start, e.target.value])}
            />
          </label>
        </div>
      )}
      <p role="status" className="en-notice">
        {notice}
      </p>
      {tab === "Overview" && (
        <>
          <div className="en-overview">
            <section className="en-cash">
              <div>
                <span className="en-caption">Recorded receipts</span>
                <span className="en-badge">{periodName}</span>
              </div>
              <h2>{money(received, currency)}</h2>
              <p>Payments recorded in your ledger</p>
              <div className="en-cash-actions">
                <button disabled={offline} onClick={() => create("receipt")}>
                  <ArrowDownLeft />
                  Record a payment
                </button>
                <button onClick={() => setTab("Payments")}>
                  View payments
                  <ArrowUpRight />
                </button>
              </div>
              <CashChart ledger={ledger} currency={currency} />
            </section>
            <section className="en-position">
              <h2>A clear picture.</h2>
              <div>
                <span>
                  Agreed value <small>selected period</small>
                </span>
                <strong>{money(agreed, currency)}</strong>
              </div>
              <div>
                <span>
                  Outstanding <small>all dates</small>
                </span>
                <strong>{money(balance, currency)}</strong>
              </div>
              <div>
                <span>
                  Overdue <small>all dates</small>
                </span>
                <strong className={overdue > 0n ? "en-late" : ""}>
                  {money(overdue, currency)}
                </strong>
              </div>
              <div>
                <span>
                  Expenses <small>selected period</small>
                </span>
                <strong>{money(spent, currency)}</strong>
              </div>
              <footer>
                <span>Receipts less expenses</span>
                <b>{money(received - spent, currency)}</b>
              </footer>
              <small>
                Cash contribution before tax and other unrecorded costs.
              </small>
            </section>
          </div>
          <div className="en-bottom-grid">
            <section>
              <div className="en-section-title">
                <h2>Next to collect</h2>
                <button className="en-link" onClick={() => setTab("Ledger")}>
                  View ledger
                  <ArrowRight />
                </button>
              </div>
              {open.length ? (
                open.slice(0, 4).map((o) => (
                  <button
                    className="en-collect"
                    key={o.id}
                    onClick={() => {
                      setFollowUp("");
                      setSelected(o);
                    }}
                  >
                    <span className="en-initial">{o.client.slice(0, 1)}</span>
                    <span>
                      <strong>{o.client}</strong>
                      <small>
                        {o.title} · due {date(o.due)}
                      </small>
                    </span>
                    <span>
                      <b>{money(outstanding(ledger, o), currency)}</b>
                      <Status o={o} l={ledger} />
                    </span>
                  </button>
                ))
              ) : (
                <Empty
                  title="All clear for now."
                  body="Outstanding obligations will appear here with their due dates."
                />
              )}
            </section>
            <section className="en-invoice-card">
              <FileText />
              <h2>Ready to send.</h2>
              <p>
                Turn an agreed obligation into a clear invoice. Keep the issued
                version with your records.
              </p>
              <button
                disabled={offline || !ledger.obligations.length}
                onClick={() => create("invoice")}
              >
                Create invoice
                <ArrowUpRight />
              </button>
              <footer>
                {ledger.invoices.filter((i) => i.status === "Draft").length}{" "}
                drafts in your workspace
              </footer>
            </section>
          </div>
        </>
      )}
      {tab === "Ledger" && (
        <>
          <div className="en-section-title">
            <h2>Your income ledger</h2>
            <button disabled={offline} onClick={() => create("obligation")}>
              <Plus />
              Add obligation
            </button>
          </div>
          {obligations.length ? (
            <div className="en-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project / client</th>
                    <th>Agreed</th>
                    <th>Outstanding</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Open record</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.title}</strong>
                        <small>{o.client}</small>
                      </td>
                      <td>{money(adjusted(ledger, o), currency)}</td>
                      <td>{money(outstanding(ledger, o), currency)}</td>
                      <td>{date(o.due)}</td>
                      <td>
                        <Status o={o} l={ledger} />
                      </td>
                      <td>
                        <button
                          aria-label={"Open " + o.title}
                          onClick={() => {
                            setSelected(o);
                            setFollowUp("");
                          }}
                        >
                          <ChevronRight />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Start with the work you agreed."
              body="Add an external client obligation with its amount, currency and due date."
            />
          )}
        </>
      )}
      {tab === "Payments" && (
        <>
          <div className="en-section-title">
            <div>
              <h2>Payments, recorded.</h2>
              <p className="en-muted">
                Self-reported external receipts and their allocations.
              </p>
            </div>
            <button
              className="en-primary"
              disabled={offline}
              onClick={() => create("receipt")}
            >
              <Plus />
              Record payment
            </button>
          </div>
          {receipts.length ? (
            <div className="en-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Payer / reference</th>
                    <th>Amount</th>
                    <th>Unallocated</th>
                    <th>Date</th>
                    <th>Record</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.payer}</strong>
                        <small>{r.reference || "No reference recorded"}</small>
                        {safeLink(r.evidence) && (
                          <a href={r.evidence} target="_blank" rel="noreferrer">
                            Evidence ↗
                          </a>
                        )}
                      </td>
                      <td>{money(r.amount, currency)}</td>
                      <td>{money(unallocated(r), currency)}</td>
                      <td>{date(r.date)}</td>
                      <td>
                        <span className="en-status">
                          {r.reversed ? "Reversed" : r.confirmation}
                        </span>
                      </td>
                      <td>
                        <div className="en-row-actions">
                          {!r.reversed && (
                            <>
                              <button
                                disabled={offline || unallocated(r) === 0n}
                                onClick={() => create("allocate", r.id)}
                              >
                                Allocate
                              </button>
                              <button
                                disabled={offline}
                                onClick={() => create("reverse", r.id)}
                              >
                                Reverse
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="A home for each payment."
              body="Record actual receipts, then allocate them to the work they cover."
            />
          )}
        </>
      )}
      {tab === "Invoices" && (
        <>
          <div className="en-section-title">
            <h2>Invoices</h2>
            <button
              className="en-primary"
              disabled={offline || !ledger.obligations.length}
              onClick={() => create("invoice")}
            >
              <Plus />
              Create draft
            </button>
          </div>
          <div className="en-invoice-grid">
            {ledger.invoices
              .filter(
                (i) =>
                  i.currency === currency &&
                  (i.number + " " + i.title)
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((i) => (
                <button
                  className="en-invoice-tile"
                  key={i.id}
                  onClick={() => setInvoice(i)}
                >
                  <div>
                    <FileText />
                    <span
                      className={
                        "en-status " + (i.status === "Issued" ? "good" : "")
                      }
                    >
                      {i.status}
                    </span>
                  </div>
                  <small>
                    {i.number} · v{i.version}
                  </small>
                  <h3>{i.title}</h3>
                  <strong>{money(i.amount, i.currency)}</strong>
                  <footer>
                    Due {date(i.due)}
                    <ArrowUpRight />
                  </footer>
                </button>
              ))}
          </div>
          {!ledger.invoices.length && (
            <Empty
              title="The details make the difference."
              body="Create a draft from an obligation, review billing details, then issue a protected version."
            />
          )}
        </>
      )}
      {tab === "Expenses" && (
        <>
          <div className="en-section-title">
            <div>
              <h2>The cost of creating</h2>
              <p className="en-muted">Private expenses and production time.</p>
            </div>
            <button
              className="en-primary"
              disabled={offline}
              onClick={() => create("expense")}
            >
              <Plus />
              Add expense
            </button>
          </div>
          {expenses.length ? (
            <div className="en-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Expense</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Hours</th>
                    <th>Date</th>
                    <th>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.title}</strong>
                        <small>{e.client || "General business"}</small>
                        {safeLink(e.evidence) && (
                          <a href={e.evidence} target="_blank" rel="noreferrer">
                            Evidence ↗
                          </a>
                        )}
                      </td>
                      <td>{e.category}</td>
                      <td>{money(e.amount, currency)}</td>
                      <td>{e.hours || "—"}</td>
                      <td>{date(e.date)}</td>
                      <td>
                        {e.voided ? (
                          <span className="en-status">Voided</span>
                        ) : (
                          <button
                            disabled={offline}
                            onClick={() => create("voidExpense", e.id)}
                          >
                            Correct record
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Know what goes into the work."
              body="Capture production, software and other business costs."
            />
          )}
        </>
      )}
      {tab === "Goals" && (
        <>
          <div className="en-section-title">
            <div>
              <h2>Build toward something.</h2>
              <p className="en-muted">
                Track recorded receipts against a goal you set.
              </p>
            </div>
            <button
              className="en-primary"
              disabled={offline}
              onClick={() => create("target")}
            >
              <Plus />
              Set goal
            </button>
          </div>
          <div className="en-goals">
            {ledger.targets
              .filter((t) => t.currency === currency)
              .map((t) => {
                const earned = ledger.receipts
                  .filter(
                    (r) =>
                      !r.reversed &&
                      r.currency === t.currency &&
                      inPeriod(r.date, t.start, t.end),
                  )
                  .reduce((s, r) => s + units(r.amount), 0n);
                const progress = Number((earned * 100n) / units(t.amount));
                return (
                  <article key={t.id}>
                    <div>
                      <TrendingUp />
                      <button
                        disabled={offline}
                        onClick={() => create("target", t.id)}
                      >
                        Edit
                      </button>
                    </div>
                    <h3>{t.title}</h3>
                    <span>
                      {date(t.start)} – {date(t.end)}
                    </span>
                    <p>
                      <strong>{money(earned, t.currency)}</strong> of{" "}
                      {money(t.amount, t.currency)}
                    </p>
                    <progress
                      value={Math.min(progress, 100)}
                      max={100}
                      aria-label={t.title}
                    />
                    <small>{progress}% of recorded receipt target</small>
                  </article>
                );
              })}
          </div>
          {!ledger.targets.length && (
            <Empty
              title="Your pace. Your ambition."
              body="Set a monthly, quarterly or annual target using your own dates."
            />
          )}
        </>
      )}
      {tab === "Registers" && (
        <>
          <div className="en-section-title">
            <h2>Beyond cash receipts</h2>
          </div>
          <div className="en-register-tabs">
            {["Barter", "Commissions", "Forecasts"].map((t) => (
              <button
                aria-pressed={register === t}
                key={t}
                onClick={() => setRegister(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="en-section-title">
            <p className="en-muted">
              {register === "Barter"
                ? "Non-cash benefits stay in their own register."
                : register === "Commissions"
                  ? "Commission status is recorded separately from cash receipts."
                  : "Estimates carry their basis and uncertainty."}
            </p>
            <button
              disabled={offline}
              onClick={() =>
                create(
                  register === "Barter"
                    ? "benefit"
                    : register === "Commissions"
                      ? "commission"
                      : "forecast",
                )
              }
            >
              <Plus />
              Add record
            </button>
          </div>
          {register === "Barter" &&
            ledger.benefits
              .filter(
                (b) => b.currency === currency && inPeriod(b.date, start, end),
              )
              .map((b) => (
                <article className="en-register-row" key={b.id}>
                  <div>
                    <strong>{b.title}</strong>
                    <small>
                      {b.partner} · {date(b.date)}
                    </small>
                  </div>
                  <span>
                    {b.value
                      ? money(b.value, b.currency)
                      : "Value not declared"}
                  </span>
                  <span className="en-status">{b.status}</span>
                </article>
              ))}
          {register === "Commissions" &&
            ledger.commissions
              .filter(
                (c) => c.currency === currency && inPeriod(c.date, start, end),
              )
              .map((c) => (
                <article className="en-register-row" key={c.id}>
                  <div>
                    <strong>{c.title}</strong>
                    <small>
                      {c.partner} · {c.source}
                    </small>
                  </div>
                  <span>{money(c.amount, c.currency)}</span>
                  <button
                    disabled={offline}
                    onClick={() => create("commissionStatus", c.id)}
                  >
                    {c.status}
                    <ChevronRight />
                  </button>
                </article>
              ))}
          {register === "Forecasts" &&
            ledger.forecasts
              .filter(
                (f) => f.currency === currency && inPeriod(f.date, start, end),
              )
              .map((f) => (
                <article className="en-register-row" key={f.id}>
                  <div>
                    <strong>{f.title}</strong>
                    <small>
                      {f.basis} · {date(f.date)}
                    </small>
                  </div>
                  <span>{money(f.amount, f.currency)}</span>
                  <span className="en-status">Estimate</span>
                </article>
              ))}
        </>
      )}
      {tab === "Reports" && (
        <>
          <div className="en-section-title">
            <div>
              <h2>Your records. Ready to work.</h2>
              <p className="en-muted">
                Exports follow the selected currency and obligation period.
              </p>
            </div>
            <button
              disabled={offline}
              onClick={() => exportLedger(ledger, currency, start, end)}
            >
              <Download />
              Export ledger CSV
            </button>
          </div>
          <section className="en-report-note">
            <ShieldCheck />
            <div>
              <h3>Choose what you share</h3>
              <p>
                The ledger export contains obligations, allocations and
                outstanding amounts. Private expense details and evidence links
                are excluded.
              </p>
              <p>
                Downloaded invoice files can be opened and printed to PDF in
                your browser.
              </p>
            </div>
          </section>
          <div className="en-section-title">
            <h2>Activity record</h2>
          </div>
          <ol className="en-activity">
            {ledger.events.map((e) => (
              <li key={e.id}>
                <span className="en-event-dot" />
                <div>
                  <strong>
                    {labels[e.action as Command["type"]] || e.action}
                  </strong>
                  <small>{new Date(e.at).toLocaleString("en-IN")}</small>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {action && (
        <CommercialForm
          key={action.type + action.id}
          action={action}
          ledger={ledger}
          currencyCode={currency}
          close={() => setAction(null)}
          run={run}
        />
      )}
      {latestSelected && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setSelected(null);
          }}
        >
          <DialogContent className="en-dialog">
            <DialogHeader>
              <DialogTitle>{latestSelected.title}</DialogTitle>
              <DialogDescription>
                {latestSelected.client} · {latestSelected.category}
              </DialogDescription>
            </DialogHeader>
            <Status o={latestSelected} l={ledger} />
            <dl className="en-record-totals">
              <div>
                <dt>Adjusted obligation</dt>
                <dd>
                  {money(
                    adjusted(ledger, latestSelected),
                    latestSelected.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Allocated receipts</dt>
                <dd>
                  {money(
                    allocated(ledger, latestSelected.id),
                    latestSelected.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Outstanding</dt>
                <dd>
                  {money(
                    outstanding(ledger, latestSelected),
                    latestSelected.currency,
                  )}
                </dd>
              </div>
            </dl>
            <p className="en-record-terms">{latestSelected.terms}</p>
            <div className="en-row-actions">
              <button
                disabled={offline}
                onClick={() => create("adjust", latestSelected.id)}
              >
                Adjustment
              </button>
              <button
                disabled={offline}
                onClick={() => create("dispute", latestSelected.id)}
              >
                <Flag />
                Dispute status
              </button>
              <button
                onClick={() =>
                  setFollowUp(
                    "Hi " +
                      latestSelected.client +
                      ", following up on " +
                      latestSelected.title +
                      ". Our recorded outstanding amount is " +
                      money(
                        outstanding(ledger, latestSelected),
                        latestSelected.currency,
                      ) +
                      ", due " +
                      latestSelected.due +
                      ". Please share an update or any payment reference so I can reconcile our records.",
                  )
                }
              >
                Draft follow-up
              </button>
            </div>
            {followUp && (
              <label className="en-follow-up">
                Editable follow-up
                <textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(followUp);
                      setNotice(
                        "Follow-up copied. Ready for your review and sending.",
                      );
                    } catch {
                      setNotice("Select the follow-up text to copy it.");
                    }
                  }}
                >
                  Copy message
                </button>
              </label>
            )}
            <details>
              <summary>Adjustments and provenance</summary>
              {ledger.adjustments
                .filter((a) => a.obligation === latestSelected.id)
                .map((a) => (
                  <p key={a.id}>
                    {a.kind} · {money(a.amount, latestSelected.currency)}
                    <br />
                    {a.reason}
                    {safeLink(a.evidence) && (
                      <a href={a.evidence} target="_blank" rel="noreferrer">
                        {" "}
                        Evidence ↗
                      </a>
                    )}
                  </p>
                ))}
            </details>
          </DialogContent>
        </Dialog>
      )}
      {invoice && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) setInvoice(null);
          }}
        >
          <DialogContent className="en-dialog">
            <DialogHeader>
              <DialogTitle>{invoice.number}</DialogTitle>
              <DialogDescription>
                {invoice.status} · Version {invoice.version}
              </DialogDescription>
            </DialogHeader>
            <div className="en-invoice-preview">
              <FileText />
              <h2>{money(invoice.amount, invoice.currency)}</h2>
              <p>{invoice.title}</p>
              <div>
                <label>From</label>
                <p>{invoice.seller}</p>
                <label>Bill to</label>
                <p>{invoice.buyer}</p>
              </div>
              <p>{invoice.notes}</p>
              <small>Due {invoice.due}</small>
            </div>
            <div className="en-row-actions">
              <button onClick={() => exportInvoice(invoice)}>
                <Download />
                Download invoice
              </button>
              {invoice.status === "Draft" && (
                <>
                  <button
                    disabled={offline}
                    onClick={() => create("invoice", invoice.id)}
                  >
                    Edit draft
                  </button>
                  <button
                    className="en-primary"
                    disabled={offline}
                    onClick={() => create("issue", invoice.id)}
                  >
                    Issue invoice
                  </button>
                </>
              )}
              {invoice.status === "Issued" && (
                <button
                  disabled={offline}
                  onClick={() => create("cancelInvoice", invoice.id)}
                >
                  Cancel invoice
                </button>
              )}
            </div>
            <details>
              <summary>Version history</summary>
              {invoice.history.map((v) => (
                <p key={v.version}>
                  Version {v.version} · {v.number} ·{" "}
                  {new Date(v.at).toLocaleString()}
                  <br />
                  {v.seller}
                  <br />
                  {v.buyer}
                  <br />
                  {v.notes}
                </p>
              ))}
            </details>
          </DialogContent>
        </Dialog>
      )}
      {!preview && (
        <footer className="en-footer">
          <Link href="/collaborations">
            Open collaboration workspaces
            <ArrowUpRight size={13} />
          </Link>
        </footer>
      )}
    </div>
  );
}
function CashChart({ ledger, currency }: { ledger: Ledger; currency: string }) {
  const now = new Date(),
    months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      return {
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        total: ledger.receipts
          .filter(
            (r) =>
              !r.reversed && r.currency === currency && r.date.startsWith(key),
          )
          .reduce((s, r) => s + units(r.amount), 0n),
      };
    });
  const max = months.reduce((a, m) => (m.total > a ? m.total : a), 0n);
  return (
    <figure className="en-cash-chart">
      <figcaption>Recorded receipts · last six months</figcaption>
      <div>
        {months.map((m) => (
          <div key={m.label} title={money(m.total, currency)}>
            <span className="sr-only">
              {m.label} {money(m.total, currency)}
            </span>
            <div className="en-bar-track">
              <span
                style={{
                  height: (max ? Number((m.total * 100n) / max) : 0) + "%",
                }}
              />
            </div>
            <small>{m.label}</small>
          </div>
        ))}
      </div>
    </figure>
  );
}
