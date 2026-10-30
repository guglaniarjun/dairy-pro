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
import { SalesGrid as Grid } from "./sales-grid";
import { CustomerForm } from "./customer-form";
import {
  currency,
  AccountBalance,
  useSales,
  useSalesWrite,
  SalesSetup,
  SalesTable,
} from "./common";

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
  const [receiptDate, setReceiptDate] = useState(date);
  const [amount, setAmount] = useState("");
  const receiptQuery = useSales(receiptDate);
  const receiptData = receiptQuery.data;
  const selected = receiptData?.customers.find((c: any) => c.id === customer);
  return (
    <div className="space-y-5">
      <Panel
        title="Receive payment"
        description="Receive money at any time. Oldest dues are cleared first and the remainder becomes advance for future purchases."
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
            ) {
              form.reset();
              setAmount("");
            }
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
                label: `${c.name} — ${Number(c.balance) < 0 ? "Advance" : "Due"} ${currency(Math.abs(Number(c.balance)))}`,
              }))}
            />
            {selected && (
              <p>
                Account as of {receiptDate}:{" "}
                <AccountBalance balance={selected.balance} />
              </p>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <InputField
                label="Receipt date"
                name="date"
                type="date"
                required
                value={receiptDate}
                onChange={(e: any) => {
                  if (e.target.value) setReceiptDate(e.target.value);
                }}
                max={farmDay()}
              />
              <InputField
                label="Amount (₹)"
                name="amount"
                value={amount}
                onChange={(e: any) => setAmount(e.target.value)}
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
                options={modeOptions.filter((m) => m.value !== "credit")}
              />
              <InputField
                label="Payment reference"
                name="reference"
                maxLength={150}
              />
            </div>
            {write.message}
            {selected && Number(amount) > 0 && (
              <p className="text-sm">
                Balance after receipt:{" "}
                <AccountBalance
                  balance={decimal(cents(selected.balance) - cents(amount))}
                />
              </p>
            )}
            {receiptQuery.error && (
              <p role="alert">
                Unable to load account balance. Refresh and try again.
              </p>
            )}
            <Button
              type="submit"
              disabled={!customer || !selected || receiptQuery.isFetching}
            >
              Receive payment
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
          {query.canManage && (
            <Button variant="outline" onClick={() => setTab("payments")}>
              Receive payment
            </Button>
          )}
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
                    "Customer advances",
                    currency(
                      data.customers.reduce(
                        (n: number, c: any) => n + Number(c.advance),
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
                        ["payments", "Receive payment"],
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
