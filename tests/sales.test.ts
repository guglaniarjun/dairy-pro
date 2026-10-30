import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import request from "supertest";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import { isolatedDatabase } from "./database";
import { db, pool } from "../server/db";
import * as s from "../shared/schema";
import { farmDay, addDays } from "../shared/care";
import { paymentDueDate } from "../shared/sales";
import { customerAccount } from "../shared/customer-account";
import { buildDailyReport, rows } from "../server/care-service";
import { reportWorkbook } from "../server/report-export";
const date = addDays(farmDay(), -3);
let engine: any,
  owner: any,
  other: any,
  worker: any,
  tenant: any,
  foreign: any,
  milk: any,
  paneer: any,
  ghee: any,
  alice: any,
  bob: any;
const ok = (res: any, status = 200) => {
  assert.equal(res.status, status, JSON.stringify(res.body));
  return res.body;
};
const post = async (path: string, data: any, status = 201, agent = owner) =>
  ok(await agent.post(path).send(data), status);
const overview = async (day = date) =>
  ok(await owner.get(`/api/sales?date=${day}`));
const line = (customer: any, product: any, quantity = "1", extras = {}) => ({
  customerId: customer.id,
  productId: product.id,
  quantity,
  rate: product.isMilk ? "60" : "400",
  paymentType: "cash",
  paymentMode: "cash",
  ...extras,
});
before(async () => {
  process.env.SESSION_SECRET = "sales-isolated-test-session-secret";
  process.env.WHATSAPP_WEB_ENABLED = "false";
  ({ engine } = await isolatedDatabase());
  const app = express();
  app.use(express.json());
  const { registerRoutes } = await import("../server/routes");
  await registerRoutes(createServer(app), app);
  const hash = await bcrypt.hash("TestPass!12345", 4);
  const [user] = await db
    .insert(s.users)
    .values({ email: "sales@test.local", passwordHash: hash })
    .returning();
  [tenant] = await db
    .insert(s.tenants)
    .values({ name: "Sales farm", slug: "sales", ownerId: user.id })
    .returning();
  const [u2] = await db
    .insert(s.users)
    .values({ email: "foreign@test.local", passwordHash: hash })
    .returning();
  [foreign] = await db
    .insert(s.tenants)
    .values({ name: "Foreign farm", slug: "foreign", ownerId: u2.id })
    .returning();
  const [u3] = await db
    .insert(s.users)
    .values({ email: "sales-worker@test.local", passwordHash: hash })
    .returning();
  await db
    .insert(s.tenantMembers)
    .values({ tenantId: tenant.id, userId: u3.id, role: "worker" });
  owner = request.agent(app);
  other = request.agent(app);
  worker = request.agent(app);
  for (const [agent, email] of [
    [owner, user.email],
    [other, u2.email],
    [worker, u3.email],
  ])
    ok(
      await agent
        .post("/api/auth/login")
        .send({ email, password: "TestPass!12345" }),
    );
  const [cow] = await db
    .insert(s.cattle)
    .values({
      tenantId: tenant.id,
      tagNumber: "S-1",
      dateOfEntry: date,
      gender: "female",
      stage: "milking",
    })
    .returning();
  await db.insert(s.milkEntries).values([
    {
      tenantId: tenant.id,
      cattleId: cow.id,
      date,
      session: "morning",
      quantity: "100",
    },
    {
      tenantId: tenant.id,
      cattleId: cow.id,
      date,
      session: "evening",
      quantity: "20",
      destination: "discarded",
    },
  ]);
});
after(async () => {
  await engine.close();
  await pool.end();
});
test("sets up products once and stores customer defaults", async () => {
  const products = await post("/api/sales/setup", {});
  await post("/api/sales/setup", {});
  milk = products.find((p: any) => p.isMilk);
  paneer = products.find((p: any) => p.name === "Paneer");
  ghee = products.find((p: any) => p.name === "Ghee");
  assert.equal((await overview()).products.length, 6);
  ok(
    await owner
      .patch(`/api/sales/products/${milk.id}`)
      .send({ name: "Milk", unit: "litre", defaultRate: "60" }),
  );
  alice = await post("/api/sales/customers", {
    name: "Alice",
    defaultProductId: milk.id,
    defaultQuantity: "10",
  });
  bob = await post("/api/sales/customers", {
    name: "Bob",
    paymentType: "credit",
    paymentMode: "monthly_credit",
  });
  assert.equal(alice.defaultQuantity, "10.00");
  assert.equal(alice.daily, true);
  await post("/api/sales/stock", {
    productId: paneer.id,
    date,
    quantity: "5",
    kind: "opening",
    notes: "Counted opening batch",
  });
  await post("/api/sales/stock", {
    productId: ghee.id,
    date,
    quantity: "2",
    kind: "opening",
    notes: "Opening",
  });
});
test("mixed cash and part-paid credit batch updates stock, income, milk, balances and report exactly once", async () => {
  const batch = {
    date,
    source: "daily",
    entries: [
      line(alice, milk, "10"),
      line(bob, paneer, "2", {
        paymentType: "credit",
        paymentMode: "upi",
        paidAmount: "200",
        reference: "UPI-123",
      }),
    ],
  };
  const first = ok(
    await owner
      .post("/api/sales/entries")
      .set("Idempotency-Key", "test-daily-batch")
      .send(batch),
    201,
  );
  const retry = ok(
    await owner
      .post("/api/sales/entries")
      .set("Idempotency-Key", "test-daily-batch")
      .send(batch),
    201,
  );
  assert.deepEqual(retry, first);
  const state = await overview();
  assert.equal(state.entries.length, 2);
  assert.equal(state.products.find((p: any) => p.id === milk.id).stock, 90);
  assert.equal(state.products.find((p: any) => p.id === paneer.id).stock, 3);
  assert.equal(
    state.customers.find((c: any) => c.id === bob.id).outstanding,
    "600.00",
  );
  assert.equal(
    (await rows(s.incomes, tenant.id)).reduce(
      (n, r) => n + Number(r.amount),
      0,
    ),
    1400,
  );
  const report = await buildDailyReport(tenant.id, date);
  assert.equal(report.milk.sold, 10);
  assert.equal(report.milk.unallocated, 90);
  assert.equal(report.dairySales.entries.length, 2);
  assert.equal(
    ok(await owner.get("/api/dashboard/stats")).pendingReceivables,
    600,
  );
  assert.equal(
    ok(await owner.get("/api/finance/analytics")).pendingReceivables,
    600,
  );
});
test("duplicate daily entries and changed retry payloads are rejected", async () => {
  await post(
    "/api/sales/entries",
    { date, source: "daily", entries: [line(alice, milk)] },
    409,
  );
  ok(
    await owner
      .post("/api/sales/entries")
      .set("Idempotency-Key", "test-daily-batch")
      .send({ date, source: "individual", entries: [line(alice, milk)] }),
    409,
  );
  assert.equal((await overview()).entries.length, 2);
});
test("insufficient stock rolls back every line and income in a bulk batch", async () => {
  await post(
    "/api/sales/entries",
    {
      date,
      source: "individual",
      entries: [line(alice, milk, "5"), line(bob, ghee, "99")],
    },
    409,
  );
  assert.equal(
    (await overview()).products.find((p: any) => p.id === milk.id).stock,
    90,
  );
  assert.equal((await rows(s.incomes, tenant.id)).length, 2);
  assert.equal((await rows(s.milkSales, tenant.id)).length, 1);
  await post(
    "/api/sales/entries",
    { date, source: "individual", entries: [line(alice, milk, "91")] },
    409,
  );
});
test("individual additional delivery and monthly collection clear debt without recording income twice", async () => {
  await post("/api/sales/entries", {
    date,
    source: "individual",
    entries: [
      line(bob, milk, "5", {
        paymentType: "credit",
        paymentMode: "monthly_credit",
      }),
    ],
  });
  const payment = {
    customerId: bob.id,
    date: addDays(date, 1),
    amount: "750",
    mode: "upi",
    reference: "MONTHLY-1",
  };
  const first = ok(
    await owner
      .post("/api/sales/payments")
      .set("Idempotency-Key", "monthly-payment")
      .send(payment),
    201,
  );
  ok(
    await owner
      .post("/api/sales/payments")
      .set("Idempotency-Key", "monthly-payment")
      .send(payment),
    201,
  );
  assert.equal(first.payments.length, 1);
  assert.equal(
    (await overview(addDays(date, 1))).customers.find(
      (c: any) => c.id === bob.id,
    ).outstanding,
    "150.00",
  );
  assert.equal(
    (await overview()).customers.find((c: any) => c.id === bob.id).outstanding,
    "900.00",
    "historical report excludes next-day receipts",
  );
  assert.equal(
    (await rows(s.incomes, tenant.id)).reduce(
      (n, r) => n + Number(r.amount),
      0,
    ),
    1700,
  );
  assert.equal(
    ok(await owner.get("/api/dashboard/stats")).pendingReceivables,
    150,
  );
  const milkRows = await rows(s.milkSales, tenant.id);
  assert.equal(
    milkRows.find((r) => r.buyerName === "Bob").paymentStatus,
    "partial",
  );
  await post("/api/sales/payments", { ...payment, amount: "150" });
  assert.equal(
    ok(await owner.get("/api/dashboard/stats")).pendingReceivables,
    0,
  );
  assert.equal(
    ok(await owner.get(`/api/sales/customers/${bob.id}`)).entries.length,
    2,
  );
});
test("processing milk updates finished goods and milk balance; future receipts cannot fund past sales", async () => {
  await post("/api/sales/stock", {
    productId: paneer.id,
    date,
    quantity: "1",
    kind: "production",
    milkUsed: "5",
    notes: "Paneer batch 2",
  });
  const state = await overview();
  assert.equal(state.products.find((p: any) => p.id === paneer.id).stock, 4);
  assert.equal(state.products.find((p: any) => p.id === milk.id).stock, 80);
  const report = await buildDailyReport(tenant.id, date);
  assert.equal(report.milk.used, 5);
  await post("/api/sales/stock", {
    productId: ghee.id,
    date: addDays(date, 1),
    quantity: "100",
    kind: "purchase",
    notes: "Supplier receipt",
  });
  await post(
    "/api/sales/entries",
    { date, source: "individual", entries: [line(alice, ghee, "3")] },
    409,
  );
  await post("/api/sales/entries", {
    date: addDays(date, 1),
    source: "individual",
    entries: [line(alice, ghee, "102")],
  });
  await post(
    "/api/sales/entries",
    { date, source: "individual", entries: [line(alice, ghee, "1")] },
    409,
    owner,
  );
});
test("rejects invalid amounts, modes and dates, and derives totals on the server", async () => {
  for (const entry of [
    line(alice, milk, "-1"),
    line(alice, milk, "1.001"),
    line(alice, milk, "1", { rate: "0" }),
    line(alice, milk, "1", { paymentMode: "monthly_credit" }),
    line(alice, milk, "1", {
      paymentType: "credit",
      paymentMode: "monthly_credit",
      paidAmount: "1",
    }),
    line(alice, milk, "1", { receivedAmount: "-1" }),
    line(alice, milk, "1", { receivedAmount: "100000001" }),
  ])
    await post(
      "/api/sales/entries",
      { date, source: "individual", entries: [entry] },
      400,
    );
  await post(
    "/api/sales/entries",
    { date: "2026-02-30", source: "individual", entries: [line(alice, milk)] },
    400,
  );
  await post(
    "/api/sales/entries",
    {
      date: addDays(farmDay(), 1),
      source: "individual",
      entries: [line(alice, milk)],
    },
    400,
  );
  const sale = await post("/api/sales/entries", {
    date,
    source: "individual",
    entries: [line(alice, milk, "0.25", { rate: "60.50", totalAmount: "1" })],
  });
  assert.equal(sale.entries[0].totalAmount, "15.13");
});
test("tenant isolation and role authorization cover reads, customer references and edits", async () => {
  ok(await worker.get("/api/sales"), 403);
  await post("/api/sales/setup", {}, 403, worker);
  const foreignProducts = await post("/api/sales/setup", {}, 201, other);
  const foreignCustomer = await post(
    "/api/sales/customers",
    { name: "Foreign customer" },
    201,
    other,
  );
  ok(await other.get(`/api/sales/customers/${alice.id}`), 404);
  ok(
    await other
      .patch(`/api/sales/customers/${alice.id}`)
      .send({ name: "Attack" }),
    404,
  );
  await post(
    "/api/sales/customers",
    { name: "Bad default", defaultProductId: foreignProducts[0].id },
    404,
  );
  await post(
    "/api/sales/entries",
    { date, source: "individual", entries: [line(foreignCustomer, milk)] },
    404,
  );
  await post(
    "/api/sales/entries",
    { date, source: "individual", entries: [line(alice, foreignProducts[0])] },
    404,
  );
  assert.equal(
    ok(await other.get(`/api/sales?date=${date}`)).entries.length,
    0,
  );
});
test("daily exports contain dairy sales, receipts and stock and migration is repeatable", async () => {
  const report = await buildDailyReport(tenant.id, date);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await reportWorkbook(report)) as any);
  assert.ok(book.getWorksheet("Dairy sales"));
  assert.ok(book.getWorksheet("Sales receipts"));
  assert.ok(book.getWorksheet("Dairy product stock"));
  const before = (await rows(s.dairySales, tenant.id)).length;
  const migration = await fs.readFile(
    "migrations/0001_nebulous_wither.sql",
    "utf8",
  );
  await engine.exec(migration);
  await engine.exec(migration);
  assert.equal((await rows(s.dairySales, tenant.id)).length, before);
});

