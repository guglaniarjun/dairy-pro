import { z } from "zod";
export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Invalid calendar date",
  );
export const positive = z.coerce.number().finite().positive().max(100000000);
export const nonnegative = z.coerce.number().finite().min(0).max(100000000);
export function addDays(day: string, count: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function farmDay(timezone = "Asia/Kolkata", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function isLactating(c: any) {
  return (
    c.status === "active" &&
    !c.mergedIntoId &&
    (c.productionStatus === "lactating" ||
      (!c.productionStatus && c.stage === "milking"))
  );
}
export function inStage(c: any, stage: string) {
  if (c.mergedIntoId) return false;
  if (stage === "milking")
    return c.productionStatus
      ? c.productionStatus === "lactating"
      : c.stage === "milking";
  if (stage === "dry")
    return c.productionStatus
      ? c.productionStatus === "dry"
      : c.stage === "dry";
  if (stage === "pregnant")
    return c.reproductiveStatus
      ? c.reproductiveStatus === "pregnant"
      : c.stage === "pregnant";
  return (c.lifeStage || c.stage) === stage;
}
export function matchesAnimal(c: any, criteria: any = {}, today = farmDay()) {
  if (c.status !== "active" || c.mergedIntoId) return false;
  for (const key of [
    "species",
    "gender",
    "lifeStage",
    "productionStatus",
    "reproductiveStatus",
    "healthStatus",
    "pen",
  ])
    if (criteria[key] && c[key] !== criteria[key]) return false;
  const age = c.dateOfBirth
    ? Math.floor((Date.parse(today) - Date.parse(c.dateOfBirth)) / 86400000)
    : null;
  if (criteria.minAgeDays != null && (age == null || age < criteria.minAgeDays))
    return false;
  if (criteria.maxAgeDays != null && (age == null || age > criteria.maxAgeDays))
    return false;
  if (
    criteria.minWeightKg != null &&
    (c.weightKg == null || Number(c.weightKg) < criteria.minWeightKg)
  )
    return false;
  return true;
}
export const eligibilitySchema = z
  .object({
    species: z.string().optional(),
    gender: z.enum(["male", "female"]).optional(),
    lifeStage: z.string().optional(),
    productionStatus: z.string().optional(),
    reproductiveStatus: z.string().optional(),
    healthStatus: z.string().optional(),
    pen: z.string().optional(),
    minAgeDays: nonnegative.optional(),
    maxAgeDays: nonnegative.optional(),
    minWeightKg: nonnegative.optional(),
  })
  .strict();
export const supplySchema = z.object({
  itemId: z.string().min(1),
  quantity: positive,
});
export const protocolSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    familyId: z.string().optional(),
    trigger: z.enum([
      "expected_calving",
      "birth",
      "calving",
      "dry_off",
      "insemination",
      "heat",
      "treatment",
      "weaning",
      "pregnancy_loss",
      "age",
    ]),
    eligibility: eligibilitySchema.default({}),
    steps: z
      .array(
        z.object({
          title: z.string().trim().min(1),
          offsetDays: z.coerce.number().int().min(-730).max(3650),
          repeatEveryDays: z.coerce.number().int().min(1).max(730).optional(),
          repeatCount: z.coerce.number().int().min(1).max(100).default(1),
          instructions: z.string().default(""),
          type: z
            .enum(["health", "breeding", "feeding", "other"])
            .default("health"),
          assignedTo: z.string().optional(),
          supplies: z.array(supplySchema).default([]),
          milkWithdrawalDays: z.coerce
            .number()
            .int()
            .min(0)
            .max(3650)
            .optional(),
          meatWithdrawalDays: z.coerce
            .number()
            .int()
            .min(0)
            .max(3650)
            .optional(),
          evidenceRequired: z.boolean().default(true),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const eventSchema = z.object({
  cattleId: z.string().min(1),
  type: z.enum([
    "expected_calving",
    "dry_off",
    "birth",
    "calving",
    "pregnancy_loss",
    "treatment",
    "weaning",
    "weight",
    "diet_change",
    "pen_move",
    "colostrum",
    "calf_feeding",
    "vaccination",
    "deworming",
    "observation",
    "status_change",
  ]),
  date: daySchema,
  notes: z.string().default(""),
  details: z.record(z.any()).default({}),
});
export const finishedTask = (status: string) =>
  ["completed", "cancelled", "excluded"].includes(status);
export function lotExpiry(lot: any) {
  const opened =
    lot.openedDate && lot.usableDays != null
      ? addDays(lot.openedDate, lot.usableDays)
      : null;
  return [lot.expiryDate, opened].filter(Boolean).sort()[0] || "9999-12-31";
}
export function farmMidnight(day: string, timezone: string) {
  const utc = Date.parse(`${day}T00:00:00Z`);
  let result = utc;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    }).formatToParts(new Date(result));
    const value = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(value);
    const offset = m
      ? (Number(m[2]) * 60 + Number(m[3])) * (m[1] === "+" ? 1 : -1)
      : 0;
    result = utc - offset * 60000;
  }
  return new Date(result);
}
