import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breedingOverview,
  currentVaccinations,
  countdown,
  reportingRange,
} from "../shared/farm-overview";
import { dailyBrief } from "../shared/daily-brief";
import { compactReportPdf } from "../server/daily-report-pdf";
import { reportFixture } from "./report-fixture";
import { offlineSalesView } from '../shared/offline-sales';

test('offline sales can open an uncached day while preserving as-of customer balances',()=>{
 const raw={date:'2026-11-13',products:[{id:'milk',isMilk:true}],customers:[{id:'c',name:'Customer'}],milkAvailable:12,movements:[],
 sales:[{id:'s',customerId:'c',date:'2026-11-13',createdAt:'2026-11-13T01:00:00Z',totalAmount:'100',productName:'Milk',quantity:'2',unit:'L',paymentMode:'credit'}],
 payments:[{id:'p',customerId:'c',date:'2026-11-15',createdAt:'2026-11-15T01:00:00Z',amount:'120',mode:'cash'}]};
 const next=offlineSalesView(raw,'2026-11-14');assert.equal(next.entries.length,0);assert.equal(next.customers[0].balance,'100.00');assert.equal(next.stockAsOf,'2026-11-13');
 assert.equal(offlineSalesView(raw,'2026-11-15').customers[0].advance,'20.00');
});

const cfg = {
  timezone: "Asia/Kolkata",
  dryPeriodDays: 60,
  pregnancyTestDays: 30,
  heatIntervalDays: 21,
};
test("report drill-down periods include whole farm days and use calendar quarters", () => {
  assert.deepEqual(reportingRange("week", "2026-11-13"), {
    from: "2026-11-07",
    to: "2026-11-13",
  });
  assert.deepEqual(reportingRange("quarter", "2026-11-13"), {
    from: "2026-10-01",
    to: "2026-11-13",
  });
  assert.deepEqual(reportingRange("month", "2026-01-01"), {
    from: "2026-01-01",
    to: "2026-01-01",
  });
});
test("pregnancy counts include lactating, dry and undated pregnancies; exclude inactive/merged cattle", () => {
  const pregnant = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    gender: "female",
    status: "active",
    reproductiveStatus: "pregnant",
    productionStatus: i < 3 ? "lactating" : "dry",
    expectedCalvingDate: i === 0 ? "2026-11-20" : null,
  }));
  const animals = [
    ...pregnant,
    { ...pregnant[0], id: "sold", status: "sold" },
    { ...pregnant[0], id: "merged", mergedIntoId: "p0" },
  ];
  const overview = breedingOverview(animals, [], [], [], [], cfg, "2026-11-13");
  assert.equal(overview.pregnant.length, 5);
  assert.equal(overview.pregnancies.length, 5);
  assert.equal(overview.calvingDue.length, 1);
  assert.equal(overview.dryDue.length, 1);
  assert.equal(overview.dryDue[0].dryDaysLeft, -53);
});
test("expected actions share calendar-day boundaries and stop after birth or dry-off", () => {
  const animal = {
    id: "a",
    gender: "female",
    status: "active",
    lifeStage: "adult",
    productionStatus: "lactating",
    reproductiveStatus: "unserved",
  };
  const service = { id: "s", cattleId: "a", date: "2026-10-14" };
  for (const detectedAt of [
    new Date("2026-10-23T20:00:00Z"),
    "2026-10-23T20:00:00Z",
  ]) {
    const heat = breedingOverview(
      [animal],
      [service],
      [],
      [],
      [{ cattleId: "a", detectedAt }],
      cfg,
      "2026-11-13",
    );
    assert.equal(
      heat.heatDue[0].dueDate,
      "2026-11-14",
      "Server Date objects and browser ISO values must use the same farm day",
    );
  }
  let b = breedingOverview([animal], [service], [], [], [], cfg, "2026-11-13");
  assert.equal(b.ptDue[0].dueDays, 0);
  b = breedingOverview(
    [animal],
    [service],
    [],
    [{ cattleId: "a", date: "2026-11-01" }],
    [],
    cfg,
    "2026-11-13",
  );
  assert.equal(b.ptDue.length, 0);
  assert.equal(b.heatDue.length, 0);
  b = breedingOverview(
    [
      {
        ...animal,
        reproductiveStatus: "pregnant",
        productionStatus: "dry",
        expectedCalvingDate: "2026-11-20",
      },
    ],
    [],
    [],
    [],
    [],
    cfg,
    "2026-11-13",
  );
  assert.equal(b.dryDue.length, 0);
  assert.equal(b.calvingDue.length, 1);
  assert.equal(countdown("2026-11-14", "2026-11-13"), "1 day left");
  assert.equal(countdown("2026-11-12", "2026-11-13"), "1 day overdue");
});
test("vaccination reminders retain different vaccines without IDs and discard superseded doses", () => {
  const rows = [
    {
      id: "1",
      cattleId: "a",
      vaccineName: "Vaccine A",
      date: "2026-01-01",
      nextDueDate: "2026-10-01",
    },
    {
      id: "2",
      cattleId: "a",
      vaccineName: "Vaccine B",
      date: "2026-10-01",
      nextDueDate: "2026-11-13",
    },
    {
      id: "3",
      cattleId: "a",
      vaccineName: "Vaccine A",
      date: "2026-11-01",
      nextDueDate: "2027-01-01",
    },
  ];
  assert.deepEqual(
    currentVaccinations(
      rows,
      [{ id: "a", status: "active" }],
      "2026-11-13",
    ).map((r) => r.id),
    ["2"],
  );
});
test("daily brief preserves recorded zero, missing milk, debit/credit and avoids duplicate linked sales", () => {
  const b = dailyBrief(reportFixture());
  assert.equal(b.milkRows.length, 30);
  assert.equal(b.milkRows[0].sessions.morning, 0);
  assert.equal(b.milkRows[1].sessions.evening, null);
  assert.equal(b.saleRows.length, 8);
  assert.equal(b.totals.sales, 8000);
  assert.equal(b.customers[0].credit, 250);
  assert.equal(b.customers[1].debit, 500);
  assert.equal(
    b.activity.length,
    1,
    "Per-entry milk audit events must be summarized, not printed again",
  );
  assert.match(b.activity[0].text, /Milk records: 59 added/);
  assert.equal(
    b.actions.find((a) => a.id === "dry-1")?.countdown,
    "1 day left",
  );
  assert.ok(b.health.some((h) => h.text.includes("As prescribed")));
});
test("a 30-cow daily PDF with sales, accounts, health and 14 actions fits two A4 pages", async () => {
  const pdf = await compactReportPdf(reportFixture());
  const pages = [...pdf.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
  assert.ok(
    pages >= 1 && pages <= 2,
    `Expected at most two pages, got ${pages}`,
  );
});
