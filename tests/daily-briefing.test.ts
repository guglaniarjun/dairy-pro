import { test } from "node:test";
import assert from "node:assert/strict";
import { briefingView, briefingMedicines, compareMilkSession, restrictionActive } from "../shared/daily-briefing";
import { administrationSchema } from "../shared/care";

const date = "2026-11-21";
const rules = { lookbackDays: 7, minRecords: 5, dropPercent: 20, minDropLitres: 1 };
const history = (values: number[]) => values.map((quantity, i) => ({ cattleId: "a", date: `2026-11-${String(14 + i).padStart(2, "0")}`, session: "evening", quantity }));
const animal = { id: "a", tagNumber: "A1", status: "active", productionStatus: "lactating" };
const base = () => ({ date, generatedAt: "2026-11-22T02:00:00.000Z", timezone: "Asia/Kolkata",
  briefing: { period: "morning", date: "2026-11-22", coveredDate: date, actionDate: "2026-11-22" },
  animals: [animal], milk: { entries: [{ cattleId: "a", date, session: "morning", quantity: 10 }], history: history([5, 5, 5, 5, 5, 5, 5]), comparisonRules: rules }, tasks: [], events: [], entries: [] });

test("session comparison uses earlier calendar dates and includes measured zero/discarded production", () => {
  const entries = [...history([0, 5, 5, 5, 5, 5, 5]),
    { cattleId: "a", date: "2026-11-13", session: "evening", quantity: 999 },
    { cattleId: "a", date, session: "evening", quantity: 999 },
    { cattleId: "a", date: "2026-11-22", session: "evening", quantity: 999 },
    { cattleId: "other", date: "2026-11-20", session: "evening", quantity: 999 },
    { cattleId: "a", date: "2026-11-20", session: "morning", quantity: 999 }];
  (entries[1] as any).destination = "discarded";
  const value = compareMilkSession(entries, "a", "evening", 3, date, rules);
  assert.equal(value.baseline.sampleCount, 7);
  assert.equal(value.baseline.mean, 30 / 7);
  assert.equal(value.comparison.isLow, true);
});

test("measured zero can flag a low yield; missing, insufficient history and zero baselines stay distinct", () => {
  assert.equal(compareMilkSession(history([5, 5, 5, 5, 5]), "a", "evening", 0, date, rules).comparison.isLow, true);
  assert.equal(compareMilkSession(history([5, 5, 5, 5, 5]), "a", "evening", null, date, rules).comparison.reason, "missing");
  assert.equal(compareMilkSession(history([5, 5, 5, 5]), "a", "evening", 0, date, rules).comparison.reason, "insufficient_history");
  const zero = compareMilkSession(history([0, 0, 0, 0, 0]), "a", "evening", 0, date, rules).comparison;
  assert.equal(zero.reason, "zero_baseline");
  assert.equal(zero.deltaPercent, null);
  assert.equal(zero.isLow, false);
});

test("both litre and percentage thresholds must be met and cutoff excludes later-entered history", () => {
  assert.equal(compareMilkSession(history([4, 4, 4, 4, 4]), "a", "evening", 3.1, date, rules).comparison.isLow, false);
  assert.equal(compareMilkSession(history([10, 10, 10, 10, 10]), "a", "evening", 8.5, date, rules).comparison.isLow, false);
  assert.equal(compareMilkSession(history([5, 5, 5, 5, 5]), "a", "evening", 4, date, rules).comparison.isLow, true);
  const entries = history([5, 5, 5, 5, 5]);
  (entries[0] as any).createdAt = "2026-11-23T00:00:00Z";
  assert.equal(compareMilkSession(entries, "a", "evening", 1, date, rules, "2026-11-22T00:00:00Z").baseline.sampleCount, 4);
});

