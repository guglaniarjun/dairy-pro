import { addDays, farmDay, finishedTask, inStage, isLactating } from "./care";
import { dailyBrief } from "./daily-brief";

export type BriefingPeriod = "morning" | "evening";
export interface DailyBriefingOptions {
  period?: BriefingPeriod;
  /** Delivery/action date. The existing report date remains the covered activity date. */
  briefingDate?: string;
  generatedAt?: Date;
}
export interface MilkComparisonRules {
  lookbackDays: number;
  minRecords: number;
  dropPercent: number;
  minDropLitres: number;
  historyFrom: string;
  historyTo: string;
}
export interface SessionBaseline { mean: number | null; sampleCount: number }
export interface SessionComparison {
  actual: number | null;
  usual: number | null;
  deltaLitres: number | null;
  deltaPercent: number | null;
  isLow: boolean;
  reason: "missing" | "insufficient_history" | "zero_baseline" | "low" | "within_range";
}
export interface BriefingMilkRow {
  cattleId: string;
  tag: string;
  name: string;
  sessions: Record<string, number | null>;
  total: number | null;
  discarded: number;
  baseline: Record<string, SessionBaseline>;
  comparisons: Record<string, SessionComparison>;
  pmComparison: SessionComparison;
  missingSessions: string[];
  isSubtotal: boolean;
  withheld: boolean;
}
export interface BriefingMedicine {
  id: string;
  cattleId: string | null;
  tag: string;
  date: string;
  medicineName: string | null;
  dosage: string | null;
  route: string | null;
  /** Only an explicit administration timestamp/time; entry/completion timestamps are not dose times. */
  administeredAt: string | null;
  administeredBy: string | null;
  withdrawalUntil: string | null;
  source: "treatment" | "vaccination" | "deworming" | "completed_task";
  supplies: { name: string; quantity: number; unit: string | null }[];
  notes: string | null;
  recordedAt: string | null;
}
export interface BriefingAction {
  id: string;
  cattleId?: string | null;
  tag: string;
  title: string;
  instructions: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  assignedTo: string;
  status: string;
  countdown: string;
  href?: string;
  overdue: boolean;
  dueToday: boolean;
  urgent: boolean;
}
export interface BriefingCustomerActivity {
  id: string;
  customerId: string;
  customerName: string;
  kind: string;
  title: string;
  instructions: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  assignedTo: string;
  status: string;
  source: string;
  href: string;
}
export interface BriefingRestriction {
  cattleId: string;
  tag: string;
  until: string;
}

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const total = (rows: any[], key: string) => round(rows.reduce((n, row) => n + (numeric(row[key]) ?? 0), 0));
const text = (value: unknown): string | null => value == null || value === "" ? null : String(value);
const dateOf = (value: any) => String(value || "").slice(0, 10);
const knownBy = (row: any, generatedAt: string) => !row.createdAt || new Date(row.createdAt).valueOf() <= new Date(generatedAt).valueOf();

export function compareMilkSession(
  history: any[], cattleId: string, session: string, actual: number | null,
  coveredDate: string, rules: Pick<MilkComparisonRules, "lookbackDays" | "minRecords" | "dropPercent" | "minDropLitres">,
  generatedAt?: string,
): { baseline: SessionBaseline; comparison: SessionComparison } {
  const days = new Map<string, number>();
  for (const m of history.filter(m => m.cattleId === cattleId && m.session === session &&
    m.date >= addDays(coveredDate, -rules.lookbackDays) && m.date < coveredDate && (!generatedAt || knownBy(m, generatedAt)))) {
    const value = numeric(m.quantity);
    if (value !== null && value >= 0) days.set(m.date, (days.get(m.date) || 0) + value);
  }
  const count = days.size;
  const mean = count >= rules.minRecords ? [...days.values()].reduce((a, b) => a + b, 0) / count : null;
  const delta = actual !== null && mean !== null ? actual - mean : null;
  const pct = delta !== null && mean !== null && mean > 0 ? delta / mean * 100 : null;
  const low = delta !== null && pct !== null && -delta + 1e-9 >= rules.minDropLitres && -pct + 1e-9 >= rules.dropPercent;
  return { baseline: { mean, sampleCount: count }, comparison: { actual, usual: mean, deltaLitres: delta, deltaPercent: pct, isLow: low,
    reason: actual === null ? "missing" : mean === null ? "insufficient_history" : mean === 0 ? "zero_baseline" : low ? "low" : "within_range" } };
}

