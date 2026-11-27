import {
  type Ledger,
  type Command,
  units,
  outstanding,
  unallocated,
  day,
} from "./model";
export function previewTransition(source: Ledger, command: Command): Ledger {
  const l = structuredClone(source),
    id = crypto.randomUUID(),
    at = new Date().toISOString();
  const require = (ok: boolean, message: string) => {
    if (!ok) throw Error(message);
  };
  function allocations(
    currency: string,
    rows: { obligation: string; amount: string }[],
    budget: bigint,
  ) {
    require(rows.reduce((s, a) => s + units(a.amount), 0n) <=
      budget, "Allocations exceed this receipt.");
    const totals = new Map<string, bigint>();
    for (const a of rows) {
      const o = l.obligations.find((o) => o.id === a.obligation);
      require(!!o &&
        o.currency ===
          currency, "Choose an obligation in the receipt currency.");
      totals.set(
        a.obligation,
        (totals.get(a.obligation) || 0n) + units(a.amount),
      );
    }
    for (const [key, value] of totals) {
      const o = l.obligations.find((o) => o.id === key)!;
      require(value <=
        outstanding(l, o), "Allocation exceeds the outstanding balance.");
    }
  }
  switch (command.type) {
    case "obligation":
      l.obligations.push({ ...command, id, disputed: false });
      break;
    case "receipt":
      require(command.date <= day(), "Use the actual receipt date.");
      require(!command.reference ||
        !l.receipts.some(
          (r) =>
            !r.reversed &&
            r.reference === command.reference &&
            r.payer === command.payer &&
            r.currency === command.currency,
        ), "This payment reference is already recorded.");
      allocations(command.currency, command.allocations, units(command.amount));
      l.receipts.push({
        ...command,
        id,
        reversed: false,
        confirmation: "Self-reported",
      });
      break;
    case "allocate": {
      const r = l.receipts.find((r) => r.id === command.receipt);
      require(!!r && !r.reversed, "Choose an active receipt.");
      if (r) {
        allocations(r.currency, command.allocations, unallocated(r));
        r.allocations.push(...command.allocations);
      }
      break;
    }
    case "reverse": {
      const r = l.receipts.find((r) => r.id === command.receipt);
      require(!!r && !r.reversed, "Choose an active receipt.");
      if (r) {
        r.reversed = true;
        r.reason = command.reason;
      }
      break;
    }
    case "adjust": {
      const o = l.obligations.find((o) => o.id === command.obligation);
      require(!!o, "Choose an obligation.");
      if (o)
        require(command.kind === "Increase" ||
          units(command.amount) <=
            outstanding(l, o), "Adjustment exceeds the outstanding balance.");
      l.adjustments.push({ ...command, id });
      break;
    }
    case "dispute": {
      const o = l.obligations.find((o) => o.id === command.obligation);
      require(!!o, "Choose an obligation.");
      if (o) o.disputed = command.open;
      break;
    }
    case "expense":
      require(command.date <= day(), "Use the actual expense date.");
      l.expenses.push({ ...command, id, voided: false });
      break;
    case "voidExpense": {
      const e = l.expenses.find((e) => e.id === command.expense);
      require(!!e && !e.voided, "Choose an active expense.");
      if (e) e.voided = true;
      break;
    }
    case "invoice": {
      const o = l.obligations.find((o) => o.id === command.obligation);
      require(!!o, "Choose an obligation.");
      const old = l.invoices.find((i) => i.id === command.id);
      require(!old || old.status === "Draft", "Issued invoices are protected.");
      if (!o) break;
      const invoice = {
        ...command,
        status: "Draft" as const,
        version: (old?.version || 0) + 1,
        amount: o.amount,
        currency: o.currency,
        title: o.title,
        due: o.due,
        history: old
          ? [
              ...old.history,
              {
                version: old.version,
                seller: old.seller,
                buyer: old.buyer,
                notes: old.notes,
                number: old.number,
                at,
              },
            ]
          : [],
      };
      l.invoices = l.invoices.filter((i) => i.id !== command.id);
      l.invoices.push(invoice);
      break;
    }
    case "issue": {
      const invoice = l.invoices.find((i) => i.id === command.invoice);
      require(!!invoice &&
        invoice.status === "Draft", "Choose a draft invoice.");
      if (!invoice) break;
      require(!l.invoices.some(
        (i) =>
          i.id !== invoice.id &&
          i.status !== "Draft" &&
          i.number === invoice.number,
      ), "This invoice number has already been issued.");
      require(!l.invoices.some(
        (i) =>
          i.id !== invoice.id &&
          i.status === "Issued" &&
          i.obligation === invoice.obligation,
      ), "This obligation is already invoiced.");
      invoice.status = "Issued";
      invoice.issuedAt = at;
      break;
    }
    case "cancelInvoice": {
      const i = l.invoices.find((i) => i.id === command.invoice);
      require(!!i && i.status === "Issued", "Choose an issued invoice.");
      if (i) {
        i.status = "Cancelled";
        i.reason = command.reason;
      }
      break;
    }
    case "target":
      require(command.start <= command.end, "Check the target period.");
      l.targets = [...l.targets.filter((t) => t.id !== command.id), command];
      break;
    case "benefit":
      l.benefits.push({ ...command, id });
      break;
    case "commission":
      l.commissions.push({ ...command, id, status: "Pending" });
      break;
    case "commissionStatus": {
      const c = l.commissions.find((c) => c.id === command.commission);
      require(!!c, "Choose a commission.");
      if (c) {
        c.status = command.status;
        c.note = command.note;
      }
      break;
    }
    case "forecast":
      l.forecasts.push({ ...command, id });
      break;
  }
  l.events.unshift({ id, action: command.type, at, actor: "Preview Creator" });
  l.revision++;
  return l;
}
