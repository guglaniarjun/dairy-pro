import { eq, sql } from "drizzle-orm";
import { db, transactionContext } from "./db";
import {
  tenants,
  tasks,
  alerts,
  reportSchedules,
  cattle,
  vaccinations,
  inseminations,
  pregnancyTests,
  calvings,
} from "@shared/schema";
import {
  rows,
  settings,
  buildDailyReport,
  stockForecast,
  schedulePregnancy,
  makeTask,
} from "./care-service";
import { farmDay, addDays, finishedTask } from "@shared/care";
import { queueWhatsappMessage } from "./notification-engine";
export async function evaluateCare(tenantId: string, now = new Date()) {
  return db.transaction((tx) =>
    transactionContext.run(tx, async () => {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtext(${tenantId}))`,
      );
      const cfg = await settings(tenantId),
        today = farmDay(cfg.timezone, now);
      const existingWork = await rows(tasks, tenantId);
      const animals = await rows(cattle, tenantId);
      const services = await rows(inseminations, tenantId),
        tests = await rows(pregnancyTests, tenantId),
        births = await rows(calvings, tenantId);
      for (const animal of animals.filter(
        (a) => a.status === "active" && !a.mergedIntoId,
      )) {
        const service = services
          .filter((s) => s.cattleId === animal.id)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        if (
          service &&
          animal.reproductiveStatus !== "pregnant" &&
          !births.some(
            (b) => b.cattleId === animal.id && b.date >= service.date,
          ) &&
          !tests.some(
            (t) =>
              t.inseminationId === service.id && t.result !== "inconclusive",
          )
        ) {
          for (const step of [
            {
              key: "test",
              title: "Pregnancy confirmation due",
              days: cfg.pregnancyTestDays,
            },
            {
              key: "heat",
              title: "Observe expected return to heat (prediction)",
              days: cfg.heatIntervalDays,
            },
          ])
            await makeTask(tenantId, {
              cattleId: animal.id,
              title: step.title,
              type: "breeding",
              dueDate: addDays(service.date, step.days),
              trigger: "insemination",
              cycleId: service.id,
              sourceKey: `service:${service.id}:${step.key}`,
            });
        }
        if (
          animal.expectedCalvingDate &&
          animal.reproductiveStatus === "pregnant" &&
          !existingWork.some(
            (t) =>
              t.cattleId === animal.id &&
              t.sourceKey?.startsWith(
                `pregnancy:${animal.id}:${animal.breedingCycleId}:`,
              ),
          )
        )
          await schedulePregnancy(
            tenantId,
            animal,
            animal.expectedCalvingDate,
            "scheduler",
          );
      }
      const vaccineRecords = await rows(vaccinations, tenantId);
      for (const v of vaccineRecords) {
        if (
          !v.nextDueDate ||
          !animals.some((a) => a.id === v.cattleId && a.status === "active") ||
          vaccineRecords.some(
            (n) =>
              n.cattleId === v.cattleId &&
              n.vaccineId === v.vaccineId &&
              n.date > v.date,
          )
        )
          continue;
        await makeTask(tenantId, {
          cattleId: v.cattleId,
          title: `Follow-up: ${v.vaccineName || "vaccination"}`,
          type: "health",
          dueDate: v.nextDueDate,
          sourceKey: `vaccine:${v.vaccineId}:${v.id}`,
          evidenceRequired: true,
        });
      }
      for (const task of await rows(tasks, tenantId)) {
        if (
          task.cattleId &&
          !animals.some(
            (a) =>
              a.id === task.cattleId &&
              a.status === "active" &&
              !a.mergedIntoId,
          ) &&
          !finishedTask(task.status)
        ) {
          await db
            .update(tasks)
            .set({
              status: "cancelled",
              reason: "Animal is no longer active in this herd",
              updatedAt: new Date(),
              revision: task.revision + 1,
            })
            .where(eq(tasks.id, task.id));
          continue;
        }
        if (!task.dueDate || task.dueDate > today || finishedTask(task.status))
          continue;
        const overdue = task.dueDate < today;
        await db
          .insert(alerts)
          .values({
            tenantId,
            type: "task",
            title: task.title,
            message: `${overdue ? "Overdue since" : "Due"} ${task.dueDate}. ${task.reason || ""}`,
            severity: overdue ? "critical" : "warning",
            cattleId: task.cattleId,
            referenceType: "care_task",
            referenceId: task.id,
            dedupeKey: `care:${tenantId}:${task.id}:${overdue ? "overdue" : "due"}`,
          })
          .onConflictDoNothing();
      }
      const work = await rows(tasks, tenantId);
      for (const alert of await rows(alerts, tenantId))
        if (
          alert.referenceType === "care_task" &&
          work.some((t) => t.id === alert.referenceId && finishedTask(t.status))
        )
          await db
            .update(alerts)
            .set({ isDismissed: true })
            .where(eq(alerts.id, alert.id));
      for (const item of await stockForecast(tenantId, today))
        if (item.lowStock || item.shortage || item.expired.length)
          await db
            .insert(alerts)
            .values({
              tenantId,
              type: "inventory",
              title: `Review stock: ${item.name}`,
              message: `Usable ${item.available} ${item.unit}; required ${item.required}; shortage ${item.shortage}; expired lots ${item.expired.length}`,
              severity: item.shortage ? "critical" : "warning",
              dedupeKey: `stock:${tenantId}:${item.id}:${today}`,
            })
            .onConflictDoNothing();
      const schedule = (await rows(reportSchedules, tenantId))[0];
      if (!schedule || schedule.status !== "active") return;
      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone: cfg.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(now);
      const through = time >= schedule.cutoff ? today : addDays(today, -1);
      let day = schedule.lastDate
        ? addDays(schedule.lastDate, 1)
        : farmDay(cfg.timezone, new Date(schedule.createdAt));
      // Bound each pass while retaining the cursor, so downtime catches up without skipping dates.
      for (let n = 0; day <= through && n < 31; n++, day = addDays(day, 1)) {
        const report = await buildDailyReport(tenantId, day, "scheduler", true);
        await db
          .update(reportSchedules)
          .set({ lastDate: day })
          .where(eq(reportSchedules.id, schedule.id));
        for (const phone of schedule.recipients)
          await queueWhatsappMessage(
            tenantId,
            phone,
            `Daily farm report ${day}: milk ${report.milk.produced} L; ${report.tasks.filter((t: any) => !finishedTask(t.status) && t.dueDate <= day).length} outstanding actions. Complete report: ${process.env.PUBLIC_APP_URL || ""}/daily-report?date=${day}&archive=${report.reportId}`,
            "daily_report",
          );
      }
    }),
  );
}
let running = false;
export function startCareWorkers() {
  const run = async () => {
    if (running) return;
    running = true;
    try {
      for (const farm of await db
        .select()
        .from(tenants)
        .where(eq(tenants.isActive, true)))
        await evaluateCare(farm.id);
    } catch (error) {
      console.error("Care/report worker failed", error);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 15000).unref();
  setInterval(run, 60000).unref();
}