/** Exact timestamp comparison for new restrictions; legacy date-only holds include that farm date. */
export function restrictionActive(until: any, generatedAt: string, timezone: string): boolean {
  if (!until) return false;
  const value = String(until);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value >= farmDay(timezone, new Date(generatedAt))
    : Number.isFinite(new Date(value).valueOf()) && new Date(value).valueOf() > new Date(generatedAt).valueOf();
}

/** Actual administration records only. Health descriptions and planned tasks never become doses. */
export function briefingMedicines(report: any, date: string): BriefingMedicine[] {
  const generatedAt = report.generatedAt || new Date().toISOString();
  const animals: any[] = report.animals || [];
  const tag = (id: string | null) => animals.find(a => a.id === id)?.tagNumber || (id ? "Unknown animal" : "Farm");
  const candidates: any[] = (report.medicationRecords || report.entries || [])
    .filter((e: any) => ["treatment", "vaccination", "deworming"].includes(e.type))
    .map((e: any) => ({ ...e, origin: "record" }));
  const allEvents: any[] = report.medicationEvents || report.events || [];
  const completed = (report.medicationTasks || report.tasks || []).filter((t: any) =>
    t.status === "completed" && (t.clinical || t.evidence?.administration?.medicineName) &&
    ((t.evidence?.consumed || []).length || t.evidence?.administration?.medicineName || t.medicineName));
  for (const e of allEvents) {
    if (["treatment", "vaccination", "deworming"].includes(e.type)) candidates.push({ ...e, origin: "event" });
    if (e.type === "task_completed" && (e.payload?.clinical || e.payload?.administration?.medicineName) &&
      (e.payload?.consumed?.length || e.payload?.medicineName || e.payload?.administration?.medicineName)) {
      const t = completed.find((t: any) => t.id === e.payload?.taskId);
      candidates.push({ ...e, origin: "task", task: t });
    }
  }
  for (const t of completed) {
    if (candidates.some(e => e.origin === "task" && e.payload?.taskId === t.id)) continue;
    candidates.push({ ...t, type: "task_completed", date: t.evidence?.date || (t.completedAt ? farmDay(report.timezone, new Date(t.completedAt)) : null),
      payload: { ...t.evidence, taskId: t.id, clinical: t.clinical, title: t.title }, origin: "task", task: t });
  }
  const vaccines = candidates.filter(e => e.type === "vaccination" && e.origin === "record");
  const matchedVaccines = new Set<string>();
  const result = new Map<string, BriefingMedicine>();
  for (const e of candidates.filter(e => dateOf(e.date) === date && knownBy(e, generatedAt))) {
    const p = e.payload || {};
    const duplicate = e.type === "vaccination" && e.origin === "event" ? vaccines.find(v => !matchedVaccines.has(v.id) &&
      v.cattleId === e.cattleId && dateOf(v.date) === date &&
      ((p.vaccinationId && p.vaccinationId === v.id) || (e.sourceType === "vaccination" && e.sourceId === v.id) ||
       (v.vaccineId && v.vaccineId === p.vaccineId) ||
       (v.vaccineName && String(v.vaccineName).trim().toLowerCase() === String(p.vaccineName || "").trim().toLowerCase()))) : null;
    if (duplicate) matchedVaccines.add(duplicate.id);
    // The event carries actual stock consumption; merge it into the matching structured vaccination.
    const sourceId = duplicate ? `record:${duplicate.id}` : e.origin === "task" ? `task:${p.taskId || e.id}` : `${e.origin}:${e.id}`;
    const record = duplicate || e;
    const actual = p.administration || record.administration || e.task?.evidence?.administration || {};
    const consumed = p.consumed || e.evidence?.consumed || [];
    const supplies = consumed.map((s: any) => ({ name: String(s.item || s.name || s.itemName || "Recorded supply"), quantity: Number(s.quantity), unit: text(s.unit) }));
    const by = text(actual.administeredByName || actual.administeredBy || record.administeredByName || record.administeredBy || p.administeredByName || p.administeredBy || e.task?.evidence?.administeredBy);
    const item: BriefingMedicine = {
      id: sourceId, cattleId: e.cattleId || null, tag: tag(e.cattleId), date,
      medicineName: text(actual.medicineName || record.medicineName || record.vaccineName || p.medicineName || p.vaccineName),
      dosage: text(actual.dosage || record.dosage || p.dosage), route: text(actual.route || record.route || p.route),
      administeredAt: text(actual.administeredAt || actual.administrationTime || record.administeredAt || p.administeredAt || record.administrationTime || p.administrationTime),
      administeredBy: by, withdrawalUntil: text(record.withdrawalEndsAt || p.milkWithholdUntil || p.withdrawalEndsAt),
      source: e.origin === "task" ? "completed_task" : e.type,
      supplies, notes: text(record.notes || p.notes || p.instructions || p.title), recordedAt: text(e.createdAt),
    };
    if (supplies.length && !item.medicineName) item.medicineName = supplies.map((s: any) => s.name).join("; ");
    const existing = result.get(sourceId);
    result.set(sourceId, existing ? { ...existing, ...item, supplies: supplies.length ? supplies : existing.supplies } : item);
  }
  return [...result.values()].sort((a, b) => (a.administeredAt || "99").localeCompare(b.administeredAt || "99") || a.tag.localeCompare(b.tag));
}

