import { addDays, farmDay, finishedTask, inStage, isLactating } from "./care";

export const activeAnimal = (c: any) =>
  c.status === "active" && !c.mergedIntoId;

export function reportingRange(period: string, today: string) {
  const month = Number(today.slice(5, 7));
  const from =
    period === "week"
      ? addDays(today, -6)
      : period === "month"
        ? today.slice(0, 7) + "-01"
        : period === "quarter"
          ? `${today.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`
          : today.slice(0, 4) + "-01-01";
  return { from, to: today };
}
export const daysUntil = (date: string, today: string) =>
  Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today)) / 86400000);
export function countdown(date: string | null, today: string) {
  if (!date) return "Date needed";
  const days = daysUntil(date, today);
  return days < 0
    ? `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`
    : days === 0
      ? "Due today"
      : `${days} day${days === 1 ? "" : "s"} left`;
}

/** One definition for dashboard totals, breeding drill-downs and report reminders. */
export function breedingOverview(
  animals: any[],
  services: any[],
  tests: any[],
  births: any[],
  heats: any[],
  cfg: any,
  today = farmDay(cfg?.timezone),
) {
  const active = animals.filter(activeAnimal);
  const recordDay = (r: any, key: string) =>
    key === "detectedAt"
      ? farmDay(cfg?.timezone, new Date(r[key]))
      : String(r[key]).slice(0, 10);
  const latest = (records: any[], id: string, key = "date") =>
    records
      .filter((r) => r.cattleId === id && recordDay(r, key) <= today)
      .sort(
        (a, b) => new Date(b[key]).valueOf() - new Date(a[key]).valueOf(),
      )[0];
  const latestTest = (id: string) =>
    tests
      .filter((t) => t.inseminationId === id && t.testDate <= today)
      .sort((a, b) => b.testDate.localeCompare(a.testDate))[0];
  const open = active.filter(
    (c) =>
      c.gender === "female" &&
      !inStage(c, "pregnant") &&
      !["calf", "weaned_calf"].includes(c.lifeStage || c.stage),
  );
  const pregnant = active.filter((c) => inStage(c, "pregnant"));
  const pregnancies = pregnant.map((c) => ({
    id: c.id,
    cattleId: c.id,
    cow: c,
    date: latest(services, c.id)?.date,
    expectedCalving: c.expectedCalvingDate
      ? new Date(`${c.expectedCalvingDate}T12:00:00`)
      : null,
    daysToCalving: c.expectedCalvingDate
      ? daysUntil(c.expectedCalvingDate, today)
      : null,
  }));
  const calvingDue = pregnancies
    .filter((p) => p.daysToCalving != null && p.daysToCalving <= 30)
    .sort((a, b) => a.daysToCalving! - b.daysToCalving!);
  const dryDue = pregnancies
    .filter((p) => p.daysToCalving != null && isLactating(p.cow))
    .map((p) => ({
      ...p,
      dueDate: addDays(p.cow.expectedCalvingDate, -(cfg?.dryPeriodDays || 60)),
      dryDaysLeft: p.daysToCalving! - (cfg?.dryPeriodDays || 60),
    }))
    .filter((p) => p.dryDaysLeft <= 30)
    .sort((a, b) => a.dryDaysLeft - b.dryDaysLeft);
  const heatDue = open
    .flatMap((c) => {
      const birth = latest(births, c.id);
      const service = latest(services, c.id);
      const heat = latest(heats, c.id, "detectedAt");
      const heatDay = heat
        ? farmDay(cfg?.timezone, new Date(heat.detectedAt))
        : null;
      const anchor = [service?.date, heatDay].filter(Boolean).sort().at(-1);
      if (!anchor || (birth && anchor <= birth.date)) return [];
      const dueDate = addDays(anchor, cfg?.heatIntervalDays || 21);
      return [
        {
          ...c,
          refDate: anchor,
          refType: anchor === heatDay ? "Observed heat" : "Last service",
          dueDate,
          expectedIn: daysUntil(dueDate, today),
        },
      ];
    })
    .filter((c) => c.expectedIn <= 30);
  const ptDue = active
    .flatMap((cow) => {
      const service = latest(services, cow.id),
        birth = latest(births, cow.id);
      if (
        !service ||
        inStage(cow, "pregnant") ||
        (birth && birth.date >= service.date)
      )
        return [];
      const result = latestTest(service.id);
      if (result && result.result !== "inconclusive") return [];
      const dueDate = addDays(service.date, cfg?.pregnancyTestDays || 30);
      return [
        {
          ...service,
          cow,
          dueDate,
          daysAgo: -daysUntil(service.date, today),
          dueDays: daysUntil(dueDate, today),
        },
      ];
    })
    .filter((p) => p.dueDays <= 30);
  const repeatBreeders = open
    .map((cow) => {
      const birth = latest(births, cow.id);
      const ais = services.filter(
        (s) =>
          s.cattleId === cow.id &&
          (!birth || s.date > birth.date) &&
          latestTest(s.id)?.result === "negative",
      );
      return { cow, ais, count: ais.length };
    })
    .filter((c) => c.count >= 3);
  const tested = services.filter((s) => {
    const t = latestTest(s.id);
    return t && t.result !== "inconclusive";
  });
  const confirmed = tested.filter(
    (s) => latestTest(s.id)?.result === "positive",
  );
  return {
    active,
    open,
    pregnant,
    pregnancies,
    calvingDue,
    dryDue,
    heatDue,
    ptDue,
    repeatBreeders,
    testedServices: tested.length,
    confirmedServices: confirmed.length,
    conceptionRate: tested.length
      ? Math.round((confirmed.length / tested.length) * 100)
      : null,
  };
}

export function vaccineIdentity(v: any) {
  return v.vaccineId || String(v.vaccineName || v.id).trim().toLowerCase();
}

export function latestVaccinations(records: any[], animals: any[], today: string) {
  const active = new Set(animals.filter(activeAnimal).map((a) => a.id));
  const latest = new Map<string, any>();
  for (const v of records.filter(v => active.has(v.cattleId) && v.date <= today)) {
    const key = `${v.cattleId}:${vaccineIdentity(v)}`;
    const old = latest.get(key);
    if (!old || `${old.date}:${old.createdAt || ''}` <= `${v.date}:${v.createdAt || ''}`) latest.set(key, v);
  }
  return [...latest.values()];
}

export function currentVaccinations(
  records: any[],
  animals: any[],
  today: string,
) {
  return latestVaccinations(records, animals, today).filter(
    (v) => v.nextDueDate && v.nextDueDate <= addDays(today, 30),
  );
}

export function pendingWork(tasks: any[], date: string) {
  return tasks.filter(
    (t) =>
      !finishedTask(t.status) && (!t.dueDate || t.dueDate <= addDays(date, 30)),
  );
}