test("customer's nine-day example: immediate receipts, credit, excess payment and automatic advance", async () => {
  const start = addDays(farmDay(), -12);
  const customer = await post("/api/sales/customers", {
    name: "Account example",
    paymentMode: "credit",
    paymentTerm: "days",
    paymentDays: 7,
  });
  const [cow] = await db
    .insert(s.cattle)
    .values({
      tenantId: tenant.id,
      tagNumber: "ACCOUNT-COW",
      dateOfEntry: start,
    })
    .returning();
  for (let i = 0; i < 9; i++)
    await db.insert(s.milkEntries).values({
      tenantId: tenant.id,
      cattleId: cow.id,
      date: addDays(start, i),
      session: "morning",
      quantity: "10",
    });
  const sale = (i: number, receivedAmount = "0", paymentMode = "credit") =>
    post("/api/sales/entries", {
      date: addDays(start, i),
      source: "daily",
      entries: [
        {
          customerId: customer.id,
          productId: milk.id,
          quantity: "1",
          rate: "100",
          receivedAmount,
          paymentMode,
        },
      ],
    });
  for (let i = 0; i < 3; i++)
    await sale(i, "100", ["cash", "upi", "cheque"][i]);
  for (let i = 3; i < 6; i++) await sale(i);
  const balance = async (i: number) =>
    (await overview(addDays(start, i))).customers.find(
      (c: any) => c.id === customer.id,
    );
  assert.equal((await balance(5)).balance, "300.00");
  const payment = {
    customerId: customer.id,
    date: addDays(start, 5),
    amount: "500",
    mode: "upi",
    reference: "EXAMPLE-500",
  };
  const receipt = ok(
    await owner
      .post("/api/sales/payments")
      .set("Idempotency-Key", "example-500")
      .send(payment),
    201,
  );
  ok(
    await owner
      .post("/api/sales/payments")
      .set("Idempotency-Key", "example-500")
      .send(payment),
    201,
  );
  assert.equal(receipt.payments.length, 1);
  assert.equal((await balance(5)).advance, "200.00");
  await sale(6);
  assert.equal((await balance(6)).advance, "100.00");
  await sale(7);
  assert.equal((await balance(7)).balance, "0.00");
  await sale(8);
  assert.equal((await balance(8)).outstanding, "100.00");
  const ledger = ok(await owner.get(`/api/sales/customers/${customer.id}`));
  assert.equal(
    ledger.payments.length,
    4,
    "using advance must not create a second cash receipt",
  );
  assert.equal(ledger.ledger.length, 13);
  assert.equal(
    ledger.payments.reduce((n: number, p: any) => n + Number(p.amount), 0),
    800,
  );
  assert.equal(
    ledger.entries.find((s: any) => s.date === addDays(start, 6))
      .advanceApplied,
    "100.00",
  );
  assert.equal(
    ledger.entries.find((s: any) => s.date === start).dueDate,
    addDays(start, 7),
  );
  assert.equal(
    (await balance(4)).outstanding,
    "200.00",
    "future receipt must not clear historical debt",
  );
  assert.equal(
    (await rows(s.incomes, tenant.id))
      .filter((r) => r.customerName === customer.name)
      .reduce((n, r) => n + Number(r.amount), 0),
    900,
  );
  assert.equal(
    (await overview(addDays(start, 6))).products.find(
      (p: any) => p.id === milk.id,
    ).stock,
    9,
  );
  const report = await buildDailyReport(tenant.id, addDays(start, 5));
  assert.equal(
    report.dairySales.customers.find((c: any) => c.id === customer.id)?.advance,
    "200.00",
  );
  assert.equal(
    report.dairySales.payments.filter((p: any) => p.customerId === customer.id)
      .length,
    1,
  );
});

