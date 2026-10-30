import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import * as s from "@shared/schema";
import {
  cents,
  decimal,
  lineTotal,
  customerSchema,
  productSchema,
  salesBatchSchema,
  stockReceiptSchema,
  paymentSchema,
} from "@shared/sales";
import { daySchema, farmDay } from "@shared/care";
import { rows, owned, fail, recordEvent, settings } from "./care-service";

// Called inside safeTenantRequest's farm lock and transaction. Never partially save a batch.
export async function setupSales(tenant: string) {
  for (const [name, code, unit] of [
    ["Milk", "milk", "litre"],
    ["Paneer", "paneer", "kg"],
    ["Curd", "curd", "kg"],
    ["Ghee", "ghee", "litre"],
    ["Butter", "butter", "kg"],
    ["Cream", "cream", "litre"],
  ]) {
    await db
      .insert(s.salesProducts)
      .values({ tenantId: tenant, name, code, unit, isMilk: code === "milk" })
      .onConflictDoNothing();
  }
  return rows(s.salesProducts, tenant);
}
export async function saveCustomer(tenant: string, body: unknown, id?: string) {
  const data = customerSchema.parse(body);
  if (id) await owned(s.salesCustomers, tenant, id);
  if (data.defaultProductId)
    await owned(s.salesProducts, tenant, data.defaultProductId);
  if (data.paymentType === "cash" && data.paymentMode === "monthly_credit")
    fail("Monthly credit requires Credit terms");
  const values = {
    ...data,
    defaultQuantity:
      data.defaultQuantity == null
        ? null
        : decimal(cents(data.defaultQuantity)),
    defaultRate:
      data.defaultRate == null ? null : decimal(cents(data.defaultRate)),
  };
  const [result] = id
    ? await db
        .update(s.salesCustomers)
        .set(values)
        .where(eq(s.salesCustomers.id, id))
        .returning()
    : await db
        .insert(s.salesCustomers)
        .values({ ...values, tenantId: tenant })
        .returning();
  return result;
}
export async function saveProduct(tenant: string, body: unknown, id?: string) {
  const data = productSchema.parse(body);
  const old = id ? await owned(s.salesProducts, tenant, id) : null;
  if (old && data.unit !== old.unit)
    fail("The unit cannot change after an item is created");
  if (old?.isMilk && !data.active) fail("Milk must remain active");
  const code = data.name.toLowerCase();
  if (
    (await rows(s.salesProducts, tenant)).some(
      (p) => p.id !== id && p.name.toLowerCase() === code,
    )
  )
    fail("An item with this name already exists", 409);
  const values = { ...data, defaultRate: decimal(cents(data.defaultRate)) };
  const [result] = id
    ? await db
        .update(s.salesProducts)
        .set(values)
        .where(eq(s.salesProducts.id, id))
        .returning()
    : await db
        .insert(s.salesProducts)
        .values({ ...values, tenantId: tenant, code: crypto.randomUUID() })
        .returning();
  return result;
}
export async function milkAvailable(tenant: string, date: string) {
  const [milk, sales, events] = await Promise.all([
    rows(s.milkEntries, tenant),
    rows(s.milkSales, tenant),
    rows(s.farmEvents, tenant),
  ]);
  const produced = milk
    .filter((m) => m.date === date && m.destination !== "discarded")
    .reduce((n, m) => n + cents(m.quantity), 0);
  const sold = sales
    .filter((m) => m.date === date)
    .reduce((n, m) => n + cents(m.quantity), 0);
  const uses = events.filter(
    (e) => e.date === date && e.type === "milk_disposition",
  );
  const opening = uses
    .filter((e) => e.payload.kind === "opening_stock")
    .reduce((n, e) => n + cents(e.payload.quantity), 0);
  const used = uses
    .filter(
      (e) =>
        !["opening_stock", "closing_stock"].includes(e.payload.kind) &&
        !e.payload.milkEntryId,
    )
    .reduce((n, e) => n + cents(e.payload.quantity), 0);
  return (produced + opening - sold - used) / 100;
}
async function takeStock(
  tenant: string,
  product: any,
  date: string,
  quantity: number,
  saleId: string,
  actor: string,
) {
  if (product.isMilk) {
    if (cents(await milkAvailable(tenant, date)) < cents(quantity))
      fail(
        `Insufficient saleable milk on ${date}. Record production or explained opening stock first.`,
        409,
      );
    return;
  }
  const ledger = (await rows(s.productStock, tenant)).filter(
    (l) => l.productId === product.id,
  );
  // Check every later balance too: a backdated sale must not consume stock already sold.
  const days = [...new Set([date, ...ledger.map((l) => l.date)])].sort();
  let balance = 0;
  for (const day of days) {
    balance += ledger
      .filter((l) => l.date === day)
      .reduce((n, l) => n + cents(l.quantity), 0);
    if (day === date) balance -= cents(quantity);
    if (balance < 0)
      fail(
        `Insufficient ${product.name} stock on ${day}. Add product stock first.`,
        409,
      );
  }
  await db
    .insert(s.productStock)
    .values({
      tenantId: tenant,
      productId: product.id,
      date,
      quantity: decimal(-cents(quantity)),
      kind: "sale",
      saleId,
      recordedBy: actor,
    });
}
async function incomeHead(milk: boolean) {
  const code = milk ? "milk-sale" : "dairy-products-sale";
  await db
    .insert(s.incomeHeads)
    .values({
      code,
      name: milk ? "Milk Sales" : "Dairy Product Sales",
      category: milk ? "milk_sale" : "other",
    })
    .onConflictDoNothing();
  const [head] = await db
    .select()
    .from(s.incomeHeads)
    .where(eq(s.incomeHeads.code, code));
  return head.id;
}
export async function saveSales(tenant: string, actor: string, body: unknown) {
  const batch = salesBatchSchema.parse(body);
  if (batch.date > farmDay((await settings(tenant)).timezone))
    fail("Sales cannot be future dated");
  const saved = [];
  for (const entry of batch.entries) {
    const customer = await owned(s.salesCustomers, tenant, entry.customerId);
    const product = await owned(s.salesProducts, tenant, entry.productId);
    if (!customer.active || !product.active)
      fail("Choose an active customer and item");
    const entryKey =
      batch.source === "daily"
        ? `daily:${batch.date}:${customer.id}`
        : crypto.randomUUID();
    if ((await rows(s.dairySales, tenant)).some((r) => r.entryKey === entryKey))
      fail(
        `${customer.name} already has a daily entry for ${batch.date}. Use Individual entry for an additional sale.`,
        409,
      );
    const total = lineTotal(entry.quantity, entry.rate);
    const paid = entry.paymentType === "cash" ? total : cents(entry.paidAmount);
    const saleId = crypto.randomUUID();
    await takeStock(tenant, product, batch.date, entry.quantity, saleId, actor);
    let milkSaleId: string | null = null;
    if (product.isMilk) {
      const [legacy] = await db
        .insert(s.milkSales)
        .values({
          tenantId: tenant,
          date: batch.date,
          buyerName: customer.name,
          quantity: decimal(cents(entry.quantity)),
          pricePerLiter: decimal(cents(entry.rate)),
          totalAmount: decimal(total),
          paymentStatus: paid === total ? "paid" : paid ? "partial" : "pending",
          notes: entry.notes,
        })
        .returning();
      milkSaleId = legacy.id;
    }
    const [sale] = await db
      .insert(s.dairySales)
      .values({
        id: saleId,
        tenantId: tenant,
        entryKey,
        source: batch.source,
        date: batch.date,
        customerId: customer.id,
        customerName: customer.name,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: decimal(cents(entry.quantity)),
        rate: decimal(cents(entry.rate)),
        totalAmount: decimal(total),
        paidAmount: decimal(paid),
        paymentType: entry.paymentType,
        paymentMode: entry.paymentMode,
        milkSaleId,
        notes: entry.notes,
        recordedBy: actor,
      })
      .returning();
    await db
      .insert(s.incomes)
      .values({
        tenantId: tenant,
        headId: await incomeHead(product.isMilk),
        date: batch.date,
        amount: decimal(total),
        customerName: customer.name,
        description: `${product.name} — ${entry.quantity} ${product.unit} × ₹${entry.rate}`,
        paymentMethod:
          entry.paymentType === "credit" ? "credit" : entry.paymentMode,
        referenceType: "dairy_sale",
        referenceId: saleId,
        recordedBy: actor,
      });
    if (paid > 0)
      await db
        .insert(s.salesPayments)
        .values({
          tenantId: tenant,
          saleId,
          customerId: customer.id,
          date: batch.date,
          amount: decimal(paid),
          mode: entry.paymentMode,
          reference: entry.reference,
          recordedBy: actor,
        });
    saved.push(sale);
  }
  return { entries: saved };
}
export async function receiveProduct(
  tenant: string,
  actor: string,
  body: unknown,
) {
  const data = stockReceiptSchema.parse(body);
  if (data.date > farmDay((await settings(tenant)).timezone))
    fail("Stock receipts cannot be future dated");
  const product = await owned(s.salesProducts, tenant, data.productId);
  if (!product.active) fail("Choose an active item");
  if (product.isMilk)
    fail("Record milk through Milk Records or opening stock in Daily Report");
  if (data.milkUsed && data.kind !== "production")
    fail("Milk usage applies only to production");
  if (data.milkUsed) {
    if (cents(await milkAvailable(tenant, data.date)) < cents(data.milkUsed))
      fail("Not enough saleable milk for this production batch", 409);
    await recordEvent(
      tenant,
      "milk_disposition",
      data.date,
      {
        kind: "processing",
        quantity: data.milkUsed,
        notes: `${product.name}: ${data.notes}`,
      },
      null,
      actor,
    );
  }
  const [result] = await db
    .insert(s.productStock)
    .values({
      ...data,
      tenantId: tenant,
      quantity: decimal(cents(data.quantity)),
      milkUsed: decimal(cents(data.milkUsed)),
      recordedBy: actor,
    })
    .returning();
  return result;
}
export async function collectPayment(
  tenant: string,
  actor: string,
  body: unknown,
) {
  const data = paymentSchema.parse(body);
  await owned(s.salesCustomers, tenant, data.customerId);
  if (data.date > farmDay((await settings(tenant)).timezone))
    fail("Payments cannot be future dated");
  const sales = (await rows(s.dairySales, tenant))
    .filter((r) => r.customerId === data.customerId && r.date <= data.date)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        String(a.createdAt).localeCompare(String(b.createdAt)),
    );
  let remaining = cents(data.amount);
  const due = sales.reduce(
    (n, r) => n + cents(r.totalAmount) - cents(r.paidAmount),
    0,
  );
  if (remaining > due)
    fail(
      "Payment exceeds the customer's outstanding balance on eligible sales",
      409,
    );
  const payments = [];
  for (const sale of sales) {
    const amount = Math.min(
      remaining,
      cents(sale.totalAmount) - cents(sale.paidAmount),
    );
    if (amount <= 0) continue;
    const paid = cents(sale.paidAmount) + amount;
    await db
      .update(s.dairySales)
      .set({ paidAmount: decimal(paid) })
      .where(eq(s.dairySales.id, sale.id));
    if (sale.milkSaleId)
      await db
        .update(s.milkSales)
        .set({
          paymentStatus: paid === cents(sale.totalAmount) ? "paid" : "partial",
        })
        .where(eq(s.milkSales.id, sale.milkSaleId));
    const [receipt] = await db
      .insert(s.salesPayments)
      .values({
        tenantId: tenant,
        saleId: sale.id,
        customerId: data.customerId,
        date: data.date,
        amount: decimal(amount),
        mode: data.mode,
        reference: data.reference,
        recordedBy: actor,
      })
      .returning();
    payments.push(receipt);
    remaining -= amount;
  }
  return { payments };
}
export async function salesOverview(tenant: string, date: string) {
  daySchema.parse(date);
  const [products, customers, sales, payments, movements] = await Promise.all([
    rows(s.salesProducts, tenant),
    rows(s.salesCustomers, tenant),
    rows(s.dairySales, tenant),
    rows(s.salesPayments, tenant),
    rows(s.productStock, tenant),
  ]);
  const milk = await milkAvailable(tenant, date);
  const asOfSales = sales
    .filter((s) => s.date <= date)
    .map((sale) => {
      const paid = payments
        .filter((p) => p.saleId === sale.id && p.date <= date)
        .reduce((n, p) => n + cents(p.amount), 0);
      return {
        ...sale,
        paidAmount: decimal(paid),
        outstanding: decimal(cents(sale.totalAmount) - paid),
      };
    });
  const customerRows = customers.map((customer) => ({
    ...customer,
    outstanding: decimal(
      asOfSales
        .filter((s) => s.customerId === customer.id)
        .reduce((n, s) => n + cents(s.outstanding), 0),
    ),
  }));
  return {
    date,
    products: products.map((p) => ({
      ...p,
      stock: p.isMilk
        ? milk
        : movements
            .filter((m) => m.productId === p.id && m.date <= date)
            .reduce((n, m) => n + cents(m.quantity), 0) / 100,
    })),
    customers: customerRows.sort((a, b) => a.name.localeCompare(b.name)),
    entries: asOfSales.filter((s) => s.date === date),
    outstandingSales: asOfSales.filter((s) => cents(s.outstanding) > 0),
    payments: payments
      .filter((p) => p.date === date)
      .map((p) => ({
        ...p,
        customerName: customers.find((c) => c.id === p.customerId)?.name,
        productName: sales.find((s) => s.id === p.saleId)?.productName,
      })),
    stockMovements: movements
      .filter((m) => m.date === date)
      .map((m) => ({
        ...m,
        productName: products.find((p) => p.id === m.productId)?.name,
      })),
  };
}
export async function salesReceivables(tenant: string) {
  const sales = await rows(s.dairySales, tenant);
  const linked = new Set(sales.map((s) => s.milkSaleId));
  const legacy = (await rows(s.milkSales, tenant)).filter(
    (s) => !linked.has(s.id) && s.paymentStatus !== "paid",
  );
  return (
    (sales.reduce((n, s) => n + cents(s.totalAmount) - cents(s.paidAmount), 0) +
      legacy.reduce((n, s) => n + cents(s.totalAmount), 0)) /
    100
  );
}
export async function customerLedger(tenant: string, id: string) {
  const customer = await owned(s.salesCustomers, tenant, id);
  const entries = (await rows(s.dairySales, tenant))
    .filter((s) => s.customerId === id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const payments = (await rows(s.salesPayments, tenant))
    .filter((p) => p.customerId === id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { customer, entries, payments };
}
