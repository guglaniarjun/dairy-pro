import {
  cattle,
  inseminations,
  pregnancyTests,
  calvings,
  heats,
  tasks,
  milkEntries,
  milkSales,
} from "@shared/schema";
import { rows, settings } from "./care-service";
import { farmDay, addDays, isLactating, finishedTask } from "@shared/care";
import { breedingOverview, pendingWork } from "@shared/farm-overview";
export async function breedingMetrics(tenantId: string) {
  const cfg = await settings(tenantId),
    today = farmDay(cfg.timezone);
  const [animals, services, tests, births, observations, work] =
    await Promise.all([
      rows(cattle, tenantId),
      rows(inseminations, tenantId),
      rows(pregnancyTests, tenantId),
      rows(calvings, tenantId),
      rows(heats, tenantId),
      rows(tasks, tenantId),
    ]);
  const b = breedingOverview(
    animals,
    services,
    tests,
    births,
    observations,
    cfg,
    today,
  );
  return {
    today,
    totalCattle: b.active.length,
    pregnant: b.pregnant.length,
    dry: b.active.filter(
      (a) =>
        a.productionStatus === "dry" ||
        (!a.productionStatus && a.stage === "dry"),
    ).length,
    milking: b.active.filter(isLactating).length,
    heifer: b.active.filter((a) => (a.lifeStage || a.stage) === "heifer")
      .length,
    openCattle: b.open.length,
    repeatBreeders: b.repeatBreeders.length,
    expectedHeat: b.heatDue.length,
    pregnancyTestDue: b.ptDue.length,
    expectedPregnancyTests: b.ptDue.length,
    expectedCalving: b.calvingDue.length,
    expectedCalvings: b.calvingDue.length,
    dryOffDue: b.dryDue.length,
    totalInseminations: services.length,
    totalCalvings: births.filter(b => b.outcome !== "abortion").length,
    conceptionRate: b.conceptionRate,
    testedServices: b.testedServices,
    confirmedServices: b.confirmedServices,
    dewormingDue: pendingWork(work, today).filter((t) =>
      /deworm/i.test(t.title),
    ).length,
  };
}
export async function allocatedMilkRevenue(tenantId: string, cattleId: string) {
  const milk = (await rows(milkEntries, tenantId)).filter(
      (m) => m.destination !== "discarded",
    ),
    sales = await rows(milkSales, tenantId);
  let revenue = 0;
  for (const date of new Set(sales.map((s) => s.date))) {
    const total = milk
      .filter((m) => m.date === date)
      .reduce((n, m) => n + Number(m.quantity), 0);
    const own = milk
      .filter((m) => m.date === date && m.cattleId === cattleId)
      .reduce((n, m) => n + Number(m.quantity), 0);
    if (total > 0)
      revenue +=
        (sales
          .filter((s) => s.date === date)
          .reduce((n, s) => n + Number(s.totalAmount), 0) *
          own) /
        total;
  }
  return Math.round(revenue * 100) / 100;
}
