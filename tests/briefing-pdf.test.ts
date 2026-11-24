import { test } from "node:test";
import assert from "node:assert/strict";
import { printableBriefingPdf } from "../server/briefing-report-pdf";
import { reportFixture } from "./report-fixture";
import { addDays } from "../shared/care";

export function printableFixture(period: "morning" | "evening", count = 19) {
  const r: any = reportFixture(count);
  r.briefing = { period, coveredDate: r.date, date: period === "morning" ? addDays(r.date, 1) : r.date,
    actionDate: period === "morning" ? addDays(r.date, 1) : r.date };
  r.generatedAt = period === "morning" ? "2026-11-13T02:00:00Z" : "2026-11-12T14:00:00Z";
  r.tasks = [{ id: "urgent", cattleId: "cow-0", title: "Check the animal and the zero entry", dueDate: r.briefing.date,
    dueTime: "08:30", priority: "urgent", status: "pending", assignedToName: "Farm team" }];
  r.reminders = [];
  r.dairySales.entries = r.dairySales.entries.slice(0, 3);
  r.dairySales.customers = r.dairySales.customers.slice(0, 3);
  r.customerActivities = [{ id: "customer-task", customerId: "customer-0", customerName: "Customer 1", title: "Confirm next delivery quantity",
    dueDate: r.briefing.date, dueTime: "10:00", priority: "high", status: "pending", source: "manual", assignedToName: "Farm team" }];
  r.milk.history = r.animals.flatMap((a: any) => Array.from({ length: 7 }, (_, i) => [
    { cattleId: a.id, date: addDays(r.date, -i - 1), session: "morning", quantity: 8.5 },
    { cattleId: a.id, date: addDays(r.date, -i - 1), session: "evening", quantity: 6.5 },
  ]).flat());
  r.milk.comparisonRules = { lookbackDays: 7, minRecords: 5, dropPercent: 20, minDropLitres: 1 };
  return r;
}

test("ordinary morning and evening briefings have two printable pages including customer work and accounts", async () => {
  for (const period of ["morning", "evening"] as const) {
    const buffer = await printableBriefingPdf(printableFixture(period));
    assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    const pages = [...buffer.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
    assert.equal(pages, 2, `${period} should have two main pages`);
  }
});

test("large print reports add continuations rather than truncate animals or long care instructions", async () => {
  const report = printableFixture("morning", 95);
  report.tasks[0].description = ("Recorded instructions with the animal's observations. ").repeat(170);
  report.tasks[0].title = "Long approved care plan " + "IDENTIFIER".repeat(35);
  report.customerActivities = Array.from({ length: 35 }, (_, i) => ({ ...report.customerActivities[0], id: `activity-${i}`, customerName: `Customer ${i + 1}` }));
  const buffer = await printableBriefingPdf(report);
  const pages = [...buffer.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
  assert.ok(pages > 2, "overflow is a visible continuation, not hidden rows");
  assert.ok(pages < 30, "long wrapped rows must finish without a pagination loop");
});

test("empty briefing still produces both main pages without inferring medicine administrations", async () => {
  const report = printableFixture("evening", 0);
  Object.assign(report, { tasks: [], reminders: [], entries: [], events: [], customerActivities: [] });
  const buffer = await printableBriefingPdf(report);
  assert.equal([...buffer.toString("latin1").matchAll(/\/Type \/Page\b/g)].length, 2);
});
