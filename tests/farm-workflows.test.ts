import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import { createServer } from "node:http";
import request from "supertest";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { isolatedDatabase } from "./database";
import { db, pool } from "../server/db";
import * as s from "../shared/schema";
import {
  farmDay,
  addDays,
  farmMidnight,
  lotExpiry,
  isLactating,
  matchesAnimal,
} from "../shared/care";
import { rows, buildDailyReport } from "../server/care-service";
import { evaluateCare } from "../server/care-worker";
import { reportWorkbook, reportPdf } from "../server/report-export";
import ExcelJS from "exceljs";
let engine: any,
  app: any,
  owner: any,
  worker: any,
  other: any,
  farm: any,
  foreignFarm: any,
  cow: any,
  foreignCow: any,
  item: any;
const today = farmDay();
const ok = (r: any, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  return r.body;
};
const post = async (path: string, data: any, agent = owner, status = 201) =>
  ok(await agent.post(path).send(data), status);
before(async () => {
  process.env.SESSION_SECRET = "isolated-test-session-secret-123456789";
  process.env.WHATSAPP_WEB_ENABLED = "false";
  ({ engine } = await isolatedDatabase());

  app = express();
  app.use(express.json());
  const { registerRoutes } = await import("../server/routes");
  await registerRoutes(createServer(app), app);

  const hash = await bcrypt.hash("TestPass!12345", 4);
  const [u] = await db
    .insert(s.users)
    .values({
      email: "owner@test.local",
      passwordHash: hash,
      firstName: "Owner",
    })
    .returning();
  [farm] = await db
    .insert(s.tenants)
    .values({ name: "Farm A", slug: "farm-a", ownerId: u.id, maxCattle: 1000 })
    .returning();
  await db.insert(s.farmSettings).values({
    tenantId: farm.id,
    timezone: "Asia/Kolkata",
    gestationDays: 285,
    dryPeriodDays: 55,
    pregnancyTestDays: 32,
  });
  const [v] = await db
    .insert(s.users)
    .values({
      email: "other@test.local",
      passwordHash: hash,
      firstName: "Other",
    })
    .returning();
  [foreignFarm] = await db
    .insert(s.tenants)
    .values({ name: "Farm B", slug: "farm-b", ownerId: v.id, maxCattle: 1000 })
    .returning();
  const [w] = await db
    .insert(s.users)
    .values({
      email: "worker@test.local",
      passwordHash: hash,
      firstName: "Worker",
    })
    .returning();
  await db
    .insert(s.tenantMembers)
    .values({ tenantId: farm.id, userId: w.id, role: "worker" });
  owner = request.agent(app);
  other = request.agent(app);
  worker = request.agent(app);
  for (const [agent, email] of [
    [owner, u.email],
    [other, v.email],
    [worker, w.email],
  ])
    ok(
      await agent
        .post("/api/auth/login")
        .send({ email, password: "TestPass!12345" }),
    );

  cow = await post("/api/cattle", {
    tagNumber: "C-101",
    dateOfEntry: today,
    dateOfBirth: addDays(today, -1100),
    gender: "female",
    stage: "milking",
    productionStatus: "lactating",
    lifeStage: "adult",
    reproductiveStatus: "unserved",
  });

  foreignCow = await post(
    "/api/cattle",
    {
      tagNumber: "B-1",
      dateOfEntry: today,
      stage: "milking",
      productionStatus: "lactating",
    },
    other,
  );
  item = await post("/api/inventory", {
    name: "Test medicine",
    unit: "ml",
    minStock: "5",
    currentStock: "0",
  });
});
after(async () => {
  await engine?.close();
  await pool.end();
});
test("independent statuses allow pregnant animals to remain in milk", async () => {
  await post("/api/operations/events", {
    cattleId: cow.id,
    type: "expected_calving",
    date: today,
    details: { expectedDate: addDays(today, 80) },
  });
  const animal = ok(await owner.get(`/api/cattle/${cow.id}`));
  assert.equal(animal.reproductiveStatus, "pregnant");
  assert.equal(animal.productionStatus, "lactating");
  assert.ok(isLactating(animal));
  await post("/api/milk", {
    cattleId: cow.id,
    date: today,
    session: "morning",
    quantity: 12.5,
  });
  assert.equal(
    (
      await owner.post("/api/milk").send({
        cattleId: cow.id,
        date: today,
        session: "morning",
        quantity: 4,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await owner.post("/api/milk").send({
        cattleId: cow.id,
        date: today,
        session: "evening",
        quantity: -1,
      })
    ).status,
    400,
  );
});
test("tenant isolation covers history, payments, nested references and forged tenant fields", async () => {
  for (const suffix of [
    "milk-entries",
    "health-events",
    "inseminations",
    "heats",
    "pregnancy-tests",
    "calvings",
    "vaccinations",
    "costs",
    "pl-summary",
  ])
    assert.equal(
      (await owner.get(`/api/cattle/${foreignCow.id}/${suffix}`)).status,
      404,
      suffix,
    );
  assert.equal(
    (
      await owner.post("/api/milk").send({
        cattleId: foreignCow.id,
        date: today,
        session: "morning",
        quantity: 2,
      })
    ).status,
    404,
  );
  const patch = ok(
    await owner
      .patch(`/api/cattle/${cow.id}`)
      .send({ tenantId: foreignFarm.id, name: "Reviewed" }),
  );
  assert.equal(patch.tenantId, farm.id);
  const tx = await post(
    "/api/cattle-transactions",
    {
      cattleId: foreignCow.id,
      date: today,
      type: "purchase",
      amount: "1000",
      paidAmount: "0",
    },
    other,
  );
  assert.equal(
    (await owner.get(`/api/cattle-transactions/${tx.id}/payments`)).status,
    404,
  );
  assert.equal(
    (
      await owner
        .post(`/api/cattle-transactions/${tx.id}/payments`)
        .send({ date: today, amount: "5" })
    ).status,
    404,
  );
});
test("RBAC restricts reports, medicines, finance and farm switching", async () => {
  assert.equal(
    (await worker.get("/api/operations/daily-report?date=" + today)).status,
    403,
  );
  assert.equal(
    (await worker.post("/api/operations/protocols").send({})).status,
    403,
  );
  assert.equal((await worker.get("/api/cattle-transactions")).status, 403);
  const stats = ok(await worker.get("/api/dashboard/stats"));
  assert.equal(stats.monthRevenue, undefined);
  assert.equal(
    (
      await owner
        .post("/api/operations/milk-bulk")
        .set("X-Farm-ID", foreignFarm.id)
        .send({ entries: [] })
    ).status,
    409,
  );
});
test("duplicate tags and invalid dates cannot be created", async () => {
  assert.equal(
    (
      await owner
        .post("/api/cattle")
        .send({ tagNumber: " c-101 ", dateOfEntry: today })
    ).status,
    409,
  );
  assert.equal(
    (
      await owner
        .post("/api/cattle")
        .send({ tagNumber: "BAD", dateOfEntry: "2026-02-30" })
    ).status,
    400,
  );
});
let protocol: any;
test("approved protocols create -15/-10 day work and preserve completed steps on rescheduling", async () => {
  protocol = await post("/api/operations/protocols", {
    name: "Reviewed calving preparation",
    trigger: "expected_calving",
    steps: [
      {
        title: "Preparation 15 days before",
        offsetDays: -15,
        instructions: "Follow approved plan",
        evidenceRequired: true,
      },
      {
        title: "Preparation 10 days before",
        offsetDays: -10,
        instructions: "Follow approved plan",
        evidenceRequired: true,
      },
    ],
  });
  let work = ok(await owner.get("/api/operations/work")).tasks;
  assert.equal(work.filter((t: any) => t.protocolId === protocol.id).length, 0);
  await post(
    `/api/operations/protocols/${protocol.id}/approve`,
    { note: "Test veterinarian, review REF-1" },
    owner,
    200,
  );
  work = ok(await owner.get("/api/operations/work")).tasks.filter(
    (t: any) => t.protocolId === protocol.id,
  );
  assert.equal(work.length, 2);
  assert.equal(work[0].dueDate, addDays(today, 65));
  await post(
    `/api/operations/tasks/${work[0].id}/complete`,
    { date: today, evidence: "Performed per reviewed instruction" },
    owner,
    200,
  );
  await post("/api/operations/events", {
    cattleId: cow.id,
    type: "expected_calving",
    date: today,
    details: { expectedDate: addDays(today, 90) },
  });
  const updated = ok(await owner.get("/api/operations/work")).tasks;
  assert.equal(
    updated.find((t: any) => t.id === work[0].id).dueDate,
    work[0].dueDate,
  );
  assert.equal(
    updated.find((t: any) => t.id === work[1].id).dueDate,
    addDays(today, 80),
  );
});
let usable: any, expired: any;
test("stock converts packs, consumes FEFO lots and blocks expired stock", async () => {
  usable = await post("/api/operations/stock/receive", {
    itemId: item.id,
    batchNumber: "GOOD",
    packs: 2,
    unitsPerPack: 100,
    packCost: 500,
    receivedDate: today,
    expiryDate: addDays(today, 60),
  });
  expired = await post("/api/operations/stock/receive", {
    itemId: item.id,
    batchNumber: "EXPIRED",
    packs: 1,
    unitsPerPack: 50,
    packCost: 200,
    receivedDate: addDays(today, -90),
    expiryDate: addDays(today, -1),
  });
  const state = ok(await owner.get("/api/operations/stock"));
  assert.equal(
    state.forecast.find((i: any) => i.id === item.id).available,
    200,
  );
  assert.equal(Number(usable.quantity), 200);
  const event = await post("/api/operations/events", {
    cattleId: cow.id,
    type: "treatment",
    date: today,
    details: {
      instructions: "Test prescription REF-2, reviewed dose and route",
      supplies: [{ itemId: item.id, quantity: 10 }],
      repeatAfterDays: 3,
      milkWithdrawalDays: 3,
    },
  });
  const stock = ok(await owner.get("/api/operations/stock"));
  assert.equal(
    Number(stock.lots.find((l: any) => l.id === usable.id).quantity),
    190,
  );
  assert.equal(
    Number(stock.lots.find((l: any) => l.id === expired.id).quantity),
    50,
  );
  const repeat = ok(await owner.get("/api/operations/work")).tasks.find(
    (t: any) => t.sourceKey === `repeat:${event.id}`,
  );
  assert.equal(repeat.dueDate, addDays(today, 3));
  assert.equal(repeat.clinical.milkWithdrawalDays, 3);
  const animal = ok(await owner.get(`/api/cattle/${cow.id}`));
  assert.equal(
    animal.milkWithholdUntil,
    farmMidnight(addDays(today, 4), "Asia/Kolkata").toISOString(),
  );
});
test("insufficient supply rolls back animal event, stock and cost together", async () => {
  const before = (await rows(s.farmEvents, farm.id)).length,
    stock = Number(
      (await rows(s.stockLots, farm.id)).find((l) => l.id === usable.id)
        .quantity,
    );
  const failed = await owner.post("/api/operations/events").send({
    cattleId: cow.id,
    type: "treatment",
    date: today,
    details: {
      instructions: "Test",
      supplies: [{ itemId: item.id, quantity: stock + 1 }],
    },
  });
  assert.equal(failed.status, 409, JSON.stringify(failed.body));
  assert.equal((await rows(s.farmEvents, farm.id)).length, before);
  assert.equal(
    Number(
      (await rows(s.stockLots, farm.id)).find((l) => l.id === usable.id)
        .quantity,
    ),
    stock,
  );
});
test("idempotent retries and duplicate completion deduct stock exactly once", async () => {
  const work = ok(await owner.get("/api/operations/work")).tasks.find(
    (t: any) => t.sourceKey?.startsWith("repeat:"),
  );
  const key = crypto.randomUUID();
  const body = { date: today, evidence: "Done", revision: work.revision };
  const first = ok(
    await owner
      .post(`/api/operations/tasks/${work.id}/complete`)
      .set("Idempotency-Key", key)
      .send(body),
  );
  const second = ok(
    await owner
      .post(`/api/operations/tasks/${work.id}/complete`)
      .set("Idempotency-Key", key)
      .send(body),
  );
  assert.equal(first.id, second.id);
  ok(await owner.post(`/api/operations/tasks/${work.id}/complete`).send(body));
  const movements = (await rows(s.stockLedger, farm.id)).filter(
    (m) => m.taskId === work.id,
  );
  assert.equal(movements.length, 1);
  assert.equal(Number(movements[0].quantity), -10);
  assert.equal(
    (
      await owner
        .post(`/api/operations/tasks/${work.id}/complete`)
        .set("Idempotency-Key", key)
        .send({ ...body, evidence: "changed" })
    ).status,
    409,
  );
});
let calves: any[] = [];
test("calving creates twins, parent links, calf protocols and postpartum review", async () => {
  const p = await post("/api/operations/protocols", {
    name: "Calf care",
    trigger: "birth",
    steps: [
      {
        title: "Calf growth review",
        offsetDays: 7,
        instructions: "Measure growth",
      },
    ],
  });
  await post(
    `/api/operations/protocols/${p.id}/approve`,
    { note: "Calf care review" },
    owner,
    200,
  );
  await post("/api/operations/events", {
    cattleId: cow.id,
    type: "calving",
    date: today,
    details: {
      calves: [
        { tagNumber: "CALF-A", gender: "female", weight: 29 },
        { tagNumber: "CALF-B", gender: "male", weight: 30 },
      ],
    },
  });
  calves = ok(await owner.get("/api/cattle")).filter(
    (a: any) => a.motherId === cow.id,
  );
  assert.equal(calves.length, 2);
  assert.equal(calves[0].lifeStage, "calf");
  const mother = ok(await owner.get(`/api/cattle/${cow.id}`));
  assert.equal(mother.productionStatus, "lactating");
  assert.equal(mother.expectedCalvingDate, null);
  const work = ok(await owner.get("/api/operations/work")).tasks;
  assert.equal(work.filter((t: any) => t.protocolId === p.id).length, 2);
  assert.ok(
    work.some(
      (t: any) => t.cattleId === cow.id && /Post-calving/.test(t.title),
    ),
  );
});
test("pregnancy loss cancels pregnancy tasks and creates urgent medical review", async () => {
  await post("/api/operations/events", {
    cattleId: cow.id,
    type: "expected_calving",
    date: today,
    details: { expectedDate: addDays(today, 150) },
  });
  await post("/api/operations/events", {
    cattleId: cow.id,
    type: "pregnancy_loss",
    date: today,
    notes: "Clinical review requested",
  });
  const animal = ok(await owner.get(`/api/cattle/${cow.id}`));
  assert.equal(animal.reproductiveStatus, "lost");
  assert.equal(animal.expectedCalvingDate, null);
  const work = ok(await owner.get("/api/operations/work")).tasks;
  assert.ok(
    work.some((t: any) => t.cattleId === cow.id && t.priority === "urgent"),
  );
  assert.equal(
    work.filter(
      (t: any) =>
        t.cattleId === cow.id &&
        t.trigger === "expected_calving" &&
        !["completed", "cancelled", "excluded"].includes(t.status),
    ).length,
    0,
  );
});
let batch: any;
test("twenty-calf batch supports partial completion and exclusions", async () => {
  for (let i = 0; i < 18; i++)
    calves.push(
      await post("/api/cattle", {
        tagNumber: `GROUP-${i}`,
        dateOfEntry: today,
        dateOfBirth: addDays(today, -45),
        stage: "calf",
        lifeStage: "calf",
        productionStatus: "not_lactating",
      }),
    );
  batch = await post("/api/operations/batches", {
    title: "Reviewed calf deworming",
    date: today,
    cattleIds: calves.map((c) => c.id),
    supplies: [{ itemId: item.id, quantity: 2 }],
    instructions: "Test veterinarian-approved protocol",
  });
  let work = ok(await owner.get("/api/operations/work")).tasks.filter(
    (t: any) => t.batchId === batch.id,
  );
  assert.equal(work.length, 20);
  await post(
    `/api/operations/batches/${batch.id}/complete`,
    {
      taskIds: work.slice(0, 7).map((t: any) => t.id),
      date: today,
      evidence: "Each selected calf completed",
    },
    owner,
    200,
  );
  ok(
    await owner.patch(`/api/operations/tasks/${work[7].id}`).send({
      status: "excluded",
      reason: "Veterinarian postponed this animal",
    }),
  );
  work = ok(await owner.get("/api/operations/work")).tasks.filter(
    (t: any) => t.batchId === batch.id,
  );
  assert.equal(work.filter((t: any) => t.status === "completed").length, 7);
  assert.equal(work.filter((t: any) => t.status === "excluded").length, 1);
  assert.equal(work.filter((t: any) => t.status === "pending").length, 12);
});
test("dynamic dry-cow group and individual diet override drive feeding cost and stock", async () => {
  const feed = await post("/api/inventory", {
    name: "Feed",
    unit: "kg",
    currentStock: "0",
  });
  await post("/api/operations/stock/receive", {
    itemId: feed.id,
    batchNumber: "F-1",
    quantity: 100,
    packCost: 10,
    receivedDate: today,
  });
  const group = await post("/api/operations/groups", {
    name: "Dry cows",
    kind: "dynamic",
    criteria: { productionStatus: "dry" },
  });
  await post("/api/operations/events", {
    cattleId: cow.id,
    type: "dry_off",
    date: today,
  });
  let groups = ok(await owner.get("/api/operations/groups"));
  assert.ok(
    groups
      .find((g: any) => g.id === group.id)
      .members.some((a: any) => a.id === cow.id),
  );
  await post("/api/operations/diets", {
    name: "Dry group ration",
    groupId: group.id,
    startDate: today,
    ingredients: [{ itemId: feed.id, quantity: 5 }],
    instructions: "Nutritionist review REF-3",
  });
  const special = await post("/api/operations/diets", {
    name: "Individual reviewed ration",
    cattleId: cow.id,
    startDate: today,
    ingredients: [{ itemId: feed.id, quantity: 3 }],
    instructions: "Nutritionist individual adjustment",
  });
  const effective = ok(
    await owner.get(`/api/operations/diet/${cow.id}?date=${today}`),
  );
  assert.equal(effective.id, special.id);
  await post("/api/operations/feeding", {
    cattleId: cow.id,
    date: today,
    factor: 1,
    refusal: 0.2,
  });
  const balance = ok(await owner.get("/api/operations/stock")).lots.find(
    (l: any) => l.itemId === feed.id,
  );
  assert.equal(Number(balance.quantity), 97);
  const cost = (await rows(s.cattleCosts, farm.id)).find(
    (c) => c.sourceType === "event" && c.category === "feed",
  );
  assert.equal(Number(cost.amount), 30);
});
test("legacy recurring task completion accepts timestamps and generates one next occurrence", async () => {
  const task = await post("/api/tasks", {
    title: "Check water",
    type: "maintenance",
    dueDate: today,
    isRecurring: true,
    recurringPattern: "daily",
  });
  ok(
    await owner
      .patch(`/api/tasks/${task.id}`)
      .send({ status: "completed", completedAt: new Date().toISOString() }),
  );
  const work = ok(await owner.get("/api/operations/work")).tasks;
  assert.equal(
    work.filter((t: any) => t.sourceKey === `recurrence:${task.id}`).length,
    1,
  );
});
test("reminder catch-up keeps old overdue actions visible and deduplicates alerts", async () => {
  const task = await post("/api/tasks", {
    title: "Old missed review",
    type: "health",
    dueDate: addDays(today, -100),
  });
  await evaluateCare(farm.id);
  await evaluateCare(farm.id);
  let matches = (await rows(s.alerts, farm.id)).filter(
    (a) => a.referenceId === task.id,
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].severity, "critical");
  ok(await owner.patch(`/api/alerts/${matches[0].id}`).send({ isRead: true }));
  assert.equal(
    (await rows(s.tasks, farm.id)).find((t) => t.id === task.id).status,
    "pending",
  );
});
test("complete report reconciles totals and includes each batch member, calf and audit entry", async () => {
  const r = ok(await owner.get("/api/operations/daily-report?date=" + today));

  assert.equal(r.milk.produced, 12.5);
  assert.equal(
    r.batches.find((b: any) => b.id === batch.id).animals.length,
    20,
  );
  assert.equal(r.batches.find((b: any) => b.id === batch.id).completed, 7);
  assert.ok(r.animals.some((a: any) => a.tagNumber === "CALF-A"));
  assert.ok(r.audit.length > 0, "Audit records must be in the report");
  assert.ok(r.stockMovements.length > 0);
  assert.ok(
    r.events.some((e: any) => e.type === "pregnancy_loss"),
    "Pregnancy loss event must be in the report",
  );

  const saved = await post("/api/operations/daily-report", { date: today });

  await post("/api/operations/events", {
    cattleId: calves[0].id,
    type: "observation",
    date: today,
    notes: "Late entry",
  });
  const frozen = ok(
    await owner.get(
      `/api/operations/daily-report?date=${today}&id=${saved.reportId}`,
    ),
  );
  assert.equal(frozen.events.length, saved.events.length);
  const revised = await post("/api/operations/daily-report", { date: today });
  assert.equal(revised.revision, saved.revision + 1);
});
test("PDF and Excel contain the complete report sections", async () => {
  const report = await buildDailyReport(farm.id, today);

  const pdf = await reportPdf(report);

  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
  const workbook = await reportWorkbook(report);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(workbook as any);
  assert.equal(book.getWorksheet("Batch work")!.rowCount, 21);
  assert.ok(book.getWorksheet("Audit trail")!.rowCount > 1);
  ok(
    await owner.get(
      `/api/operations/daily-report/export?date=${today}&format=pdf`,
    ),
  );
  ok(
    await owner.get(
      `/api/operations/daily-report/export?date=${today}&format=xlsx`,
    ),
  );
});
test("preview imports never write, commit preserves rows and repeated import is blocked", async () => {
  const csv = Buffer.from(
    `Tag Number*,Date of Entry* (YYYY-MM-DD),Gender* (male/female),Stage (calf/heifer/milking/dry/pregnant)\nIMPORTED-1,${today},female,heifer\n`,
  );
  const before = (await rows(s.cattle, farm.id)).length;
  const preview = ok(
    await owner.post("/api/import/cattle").attach("file", csv, {
      filename: "animals.csv",
      contentType: "text/csv",
    }),
  );
  assert.equal(preview.preview, true);
  assert.equal(preview.failed, 0, JSON.stringify(preview.errors));
  assert.equal((await rows(s.cattle, farm.id)).length, before);
  const committed = ok(
    await owner
      .post(`/api/import/cattle?commit=${preview.token}`)
      .attach("file", csv, {
        filename: "animals.csv",
        contentType: "text/csv",
      }),
  );
  assert.equal(committed.imported, 1);
  assert.equal((await rows(s.cattle, farm.id)).length, before + 1);
  const duplicate = await owner
    .post(`/api/import/cattle?commit=${preview.token}`)
    .attach("file", csv, { filename: "animals.csv", contentType: "text/csv" });
  assert.ok(duplicate.status >= 400);
});
test("payment amounts and initial balances reconcile", async () => {
  const transaction = await post("/api/cattle-transactions", {
    cattleId: calves[0].id,
    type: "purchase",
    date: today,
    amount: "1000",
    paidAmount: "400",
  });
  let payments = ok(
    await owner.get(`/api/cattle-transactions/${transaction.id}/payments`),
  );
  assert.equal(
    payments.reduce((n: number, p: any) => n + Number(p.amount), 0),
    400,
  );
  assert.equal(
    (
      await owner
        .post(`/api/cattle-transactions/${transaction.id}/payments`)
        .send({ date: today, amount: "601" })
    ).status,
    400,
  );
  await post(`/api/cattle-transactions/${transaction.id}/payments`, {
    date: today,
    amount: "600",
  });
  assert.equal(
    ok(await owner.get(`/api/cattle-transactions/${transaction.id}`))
      .paymentStatus,
    "paid",
  );
});
test("daily schedule catches up once and archives after the local cutoff", async () => {
  await post(
    "/api/operations/report-schedule",
    { cutoff: "00:00", status: "active", recipients: [] },
    owner,
    200,
  );
  await evaluateCare(farm.id);
  const before = (await rows(s.dailyReports, farm.id)).length;
  await evaluateCare(farm.id);
  assert.equal((await rows(s.dailyReports, farm.id)).length, before);
  assert.equal((await rows(s.reportSchedules, farm.id))[0].lastDate, today);
});
test("additive migration is repeatable and preserves farm data", async () => {
  const count = (await rows(s.cattle, farm.id)).length;
  const upgrade = await fs.readFile("migrations/upgrade-existing.sql", "utf8");
  await engine.exec(upgrade);
  await engine.exec(upgrade);
  assert.equal((await rows(s.cattle, farm.id)).length, count);
});
test("database backup restores stock, reports and animal history into an isolated database", async () => {
  const dump = await engine.dumpDataDir();
  const { PGlite } = await import("@electric-sql/pglite");
  const restored = new PGlite({ loadDataDir: dump });
  try {
    for (const table of [
      "cattle",
      "tasks",
      "stock_lots",
      "farm_events",
      "daily_reports",
    ]) {
      const original = await engine.query(
        `select count(*)::int n from ${table}`,
      );
      const copy = await restored.query(`select count(*)::int n from ${table}`);
      assert.deepEqual(copy.rows, original.rows);
    }
  } finally {
    await restored.close();
  }
});

test("zero milk is recorded, withheld milk is discarded and sales cannot exceed saleable stock", async () => {
  const animal = await post("/api/cattle", {
    tagNumber: "MILK-HOLD",
    dateOfEntry: today,
    stage: "milking",
    productionStatus: "lactating",
  });
  const day = addDays(today, -2);
  await post("/api/operations/events", {
    cattleId: animal.id,
    type: "treatment",
    date: day,
    details: {
      instructions: "Synthetic approved test instruction",
      milkWithdrawalDays: 3,
    },
  });
  assert.equal(
    (
      await owner.post("/api/milk").send({
        cattleId: animal.id,
        date: day,
        session: "morning",
        quantity: 5,
      })
    ).status,
    409,
  );
  await post("/api/milk", {
    cattleId: animal.id,
    date: day,
    session: "morning",
    quantity: 5,
    destination: "discarded",
  });
  await post("/api/milk", {
    cattleId: animal.id,
    date: day,
    session: "evening",
    quantity: 0,
    destination: "discarded",
  });
  let report = await buildDailyReport(farm.id, day);
  assert.equal(report.milk.discardedAtMilking, 5);
  assert.equal(report.milk.unallocated, 0);
  assert.equal(
    report.milk.missing.some((m: any) => m.id === animal.id),
    false,
  );
  assert.equal(
    (
      await owner
        .post("/api/milk-sales")
        .send({ date: day, quantity: 1, pricePerLiter: 40 })
    ).status,
    409,
  );
  await post("/api/operations/milk-disposition", {
    date: day,
    kind: "opening_stock",
    quantity: 10,
    notes: "Test opening bulk balance",
  });
  await post("/api/milk-sales", { date: day, quantity: 8, pricePerLiter: 40 });
  report = await buildDailyReport(farm.id, day);
  assert.equal(report.milk.unallocated, 2);
});

test("bulk milk entry rejects a duplicate atomically", async () => {
  const animal = await post("/api/cattle", {
    tagNumber: "BULK-COW",
    dateOfEntry: today,
    stage: "milking",
    productionStatus: "lactating",
  });
  const record = {
    cattleId: animal.id,
    date: today,
    session: "morning",
    quantity: 4,
  };
  assert.equal(
    (
      await owner
        .post("/api/operations/milk-bulk")
        .send({ entries: [record, record] })
    ).status,
    409,
  );
  assert.equal(
    (await rows(s.milkEntries, farm.id)).filter((m) => m.cattleId === animal.id)
      .length,
    0,
  );
  const saved = await post("/api/operations/milk-bulk", {
    entries: [record, { ...record, session: "evening", quantity: 0 }],
  });
  assert.equal(saved.entries.length, 2);
});

test("protocol version changes replace pending steps and preserve completed work", async () => {
  const animal = await post("/api/cattle", {
    tagNumber: "PROTOCOL-VERSIONS",
    dateOfEntry: today,
    stage: "heifer",
  });
  await post("/api/operations/events", {
    cattleId: animal.id,
    type: "expected_calving",
    date: today,
    details: { expectedDate: addDays(today, 30) },
  });
  const p = await post("/api/operations/protocols", {
    name: "Version test",
    trigger: "expected_calving",
    steps: [
      { title: "First step", offsetDays: -15 },
      { title: "Second step", offsetDays: -10 },
    ],
  });
  await post(
    `/api/operations/protocols/${p.id}/approve`,
    { note: "Reviewed V1" },
    owner,
    200,
  );
  const work = (await rows(s.tasks, farm.id)).filter(
    (t) => t.protocolId === p.id && t.cattleId === animal.id,
  );
  await post(
    `/api/operations/tasks/${work[0].id}/complete`,
    { date: today, evidence: "Reviewed completion" },
    owner,
    200,
  );
  const next = await post("/api/operations/protocols", {
    familyId: p.familyId,
    name: p.name,
    trigger: p.trigger,
    steps: [
      { title: "First step revised", offsetDays: -14 },
      { title: "Second step revised", offsetDays: -9 },
    ],
  });
  await post(
    `/api/operations/protocols/${next.id}/approve`,
    { note: "Reviewed V2" },
    owner,
    200,
  );
  const all = await rows(s.tasks, farm.id);
  assert.equal(all.find((t) => t.id === work[0].id).status, "completed");
  assert.equal(all.find((t) => t.id === work[1].id).status, "cancelled");
  assert.equal(
    all.filter((t) => t.protocolId === next.id && t.cattleId === animal.id)
      .length,
    1,
  );
});

test("legacy inventory reconciliation preserves the total and prevents duplicate opening stock", async () => {
  const [legacy] = await db
    .insert(s.inventoryItems)
    .values({
      tenantId: farm.id,
      name: "Legacy consumable",
      unit: "piece",
      currentStock: "25",
    })
    .returning();
  const input = {
    itemId: legacy.id,
    batchNumber: "OPEN-25",
    packs: 25,
    unitsPerPack: 1,
    packCost: 5,
    receivedDate: today,
  };
  await post("/api/operations/stock/reconcile", input);
  const state = ok(await owner.get("/api/operations/stock"));
  assert.equal(
    state.forecast.find((i: any) => i.id === legacy.id).available,
    25,
  );
  assert.equal(
    Number(
      (await rows(s.inventoryItems, farm.id)).find((i) => i.id === legacy.id)
        .currentStock,
    ),
    25,
  );
  assert.equal(
    (await owner.post("/api/operations/stock/reconcile").send(input)).status,
    409,
  );
  assert.equal(
    state.ledger.find((l: any) => l.itemId === legacy.id).type,
    "opening_reconciliation",
  );
});

test("FEFO consumption splits lots and opened-vial expiry prevents use", async () => {
  const product = await post("/api/inventory", {
    name: "FEFO test",
    unit: "ml",
    currentStock: "0",
  });
  const common = {
    itemId: product.id,
    unitsPerPack: 1,
    packCost: 2,
    receivedDate: addDays(today, -10),
  };
  const early = await post("/api/operations/stock/receive", {
    ...common,
    batchNumber: "EARLY",
    packs: 5,
    expiryDate: addDays(today, 5),
  });
  const late = await post("/api/operations/stock/receive", {
    ...common,
    batchNumber: "LATE",
    packs: 10,
    expiryDate: addDays(today, 50),
  });
  const opened = await post("/api/operations/stock/receive", {
    ...common,
    batchNumber: "OPENED",
    packs: 50,
    usableDays: 1,
    expiryDate: addDays(today, 100),
  });
  await post(
    `/api/operations/stock/${opened.id}/move`,
    { type: "open", date: addDays(today, -5), reason: "Opened under test" },
    owner,
    200,
  );
  await post("/api/operations/events", {
    cattleId: cow.id,
    type: "treatment",
    date: today,
    details: {
      instructions: "Test only",
      supplies: [{ itemId: product.id, quantity: 8 }],
    },
  });
  const lots = await rows(s.stockLots, farm.id);
  assert.equal(Number(lots.find((l) => l.id === early.id).quantity), 0);
  assert.equal(Number(lots.find((l) => l.id === late.id).quantity), 7);
  assert.equal(Number(lots.find((l) => l.id === opened.id).quantity), 50);
});

test("duplicate identity merge preserves history, parent links and detects stale revisions", async () => {
  const source = await post("/api/cattle", {
    tagNumber: "MERGE-SOURCE",
    dateOfEntry: today,
    stage: "heifer",
  });
  const target = await post("/api/cattle", {
    tagNumber: "MERGE-TARGET",
    dateOfEntry: today,
    stage: "heifer",
  });
  const child = await post("/api/cattle", {
    tagNumber: "MERGE-CHILD",
    dateOfEntry: today,
    stage: "calf",
    motherId: source.id,
  });
  const event = await post("/api/operations/events", {
    cattleId: source.id,
    type: "observation",
    date: today,
    notes: "History must be retained",
  });
  let preview = ok(
    await owner.get(
      `/api/operations/merge-preview?source=${source.id}&target=${target.id}`,
    ),
  );
  const input = {
    sourceId: source.id,
    targetId: target.id,
    sourceRevision: preview.source.revision,
    targetRevision: preview.target.revision,
    reason: "Reviewed duplicate identity",
  };
  ok(
    await owner
      .patch(`/api/cattle/${source.id}`)
      .send({ name: "Changed after preview" }),
  );
  assert.equal(
    (await owner.post("/api/operations/merge").send(input)).status,
    409,
  );
  preview = ok(
    await owner.get(
      `/api/operations/merge-preview?source=${source.id}&target=${target.id}`,
    ),
  );
  await post(
    "/api/operations/merge",
    { ...input, sourceRevision: preview.source.revision },
    owner,
    200,
  );
  assert.equal(
    ok(await owner.get(`/api/cattle/${child.id}`)).motherId,
    target.id,
  );
  assert.equal(
    (await rows(s.farmEvents, farm.id)).find((e) => e.id === event.id).cattleId,
    target.id,
  );
  assert.equal(
    ok(await owner.get(`/api/cattle/${source.id}`)).mergedIntoId,
    target.id,
  );
});

test("configured gestation and testing offsets follow the linked current service", async () => {
  const animal = await post("/api/cattle", {
    tagNumber: "LINKED-AI",
    dateOfEntry: today,
    stage: "heifer",
    gender: "female",
  });
  const service = await post("/api/breeding/inseminations", {
    cattleId: animal.id,
    date: addDays(today, -40),
    method: "ai",
  });
  const work = (await rows(s.tasks, farm.id)).find(
    (t) => t.sourceKey === `service:${service.id}:test`,
  );
  assert.equal(work.dueDate, addDays(today, -8));
  await post("/api/breeding/pregnancy-tests", {
    cattleId: animal.id,
    inseminationId: service.id,
    testDate: today,
    result: "positive",
  });
  assert.equal(
    ok(await owner.get(`/api/cattle/${animal.id}`)).expectedCalvingDate,
    addDays(service.date, 285),
  );
  assert.equal(
    (await rows(s.tasks, farm.id)).find((t) => t.id === work.id).status,
    "completed",
  );
});

test("all operational read APIs remain available after the complete workflow", async () => {
  for (const path of [
    "/api/dashboard/stats",
    "/api/breeding/analytics",
    "/api/cattle",
    "/api/milk",
    "/api/health",
    "/api/tasks",
    "/api/inventory",
    "/api/operations/work",
    "/api/operations/people",
    "/api/operations/preferences",
    "/api/operations/events",
    "/api/operations/groups",
    "/api/operations/protocols",
    "/api/operations/stock",
    "/api/operations/diets",
    "/api/operations/quality",
    "/api/operations/report-archive",
    "/api/operations/daily-report?date=" + today,
  ]) {
    const result = await owner.get(path);
    assert.equal(result.status, 200, path + ": " + JSON.stringify(result.body));
  }
});

test("completing dry-off work changes production status and schedules diet review", async () => {
  const animal = await post("/api/cattle", {
    tagNumber: "DRY-ACTION",
    dateOfEntry: today,
    stage: "milking",
    productionStatus: "lactating",
  });
  await post("/api/operations/events", {
    cattleId: animal.id,
    type: "expected_calving",
    date: today,
    details: { expectedDate: addDays(today, 55) },
  });
  const task = (await rows(s.tasks, farm.id)).find(
    (t) => t.cattleId === animal.id && t.sourceKey?.endsWith(":dry"),
  );
  await post(
    `/api/operations/tasks/${task.id}/complete`,
    { date: today, evidence: "Dry-off completed according to reviewed plan" },
    owner,
    200,
  );
  assert.equal(
    ok(await owner.get(`/api/cattle/${animal.id}`)).productionStatus,
    "dry",
  );
  assert.equal(
    (await rows(s.tasks, farm.id)).filter(
      (t) => t.cattleId === animal.id && t.sourceKey?.startsWith("dry-diet:"),
    ).length,
    1,
  );
});

test("the upgrade supports a legacy schema without new tables or status columns", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const legacy = new PGlite({ loadDataDir: await engine.dumpDataDir() });
  try {
    const before = await legacy.query("select count(*)::int n from cattle");
    for (const table of [
      "animal_groups",
      "care_protocols",
      "daily_reports",
      "diet_plans",
      "farm_events",
      "operation_receipts",
      "report_schedules",
      "stock_ledger",
      "stock_lots",
      "work_batches",
    ])
      await legacy.exec(`DROP TABLE ${table}`);
    for (const column of [
      "species",
      "life_stage",
      "production_status",
      "reproductive_status",
      "health_status",
      "pen",
      "weight_kg",
      "expected_calving_date",
      "breeding_cycle_id",
      "milk_withhold_until",
      "meat_withhold_until",
      "merged_into_id",
      "revision",
    ])
      await legacy.exec(`ALTER TABLE cattle DROP COLUMN ${column}`);
    for (const column of [
      "batch_id",
      "source_key",
      "trigger",
      "cycle_id",
      "protocol_id",
      "protocol_version",
      "supplies",
      "clinical",
      "evidence_required",
      "evidence",
      "reason",
      "original_due_date",
      "revision",
    ])
      await legacy.exec(`ALTER TABLE tasks DROP COLUMN ${column}`);
    await legacy.exec("ALTER TABLE milk_entries DROP COLUMN destination");
    await legacy.exec(
      await fs.readFile("migrations/upgrade-existing.sql", "utf8"),
    );
    assert.deepEqual(
      (await legacy.query("select count(*)::int n from cattle")).rows,
      before.rows,
    );
    assert.equal(
      (
        await legacy.query(
          "select count(*)::int n from cattle where life_stage is null",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await legacy.query(
          "select count(*)::int n from milk_entries where destination is null",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await legacy.query("select count(*)::int n from care_protocols")).rows[0]
        .n,
      0,
    );
  } finally {
    await legacy.close();
  }
});

test("legacy treatments remain in individual reports and enforce milk withdrawal", async () => {
  const animal = await post("/api/cattle", {
    tagNumber: "LEGACY-TREATMENT",
    dateOfEntry: today,
    stage: "milking",
    productionStatus: "lactating",
  });
  const health = await post("/api/health", {
    cattleId: animal.id,
    eventType: "illness",
    date: today,
    description: "Synthetic historical case",
  });
  const [treatment] = await db
    .insert(s.treatments)
    .values({
      tenantId: farm.id,
      healthEventId: health.id,
      medicineName: "Synthetic historical treatment",
      date: today,
      withdrawalDays: 3,
      withdrawalEndsAt: addDays(today, 3),
    })
    .returning();
  assert.equal(
    (
      await owner
        .post("/api/milk")
        .send({
          cattleId: animal.id,
          date: today,
          session: "morning",
          quantity: 1,
        })
    ).status,
    409,
  );
  const report = await buildDailyReport(farm.id, today);
  assert.equal(
    report.animals
      .find((a: any) => a.id === animal.id)
      .entries.some(
        (e: any) => e.id === treatment.id && e.type === "treatment",
      ),
    true,
  );
});
