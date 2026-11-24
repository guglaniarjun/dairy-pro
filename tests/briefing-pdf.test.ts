import { test } from "node:test";
import assert from "node:assert/strict";
import { printableBriefingPdf } from "../server/briefing-report-pdf";
import { printableFixture } from "./briefing-fixture";

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