/** Shared printable/UI model. All historical comparisons are bounded to earlier calendar dates. */
export function briefingView(report: any) {
  const period: BriefingPeriod = report.briefing?.period || "evening";
  const coveredDate: string = report.briefing?.coveredDate || report.date;
  const briefingDate: string = report.briefing?.date || (period === "morning" ? addDays(coveredDate, 1) : coveredDate);
  const actionDate: string = report.briefing?.actionDate || briefingDate;
  const generatedAt: string = report.generatedAt || new Date().toISOString();
  const timezone: string = report.timezone || "Asia/Kolkata";
  const sourceRules = report.milk?.comparisonRules || {};
  const rules: MilkComparisonRules = {
    lookbackDays: Math.max(1, Math.floor(numeric(sourceRules.lookbackDays) ?? 7)), minRecords: Math.max(1, Math.floor(numeric(sourceRules.minRecords) ?? 5)),
    dropPercent: Math.max(0, numeric(sourceRules.dropPercent) ?? 20),
    minDropLitres: Math.max(0, numeric(sourceRules.minDropLitres) ?? 1),
    historyFrom: addDays(coveredDate, -Math.max(1, Math.floor(numeric(sourceRules.lookbackDays) ?? 7))), historyTo: addDays(coveredDate, -1),
  };
  const sourceBrief = dailyBrief({ ...report, milk: { ...report.milk,
    entries: (report.milk?.entries || []).filter((e: any) => e.date === coveredDate && knownBy(e, generatedAt)) } });
  const sessions = sourceBrief.sessions;
  const restrictions: BriefingRestriction[] = (report.animals || [])
    .filter((a: any) => a.status === "active" && !a.mergedIntoId && restrictionActive(a.milkWithholdUntil, generatedAt, timezone))
    .map((a: any) => ({ cattleId: a.id, tag: a.tagNumber, until: String(a.milkWithholdUntil) }));
  const history: any[] = (report.milk?.history || []).filter((m: any) =>
    m.date >= rules.historyFrom && m.date <= rules.historyTo && knownBy(m, generatedAt));
  const milkRows: BriefingMilkRow[] = sourceBrief.milkRows.map(row => {
    const baseline: Record<string, SessionBaseline> = {};
    const comparisons: Record<string, SessionComparison> = {};
    for (const session of sessions) {
      const actual = row.sessions[session] ?? null;
      const comparison = compareMilkSession(history, String(row.cattleId), session, actual, coveredDate, rules, generatedAt);
      baseline[session] = comparison.baseline;
      comparisons[session] = comparison.comparison;
    }
    const missingSessions = sessions.filter(s => row.sessions[s] == null);
    return { ...row, cattleId: String(row.cattleId), baseline, comparisons, pmComparison: comparisons.evening,
      missingSessions, isSubtotal: missingSessions.length > 0, withheld: restrictions.some(a => a.cattleId === row.cattleId) };
  });
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const actions: BriefingAction[] = sourceBrief.actions.filter((a: any) => !finishedTask(a.status) && (!a.dueDate || a.dueDate <= addDays(actionDate, 30))).map((a: any) => ({
    ...a, dueDate: a.dueDate || null, dueTime: a.dueTime || null, priority: a.priority || "medium",
    instructions: a.instructions || "", status: a.status || "pending", assignedTo: a.assignedTo || "Unassigned",
    overdue: Boolean(a.dueDate && a.dueDate < actionDate), dueToday: a.dueDate === actionDate, urgent: a.priority === "urgent",
  })).sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) ||
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || (a.dueTime || "99").localeCompare(b.dueTime || "99") || a.tag.localeCompare(b.tag));
  const activities = Array.isArray(report.customerActivities) ? report.customerActivities : report.customerActivities?.activities || [];
  const customerUpcoming: BriefingCustomerActivity[] = activities.filter((a: any) => !finishedTask(a.status) && (!a.dueDate || a.dueDate <= addDays(actionDate, 30)))
    .map((a: any) => ({ id: a.id, customerId: a.customerId, customerName: a.customerName || "Customer", kind: a.kind || "follow_up",
      title: a.title, instructions: a.instructions || "", dueDate: a.dueDate || null, dueTime: a.dueTime || null,
      priority: a.priority || "medium", assignedTo: a.assignedToName || a.assignedTo || "Unassigned", status: a.status || "pending",
      source: a.source || "manual", href: a.href || `/customers?customer=${encodeURIComponent(a.customerId)}#customer-activities` }))
    .sort((a: BriefingCustomerActivity, b: BriefingCustomerActivity) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const morningEntries: any[] = (report.milk?.currentMorning || []).filter((e: any) => e.date === briefingDate && e.session === "morning" && knownBy(e, generatedAt));
  const animals: any[] = (report.animals || []).filter((a: any) => a.status === "active" && !a.mergedIntoId);
  const lactating = animals.filter(isLactating);
  const allocations = (kind: string) => total((report.milk?.dispositions || []).filter((e: any) => e.payload?.kind === kind && !e.payload?.milkEntryId).map((e: any) => ({ quantity: e.payload.quantity })), "quantity");
  const recordedEntries = milkRows.reduce((n, row) => n + sessions.filter(s => row.sessions[s] !== null).length, 0);
  return {
    period, briefingDate, coveredDate, actionDate, generatedAt, timezone, sessions, rules, milkRows,
    medicines: briefingMedicines(report, coveredDate), currentMedicines: briefingDate !== coveredDate ? briefingMedicines(report, briefingDate) : [],
    actions, urgentActions: actions.filter(a => a.urgent), followUpActions: actions.filter(a => !a.urgent), customerUpcoming, restrictions,
    currentMorning: { entries: morningEntries, total: total(morningEntries, "quantity"), recordedAnimals: new Set(morningEntries.map(e => e.cattleId)).size,
      expectedAnimals: lactating.length, missing: lactating.filter(a => !morningEntries.some(e => e.cattleId === a.id)).map(a => ({ id: a.id, tag: a.tagNumber })) },
    herd: { total: animals.length, inMilk: lactating.length, dry: animals.filter(a => inStage(a, "dry")).length,
      heifers: animals.filter(a => inStage(a, "heifer")).length, calves: animals.filter(a => inStage(a, "calf") || inStage(a, "weaned_calf")).length,
      pregnant: animals.filter(a => inStage(a, "pregnant")).length },
    totals: { produced: Number(report.milk?.produced || 0), sold: Number(report.milk?.sold || 0),
      sales: sourceBrief.totals.sales, received: sourceBrief.totals.received, expenses: sourceBrief.totals.expenses,
      outstanding: total(report.dairySales?.customers || [], "outstanding"), advances: total(report.dairySales?.customers || [], "advance"),
      discarded: Number(report.milk?.discardedAtMilking || 0) + allocations("discarded"), opening: Number(report.milk?.opening || 0),
      closing: allocations("closing_stock"), calfUse: allocations("calf_feed") + allocations("calf_feeding"), farmUse: allocations("household") + allocations("farm_use"),
      previousClosing: report.milk?.previousClosingKnown ? Number(report.milk.previousClosing || 0) : null,
      unallocated: Number(report.milk?.unallocated || 0), expectedEntries: milkRows.length * sessions.length, recordedEntries,
      missingEntries: milkRows.length * sessions.length - recordedEntries, lowPmCount: milkRows.filter(r => r.pmComparison?.isLow).length,
      activeHealth: (report.activeHealth || []).length },
  };
}

export type DailyBriefingView = ReturnType<typeof briefingView>;
