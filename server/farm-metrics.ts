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
export async function breedingMetrics(tenantId: string) {
  const cfg = await settings(tenantId),
    today = farmDay(cfg.timezone),
    future = addDays(today, 30);
  const animals = (await rows(cattle, tenantId)).filter(
    (c) => c.status === "active" && !c.mergedIntoId,
  );
  const services = await rows(inseminations, tenantId),
    tests = await rows(pregnancyTests, tenantId),
    births = await rows(calvings, tenantId),
    observations = await rows(heats, tenantId),
    work = await rows(tasks, tenantId);
  const confirmed = new Set<string>(),
    tested = new Set<string>();
  for (const service of services) {
    const result = tests
      .filter((t) => t.inseminationId === service.id)
      .sort((a, b) => b.testDate.localeCompare(a.testDate))[0];
    if (result && result.result !== "inconclusive") {
      tested.add(service.id);
      if (result.result === "positive") confirmed.add(service.id);
    }
  }
  let expectedHeat = 0,
    pregnancyTestDue = 0,
    expectedCalving = 0,
    dryOffDue = 0,
    openCattle = 0,
    repeatBreeders = 0;
  for (const animal of animals) {
    const service = services
      .filter((s) => s.cattleId === animal.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const birth = births
      .filter((b) => b.cattleId === animal.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const pregnant =
      animal.reproductiveStatus === "pregnant" ||
      (!animal.reproductiveStatus && animal.stage === "pregnant");
    const failedServices = services.filter(
      (service) =>
        service.cattleId === animal.id &&
        (!birth || service.date > birth.date) &&
        tested.has(service.id) &&
        !confirmed.has(service.id),
    );
    if (!pregnant && failedServices.length >= 3) repeatBreeders++;
    if (pregnant && animal.expectedCalvingDate) {
      if (animal.expectedCalvingDate <= future) expectedCalving++;
      if (
        isLactating(animal) &&
        addDays(animal.expectedCalvingDate, -cfg.dryPeriodDays) <= today
      )
        dryOffDue++;
    }
    if (
      service &&
      (!birth || birth.date < service.date) &&
      !pregnant &&
      !tests.some(
        (t) => t.inseminationId === service.id && t.result !== "inconclusive",
      ) &&
      addDays(service.date, cfg.pregnancyTestDays) <= today
    )
      pregnancyTestDue++;
    if (
      !pregnant &&
      animal.gender === "female" &&
      !["calf", "weaned_calf"].includes(animal.lifeStage || animal.stage)
    ) {
      openCattle++;
      const heat = observations
        .filter((h) => h.cattleId === animal.id)
        .sort(
          (a, b) =>
            new Date(b.detectedAt).valueOf() - new Date(a.detectedAt).valueOf(),
        )[0];
      const anchor =
        service?.date ||
        (heat ? farmDay(cfg.timezone, new Date(heat.detectedAt)) : null);
      if (anchor && addDays(anchor, cfg.heatIntervalDays) <= today)
        expectedHeat++;
    }
  }
  return {
    today,
    repeatBreeders,
    totalCattle: animals.length,
    pregnant: animals.filter(
      (a) =>
        a.reproductiveStatus === "pregnant" ||
        (!a.reproductiveStatus && a.stage === "pregnant"),
    ).length,
    dry: animals.filter(
      (a) =>
        a.productionStatus === "dry" ||
        (!a.productionStatus && a.stage === "dry"),
    ).length,
    milking: animals.filter(isLactating).length,
    heifer: animals.filter((a) => (a.lifeStage || a.stage) === "heifer").length,
    openCattle,
    expectedHeat,
    pregnancyTestDue,
    expectedPregnancyTests: pregnancyTestDue,
    expectedCalving,
    expectedCalvings: expectedCalving,
    dryOffDue,
    totalInseminations: services.length,
    totalCalvings: births.length,
    conceptionRate: tested.size
      ? Math.round((confirmed.size / tested.size) * 100)
      : null,
    testedServices: tested.size,
    confirmedServices: confirmed.size,
    dewormingDue: work.filter(
      (t) =>
        !finishedTask(t.status) &&
        t.dueDate &&
        t.dueDate <= today &&
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
