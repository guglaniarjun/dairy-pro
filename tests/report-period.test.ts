import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { isolatedDatabase } from "./database";
import { db, pool } from "../server/db";
import * as s from "../shared/schema";
import { coveredReportDate, dueReportDates, matchesReportIdentity } from "../shared/report-period";
import { evaluateCare } from "../server/care-worker";
import { buildDailyReport, rows } from "../server/care-service";
import { registerOperations } from "../server/operations-routes";
import { farmDay } from "../shared/care";
import { briefingView } from "../shared/daily-briefing";

let engine: any, user: any, sequence = 0;
before(async () => {
  process.env.WHATSAPP_WEB_ENABLED = "false";
  ({ engine } = await isolatedDatabase());
  [user] = await db.insert(s.users).values({ email: "report-test@example.invalid", firstName: "Report test" }).returning();
});
after(async () => { await engine?.close(); await pool.end(); });
async function farm() {
  const [tenant] = await db.insert(s.tenants).values({ name: "Report test", slug: `report-test-${++sequence}`, ownerId: user.id }).returning();
  await db.insert(s.farmSettings).values({ tenantId: tenant.id, timezone: "Asia/Kolkata" });
  return tenant;
}
function api(tenantId: string) {
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.tenantId = tenantId; req.user = user; req.tenantPermissions = ["reports.view", "settings.manage", "tasks.manage", "health.manage"]; next(); });
  registerOperations(app, (_req, _res, next) => next(), (_req, _res, next) => next());
  return request(app);
}

test("morning and evening use delivery dates without confusing saved identities", () => {
  assert.equal(coveredReportDate("2026-11-22", "morning"), "2026-11-21");
  assert.equal(coveredReportDate("2026-11-22", "evening"), "2026-11-22");
  const saved = { date: "2026-11-21", period: "morning", briefingDate: "2026-11-22" };
  assert.equal(matchesReportIdentity(saved, "2026-11-22", "morning"), true);
  assert.equal(matchesReportIdentity(saved, "2026-11-21", "evening"), false);
  assert.equal(matchesReportIdentity(saved, "2026-11-21", "daily"), false);
  assert.deepEqual(dueReportDates("2026-11-20", "2026-11-20", "2026-11-22", "07:29", "07:30"), ["2026-11-21"]);
});

test("each farm-local cutoff archives once and advances only its own cursor", async () => {
  const f = await farm();
  await db.insert(s.reportSchedules).values({ tenantId: f.id, mode: "briefings", briefingStartDate: "2026-11-22", recipients: ["+919999999999"] });
  await evaluateCare(f.id, new Date("2026-11-22T01:59:00Z"));
  assert.equal((await rows(s.dailyReports, f.id)).length, 0);
  await evaluateCare(f.id, new Date("2026-11-22T02:00:00Z"));
  let reports = await rows(s.dailyReports, f.id);
  assert.equal(reports.length, 1); assert.equal(reports[0].period, "morning");
  assert.equal(reports[0].date, "2026-11-21"); assert.equal(reports[0].briefingDate, "2026-11-22");
  let schedule = (await rows(s.reportSchedules, f.id))[0];
  assert.equal(schedule.morningLastDate, "2026-11-22"); assert.equal(schedule.eveningLastDate, null);
  await evaluateCare(f.id, new Date("2026-11-22T02:01:00Z"));
  assert.equal((await rows(s.dailyReports, f.id)).length, 1);
  await evaluateCare(f.id, new Date("2026-11-22T14:00:00Z"));
  await evaluateCare(f.id, new Date("2026-11-22T14:01:00Z"));
  reports = await rows(s.dailyReports, f.id);
  assert.deepEqual(reports.map(r => r.period).sort(), ["evening", "morning"]);
  assert.equal((await rows(s.whatsappLogs, f.id)).length, 2, "Only isolated pending messages; no gateway is started");
  assert.ok((await rows(s.whatsappLogs, f.id)).every(r => r.status === "pending" && r.message.includes("period=")));
  schedule = (await rows(s.reportSchedules, f.id))[0];
  assert.equal(schedule.lastDate, null, "The original daily cursor is preserved");
  assert.equal(schedule.eveningLastDate, "2026-11-22");
});

test("downtime recovers every missed briefing, including the previous evening", async () => {
  const f = await farm();
  await db.insert(s.reportSchedules).values({ tenantId: f.id, mode: "briefings", briefingStartDate: "2026-11-20", morningLastDate: "2026-11-20", eveningLastDate: "2026-11-19" });
  await evaluateCare(f.id, new Date("2026-11-22T02:00:00Z"));
  const identities = (await rows(s.dailyReports, f.id)).map(r => `${r.period}:${r.briefingDate}`).sort();
  assert.deepEqual(identities, ["evening:2026-11-20", "evening:2026-11-21", "morning:2026-11-21", "morning:2026-11-22"]);
  await evaluateCare(f.id, new Date("2026-11-22T02:01:00Z"));
  assert.equal((await rows(s.dailyReports, f.id)).length, 4);
});

