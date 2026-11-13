import { cents } from "./sales";
import { customerAccount } from "./customer-account";
/** Rebuild dated views from downloaded records when the requested day was never opened online. */
export function offlineSalesView(raw: any, date: string) {
  const sales = raw.sales || [],
    payments = raw.payments || [],
    movements = raw.movements || [];
  const accounts = (raw.customers || []).map((c: any) => ({
    customer: c,
    account: customerAccount(
      sales.filter((s: any) => s.customerId === c.id),
      payments.filter((p: any) => p.customerId === c.id),
      date,
    ),
  }));
  const entries = accounts.flatMap((a: any) => a.account.entries);
  return {
    date,
    offline: true,
    stockAsOf: raw.date,
    products: (raw.products || []).map((p: any) => ({
      ...p,
      stock: p.isMilk
        ? Number(raw.milkAvailable || 0)
        : movements
            .filter((m: any) => m.productId === p.id && m.date <= date)
            .reduce((n: number, m: any) => n + cents(m.quantity), 0) / 100,
    })),
    customers: accounts.map(({ customer, account }: any) => ({
      ...customer,
      balance: account.balance,
      outstanding: account.outstanding,
      advance: account.advance,
      overdue: account.overdue,
    })),
    entries: entries.filter((s: any) => s.date === date),
    outstandingSales: entries.filter((s: any) => cents(s.outstanding) > 0),
    payments: payments
      .filter((p: any) => p.date === date)
      .map((p: any) => ({
        ...p,
        customerName: raw.customers.find((c: any) => c.id === p.customerId)
          ?.name,
        productName:
          sales.find((s: any) => s.id === p.saleId)?.productName ||
          "Customer account",
      })),
    stockMovements: movements
      .filter((m: any) => m.date === date)
      .map((m: any) => ({
        ...m,
        productName: raw.products.find((p: any) => p.id === m.productId)?.name,
      })),
  };
}