test("morning model keeps prior-day subtotal separate from current morning and uses action-date countdowns", () => {
  const report: any = base();
  report.tasks = [
    { id: "old", cattleId: "a", title: "Old entry", dueDate: "2026-09-01", priority: "low", status: "pending" },
    { id: "urgent", cattleId: "a", title: "Review", dueDate: "2026-11-22", dueTime: "08:30", priority: "urgent", status: "pending", assignedToName: "Amit" },
  ];
  report.milk.currentMorning = [
    { cattleId: "a", date: "2026-11-22", session: "morning", quantity: 9, createdAt: "2026-11-22T01:30:00Z" },
    { cattleId: "b", date: "2026-11-22", session: "morning", quantity: 8, createdAt: "2026-11-22T03:00:00Z" },
  ];
  const view = briefingView(report);
  assert.equal(view.coveredDate, date);
  assert.equal(view.milkRows[0].total, 10);
  assert.equal(view.milkRows[0].pmComparison.reason, "missing");
  assert.equal(view.milkRows[0].isSubtotal, true);
  assert.equal(view.totals.missingEntries, 1);
  assert.equal(view.currentMorning.total, 9);
  assert.equal(view.actions[0].id, "urgent");
  assert.equal(view.actions[0].countdown, "Due today");
  assert.equal(view.actions[0].dueTime, "08:30");
  assert.equal(view.actions[0].assignedTo, "Amit");
});

test("medicine list ignores diagnosis text and pending clinical plans; distinguishes actual date from entry date", () => {
  const report: any = base();
  report.entries = [
    { id: "h", type: "health", cattleId: "a", date, description: "Medicine X given" },
    { id: "t", type: "treatment", cattleId: "a", date, medicineName: "Recorded medicine", dosage: "2 mL", route: "oral", createdAt: "2026-11-22T01:00:00Z" },
    { id: "late", type: "treatment", cattleId: "a", date: "2026-11-20", medicineName: "Older medicine", createdAt: "2026-11-21T01:00:00Z" },
  ];
  report.tasks = [{ id: "planned", cattleId: "a", status: "pending", clinical: { milkWithdrawalDays: 3 }, supplies: [{ name: "Planned" }] }];
  const meds = briefingMedicines(report, date);
  assert.equal(meds.length, 1);
  assert.equal(meds[0].medicineName, "Recorded medicine");
  assert.equal(meds[0].administeredAt, null, "creation time must not be reported as dose time");
  assert.equal(meds[0].administeredBy, null);
});

test("structured vaccination and its matching event count once and retain actual consumed supply evidence", () => {
  const report: any = base();
  report.entries = [{ id: "v1", type: "vaccination", cattleId: "a", date, vaccineName: "Vaccine X", administeredByName: "Ravi" }];
  report.events = [{ id: "v-event", type: "vaccination", cattleId: "a", date,
    payload: { vaccineName: "Vaccine X", consumed: [{ item: "Vaccine X", quantity: 2, unit: "mL" }] } }];
  const meds = briefingMedicines(report, date);
  assert.equal(meds.length, 1);
  assert.equal(meds[0].administeredBy, "Ravi");
  assert.equal(meds[0].supplies[0].quantity, 2);
});

test("completed clinical task and completion event count once using consumption rather than planned quantity", () => {
  const report: any = base();
  report.tasks = [{ id: "t1", status: "completed", cattleId: "a", clinical: { milkWithdrawalDays: 3 },
    completedAt: "2026-11-21T12:00:00Z", completedByName: "Amit", supplies: [{ name: "Plan only", quantity: 999 }],
    evidence: { date, consumed: [{ item: "Actual medicine", quantity: 1, unit: "mL" }] } }];
  report.events = [{ id: "e1", type: "task_completed", date, cattleId: "a",
    payload: { taskId: "t1", clinical: { milkWithdrawalDays: 3 }, consumed: [{ item: "Actual medicine", quantity: 1, unit: "mL" }] } }];
  const meds = briefingMedicines(report, date);
  assert.equal(meds.length, 1);
  assert.equal(meds[0].medicineName, "Actual medicine");
  assert.equal(meds[0].supplies[0].quantity, 1);
  assert.equal(meds[0].administeredBy, null, "task completer is not necessarily the person who administered medicine");
  assert.equal(meds[0].administeredAt, null);
});