test("standalone advance, partial coverage, immediate excess and stale balance protection", async () => {
  const c = await post("/api/sales/customers", {
    name: "Advance before sale",
    paymentTerm: "monthly",
  });
  const receipt = await post("/api/sales/payments", {
    customerId: c.id,
    date,
    amount: "40",
    mode: "bank_transfer",
  });
  assert.equal(receipt.advance, "40.00");
  assert.equal(receipt.payments[0].saleId, null);
  const payload = {
    date,
    source: "individual",
    entries: [
      {
        customerId: c.id,
        productId: milk.id,
        quantity: "1",
        rate: "100",
        paymentMode: "credit",
        receivedAmount: "0",
        expectedBalance: "-40",
      },
    ],
  };
  const saved = await post("/api/sales/entries", payload);
  assert.equal(saved.entries[0].paidAmount, "40.00");
  assert.equal(saved.entries[0].dueDate, paymentDueDate(date, "monthly", 0));
  await post("/api/sales/entries", payload, 409);
  let ledger = ok(await owner.get(`/api/sales/customers/${c.id}`));
  assert.equal(ledger.outstanding, "60.00");
  assert.equal(ledger.entries.length, 1);
  await post("/api/sales/entries", {
    date,
    source: "individual",
    entries: [
      {
        customerId: c.id,
        productId: milk.id,
        quantity: "1",
        rate: "100",
        paymentMode: "cash",
        receivedAmount: "200",
      },
    ],
  });
  ledger = ok(await owner.get(`/api/sales/customers/${c.id}`));
  assert.equal(ledger.advance, "40.00");
  assert.equal(
    ledger.entries.filter((s: any) => Number(s.outstanding) > 0).length,
    0,
  );
  assert.equal(ledger.payments.length, 2);
  const before = ledger.balance;
  await post(
    "/api/sales/entries",
    {
      date,
      source: "individual",
      entries: [
        {
          customerId: c.id,
          productId: milk.id,
          quantity: "99999",
          rate: "100",
          paymentMode: "cash",
          receivedAmount: "200",
        },
      ],
    },
    409,
  );
  assert.equal(
    ok(await owner.get(`/api/sales/customers/${c.id}`)).balance,
    before,
    "failed stock check must not change account",
  );
});

