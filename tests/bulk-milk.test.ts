import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bulkMilkRows,
  copyPreviousMilk,
  milkDraftIssues,
  prepareBulkMilk,
  type MilkDrafts,
  type MilkMeasurement,
} from "../client/src/lib/bulk-milk";
import type { Cattle } from "../shared/schema";

const preferences = {
  milkingSessions: 2,
  fatMandatory: false,
  snfMandatory: false,
};
const date = "2026-10-04";
const animals = ["a", "b", "c", "d"].map(
  (id) =>
    ({
      id,
      tagNumber: id.toUpperCase(),
      status: "active",
      productionStatus: "lactating",
      reproductiveStatus: "pregnant",
    }) as Cattle,
);
const record = (
  cattleId: string,
  extra: Partial<MilkMeasurement> = {},
): MilkMeasurement => ({
  cattleId,
  date,
  session: "morning",
  quantity: "5.00",
  destination: "bulk",
  ...extra,
});

test("bulk submission records zero and excludes blanks, saved animals and queued animals", () => {
  const drafts = {
    a: { quantity: "0", fat: "0", snf: "0" },
    c: { quantity: "88" },
    d: { quantity: "99" },
  };
  const rows = bulkMilkRows(
    animals,
    [record("c")],
    [record("d")],
    drafts,
    date,
    "morning",
    preferences,
  );
  assert.deepEqual(
    rows.map((r) => r.status),
    ["draft", "missing", "saved", "queued"],
  );
  assert.deepEqual(prepareBulkMilk(rows, date, "morning", preferences, date), [
    {
      cattleId: "a",
      date,
      session: "morning",
      quantity: 0,
      fat: 0,
      snf: 0,
      destination: "bulk",
    },
  ]);
});

test("mandatory quality measurements and invalid quantities block the whole draft batch", () => {
  const prefs = { ...preferences, fatMandatory: true, snfMandatory: true };
  const rows = bulkMilkRows(
    animals,
    [],
    [],
    { a: { quantity: "12.5", fat: "4.2", snf: "8.5" }, b: { quantity: "10" } },
    date,
    "morning",
    prefs,
  );
  assert.throws(
    () => prepareBulkMilk(rows, date, "morning", prefs, date),
    /B: Fat is required.*SNF is required/,
  );
  assert.deepEqual(
    milkDraftIssues({ quantity: "0", fat: "0", snf: "0" }, prefs),
    [],
  );
  for (const quantity of ["-1", "NaN", "Infinity", "1000000", "1.001"])
    assert.ok(milkDraftIssues({ quantity }, preferences).length, quantity);
  assert.ok(
    milkDraftIssues({ fat: "4" }, preferences).includes("Litres is required."),
  );
  assert.ok(milkDraftIssues({ quantity: "5", snf: "101" }, preferences).length);
});

test("yesterday copy preserves manual, saved and queued rows and retains zero and discarded milk", () => {
  const drafts: MilkDrafts = { a: { fat: "4.5" } };
  const rows = bulkMilkRows(
    animals,
    [record("c")],
    [record("d")],
    drafts,
    date,
    "morning",
    preferences,
  );
  const prior = animals.map((a) =>
    record(a.id, {
      date: "2026-10-03",
      quantity: 0,
      fat: 0,
      snf: 0,
      destination: "discarded",
    }),
  );
  const copied = copyPreviousMilk(rows, prior, drafts, date, "morning");
  assert.equal(copied.count, 1);
  assert.deepEqual(copied.drafts, {
    a: { fat: "4.5" },
    b: { quantity: "0", fat: "0", snf: "0", destination: "discarded" },
  });
  assert.deepEqual(drafts, { a: { fat: "4.5" } });
});

test("saved and queued status is limited to the selected date and session", () => {
  const entries = [
    record("a"),
    record("b", { session: "evening" }),
    record("c", { date: "2026-10-03" }),
  ];
  const rows = bulkMilkRows(
    animals,
    entries,
    [record("d", { session: "evening" })],
    {},
    date,
    "morning",
    preferences,
  );
  assert.deepEqual(
    rows.map((r) => r.status),
    ["saved", "missing", "missing", "missing"],
  );
  const evening = bulkMilkRows(
    animals,
    entries,
    [record("d", { session: "evening" })],
    {},
    date,
    "evening",
    preferences,
  );
  assert.deepEqual(
    evening.map((r) => r.status),
    ["missing", "saved", "missing", "queued"],
  );
});

test("empty batches, future or invalid dates and unconfigured sessions cannot be submitted", () => {
  const rows = bulkMilkRows(
    animals,
    [],
    [],
    { a: { quantity: "2" } },
    date,
    "morning",
    preferences,
  );
  for (const invalidDate of ["", "2026-02-30", "2026-10-05"])
    assert.throws(
      () => prepareBulkMilk(rows, invalidDate, "morning", preferences, date),
      /valid date/,
    );
  assert.throws(
    () => prepareBulkMilk(rows, date, "night", preferences, date),
    /configured/,
  );
  assert.equal(
    prepareBulkMilk(
      rows,
      date,
      "night",
      { ...preferences, milkingSessions: 3 },
      date,
    )[0].session,
    "night",
  );
  assert.throws(
    () => prepareBulkMilk([], date, "morning", preferences, date),
    /at least one/,
  );
});

test("lactating pregnant animals remain eligible while dry, inactive and merged animals do not", () => {
  const cattle = [
    animals[0],
    { ...animals[1], productionStatus: "dry" },
    { ...animals[2], status: "sold" },
    { ...animals[3], mergedIntoId: "a" },
  ];
  assert.deepEqual(
    bulkMilkRows(cattle, [], [], {}, date, "morning", preferences).map(
      (row) => row.animal.id,
    ),
    ["a"],
  );
});