test("archive loading never substitutes another period and revisions remain independent", async () => {
  const f = await farm(), client = api(f.id);
  const daily = await buildDailyReport(f.id, "2026-11-21", user.id, true);
  const morning = await buildDailyReport(f.id, "2026-11-21", user.id, true, { period: "morning", briefingDate: "2026-11-22" });
  const evening = await buildDailyReport(f.id, "2026-11-21", user.id, true, { period: "evening", briefingDate: "2026-11-21" });
  assert.equal(daily.revision, 1); assert.equal(morning.revision, 1); assert.equal(evening.revision, 1);
  const again = await client.post("/api/operations/daily-report").send({ date: "2026-11-22", period: "morning" });
  assert.equal(again.status, 201, JSON.stringify(again.body)); assert.equal(again.body.revision, 2);
  const selected = await client.get("/api/operations/daily-report?date=2026-11-22&period=morning");
  assert.equal(selected.status, 200); assert.equal(selected.body.reportId, again.body.reportId);
  const wrong = await client.get(`/api/operations/daily-report?date=2026-11-22&period=morning&id=${evening.reportId}`);
  assert.equal(wrong.status, 409);
  const legacy = await client.get(`/api/operations/daily-report?date=2026-11-21&id=${daily.reportId}`);
  assert.equal(legacy.status, 200); assert.equal(legacy.body.reportId, daily.reportId);
  const absent = await client.get("/api/operations/daily-report?date=2026-11-23&period=morning");
  assert.equal(absent.status, 200); assert.equal(absent.body.revision, null); assert.equal(absent.body.briefing.date, "2026-11-23");
});

test("legacy schedules stay single-cutoff; opting in starts two briefings today", async () => {
  const f = await farm(), client = api(f.id);
  let result = await client.post("/api/operations/report-schedule").send({ cutoff: "00:00", status: "active", recipients: [] });
  assert.equal(result.status, 200); assert.equal(result.body.mode, "legacy");
  await db.update(s.reportSchedules).set({ createdAt: new Date("2026-01-01T00:00:00Z") }).where(eq(s.reportSchedules.tenantId, f.id));
  result = await client.post("/api/operations/report-schedule").send({ mode: "briefings", morningTime: "07:00", eveningTime: "19:00", status: "active", recipients: [] });
  assert.equal(result.status, 200); assert.equal(result.body.briefingStartDate, farmDay("Asia/Kolkata"));
  assert.equal((await client.post("/api/operations/report-schedule").send({ mode: "briefings", morningTime: "20:00", eveningTime: "07:00", status: "active" })).status, 400);
  const migration = await fs.readFile("migrations/0003_morning_evening_reports.sql", "utf8");
  await engine.exec(migration); await engine.exec(migration);
  assert.equal((await rows(s.reportSchedules, f.id))[0].mode, "briefings");
});

test("single and batch task completion preserve explicit medicine administration without inventing missing details", async () => {
  const f = await farm(), client = api(f.id), date = farmDay("Asia/Kolkata");
  const animals = await db.insert(s.cattle).values(["A", "B", "C"].map(tagNumber => ({ tenantId: f.id, tagNumber, dateOfEntry: date }))).returning();
  const [single] = await db.insert(s.tasks).values({ tenantId: f.id, cattleId: animals[0].id, title: "Recorded medicine administration", type: "health", clinical: {}, dueDate: date }).returning();
  const administration = { medicineName: "Explicit test medicine", dosage: "2 mL", route: "oral", administeredBy: "Actual giver", administrationTime: "06:35" };
  let result = await client.post(`/api/operations/tasks/${single.id}/complete`).send({ date, evidence: "Actual administration recorded", administration });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body.evidence.administration, administration);
  const created = await client.post("/api/operations/batches").send({ title: "Actual group administration", date, cattleIds: animals.slice(1).map(a => a.id), clinical: {}, supplies: [] });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const batch = (await rows(s.workBatches, f.id))[0];
  const children = (await rows(s.tasks, f.id)).filter(t => t.batchId === batch.id);
  result = await client.post(`/api/operations/batches/${batch.id}/complete`).send({ date, taskIds: children.map(t => t.id), evidence: "Actual medicine given, other details unknown", administration: { medicineName: "Medicine with unknown details", administrationTime: "25:00" } });
  assert.equal(result.status, 400);
  assert.ok((await rows(s.tasks, f.id)).filter(t => t.batchId === batch.id).every(t => t.status === "pending"));
  result = await client.post(`/api/operations/batches/${batch.id}/complete`).send({ date, taskIds: children.map(t => t.id), evidence: "Actual medicine given, other details unknown", administration: { medicineName: "Medicine with unknown details" } });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const report = await buildDailyReport(f.id, date, user.id, false, { period: "evening", briefingDate: date });
  const meds = briefingView(report).medicines;
  assert.equal(meds.length, 3, "One actual dose per animal, not a duplicate from task and event");
  const explicit = meds.find(m => m.cattleId === animals[0].id)!;
  assert.equal(explicit.medicineName, administration.medicineName); assert.equal(explicit.dosage, "2 mL");
  assert.equal(explicit.route, "oral"); assert.equal(explicit.administeredBy, "Actual giver"); assert.equal(explicit.administeredAt, "06:35");
  for (const med of meds.filter(m => m.cattleId !== animals[0].id)) {
    assert.equal(med.medicineName, "Medicine with unknown details"); assert.equal(med.administeredBy, null);
    assert.equal(med.administeredAt, null); assert.equal(med.dosage, null); assert.equal(med.route, null);
  }
});
