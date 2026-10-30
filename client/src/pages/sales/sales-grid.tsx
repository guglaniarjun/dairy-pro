import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Panel,
  InputField,
  SelectField,
  control,
} from "@/components/farm-forms";
import {
  cents,
  decimal,
  lineTotal,
  modeOptions,
  paymentLabel,
} from "@shared/sales";
import { AccountBalance, currency, useSalesWrite } from "./common";

function defaults(customer: any, products: any[]) {
  const product =
    products.find((p) => p.id === customer.defaultProductId && p.active) ||
    products.find((p) => p.isMilk);
  return {
    customerId: customer.id,
    productId: product?.id || "",
    quantity: customer.defaultQuantity || "",
    rate:
      customer.defaultRate != null &&
      (!customer.defaultProductId || customer.defaultProductId === product?.id)
        ? customer.defaultRate
        : product?.defaultRate || "",
    paymentMode:
      customer.paymentMode === "monthly_credit"
        ? "credit"
        : customer.paymentMode || "credit",
    receivedAmount: "",
    reference: "",
    notes: "",
  };
}
function preview(customer: any, row: any) {
  const total = lineTotal(row.quantity || 0, row.rate || 0);
  const balance = cents(customer.balance || 0);
  const advance = Math.min(total, Math.max(0, -balance));
  const received =
    row.paymentMode === "credit"
      ? 0
      : row.receivedAmount === ""
        ? total - advance
        : cents(row.receivedAmount);
  return { total, advance, received, balance: balance + total - received };
}
export function SalesGrid({ data, date, individual = false }: any) {
  const write = useSalesWrite();
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const customers = data.customers.filter(
    (c: any) => c.active && (individual ? c.id === customerId : c.daily),
  );
  const saved = (id: string) =>
    !individual &&
    data.entries.find((e: any) => e.customerId === id && e.source === "daily");
  const get = (c: any) => drafts[c.id] || defaults(c, data.products);
  const update = (c: any, key: string, value: string) => {
    const row = { ...get(c), [key]: value };
    if (key === "productId")
      row.rate =
        (value === c.defaultProductId ||
          (!c.defaultProductId &&
            data.products.find((p: any) => p.id === value)?.isMilk)) &&
        c.defaultRate != null
          ? c.defaultRate
          : data.products.find((p: any) => p.id === value)?.defaultRate || "";
    if (key === "paymentMode") row.receivedAmount = "";
    setDrafts((old) => ({ ...old, [c.id]: row }));
  };
  const entries = customers
    .filter((c: any) => !saved(c.id) && Number(get(c).quantity) > 0)
    .map((c: any) => ({
      ...get(c),
      receivedAmount: decimal(preview(c, get(c)).received),
      expectedBalance: c.balance,
    }));
  const total = entries.reduce(
    (n: number, r: any) => n + lineTotal(r.quantity, r.rate),
    0,
  );
  const received = entries.reduce(
    (n: number, r: any) => n + cents(r.receivedAmount),
    0,
  );
  return (
    <Panel
      title={individual ? "Individual sale" : "Daily customer sales"}
      description="Advance is used automatically. Choose the actual payment mode when collecting money, or Credit / Pay later. Blank or zero quantities are skipped."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await write.save("/api/sales/entries", {
              date,
              source: individual ? "individual" : "daily",
              entries,
            })
          ) {
            setDrafts({});
            if (individual) setCustomerId("");
          }
        }}
      >
        <fieldset disabled={write.busy} className="space-y-4 min-w-0">
          {individual ? (
            <SelectField
              label="Customer"
              required
              value={customerId}
              onChange={(e: any) => setCustomerId(e.target.value)}
              options={data.customers
                .filter((c: any) => c.active)
                .map((c: any) => ({ value: c.id, label: c.name }))}
            />
          ) : (
            <InputField
              label="Find a daily customer"
              value={search}
              placeholder="Search customer name"
              onChange={(e: any) => setSearch(e.target.value)}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Balances are as of {date}. Receipts clear the oldest unpaid sales
            first; extra money stays as advance.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm text-left min-w-[1270px]">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "Customer / account",
                    "Item",
                    "Quantity",
                    "Rate (₹)",
                    "Total",
                    "Advance applied",
                    "Payment mode",
                    "Received now (₹)",
                    "Balance after saving",
                    "Reference",
                  ].map((h) => (
                    <th className="p-3 whitespace-nowrap" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers
                  .filter((c: any) =>
                    c.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((c: any) => {
                    const row = get(c),
                      done = saved(c.id),
                      p = preview(c, row);
                    const product = data.products.find(
                      (p: any) => p.id === row.productId,
                    );
                    const label = (field: string) => `${c.name}: ${field}`;
                    if (done)
                      return (
                        <tr key={c.id} className="border-t bg-muted/20">
                          <td className="p-3">
                            <Link
                              href={`/customers?customer=${c.id}`}
                              className="font-medium underline"
                            >
                              {c.name}
                            </Link>
                            <p>
                              <AccountBalance balance={c.balance} />
                            </p>
                          </td>
                          <td className="p-3">{done.productName}</td>
                          <td className="p-3">
                            {done.quantity} {done.unit}
                          </td>
                          <td className="p-3">{done.rate}</td>
                          <td className="p-3">{currency(done.totalAmount)}</td>
                          <td className="p-3 text-emerald-700 dark:text-emerald-400">
                            {currency(done.advanceApplied)}
                          </td>
                          <td className="p-3">
                            {paymentLabel(done.paymentMode)}
                          </td>
                          <td className="p-3">
                            {currency(done.receivedAmount)}
                          </td>
                          <td className="p-3 text-muted-foreground" colSpan={2}>
                            Saved · use Individual entry for another delivery
                          </td>
                        </tr>
                      );
                    return (
                      <tr key={c.id} className="border-t align-top">
                        <td className="p-3 min-w-40">
                          <Link
                            href={`/customers?customer=${c.id}`}
                            className="font-medium underline"
                          >
                            {c.name}
                          </Link>
                          <p className="mt-1">
                            <AccountBalance balance={c.balance} />
                          </p>
                        </td>
                        <td className="p-2">
                          <select
                            className={`${control} min-w-28`}
                            aria-label={label("item")}
                            value={row.productId}
                            onChange={(e) =>
                              update(c, "productId", e.target.value)
                            }
                          >
                            {data.products
                              .filter((p: any) => p.active)
                              .map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            className={`${control} w-24`}
                            aria-label={label("quantity")}
                            type="number"
                            min="0"
                            max="100000"
                            step="0.01"
                            value={row.quantity}
                            onChange={(e) =>
                              update(c, "quantity", e.target.value)
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {product?.unit}
                          </span>
                        </td>
                        <td className="p-2">
                          <input
                            className={`${control} w-24`}
                            aria-label={label("rate")}
                            type="number"
                            min={Number(row.quantity) > 0 ? "0.01" : "0"}
                            max="100000"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) => update(c, "rate", e.target.value)}
                          />
                        </td>
                        <td className="p-3 font-semibold whitespace-nowrap">
                          {currency(decimal(p.total))}
                        </td>
                        <td className="p-3 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {currency(decimal(p.advance))}
                          {p.total > 0 && p.advance === p.total && (
                            <p className="text-xs">Paid from advance</p>
                          )}
                        </td>
                        <td className="p-2">
                          <select
                            className={`${control} min-w-40`}
                            aria-label={label("payment mode")}
                            value={row.paymentMode}
                            onChange={(e) =>
                              update(c, "paymentMode", e.target.value)
                            }
                          >
                            {modeOptions.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.value === "credit" &&
                                p.total > 0 &&
                                p.advance === p.total
                                  ? "Paid from advance"
                                  : m.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            className={`${control} w-28`}
                            aria-label={label("received now")}
                            type="number"
                            min="0"
                            max="100000000"
                            step="0.01"
                            disabled={row.paymentMode === "credit"}
                            value={
                              row.paymentMode !== "credit" &&
                              row.receivedAmount !== ""
                                ? row.receivedAmount
                                : decimal(p.received)
                            }
                            onChange={(e) =>
                              update(c, "receivedAmount", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-3">
                          <AccountBalance balance={decimal(p.balance)} />
                          {Number(row.quantity) <= 0 && (
                            <p className="text-xs text-muted-foreground">
                              Skipped
                            </p>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            className={`${control} w-32`}
                            aria-label={label("payment reference")}
                            maxLength={150}
                            placeholder="Optional"
                            value={row.reference}
                            onChange={(e) =>
                              update(c, "reference", e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!customers.length && (
            <p className="text-muted-foreground">
              {individual
                ? "Choose a customer above."
                : "Add a customer and enable ‘Show in daily sales grid’."}
            </p>
          )}
          <div className="flex flex-wrap gap-5 text-sm">
            <span>{entries.length} entries to save</span>
            <strong>Sales {currency(decimal(total))}</strong>
            <span>Receiving now {currency(decimal(received))}</span>
          </div>
          {search && (
            <p className="text-sm text-muted-foreground">
              Saving includes all entered rows, including customers hidden by
              this search.
            </p>
          )}
          {write.message}
          <Button type="submit" disabled={!entries.length || write.busy}>
            {write.busy
              ? "Saving…"
              : individual
                ? "Save sale"
                : `Save ${entries.length} daily sales`}
          </Button>
        </fieldset>
      </form>
    </Panel>
  );
}