test("restriction expiry uses the actual timestamp, while legacy date-only records include the farm date", () => {
  assert.equal(restrictionActive("2026-11-22T02:00:00Z", "2026-11-22T02:00:00Z", "Asia/Kolkata"), false);
  assert.equal(restrictionActive("2026-11-22T02:00:01Z", "2026-11-22T02:00:00Z", "Asia/Kolkata"), true);
  assert.equal(restrictionActive("2026-11-22", "2026-11-22T17:00:00Z", "Asia/Kolkata"), true);
  assert.equal(restrictionActive("2026-11-21", "2026-11-22T02:00:00Z", "Asia/Kolkata"), false);
});

test("actual administration details are optional, validate farm time and retain explicit given-by provenance", () => {
  assert.deepEqual(administrationSchema.parse({}), {});
  assert.equal(administrationSchema.safeParse({ administrationTime: "25:05" }).success, false);
  assert.equal(administrationSchema.safeParse({ administrationTime: "08:75" }).success, false);
  const report: any = base();
  report.tasks = [{ id: "t", status: "completed", cattleId: "a", completedByName: "Entry operator", completedAt: "2026-11-21T12:00:00Z",
    evidence: { date, administration: { medicineName: "Actual medicine", dosage: "2 mL", route: "oral", administeredBy: "Ravi", administrationTime: "17:15" } } }];
  const [med] = briefingMedicines(report, date);
  assert.equal(med.administeredBy, "Ravi");
  assert.equal(med.administeredAt, "17:15");
  assert.equal(med.dosage, "2 mL");
  assert.equal(med.route, "oral");
});

test("customer upcoming activities exclude completed and far-future work and keep payment-due rows", () => {
  const report: any = base();
  report.customerActivities = [
    { id: "due", customerId: "c", customerName: "Customer", kind: "collection", title: "Collect", dueDate: date, status: "pending", source: "payment_due" },
    { id: "done", customerId: "c", title: "Done", status: "completed" },
    { id: "future", customerId: "c", title: "Future", dueDate: "2027-01-01", status: "pending" },
  ];
  assert.deepEqual(briefingView(report).customerUpcoming.map(a => a.id), ["due"]);
});

