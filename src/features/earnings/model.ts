import { z } from "zod";
export const amountSchema = z
  .string()
  .trim()
  .regex(
    /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/,
    "Use up to 12 whole digits and 6 decimal places.",
  );
const positive = amountSchema.refine(
  (v) => units(v) > 0n,
  "Enter an amount greater than zero.",
);
const currency = z.string().regex(/^[A-Z]{3}$/);
const short = z.string().trim().min(1).max(180);
const note = z.string().trim().min(1).max(3000);
const date = z.iso.date();
const link = z.union([
  z.literal(""),
  z.url({ protocol: /^https?$/ }).max(2048),
]);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("obligation"),
    title: short,
    client: short,
    category: z.enum([
      "Freelance",
      "Platform income",
      "Direct client",
      "Other",
    ]),
    amount: positive,
    currency,
    due: date,
    date,
    terms: note,
  }),
  z.object({
    type: z.literal("receipt"),
    payer: short,
    amount: positive,
    currency,
    date,
    reference: z.string().max(180),
    method: z.string().max(80),
    evidence: link,
    sourceReport: z.uuid().optional(),
    allocations: z
      .array(z.object({ obligation: z.uuid(), amount: positive }))
      .max(50),
  }),
  z.object({
    type: z.literal("allocate"),
    receipt: z.uuid(),
    allocations: z
      .array(z.object({ obligation: z.uuid(), amount: positive }))
      .min(1)
      .max(50),
  }),
  z.object({ type: z.literal("reverse"), receipt: z.uuid(), reason: note }),
  z.object({
    type: z.literal("adjust"),
    obligation: z.uuid(),
    kind: z.enum(["Credit", "Withholding", "Deduction", "Increase"]),
    amount: positive,
    reason: note,
    evidence: link,
  }),
  z.object({
    type: z.literal("dispute"),
    obligation: z.uuid(),
    open: z.boolean(),
    reason: note,
  }),
  z.object({
    type: z.literal("expense"),
    title: short,
    category: short,
    amount: positive,
    currency,
    date,
    client: z.string().max(180),
    hours: z.union([z.literal(""), amountSchema]),
    evidence: link,
  }),
  z.object({ type: z.literal("voidExpense"), expense: z.uuid(), reason: note }),
  z.object({
    type: z.literal("invoice"),
    id: z.uuid(),
    obligation: z.uuid(),
    number: short,
    seller: note,
    buyer: note,
    notes: z.string().max(3000),
  }),
  z.object({ type: z.literal("issue"), invoice: z.uuid() }),
  z.object({
    type: z.literal("cancelInvoice"),
    invoice: z.uuid(),
    reason: note,
  }),
  z.object({
    type: z.literal("target"),
    id: z.uuid(),
    title: short,
    amount: positive,
    currency,
    start: date,
    end: date,
  }),
  z.object({
    type: z.literal("benefit"),
    title: short,
    partner: short,
    status: z.enum(["Expected", "Received", "Returned"]),
    value: z.union([z.literal(""), amountSchema]),
    currency,
    date,
    evidence: link,
  }),
  z.object({
    type: z.literal("commission"),
    title: short,
    partner: short,
    amount: positive,
    currency,
    date,
    source: note,
  }),
  z.object({
    type: z.literal("commissionStatus"),
    commission: z.uuid(),
    status: z.enum(["Pending", "Confirmed", "Reversed", "Disputed", "Settled"]),
    note,
  }),
  z.object({
    type: z.literal("forecast"),
    title: short,
    amount: positive,
    currency,
    date,
    basis: note,
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export type Obligation = {
  id: string;
  title: string;
  client: string;
  category: string;
  amount: string;
  currency: string;
  due: string;
  date: string;
  terms: string;
  disputed: boolean;
};
export type Allocation = { obligation: string; amount: string };
export type Receipt = {
  id: string;
  payer: string;
  amount: string;
  currency: string;
  date: string;
  reference: string;
  method: string;
  evidence: string;
  allocations: Allocation[];
  reversed: boolean;
  confirmation: "Self-reported" | "Mutually confirmed";
  reason?: string;
};
export type Adjustment = {
  id: string;
  obligation: string;
  kind: "Credit" | "Withholding" | "Deduction" | "Increase";
  amount: string;
  reason: string;
  evidence: string;
};
export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: string;
  currency: string;
  date: string;
  client: string;
  hours: string;
  evidence: string;
  voided: boolean;
};
export type Invoice = {
  id: string;
  obligation: string;
  number: string;
  seller: string;
  buyer: string;
  notes: string;
  status: "Draft" | "Issued" | "Cancelled";
  version: number;
  amount: string;
  currency: string;
  title: string;
  due: string;
  issuedAt?: string;
  reason?: string;
  history: {
    version: number;
    seller: string;
    buyer: string;
    notes: string;
    number: string;
    at: string;
  }[];
};
export type Target = {
  id: string;
  title: string;
  amount: string;
  currency: string;
  start: string;
  end: string;
};
export type Benefit = {
  id: string;
  title: string;
  partner: string;
  status: string;
  value: string;
  currency: string;
  date: string;
  evidence: string;
};
export type Commission = {
  id: string;
  title: string;
  partner: string;
  amount: string;
  currency: string;
  date: string;
  source: string;
  status: string;
  note?: string;
};
export type Forecast = {
  id: string;
  title: string;
  amount: string;
  currency: string;
  date: string;
  basis: string;
};
export type Ledger = {
  revision: number;
  obligations: Obligation[];
  receipts: Receipt[];
  adjustments: Adjustment[];
  expenses: Expense[];
  invoices: Invoice[];
  targets: Target[];
  benefits: Benefit[];
  commissions: Commission[];
  forecasts: Forecast[];
  events: { id: string; action: string; at: string; actor: string }[];
};
export const emptyLedger: Ledger = {
  revision: 0,
  obligations: [],
  receipts: [],
  adjustments: [],
  expenses: [],
  invoices: [],
  targets: [],
  benefits: [],
  commissions: [],
  forecasts: [],
  events: [],
};
export type Execute = (
  command: Command,
  request: string,
  revision: number,
) => Promise<{ ledger?: Ledger; error?: string }>;

// Monetary values stay decimal strings at every persistence boundary. BigInt is
// used only inside the interface; conversions never silently round a balance.
export function units(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole || "0") * 1000000n + BigInt(fraction.padEnd(6, "0"));
}
export function decimal(value: bigint): string {
  const negative = value < 0n;
  const n = negative ? -value : value;
  return (
    (negative ? "-" : "") +
    (n / 1000000n).toString() +
    "." +
    (n % 1000000n).toString().padStart(6, "0")
  );
}
export function money(value: bigint | string, currencyCode: string): string {
  const v = typeof value === "bigint" ? value : units(value),
    negative = v < 0n,
    n = negative ? -v : v;
  const whole = (n / 1000000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (n % 1000000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  const symbol = currencyCode === "INR" ? "₹" : currencyCode + " ";
  return (negative ? "−" : "") + symbol + whole + "." + fraction;
}
export function allocated(l: Ledger, id: string) {
  return l.receipts
    .filter((r) => !r.reversed)
    .flatMap((r) => r.allocations)
    .filter((a) => a.obligation === id)
    .reduce((sum, a) => sum + units(a.amount), 0n);
}
export function adjusted(l: Ledger, o: Obligation) {
  return l.adjustments
    .filter((a) => a.obligation === o.id)
    .reduce(
      (sum, a) => sum + (a.kind === "Increase" ? 1n : -1n) * units(a.amount),
      units(o.amount),
    );
}
export function outstanding(l: Ledger, o: Obligation) {
  return adjusted(l, o) - allocated(l, o.id);
}
export function unallocated(r: Receipt) {
  return r.reversed
    ? 0n
    : units(r.amount) -
        r.allocations.reduce((sum, a) => sum + units(a.amount), 0n);
}
export function day() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function inPeriod(value: string, start: string, end: string) {
  return (!start || value >= start) && (!end || value <= end);
}
