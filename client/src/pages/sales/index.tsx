import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Panel,
  InputField,
  SelectField,
  control,
} from "@/components/farm-forms";
import { farmDay } from "@shared/care";
import { cents, decimal, lineTotal, modeOptions } from "@shared/sales";
import { CustomerForm } from "./customer-form";
import {
  currency,
  useSales,
  useSalesWrite,
  SalesSetup,
  SalesTable,
} from "./common";

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
    paymentType: customer.paymentType,
    paymentMode: customer.paymentMode,
    paidAmount: "0",
    reference: "",
    notes: "",
  };
}
function Grid({ data, date, individual = false }: any) {
  const write = useSalesWrite();
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const customers = data.customers.filter(
    (c: any) => c.active && (individual ? c.id === customerId : c.daily),
  );
  const saved = (id: string) =>
    !individual &&
    data.entries.some((e: any) => e.customerId === id && e.source === "daily");
  const get = (c: any) => drafts[c.id] || defaults(c, data.products);
  const update = (customer: any, key: string, value: string) => {
    const row = { ...get(customer), [key]: value };
    if (key === "productId")
      row.rate =
        (value === customer.defaultProductId ||
          (!customer.defaultProductId &&
            data.products.find((p: any) => p.id === value)?.isMilk)) &&
        customer.defaultRate != null
          ? customer.defaultRate
          : data.products.find((p: any) => p.id === value)?.defaultRate || "";
    if (key === "paymentType") {
      row.paymentMode = value === "credit" ? "monthly_credit" : "cash";
      row.paidAmount = "0";
    }
    setDrafts((old) => ({ ...old, [customer.id]: row }));
  };
  const entries = customers
    .filter(
      (c: any) =>
        !saved(c.id) && get(c).quantity !== "" && Number(get(c).quantity) !== 0,
    )
    .map(get);
  const total = entries.reduce(
    (n: number, r: any) => n + lineTotal(r.quantity, r.rate),
    0,
  );
  const paid = entries.reduce(
    (n: number, r: any) =>
      n +
      (r.paymentType === "cash"
        ? lineTotal(r.quantity, r.rate)
        : cents(r.paidAmount || 0)),
    0,
  );
  return (
    <Panel
      title={individual ? "Individual sale" : "Daily customer sales"}
      description={
        individual
          ? "Choose any active customer. Use this for an extra delivery or another product."
          : "Enter quantities for today's customers. Blank or zero quantities are skipped. Cash means paid in full; choose the actual payment mode separately."
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await write.save("/api/sales/entries", {
            date,
            source: individual ? "individual" : "daily",
            entries,
          });
          if (result) {
            setDrafts({});
            if (individual) setCustomerId("");
          }
        }}
      >
        <fieldset disabled={write.busy} className="space-y-4">
          {individual ? (
            <SelectField
              label="Customer"
              value={customerId}
              required
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
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm text-left min-w-[1180px]">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "Customer",
                    "Item",
                    "Quantity",
                    "Rate (₹)",
                    "Total",
                    "Cash / credit",
                    "Payment mode",
                    "Paid now (₹)",
                    "Reference",
                    "Status",
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
                      product = data.products.find(
                        (p: any) => p.id === row.productId,
                      );
                    const savedRow = done
                      ? data.entries.find(
                          (e: any) =>
                            e.customerId === c.id && e.source === "daily",
                        )
                      : null;
                    if (savedRow)
                      return (
                        <tr
                          className="border-t bg-emerald-50/40 dark:bg-emerald-950/10"
                          key={c.id}
                        >
                          <td className="p-3 font-medium">{c.name}</td>
                          <td className="p-3">{savedRow.productName}</td>
                          <td className="p-3">
                            {savedRow.quantity} {savedRow.unit}
                          </td>
                          <td className="p-3">{savedRow.rate}</td>
                          <td className="p-3">
                            {currency(savedRow.totalAmount)}
                          </td>
                          <td className="p-3 capitalize">
                            {savedRow.paymentType}
                          </td>
                          <td className="p-3">
                            {savedRow.paymentMode.replaceAll("_", " ")}
                          </td>
                          <td className="p-3">{savedRow.paidAmount}</td>
                          <td></td>
                          <td className="p-3 text-emerald-700">Saved</td>
                        </tr>
                      );
                    const label = (field: string) => `${c.name}: ${field}`;
                    return (
                      <tr className="border-t" key={c.id}>
                        <td className="p-3 font-medium min-w-36">{c.name}</td>
                        <td className="p-2">
                          <select
                            className={`${control} min-w-32`}
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
                            type="number"
                            min="0"
                            max="100000"
                            step="0.01"
                            aria-label={label("quantity")}
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
                            type="number"
                            min={Number(row.quantity) > 0 ? "0.01" : "0"}
                            max="100000"
                            step="0.01"
                            aria-label={label("rate")}
                            value={row.rate}
                            onChange={(e) => update(c, "rate", e.target.value)}
                          />
                        </td>
                        <td className="p-3 font-semibold whitespace-nowrap">
                          {currency(
                            decimal(
                              lineTotal(row.quantity || 0, row.rate || 0),
                            ),
                          )}
                        </td>
                        <td className="p-2">
                          <select
                            aria-label={label("terms")}
                            className={`${control} w-28`}
                            value={row.paymentType}
                            onChange={(e) =>
                              update(c, "paymentType", e.target.value)
                            }
                          >
                            <option value="cash">Cash</option>
                            <option value="credit">Credit</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            className={`${control} min-w-36`}
                            aria-label={label("payment mode")}
                            value={row.paymentMode}
                            onChange={(e) =>
                              update(c, "paymentMode", e.target.value)
                            }
                          >
                            {modeOptions
                              .filter(
                                (m) =>
                                  row.paymentType === "credit" ||
                                  m.value !== "monthly_credit",
                              )
                              .map((m) => (
                                <option value={m.value} key={m.value}>
                                  {m.label}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="p-2">
                          {row.paymentType === "cash" ? (
                            <span className="text-muted-foreground">
                              Full amount
                            </span>
                          ) : (
                            <input
                              className={`${control} w-24`}
                              aria-label={label("paid now")}
                              type="number"
                              min="0"
                              max={decimal(
                                lineTotal(row.quantity || 0, row.rate || 0),
                              )}
                              step="0.01"
                              value={row.paidAmount}
                              onChange={(e) =>
                                update(c, "paidAmount", e.target.value)
                              }
                            />
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
                        <td className="p-3 text-muted-foreground">
                          {Number(row.quantity) > 0 ? "Ready" : "Skipped"}
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
                : "No active daily customers. Add a customer and enable ‘Show in daily sales grid’."}
            </p>
          )}
          <div className="flex flex-wrap gap-5 text-sm">
            <span>{entries.length} entries to save</span>
            <strong>Total {currency(decimal(total))}</strong>
            <span>Paid now {currency(decimal(paid))}</span>
            <span>Credit {currency(decimal(total - paid))}</span>
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

function ItemsStock({ data, date }: any) {
  const write = useSalesWrite(),
    receive = useSalesWrite(),
    add = useSalesWrite();
  const [editing, setEditing] = useState<any>(null),
    [kind, setKind] = useState("opening");
  return (
    <div className="space-y-5">
      <Panel
        title="Items & default rates"
        description="Rates apply to new entries. Existing sales keep the rate at which they were saved."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                {[
                  "Item",
                  "Unit",
                  "Default rate",
                  `Available on ${date}`,
                  "",
                ].map((h, i) => (
                  <th key={i} className="p-3 border-b">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.products.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="p-3">
                    {p.name}
                    {!p.active && " (inactive)"}
                  </td>
                  <td className="p-3">{p.unit}</td>
                  <td className="p-3">{currency(p.defaultRate)}</td>
                  <td className="p-3">
                    {p.stock} {p.unit}
                  </td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(p)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Milk stock comes from saleable milk production and opening stock, less
          sales and other uses. Other products use the stock receipts below.
        </p>
      </Panel>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel
          title="Receive / produce product stock"
          description="Enter an opening balance, purchased stock or a production batch. For a production batch, record the actual litres of milk used."
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              if (
                await receive.save(
                  "/api/sales/stock",
                  Object.fromEntries(new FormData(form)),
                )
              ) {
                form.reset();
                setKind("opening");
              }
            }}
          >
            <fieldset disabled={receive.busy} className="space-y-4">
              <SelectField
                label="Product"
                name="productId"
                required
                options={data.products
                  .filter((p: any) => !p.isMilk && p.active)
                  .map((p: any) => ({
                    value: p.id,
                    label: `${p.name} (${p.unit})`,
                  }))}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <InputField
                  label="Date"
                  name="date"
                  type="date"
                  required
                  defaultValue={date}
                  max={farmDay()}
                />
                <InputField
                  label="Quantity"
                  name="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <SelectField
                label="Stock source"
                name="kind"
                value={kind}
                onChange={(e: any) => setKind(e.target.value)}
                options={[
                  { value: "opening", label: "Opening balance" },
                  { value: "purchase", label: "Purchased stock" },
                  { value: "production", label: "Produced at farm" },
                ]}
              />
              {kind === "production" && (
                <InputField
                  label="Milk used (litres)"
                  name="milkUsed"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              )}
              <InputField
                label="Source / batch reference"
                name="notes"
                required
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                For purchased stock, enter the purchase expense separately in
                Finances.
              </p>
              {receive.message}
              <Button type="submit">
                {receive.busy ? "Saving…" : "Add stock"}
              </Button>
            </fieldset>
          </form>
        </Panel>
        <Panel title="Add another item">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              if (
                await add.save(
                  "/api/sales/products",
                  Object.fromEntries(new FormData(form)),
                )
              )
                form.reset();
            }}
          >
            <fieldset disabled={add.busy} className="space-y-4">
              <InputField
                label="Item name"
                name="name"
                required
                maxLength={80}
              />
              <SelectField
                label="Unit"
                name="unit"
                required
                options={["litre", "kg", "piece", "pack"]}
              />
              <InputField
                label="Default rate (₹)"
                name="defaultRate"
                required
                type="number"
                step="0.01"
                min="0"
              />
              {add.message}
              <Button type="submit">Add item</Button>
            </fieldset>
          </form>
        </Panel>
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit item</DialogTitle>
            <DialogDescription>
              Update the default rate or stop offering this item.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const d: any = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                if (
                  await write.save(
                    `/api/sales/products/${editing.id}`,
                    {
                      ...d,
                      unit: editing.unit,
                      active: editing.isMilk || d.active === "on",
                    },
                    "PATCH",
                  )
                )
                  setEditing(null);
              }}
            >
              <fieldset disabled={write.busy} className="space-y-4">
                <InputField
                  label="Item name"
                  name="name"
                  required
                  defaultValue={editing.name}
                />
                <InputField
                  label={`Default rate per ${editing.unit} (₹)`}
                  name="defaultRate"
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing.defaultRate}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    disabled={editing.isMilk}
                    defaultChecked={editing.active}
                  />{" "}
                  Active item
                </label>
                {write.message}
                <Button type="submit">Save item</Button>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Payments({ data, date }: any) {
  const write = useSalesWrite();
  const [customer, setCustomer] = useState(
    new URLSearchParams(location.search).get("customer") || "",
  );
  const selected = data.customers.find((c: any) => c.id === customer);
  return (
    <div className="space-y-5">
      <Panel
        title="Collect customer payment"
        description="Payments clear the oldest outstanding sales first. A receipt reduces credit due; it does not add sales revenue again."
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (
              await write.save("/api/sales/payments", {
                ...Object.fromEntries(new FormData(form)),
                customerId: customer,
              })
            )
              form.reset();
          }}
        >
          <fieldset disabled={write.busy} className="space-y-4">
            <SelectField
              label="Customer"
              required
              value={customer}
              onChange={(e: any) => setCustomer(e.target.value)}
              options={data.customers.map((c: any) => ({
                value: c.id,
                label: `${c.name} — ${currency(c.outstanding)} due`,
              }))}
            />
            {selected && (
              <p>
                Outstanding as of {date}:{" "}
                <strong>{currency(selected.outstanding)}</strong>
              </p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <InputField
                label="Receipt date"
                name="date"
                type="date"
                required
                defaultValue={date}
                max={farmDay()}
              />
              <InputField
                label="Amount (₹)"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
              <SelectField
                label="Payment mode"
                name="mode"
                required
                defaultValue="cash"
                options={modeOptions.filter(
                  (m) => m.value !== "monthly_credit",
                )}
              />
              <InputField
                label="Payment reference"
                name="reference"
                maxLength={150}
              />
            </div>
            {write.message}
            <Button type="submit" disabled={!customer}>
              Record payment
            </Button>
          </fieldset>
        </form>
      </Panel>
      <Panel title="Outstanding sales">
        <SalesTable
          entries={data.outstandingSales.filter(
            (s: any) => !customer || s.customerId === customer,
          )}
        />
      </Panel>
      <Panel title={`Receipts on ${date}`}>
        <div className="space-y-2">
          {data.payments.map((p: any) => (
            <p className="text-sm" key={p.id}>
              {p.customerName} · {currency(p.amount)} ·{" "}
              {p.mode.replaceAll("_", " ")} · {p.reference || "No reference"}
            </p>
          ))}
          {!data.payments.length && (
            <p className="text-muted-foreground">
              No payments received on this date.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

export default function SalesPage() {
  const [date, setDate] = useState(farmDay()),
    [tab, setTab] = useState(
      new URLSearchParams(location.search).get("tab") || "daily",
    ),
    [addCustomer, setAddCustomer] = useState(false);
  const query = useSales(date);
  if (!query.canView)
    return (
      <p className="p-6">
        Sales access is required. Ask your farm admin to enable it.
      </p>
    );
  const data = query.data;
  return (
    <div className="max-w-[1500px] mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground">
            Daily milk and dairy product sales, customer payments and stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/customers">
            <Button variant="outline">Customer Details</Button>
          </Link>
          {query.canManage && (
            <Button onClick={() => setAddCustomer(true)}>Add customer</Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <InputField
          label="Sales date"
          type="date"
          value={date}
          max={farmDay()}
          required
          onChange={(e: any) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
        <Link href={`/daily-report?date=${date}`}>
          <Button variant="outline">Daily report</Button>
        </Link>
      </div>
      {query.isLoading && <p>Loading sales…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {data && (
        <>
          {!data.products.length ? (
            query.canManage ? (
              <SalesSetup onSetup={() => setTab("items")} />
            ) : (
              <p>Ask your farm admin to set up sales items.</p>
            )
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  [
                    "Sales for the day",
                    currency(
                      data.entries.reduce(
                        (n: number, s: any) => n + Number(s.totalAmount),
                        0,
                      ),
                    ),
                  ],
                  [
                    "Payments received",
                    currency(
                      data.payments.reduce(
                        (n: number, p: any) => n + Number(p.amount),
                        0,
                      ),
                    ),
                  ],
                  [
                    "Outstanding as of date",
                    currency(
                      data.customers.reduce(
                        (n: number, c: any) => n + Number(c.outstanding),
                        0,
                      ),
                    ),
                  ],
                  [
                    "Milk available",
                    `${data.products.find((p: any) => p.isMilk)?.stock ?? 0} litres`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="border rounded-xl p-4 bg-card">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-semibold text-xl mt-1">{value}</p>
                  </div>
                ))}
              </div>
              <Tabs
                value={query.canManage ? tab : "history"}
                onValueChange={setTab}
              >
                <TabsList className="flex flex-wrap h-auto justify-start gap-1">
                  {(query.canManage
                    ? [
                        ["daily", "Daily bulk entry"],
                        ["individual", "Individual entry"],
                        ["history", "Sales register"],
                        ["payments", "Payments & credit"],
                        ["items", "Items & stock"],
                      ]
                    : [["history", "Sales register"]]
                  ).map(([value, label]) => (
                    <TabsTrigger key={value} value={value}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {query.canManage && (
                  <>
                    <TabsContent
                      value="daily"
                      forceMount
                      className="data-[state=inactive]:hidden"
                    >
                      <Grid key={`daily:${date}`} data={data} date={date} />
                    </TabsContent>
                    <TabsContent
                      value="individual"
                      forceMount
                      className="data-[state=inactive]:hidden"
                    >
                      <Grid
                        key={`individual:${date}`}
                        data={data}
                        date={date}
                        individual
                      />
                    </TabsContent>
                    <TabsContent value="payments">
                      <Payments key={date} data={data} date={date} />
                    </TabsContent>
                    <TabsContent value="items">
                      <ItemsStock key={date} data={data} date={date} />
                    </TabsContent>
                  </>
                )}
                <TabsContent value="history">
                  <Panel
                    title={`Sales register — ${date}`}
                    description="Saved sales update income, stock and the daily report automatically."
                  >
                    <SalesTable entries={data.entries} />
                  </Panel>
                </TabsContent>
              </Tabs>
            </>
          )}
          <Dialog open={addCustomer} onOpenChange={setAddCustomer}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add customer</DialogTitle>
                <DialogDescription>
                  Regular customers appear in your daily sales grid.
                </DialogDescription>
              </DialogHeader>
              <CustomerForm
                products={data.products}
                onSaved={() => setAddCustomer(false)}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
