import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import request from "supertest";
import bcrypt from "bcryptjs";
import { isolatedDatabase } from "./database";
import { db, pool } from "../server/db";
import * as s from "../shared/schema";
import { addDays, farmDay } from "../shared/care";

let engine: any,
  owner: any,
  other: any,
  worker: any,
  viewer: any,
  tenant: any,
  foreign: any,
  customer: any,
  foreignCustomer: any,
  actor: any,
  foreignActor: any;
const day = farmDay();
const ok = (r: any, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  return r.body;
};
const post = async (path: string, body: any, status = 201, agent = owner) =>
  ok(await agent.post(path).send(body), status);
const base = (extra = {}) => ({
  customerId: customer.id,
  kind: "delivery_change",
  title: "Deliver the revised quantity",
  instructions:
    "Confirm the delivery change with the customer before updating the order",
  dueDate: day,
  dueTime: "07:30",
  priority: "high",
  assignedTo: actor.id,
  ...extra,
});

before(async () => {
  process.env.SESSION_SECRET = "customer-activity-isolated-tests";
  process.env.WHATSAPP_WEB_ENABLED = "false";
  ({ engine } = await isolatedDatabase());
  const app = express();
  app.use(express.json());
  const { registerRoutes } = await import("../server/routes");
  await registerRoutes(createServer(app), app);
  const hash = await bcrypt.hash("ActivityPass!2345", 4);
  [actor] = await db
    .insert(s.users)
    .values({
      email: "activity-owner@test.local",
      firstName: "Owner",
      passwordHash: hash,
    })
    .returning();
  [foreignActor] = await db
    .insert(s.users)
    .values({ email: "activity-other@test.local", passwordHash: hash })
    .returning();
  const [workerUser] = await db
    .insert(s.users)
    .values({ email: "activity-worker@test.local", passwordHash: hash })
    .returning();
  const [viewerUser] = await db
    .insert(s.users)
    .values({ email: "activity-viewer@test.local", passwordHash: hash })
    .returning();
  [tenant] = await db
    .insert(s.tenants)
    .values({
      name: "Activities farm",
      slug: "activities-farm",
      ownerId: actor.id,
    })
    .returning();
  [foreign] = await db
    .insert(s.tenants)
    .values({
      name: "Other activities farm",
      slug: "activities-foreign",
      ownerId: foreignActor.id,
    })
    .returning();
  await db.insert(s.tenantMembers).values([
    { tenantId: tenant.id, userId: workerUser.id, role: "worker" },
    {
      tenantId: tenant.id,
      userId: viewerUser.id,
      role: "viewer",
      permissions: ["sales.view"],
    },
  ]);
  owner = request.agent(app);
  other = request.agent(app);
  worker = request.agent(app);
  viewer = request.agent(app);
  for (const [agent, user] of [
    [owner, actor],
    [other, foreignActor],
    [worker, workerUser],
    [viewer, viewerUser],
  ])
    ok(
      await agent
        .post("/api/auth/login")
        .send({ email: user.email, password: "ActivityPass!2345" }),
    );
  customer = await post("/api/sales/customers", { name: "Activities buyer" });
  foreignCustomer = await post(
    "/api/sales/customers",
    { name: "Other buyer" },
    201,
    other,
  );
});
after(async () => {
  await engine.close();
  await pool.end();
});

test("customer activities enforce tenant, sales access and active farm assignment", async () => {
  await post("/api/sales/customer-activities", base(), 403, worker);
  await post("/api/sales/customer-activities", base(), 403, viewer);
  ok(await worker.get("/api/sales/customer-activities"), 403);
  await post(
    "/api/sales/customer-activities",
    base({ customerId: foreignCustomer.id }),
    404,
  );
  await post(
    "/api/sales/customer-activities",
    base({ assignedTo: foreignActor.id }),
    400,
  );
  const activity = await post("/api/sales/customer-activities", base());
  assert.equal(activity.createdBy, actor.id);
  const listing = ok(await owner.get("/api/sales/customer-activities"));
  assert.equal(
    listing.activities.find((a: any) => a.id === activity.id)?.href,
    `/customers?customer=${customer.id}#customer-activities`,
  );
  assert.ok(
    listing.activities.some(
      (a: any) =>
        a.id === activity.id &&
        a.customerName === customer.name &&
        a.assignedToName === "Owner" &&
        a.source === "manual",
    ),
  );
  assert.ok(!listing.people.some((p: any) => p.id === foreignActor.id));
  assert.ok(
    ok(await viewer.get("/api/sales/customer-activities")).activities.some(
      (a: any) => a.id === activity.id,
    ),
  );
  ok(
    await other
      .patch(`/api/sales/customer-activities/${activity.id}`)
      .send({ revision: 1, title: "Wrong farm" }),
    404,
  );
  ok(
    await other.get(`/api/sales/customer-activities?customerId=${customer.id}`),
    404,
  );
});

