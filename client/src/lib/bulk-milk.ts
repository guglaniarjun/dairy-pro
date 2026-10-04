import { addDays, daySchema, isLactating } from "@shared/care";
import type { Cattle } from "@shared/schema";

export type MilkDraft = Partial<
  Record<"quantity" | "fat" | "snf" | "destination", string>
>;
export type MilkDrafts = Record<string, MilkDraft>;
export type MilkPreferences = {
  timezone?: string;
  milkingSessions: number;
  fatMandatory: boolean;
  snfMandatory: boolean;
};
export type MilkMeasurement = {
  cattleId: string;
  date: string;
  session: string;
  quantity: string | number;
  fat?: string | number | null;
  snf?: string | number | null;
  destination?: string;
};
export const hasMilkDraft = (draft: MilkDraft = {}) =>
  [draft.quantity, draft.fat, draft.snf].some((v) => v != null && v !== "") ||
  draft.destination === "discarded";

export function milkDraftIssues(
  draft: MilkDraft,
  preferences: MilkPreferences,
) {
  const issues: string[] = [];
  if (!hasMilkDraft(draft)) return issues;
  for (const [key, label, required, max] of [
    ["quantity", "Litres", true, 999999.99],
    ["fat", "Fat", preferences.fatMandatory, 100],
    ["snf", "SNF", preferences.snfMandatory, 100],
  ] as const) {
    const value = draft[key] ?? "";
    if (!value.trim()) {
      if (required) issues.push(`${label} is required.`);
    } else if (
      !Number.isFinite(Number(value)) ||
      Number(value) < 0 ||
      Number(value) > max
    )
      issues.push(`${label} must be between 0 and ${max}.`);
    else if (
      Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) > 0.000001
    )
      issues.push(`${label} accepts up to two decimal places.`);
  }
  if (draft.destination && !["bulk", "discarded"].includes(draft.destination))
    issues.push("Choose bulk or discarded milk.");
  return issues;
}

export function bulkMilkRows(
  cattle: Cattle[],
  records: MilkMeasurement[],
  queued: MilkMeasurement[],
  drafts: MilkDrafts,
  date: string,
  session: string,
  preferences: MilkPreferences,
) {
  const forSession = (entries: MilkMeasurement[]) =>
    new Map(
      entries
        .filter((entry) => entry.date === date && entry.session === session)
        .map((entry) => [entry.cattleId, entry]),
    );
  const saved = forSession(records),
    pending = forSession(queued);
  return cattle.filter(isLactating).map((animal) => {
    const draft = drafts[animal.id] || {};
    const record = saved.get(animal.id) || pending.get(animal.id);
    const status = saved.has(animal.id)
      ? "saved"
      : pending.has(animal.id)
        ? "queued"
        : hasMilkDraft(draft)
          ? "draft"
          : "missing";
    return {
      animal,
      draft,
      record,
      status,
      issues: record ? [] : milkDraftIssues(draft, preferences),
    };
  });
}

export function prepareBulkMilk(
  rows: ReturnType<typeof bulkMilkRows>,
  date: string,
  session: string,
  preferences: MilkPreferences,
  today: string,
) {
  if (!daySchema.safeParse(date).success || date > today)
    throw new Error("Choose a valid date that is not in the future.");
  if (
    ![
      "morning",
      "evening",
      ...(preferences.milkingSessions === 3 ? ["night"] : []),
    ].includes(session)
  )
    throw new Error("Choose a configured milking session.");
  const drafts = rows.filter((row) => row.status === "draft");
  const invalid = drafts.find((row) => row.issues.length);
  if (invalid)
    throw new Error(`${invalid.animal.tagNumber}: ${invalid.issues.join(" ")}`);
  if (!drafts.length)
    throw new Error("Enter litres for at least one animal before saving.");
  return drafts.map(({ animal, draft }) => ({
    cattleId: animal.id,
    date,
    session,
    quantity: Number(draft.quantity),
    fat:
      draft.fat === undefined || draft.fat === ""
        ? undefined
        : Number(draft.fat),
    snf:
      draft.snf === undefined || draft.snf === ""
        ? undefined
        : Number(draft.snf),
    destination: draft.destination || "bulk",
  }));
}

export function copyPreviousMilk(
  rows: ReturnType<typeof bulkMilkRows>,
  records: MilkMeasurement[],
  drafts: MilkDrafts,
  date: string,
  session: string,
) {
  const previous = new Map(
    records
      .filter(
        (entry) =>
          entry.date === addDays(date, -1) && entry.session === session,
      )
      .map((entry) => [entry.cattleId, entry]),
  );
  const next = { ...drafts };
  let count = 0;
  for (const row of rows) {
    const entry = previous.get(row.animal.id);
    if (row.status !== "missing" || !entry) continue;
    next[row.animal.id] = {
      quantity: String(entry.quantity),
      fat: entry.fat == null ? "" : String(entry.fat),
      snf: entry.snf == null ? "" : String(entry.snf),
      destination: entry.destination || "bulk",
    };
    count++;
  }
  return { drafts: next, count };
}