test("saved morning/evening snapshots enrich bounded history, medicines and current work with independent revisions", async () => {
  process.env.NODE_ENV = "test";
  const { isolatedDatabase } = await import("./database");
  const { db, pool } = await import("../server/db");
  const s = await import("../shared/schema");
  const { buildDailyReport, animalEvent, completeTask } = await import("../server/care-service");
  const { engine } = await isolatedDatabase();
  try {
    const [u] = await db.insert(s.users).values({ email: "briefing@test.local", firstName: "Owner" }).returning();
    const [farm] = await db.insert(s.tenants).values({ ownerId: u.id, name: "Briefing farm", slug: "briefing-test" }).returning();
    await db.insert(s.farmSettings).values({ tenantId: farm.id, timezone: "Asia/Kolkata" });
    const [a, b] = await db.insert(s.cattle).values(["A", "B"].map(tagNumber => ({
      tenantId: farm.id, tagNumber, dateOfEntry: "2026-11-01", productionStatus: "lactating", lifeStage: "adult",
      createdAt: new Date("2026-11-01T00:00:00Z"),
    }))).returning();
    await db.insert(s.milkEntries).values([
      ...history([5, 5, 5, 5, 5, 5, 5]).map(r => ({ ...r, cattleId: a.id, tenantId: farm.id, quantity: String(r.quantity), createdAt: new Date("2026-11-20T00:00:00Z") })),
      { cattleId: a.id, tenantId: farm.id, date, session: "morning", quantity: "8", createdAt: new Date("2026-11-21T01:00:00Z") },
      { cattleId: a.id, tenantId: farm.id, date, session: "evening", quantity: "3", destination: "discarded", createdAt: new Date("2026-11-21T12:00:00Z") },
      { cattleId: a.id, tenantId: farm.id, date: "2026-11-22", session: "morning", quantity: "8", createdAt: new Date("2026-11-22T01:00:00Z") },
      { cattleId: b.id, tenantId: farm.id, date: "2026-11-22", session: "morning", quantity: "9", createdAt: new Date("2026-11-22T03:00:00Z") },
    ]);
    const [health] = await db.insert(s.healthEvents).values({ tenantId: farm.id, cattleId: a.id, date,
      eventType: "illness", description: "Medicine mentioned in note only", createdAt: new Date("2026-11-21T00:00:00Z") }).returning();
    await db.insert(s.treatments).values({ tenantId: farm.id, healthEventId: health.id, date, medicineName: "Actual entry", dosage: "2 mL",
      withdrawalDays: 3, administeredBy: u.id, createdAt: new Date("2026-11-22T01:00:00Z") });
    await db.insert(s.tasks).values({ tenantId: farm.id, cattleId: a.id, title: "Urgent review", type: "health", priority: "urgent",
      dueDate: "2026-11-22", dueTime: "08:30", createdAt: new Date("2026-11-21T12:00:00Z") });
    const opts = { period: "morning" as const, briefingDate: "2026-11-22", generatedAt: new Date("2026-11-22T02:00:00Z") };
    const report = await buildDailyReport(farm.id, date, u.id, true, opts);
    const view = briefingView(report);
    assert.equal(report.revision, 1);
    assert.equal(report.briefing.coveredDate, date);
    assert.equal(view.currentMorning.total, 8);
    assert.equal(view.currentMorning.missing.length, 1);
    assert.equal(view.milkRows.find(r => r.cattleId === a.id)?.pmComparison.isLow, true);
    assert.equal(view.medicines.length, 1);
    assert.equal(view.medicines[0].administeredBy, "Owner");
    assert.equal(view.medicines[0].administeredAt, null);
    assert.equal(view.restrictions.length, 1, "legacy treatment restriction must appear in the current briefing");
    assert.equal(view.actions.find(t => t.title === "Urgent review")?.countdown, "Due today");
    const evening = await buildDailyReport(farm.id, date, u.id, true, { ...opts, period: "evening", briefingDate: date });
    assert.equal(evening.revision, 1);
    assert.equal((await buildDailyReport(farm.id, date, u.id, true, opts)).revision, 2);
    const legacy = await buildDailyReport(farm.id, date, u.id, true);
    assert.equal(legacy.revision, 1);
    assert.equal(legacy.briefing, undefined, "legacy daily exports must keep the legacy print layout");
    await assert.rejects(buildDailyReport(farm.id, date, u.id, false, { ...opts, briefingDate: date }), /does not match/);
    await assert.rejects(animalEvent(farm.id, { cattleId: a.id, type: "treatment", date,
      details: { instructions: "Approved plan", administrationTime: "25:10" } }, u.id), /HH:mm/);
    await animalEvent(farm.id, { cattleId: a.id, type: "treatment", date,
      details: { instructions: "Approved plan", medicineName: "Structured medicine", dosage: "2 mL", route: "oral", administeredBy: "Ravi", administrationTime: "17:15" } }, u.id);
    const [actualTask] = await db.insert(s.tasks).values({ tenantId: farm.id, cattleId: a.id, title: "Actual medicine administration", type: "health", clinical: {}, dueDate: date }).returning();
    await completeTask(farm.id, actualTask.id, { date, evidence: "Administration completed", administration: {
      medicineName: "Task medicine", dosage: "1 mL", route: "injection", administeredBy: "Amit", administrationTime: "18:10",
    } }, u.id);
    const updated = briefingView(await buildDailyReport(farm.id, date, u.id, false, { period: "morning", briefingDate: "2026-11-22" }));
    const structured = updated.medicines.find(m => m.medicineName === "Structured medicine");
    assert.equal(structured?.administeredAt, "17:15");
    assert.equal(structured?.administeredBy, "Ravi");
    const taskMed = updated.medicines.filter(m => m.medicineName === "Task medicine");
    assert.equal(taskMed.length, 1);
    assert.equal(taskMed[0].administeredAt, "18:10");
    assert.equal(taskMed[0].administeredBy, "Amit");
  } finally {
    await engine.close();
    await pool.end();
  }
});