test("activity edits validate schedule and revision; closing preserves accountable evidence", async () => {
  await post(
    "/api/sales/customer-activities",
    base({ dueDate: "2026-02-30" }),
    400,
  );
  await post("/api/sales/customer-activities", base({ dueTime: "25:80" }), 400);
  await post(
    "/api/sales/customer-activities",
    base({ status: "completed" }),
    400,
  );
  const a = await post(
    "/api/sales/customer-activities",
    base({ title: "Collect yesterday's amount", kind: "collection" }),
  );
  const updated = ok(
    await owner
      .patch(`/api/sales/customer-activities/${a.id}`)
      .send({ revision: 1, title: "Call first", status: "in_progress" }),
  );
  assert.equal(updated.revision, 2);
  assert.equal(updated.updatedBy, actor.id);
  ok(
    await owner
      .patch(`/api/sales/customer-activities/${a.id}`)
      .send({ revision: 1, title: "Stale change" }),
    409,
  );
  await post(
    `/api/sales/customer-activities/${a.id}/complete`,
    { revision: 2, notes: " " },
    400,
  );
  const done = await post(`/api/sales/customer-activities/${a.id}/complete`, {
    revision: 2,
    notes: "Customer confirmed; payment will be recorded separately",
  });
  assert.equal(done.status, "completed");
  assert.equal(done.completedBy, actor.id);
  assert.ok(done.completedAt);
  assert.equal(
    done.completionNotes,
    "Customer confirmed; payment will be recorded separately",
  );
  ok(
    await owner
      .patch(`/api/sales/customer-activities/${a.id}`)
      .send({ revision: 3, title: "Erase completion" }),
    409,
  );
  const b = await post(
    "/api/sales/customer-activities",
    base({ title: "Cancelled delivery request" }),
  );
  ok(
    await owner
      .delete(`/api/sales/customer-activities/${b.id}`)
      .send({ revision: 1, notes: "" }),
    400,
  );
  const cancelled = ok(
    await owner
      .delete(`/api/sales/customer-activities/${b.id}`)
      .send({ revision: 1, notes: "Customer retained existing delivery" }),
  );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancelledBy, actor.id);
  assert.ok(cancelled.cancelledAt);
  assert.ok(
    ok(
      await owner.get("/api/sales/customer-activities?history=all"),
    ).activities.some((a: any) => a.id === b.id && a.cancellationReason),
  );
});

test("derived payment reminders reconcile advances and receipts as of the requested day without creating tasks", async () => {
  const buyer = await post("/api/sales/customers", {
    name: "Collection buyer",
  });
  const product = (await post("/api/sales/setup", {})).find(
    (p: any) => p.code === "milk",
  );
  await db.insert(s.dairySales).values({
    tenantId: tenant.id,
    entryKey: "activity-derived-bill",
    source: "individual",
    date: addDays(day, -2),
    customerId: buyer.id,
    customerName: buyer.name,
    productId: product.id,
    productName: product.name,
    unit: "litre",
    quantity: "10",
    rate: "60",
    totalAmount: "600",
    dueDate: day,
    paymentType: "credit",
    paymentMode: "credit",
  });
  await db.insert(s.salesPayments).values({
    tenantId: tenant.id,
    customerId: buyer.id,
    date: addDays(day, -1),
    amount: "100",
    mode: "cash",
  });
  await db.insert(s.salesPayments).values({
    tenantId: tenant.id,
    customerId: buyer.id,
    date: addDays(day, 1),
    amount: "500",
    mode: "cash",
  });
  let listing = ok(
    await owner.get(
      `/api/sales/customer-activities?date=${day}&customerId=${buyer.id}`,
    ),
  );
  const derived = listing.activities.find(
    (a: any) => a.source === "payment_due",
  );
  assert.equal(derived.amount, "500.00");
  assert.equal(derived.href, `/customers?customer=${buyer.id}`);
  assert.equal(derived.editable, false);
  assert.equal(derived.dueDate, day);
  assert.ok(derived.instructions.includes(`as of ${day}`));
  await post(
    `/api/sales/customer-activities/${encodeURIComponent(derived.id)}/complete`,
    { revision: 1, notes: "Cannot close a calculated reminder" },
    404,
  );
  listing = ok(
    await owner.get(
      `/api/sales/customer-activities?date=${addDays(day, 1)}&customerId=${buyer.id}`,
    ),
  );
  assert.equal(
    listing.activities.filter((a: any) => a.source === "payment_due").length,
    0,
  );
  assert.equal(
    (await db.select().from(s.customerActivities)).filter(
      (a) => a.customerId === buyer.id,
    ).length,
    0,
  );
});
