import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import * as s from "@shared/schema";
import { rows, settings, makeTask, schedulePregnancy } from "./care-service";
import { addDays, farmDay, finishedTask } from "@shared/care";
import {
  breedingOverview,
  latestVaccinations,
  vaccineIdentity,
  activeAnimal,
} from "@shared/farm-overview";

/** Rebuild derived work from actual records, without repeating completed clinical actions. */
export async function reconcileCare(tenantId: string, today?: string) {
  const cfg = await settings(tenantId);
  today ||= farmDay(cfg.timezone);
  const animals = await rows(s.cattle, tenantId),
    services = await rows(s.inseminations, tenantId),
    tests = await rows(s.pregnancyTests, tenantId),
    births = await rows(s.calvings, tenantId),
    heats = await rows(s.heats, tenantId);
  const work = await rows(s.tasks, tenantId);
  const ensure = async (data: any, reopen = false) => {
    const old = work.find((t) => t.sourceKey === data.sourceKey);
    if (!old) return makeTask(tenantId, data);
    const reactivated =
      old.reason === "Animal is no longer active in this herd";
    if (
      (!finishedTask(old.status) ||
        (reopen && old.status === "completed") ||
        reactivated) &&
      old.status !== "postponed" &&
      (finishedTask(old.status) ||
        Object.entries(data).some(
          ([key, value]) => (old as any)[key] !== value,
        ))
    )
      await db
        .update(s.tasks)
        .set({
          ...data,
          status: finishedTask(old.status) ? "pending" : old.status,
          ...(finishedTask(old.status)
            ? { completedAt: null, completedBy: null, reason: null }
            : {}),
          revision: sql`${s.tasks.revision}+1`,
          updatedAt: new Date(),
        })
        .where(eq(s.tasks.id, old.id));
  };
  for (const a of animals.filter(activeAnimal)) {
    const service = services
      .filter((v) => v.cattleId === a.id && v.date <= today!)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (
      service &&
      a.reproductiveStatus === "served" &&
      !births.some((b) => b.cattleId === a.id && b.date >= service.date) &&
      !tests.some(
        (t) => t.inseminationId === service.id && t.result !== "inconclusive",
      )
    ) {
      await ensure(
        {
          cattleId: a.id,
          title: "Pregnancy confirmation due",
          type: "breeding",
          dueDate: addDays(service.date, cfg.pregnancyTestDays),
          trigger: "insemination",
          cycleId: service.id,
          sourceKey: `service:${service.id}:test`,
        },
        true,
      );
    }
    if (a.reproductiveStatus === "pregnant" && a.expectedCalvingDate) {
      await schedulePregnancy(tenantId, a, a.expectedCalvingDate, "scheduler");
      if (a.expectedCalvingDate <= addDays(today!, 20))
        await ensure({
          cattleId: a.id,
          title:
            "Review pre-calving diet, supplements and maternity preparation",
          type: "feeding",
          dueDate: addDays(a.expectedCalvingDate, -20),
          sourceKey: `pregnancy:${a.id}:${a.breedingCycleId}:diet`,
          trigger: "expected_calving",
          cycleId: a.breedingCycleId,
          evidenceRequired: true,
          priority: "high",
        });
    }
    if (a.reproductiveStatus === "pregnant" && !a.expectedCalvingDate)
      await ensure({
        cattleId: a.id,
        title: "Record expected calving date",
        type: "breeding",
        dueDate: today,
        sourceKey: `missing-expected:${a.id}`,
        priority: "high",
      });
    else
      for (const t of work.filter(
        (t) =>
          t.sourceKey === `missing-expected:${a.id}` && !finishedTask(t.status),
      ))
        await db
          .update(s.tasks)
          .set({
            status: "completed",
            completedAt: new Date(),
            reason: "Pregnancy information updated",
          })
          .where(eq(s.tasks.id, t.id));
    if (
      a.gender === "female" &&
      (a.lifeStage || a.stage) === "heifer" &&
      a.dateOfBirth &&
      a.reproductiveStatus === "unserved"
    )
      await ensure({
        cattleId: a.id,
        title: "Review heifer breeding readiness with the farm plan",
        type: "breeding",
        dueDate: addDays(a.dateOfBirth, cfg.heiferInseminationAgeDays || 365),
        sourceKey: `heifer-readiness:${a.id}`,
        evidenceRequired: true,
      });
  }
  const overview = breedingOverview(
    animals,
    services,
    tests,
    births,
    heats,
    cfg,
    today,
  );
  for (const a of overview.heatDue) {
    const service = services.find(
      (v) => v.cattleId === a.id && v.date === a.refDate,
    );
    const sourceKey = service
      ? `service:${service.id}:heat`
      : `expected-heat:${a.id}:${a.refDate}`;
    await ensure({
      cattleId: a.id,
      title: "Expected heat: observe and record; review absent heat",
      type: "breeding",
      dueDate: a.dueDate,
      trigger: "heat",
      sourceKey,
      evidenceRequired: true,
    });
  }
  const doses = latestVaccinations(
    await rows(s.vaccinations, tenantId),
    animals,
    today,
  );
  const wanted = new Set(
    doses
      .filter((v) => v.nextDueDate)
      .map((v) => `vaccine:${vaccineIdentity(v)}:${v.id}`),
  );
  for (const t of work.filter(
    (t) => t.sourceKey?.startsWith("vaccine:") && !finishedTask(t.status),
  ))
    if (!wanted.has(t.sourceKey))
      await db
        .update(s.tasks)
        .set({
          status: "cancelled",
          reason: "Superseded by recorded vaccine history",
        })
        .where(eq(s.tasks.id, t.id));
  for (const v of doses.filter((v) => v.nextDueDate))
    await ensure(
      {
        cattleId: v.cattleId,
        title: `Vaccination: ${v.vaccineName}`,
        type: "health",
        dueDate: v.nextDueDate,
        sourceKey: `vaccine:${vaccineIdentity(v)}:${v.id}`,
        evidenceRequired: true,
      },
      true,
    );
  for (const task of await rows(s.tasks, tenantId)) {
    const a = animals.find((a) => a.id === task.cattleId);
    const obsoleteHeat =
      a &&
      (task.sourceKey?.endsWith(":heat") ||
        task.sourceKey?.startsWith("expected-heat:")) &&
      !overview.heatDue.some((c) => c.id === a.id);
    if (
      task.cattleId &&
      !finishedTask(task.status) &&
      (!a || !activeAnimal(a) || obsoleteHeat)
    )
      await db
        .update(s.tasks)
        .set({
          status: "cancelled",
          reason: obsoleteHeat
            ? "Reproductive state updated"
            : "Animal is no longer active in this herd",
          revision: task.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(s.tasks.id, task.id));
  }
}
