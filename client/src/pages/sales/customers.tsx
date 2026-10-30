import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Panel, InputField } from "@/components/farm-forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CustomerForm } from "./customer-form";
import { paymentLabel } from "@shared/sales";
import {
  AccountBalance,
  currency,
  useSales,
  SalesSetup,
  SalesTable,
} from "./common";
export default function CustomersPage() {
  const query = useSales();
  const [editing, setEditing] = useState<any>(null),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(
      new URLSearchParams(location.search).get("customer") || "",
    );
  const ledger = useQuery<any>({
    queryKey: [`/api/sales/customers/${selected}`],
    enabled: !!selected && query.canView,
  });
  if (!query.canView)
    return (
      <p className="p-6">
        Sales access is required. Ask your farm admin to enable it.
      </p>
    );
  if (query.isLoading) return <p className="p-6">Loading customers…</p>;
  if (query.error)
    return (
      <p role="alert" className="p-6">
        {query.error.message}
      </p>
    );
  const data = query.data;
  return (
    <div className="max-w-7xl p-4 md:p-6 mx-auto space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customer Details</h1>
          <p className="text-muted-foreground">
            Customer accounts, advance balances, payment terms and delivery
            defaults.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sales">
            <Button variant="outline">Sales</Button>
          </Link>
          {query.canManage && (
            <Button onClick={() => setEditing({})}>Add customer</Button>
          )}
        </div>
      </div>
      {!data.products.length && query.canManage && <SalesSetup />}
      <Panel title={`${data.customers.length} customers`}>
        <InputField
          label="Find customer"
          placeholder="Search name or phone"
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                {[
                  "Customer",
                  "Phone",
                  "Default item",
                  "Quantity / rate",
                  "Payment",
                  "Account balance",
                  "",
                ].map((h, i) => (
                  <th className="p-3 border-b" key={i}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.customers
                .filter((c: any) =>
                  `${c.name} ${c.phone}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((c: any) => {
                  const p =
                    data.products.find(
                      (p: any) => p.id === c.defaultProductId,
                    ) || data.products.find((p: any) => p.isMilk);
                  return (
                    <tr key={c.id} className="border-b">
                      <td className="p-3">
                        <button
                          className="text-primary font-medium underline"
                          onClick={() => setSelected(c.id)}
                        >
                          {c.name}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {!c.active
                            ? "Inactive"
                            : c.daily
                              ? "Daily customer"
                              : "Occasional customer"}
                        </p>
                      </td>
                      <td className="p-3">{c.phone || "—"}</td>
                      <td className="p-3">{p?.name || "Milk"}</td>
                      <td className="p-3">
                        {c.defaultQuantity || "—"} {p?.unit} /{" "}
                        {currency(c.defaultRate ?? p?.defaultRate ?? 0)}
                      </td>
                      <td className="p-3 capitalize">
                        {paymentLabel(c.paymentMode)}
                        <p className="text-xs text-muted-foreground">
                          {c.paymentTerm === "monthly"
                            ? "Due at month-end"
                            : c.paymentTerm === "days"
                              ? `Due after ${c.paymentDays} days`
                              : "Due immediately"}
                        </p>
                      </td>
                      <td className="p-3 font-medium">
                        <AccountBalance balance={c.balance} />
                        {Number(c.overdue) > 0 && (
                          <p className="text-xs text-red-700 dark:text-red-400">
                            Overdue {currency(c.overdue)}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        {query.canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(c)}
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!data.customers.length && (
          <p className="text-muted-foreground">
            Add your regular customers once. They will appear in the daily sales
            grid.
          </p>
        )}
      </Panel>
      {selected && (
        <Panel title={ledger.data?.customer.name || "Customer ledger"}>
          {ledger.isLoading ? (
            <p>Loading ledger…</p>
          ) : ledger.error ? (
            <p role="alert">{ledger.error.message}</p>
          ) : (
            <>
              <p>
                {ledger.data?.customer.address} · {ledger.data?.customer.phone}
              </p>
              <div className="flex flex-wrap gap-5 items-center">
                <AccountBalance balance={ledger.data?.balance || 0} />
                <span className="text-sm text-muted-foreground">
                  As of {ledger.data?.asOf}
                </span>
                {Number(ledger.data?.overdue) > 0 && (
                  <span className="text-sm text-red-700 dark:text-red-400">
                    Overdue {currency(ledger.data.overdue)}
                  </span>
                )}
              </div>
              <h3 className="font-medium">Account ledger</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Date",
                        "Transaction",
                        "Sale",
                        "Payment received",
                        "Advance used",
                        "Mode / reference",
                        "Running balance",
                      ].map((h) => (
                        <th key={h} className="p-3 border-b whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.data?.ledger.map((r: any) => (
                      <tr key={`${r.type}:${r.id}`} className="border-b">
                        <td className="p-3 whitespace-nowrap">{r.date}</td>
                        <td className="p-3">{r.description}</td>
                        <td className="p-3">
                          {Number(r.debit) ? currency(r.debit) : "—"}
                        </td>
                        <td className="p-3">
                          {Number(r.credit) ? currency(r.credit) : "—"}
                        </td>
                        <td className="p-3 text-emerald-700 dark:text-emerald-400">
                          {Number(r.advanceApplied)
                            ? currency(r.advanceApplied)
                            : "—"}
                        </td>
                        <td className="p-3">
                          {paymentLabel(r.mode)}
                          <p className="text-xs text-muted-foreground">
                            {r.reference}
                          </p>
                        </td>
                        <td className="p-3">
                          <AccountBalance balance={r.balance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!ledger.data?.ledger.length && (
                <p className="text-muted-foreground">
                  No sales or payments yet. You can receive an advance before
                  the first sale.
                </p>
              )}
              <details>
                <summary className="cursor-pointer font-medium">
                  Sales and settlement details
                </summary>
                <SalesTable entries={ledger.data?.entries} />
              </details>
              <h3 className="font-medium">Payment receipts</h3>
              {ledger.data?.payments.map((p: any) => (
                <p key={p.id} className="text-sm">
                  {p.date} · {currency(p.amount)} · {paymentLabel(p.mode)} ·{" "}
                  {p.reference}
                </p>
              ))}
              {query.canManage && (
                <Link href={`/sales?tab=payments&customer=${selected}`}>
                  <Button>Receive payment</Button>
                </Link>
              )}
            </>
          )}
        </Panel>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit customer" : "Add customer"}
            </DialogTitle>
            <DialogDescription>
              Save customer details and defaults for faster daily entry.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <CustomerForm
              key={editing.id || "new"}
              customer={editing.id ? editing : undefined}
              products={data.products}
              onSaved={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