test("backdated receipts and sales recalculate FIFO without duplicating revenue or receipts", async () => {
  const c = await post("/api/sales/customers", {
    name: "Backdated ledger",
    paymentTerm: "days",
    paymentDays: 10,
  });
  await post("/api/sales/entries", {
    date,
    source: "individual",
    entries: [
      {
        customerId: c.id,
        productId: milk.id,
        quantity: "1",
        rate: "100",
        paymentMode: "credit",
        receivedAmount: 0,
      },
    ],
  });
  await post("/api/sales/payments", {
    customerId: c.id,
    date: addDays(date, 1),
    amount: "200",
    mode: "cheque",
    reference: "CH-2",
  });
  assert.equal(
    (await overview()).customers.find((r: any) => r.id === c.id).outstanding,
    "100.00",
  );
  await post("/api/sales/payments", {
    customerId: c.id,
    date: addDays(date, -1),
    amount: "50",
    mode: "cash",
  });
  assert.equal(
    (await overview()).customers.find((r: any) => r.id === c.id).outstanding,
    "50.00",
  );
  let ledger = ok(await owner.get(`/api/sales/customers/${c.id}`));
  assert.equal(ledger.advance, "150.00");
  assert.equal(ledger.entries[0].advanceApplied, "50.00");
  assert.equal(ledger.entries[0].paidAmount, "100.00");
  assert.equal(ledger.entries[0].dueDate, addDays(date, 10));
  await post("/api/sales/entries", {
    date,
    source: "individual",
    entries: [
      {
        customerId: c.id,
        productId: milk.id,
        quantity: "1",
        rate: "100",
        paymentMode: "credit",
        receivedAmount: 0,
      },
    ],
  });
  ledger = ok(await owner.get(`/api/sales/customers/${c.id}`));
  assert.equal(ledger.advance, "50.00");
  assert.equal(ledger.payments.length, 2);
  assert.equal(
    (await overview()).customers.find((r: any) => r.id === c.id).outstanding,
    "150.00",
  );
  assert.equal(
    ledger.entries.reduce((n: number, s: any) => n + Number(s.paidAmount), 0),
    200,
  );
  await post(
    "/api/sales/customers",
    { name: "Bad terms", paymentTerm: "days", paymentDays: 0 },
    400,
  );
  await post(
    "/api/sales/payments",
    { customerId: c.id, date, amount: 5, mode: "credit" },
    400,
  );
  await post(
    "/api/sales/payments",
    { customerId: c.id, date, amount: 5, mode: "upi" },
    404,
    other,
  );
});

