import { cents, decimal } from "./sales";

type Sale = {
  id: string;
  date: string;
  createdAt: Date | string;
  totalAmount: string;
  dueDate?: string | null;
  productName: string;
  quantity: string;
  unit: string;
  paymentMode: string;
  notes?: string | null;
};
type Receipt = {
  id: string;
  date: string;
  createdAt: Date | string;
  amount: string;
  mode: string;
  reference?: string | null;
};

// Positive balance means due; negative means advance. Receipts are immutable
// account credits. Allocation is derived in date order so backdated entries and
// historical reports use the same rules without changing receipt evidence.
export function customerAccount<S extends Sale, P extends Receipt>(
  sales: S[],
  receipts: P[],
  asOf = "9999-12-31",
) {
  const entries = sales
    .filter((s) => s.date <= asOf)
    .map((s) => ({
      ...s,
      paid: 0,
      fromAdvance: 0,
    }));
  const events = [
    ...entries.map((sale) => ({ kind: "sale" as const, row: sale })),
    ...receipts
      .filter((p) => p.date <= asOf)
      .map((row) => ({ kind: "payment" as const, row })),
  ].sort(
    (a, b) =>
      a.row.date.localeCompare(b.row.date) ||
      new Date(a.row.createdAt).getTime() -
        new Date(b.row.createdAt).getTime() ||
      (a.kind === b.kind
        ? a.row.id.localeCompare(b.row.id)
        : a.kind === "sale"
          ? -1
          : 1),
  );
  let balance = 0;
  const unpaid: typeof entries = [];
  const advances: { receiptId: string; remaining: number }[] = [];
  const allocations: {
    saleId: string;
    receiptId: string;
    amount: string;
    fromAdvance: boolean;
  }[] = [];
  const ledger = events.map((event) => {
    let debit = 0,
      credit = 0,
      advanceApplied = 0;
    if (event.kind === "sale") {
      const sale = event.row;
      debit = cents(sale.totalAmount);
      let remaining = debit;
      while (remaining > 0 && advances.length) {
        const advance = advances[0];
        const used = Math.min(remaining, advance.remaining);
        sale.paid += used;
        sale.fromAdvance += used;
        advanceApplied += used;
        remaining -= used;
        advance.remaining -= used;
        allocations.push({
          saleId: sale.id,
          receiptId: advance.receiptId,
          amount: decimal(used),
          fromAdvance: true,
        });
        if (!advance.remaining) advances.shift();
      }
      if (remaining) unpaid.push(sale);
    } else {
      const receipt = event.row;
      credit = cents(receipt.amount);
      let remaining = credit;
      while (remaining > 0 && unpaid.length) {
        const sale = unpaid[0];
        const used = Math.min(remaining, cents(sale.totalAmount) - sale.paid);
        sale.paid += used;
        remaining -= used;
        allocations.push({
          saleId: sale.id,
          receiptId: receipt.id,
          amount: decimal(used),
          fromAdvance: false,
        });
        if (sale.paid === cents(sale.totalAmount)) unpaid.shift();
      }
      if (remaining) advances.push({ receiptId: receipt.id, remaining });
    }
    balance += debit - credit;
    return {
      id: event.row.id,
      date: event.row.date,
      type: event.kind,
      description:
        event.kind === "sale"
          ? `${event.row.productName} · ${event.row.quantity} ${event.row.unit}`
          : "Payment received",
      mode: event.kind === "sale" ? event.row.paymentMode : event.row.mode,
      reference:
        event.kind === "payment"
          ? event.row.reference || ""
          : event.row.notes || "",
      debit: decimal(debit),
      credit: decimal(credit),
      advanceApplied: decimal(advanceApplied),
      balance: decimal(balance),
    };
  });
  const settled = entries.map(({ paid, fromAdvance, ...sale }) => ({
    ...sale,
    paidAmount: decimal(paid),
    advanceApplied: decimal(fromAdvance),
    outstanding: decimal(cents(sale.totalAmount) - paid),
  }));
  return {
    balance: decimal(balance),
    outstanding: decimal(Math.max(0, balance)),
    advance: decimal(Math.max(0, -balance)),
    overdue: decimal(
      settled
        .filter((s) => (s.dueDate || s.date) < asOf)
        .reduce((n, s) => n + cents(s.outstanding), 0),
    ),
    entries: settled,
    ledger,
    allocations,
  };
}
