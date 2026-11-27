import {
  money,
  allocated,
  outstanding,
  type Ledger,
  type Invoice,
} from "./model";
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csv(value: string) {
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function exportLedger(
  ledger: Ledger,
  currency: string,
  start: string,
  end: string,
) {
  const rows = [
    [
      "Title",
      "Client",
      "Currency",
      "Agreed amount",
      "Due date",
      "Received allocation",
      "Outstanding",
      "Disputed",
    ],
  ];
  for (const o of ledger.obligations.filter(
    (o) =>
      o.currency === currency &&
      (!start || o.date >= start) &&
      (!end || o.date <= end),
  ))
    rows.push([
      o.title,
      o.client,
      o.currency,
      o.amount,
      o.due,
      money(allocated(ledger, o.id), o.currency),
      money(outstanding(ledger, o), o.currency),
      o.disputed ? "Yes" : "No",
    ]);
  download(
    "\ufeff" + rows.map((r) => r.map(csv).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
    "aura-ledger-" + currency + ".csv",
  );
}
function escape(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export function exportInvoice(i: Invoice) {
  const e = escape;
  const html =
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' +
    e(i.number) +
    "</title><style>body{font:15px system-ui;color:#242137;max-width:800px;margin:70px auto;padding:20px}header{display:flex;justify-content:space-between;border-bottom:2px solid #242137;padding-bottom:25px}h1{font-size:48px;letter-spacing:-2px}section{margin:40px 0;display:flex;justify-content:space-between;gap:40px}pre{font:inherit;white-space:pre-wrap}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:15px 0;border-bottom:1px solid #ddd}small{color:#777486}@media print{body{margin:0}}</style><header><div><small>" +
    e(i.status) +
    " · Version " +
    i.version +
    "</small><h1>Invoice</h1><p>" +
    e(i.number) +
    "</p></div><div><p>Due " +
    e(i.due) +
    "</p><small>" +
    e(i.issuedAt?.slice(0, 10) || "Draft") +
    "</small></div></header><section><div><small>From</small><pre>" +
    e(i.seller) +
    "</pre></div><div><small>Bill to</small><pre>" +
    e(i.buyer) +
    "</pre></div></section><table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>" +
    e(i.title) +
    "</td><td>" +
    e(money(i.amount, i.currency)) +
    "</td></tr></tbody></table><section><strong>Total · " +
    e(i.currency) +
    "</strong><strong>" +
    e(money(i.amount, i.currency)) +
    "</strong></section><pre>" +
    e(i.notes) +
    "</pre>" +
    (i.reason ? "<p>Cancellation reason · " + e(i.reason) + "</p>" : "") +
    "</html>";
  download(html, "text/html;charset=utf-8", "aura-invoice-" + i.id + ".html");
}