test("account migration is repeatable and preserves receipts, due dates and balances", async () => {
  const before = await rows(s.salesPayments, tenant.id);
  const salesBefore = await rows(s.dairySales, tenant.id);
  const migration = await fs.readFile(
    "migrations/0002_peaceful_venom.sql",
    "utf8",
  );
  await engine.exec(migration);
  await engine.exec(migration);
  assert.deepEqual(await rows(s.salesPayments, tenant.id), before);
  assert.deepEqual(await rows(s.dairySales, tenant.id), salesBefore);
});

test("legacy accounts migrate with the same sale totals, receipts and outstanding amount", async () => {
  const [customer] = await db
    .insert(s.salesCustomers)
    .values({
      tenantId: tenant.id,
      name: "Legacy account",
      paymentType: "credit",
      paymentMode: "monthly_credit",
    })
    .returning();
  const [sale] = await db
    .insert(s.dairySales)
    .values({
      tenantId: tenant.id,
      entryKey: "legacy-account",
      source: "individual",
      date,
      customerId: customer.id,
      customerName: customer.name,
      productId: milk.id,
      productName: "Milk",
      unit: "litre",
      quantity: "3",
      rate: "100",
      totalAmount: "300",
      paidAmount: "100",
      paymentType: "credit",
      paymentMode: "upi",
    })
    .returning();
  const [receipt] = await db
    .insert(s.salesPayments)
    .values({
      tenantId: tenant.id,
      saleId: sale.id,
      customerId: customer.id,
      date,
      amount: "100",
      mode: "upi",
      reference: "ORIGINAL-REFERENCE",
    })
    .returning();
  await engine.exec(
    await fs.readFile("migrations/0002_peaceful_venom.sql", "utf8"),
  );
  const ledger = ok(await owner.get(`/api/sales/customers/${customer.id}`));
  assert.equal(ledger.outstanding, "200.00");
  assert.equal(ledger.customer.paymentTerm, "monthly");
  assert.equal(ledger.customer.paymentMode, "credit");
  assert.equal(ledger.entries[0].receivedAmount, "100.00");
  assert.equal(ledger.entries[0].dueDate, paymentDueDate(date, "monthly", 0));
  assert.equal(ledger.payments[0].id, receipt.id);
  assert.equal(ledger.payments[0].reference, "ORIGINAL-REFERENCE");
});

test("payment terms handle month boundaries and overdue amounts exclude advances", () => {
  assert.equal(paymentDueDate("2028-02-10", "monthly", 0), "2028-02-29");
  assert.equal(paymentDueDate("2026-12-31", "days", 10), "2027-01-10");
  const sale = {
    id: "s",
    date: "2026-10-01",
    createdAt: "2026-10-01T01:00:00Z",
    totalAmount: "100.00",
    dueDate: "2026-10-08",
    productName: "Milk",
    quantity: "1",
    unit: "litre",
    paymentMode: "credit",
  };
  const receipt = {
    id: "p",
    date: "2026-10-09",
    createdAt: "2026-10-09T01:00:00Z",
    amount: "150.00",
    mode: "upi",
  };
  assert.equal(
    customerAccount([sale], [receipt], "2026-10-08").overdue,
    "0.00",
  );
  assert.equal(customerAccount([sale], [], "2026-10-09").overdue, "100.00");
  const cleared = customerAccount([sale], [receipt], "2026-10-09");
  assert.equal(cleared.advance, "50.00");
  assert.equal(cleared.overdue, "0.00");
});
