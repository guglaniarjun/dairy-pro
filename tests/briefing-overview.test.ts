import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { compactBriefingPdf } from "../server/briefing-overview-pdf";
import { reportPdf } from "../server/report-export";
import { printableFixture } from "./briefing-fixture";
import { addDays } from "../shared/care";

function busyFarm(period: "morning" | "evening") {
  const r = printableFixture(period);
  r.entries = []; r.events = []; r.medicationRecords = []; r.medicationEvents = []; r.medicationTasks = [];
  r.dairySales.customers = Array.from({ length: 42 }, (_, i) => ({ id: `buyer-${i}`, name: `Sample Buyer ${String(i + 1).padStart(2, "0")}`, outstanding: i < 8 ? "150.50" : "0", advance: i === 9 ? "25.00" : "0" }));
  r.dairySales.entries = []; r.dairySales.payments = [];
  r.customerActivities = Array.from({ length: 147 }, (_, i) => ({
    id: `bill-reminder-${i}`, customerId: `buyer-${i % 8}`, customerName: r.dairySales.customers[i % 8].name,
    kind: "collection", title: "Payment collection due", instructions: "Outstanding on recorded bills; record a receipt to settle.",
    amount: "25.00", dueDate: addDays(r.briefing.actionDate, -(i % 20)), priority: "high", status: "pending", source: "payment_due",
  }));
  r.tasks = Array.from({ length: 22 }, (_, i) => ({
    id: `care-${i}`, cattleId: `cow-${i % 19}`, title: i < 10 ? "Animal health review" : "Record expected calving date",
    description: "Review the animal and record the observations in Care & Work.",
    dueDate: addDays(r.briefing.actionDate, i < 9 ? -1 : i < 15 ? 0 : 7), priority: "medium", status: "pending", assignedToName: "Farm team",
  }));
  r.reminders = [];
  return r;
}

const pageCount = (buffer: Buffer) => [...buffer.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
// Read only PDF text operands, independent of page sizes or renderer internals.
function pdfText(buffer: Buffer) {
  const strings: string[] = [];
  for (const stream of buffer.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let decoded: string;
    try { decoded = inflateSync(Buffer.from(stream[1], "latin1")).toString("latin1"); } catch { continue; }
    for (const text of decoded.matchAll(/<([0-9a-f]+)>/gi)) strings.push(Buffer.from(text[1], "hex").toString("latin1"));
  }
  return strings.join("");
}

test("busy-farm default prints two pages with every cattle and customer account, grouping repeated bill reminders", async () => {
  for (const period of ["morning", "evening"] as const) {
    const r = busyFarm(period);
    const buffer = await reportPdf(r);
    assert.equal(pageCount(buffer), 2, `${period}: 147 bill reminders must not become dozens of briefing pages`);
    const text = pdfText(buffer);
    for (const customer of r.dairySales.customers) assert.ok(text.includes(customer.name), `Missing account: ${customer.name}`);
    for (const animal of r.animals) assert.ok(text.includes(animal.tagNumber), `Missing milk row: ${animal.tagNumber}`);
  }
});

test("full-detail printing retains the original individual instructions and bill reminders", async () => {
  const r = busyFarm("morning");
  const full = await reportPdf(r, { layout: "full" });
  assert.ok(pageCount(full) > 2);
  assert.ok(pdfText(full).includes("Outstanding on recorded bills"));
});

test("short printing preserves urgent work and actual administration details", async () => {
  const r = busyFarm("morning");
  r.tasks[0] = { ...r.tasks[0], title: "Urgent animal inspection", priority: "urgent", assignedToName: "Recorded team" };
  r.medicationRecords = [{ id: "actual-dose", type: "treatment", cattleId: "cow-0", date: r.date, medicineName: "Recorded Medicine", dosage: "2 mL", route: "oral", administeredBy: "Actual giver", administrationTime: "06:35" }];
  const buffer = await compactBriefingPdf(r);
  assert.equal(pageCount(buffer), 2, "One urgent task and one administration should fit the short briefing");
  const text = pdfText(buffer);
  assert.ok(text.includes("Urgent animal inspection"));
  assert.ok(text.includes("Recorded Medicine"));
  assert.ok(text.includes("Actual giver"));
  assert.ok(text.includes("2 mL"));
});

test("a current-morning-only dose and a recorded severe health case stay visible", async () => {
  const r = busyFarm("morning");
  r.medicationRecords = [{ id: "current-dose", type: "treatment", cattleId: "cow-0", date: r.briefing.actionDate,
    medicineName: "Current Morning Dose", dosage: "3 mL", route: "oral", administeredBy: "Morning giver", administrationTime: "06:35" }];
  r.activeHealth = [{ id: "severe-record", cattleId: "cow-0", date: r.date, severity: "severe", status: "active", diagnosis: "Recorded health concern" }];
  const buffer = await compactBriefingPdf(r);
  assert.equal(pageCount(buffer), 2, "A current morning administration should fit the short briefing");
  const text = pdfText(buffer);
  assert.ok(text.includes("Current Morning Dose"));
  assert.ok(text.includes("Morning giver"));
  assert.ok(text.includes("3 mL"));
  assert.match(text, /severe/i);
});

test("large-herd short printing retains all cattle with readable continuations", async () => {
  const r = printableFixture("morning", 95);
  const buffer = await compactBriefingPdf(r);
  assert.ok(pageCount(buffer) > 2);
  const text = pdfText(buffer);
  for (const animal of r.animals) assert.ok(text.includes(animal.tagNumber), `Missing animal ${animal.tagNumber}`);
});

test("a customer manual follow-up retains what, who and its due time in the short print", async () => {
  const r = busyFarm("evening");
  r.customerActivities.push({ id: "manual-followup", customerId: "buyer-1", customerName: "Sample Buyer 02",
    title: "Confirm the delivery quantity", instructions: "Read the approved order before changing it.", source: "manual",
    kind: "delivery_change", priority: "high", status: "pending", dueDate: r.briefing.actionDate, dueTime: "10:00", assignedToName: "Delivery lead" });
  const text = pdfText(await compactBriefingPdf(r));
  assert.ok(text.includes("Confirm the delivery quantity"));
  assert.ok(text.includes("Delivery lead"));
  assert.ok(text.includes("10:00"));
});
