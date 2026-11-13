import { reconcileCare } from "./care-reconciliation";
import { countdown } from "@shared/farm-overview";
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
      await reconcileCare(tenantId, today);
      const animals = await rows(cattle, tenantId);
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
        const leadDays = task.sourceKey?.endsWith(':calving') ? 20 : task.sourceKey?.endsWith(':dry') ? 14 : task.sourceKey?.startsWith('vaccine:') ? 7 : 1;
        const existingAlerts = (await rows(alerts, tenantId)).filter(a => a.referenceType === 'care_task' && a.referenceId === task.id);
        if (!task.dueDate || task.dueDate > addDays(today, leadDays) || finishedTask(task.status)) {
          for (const a of existingAlerts) if (!a.isDismissed) await db.update(alerts).set({ isDismissed:true }).where(eq(alerts.id,a.id));
          continue;
        }
        const currentTime = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.timezone, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(now);
        const upcoming = task.dueDate > today || (task.dueDate === today && task.dueTime && task.dueTime > currentTime);
        const message = countdown(task.dueDate,today) + (task.dueTime ? ' at '+task.dueTime : '') + '. ' + (task.reason || '');
        const old = existingAlerts.find(a => a.dedupeKey === 'care:'+tenantId+':'+task.id);
        const changed = old?.message !== message;
        const nextDay = old?.scheduledFor && farmDay(cfg.timezone,new Date(old.scheduledFor)) !== today;
        const values:any = { title:task.title, message, severity: upcoming ? 'info' : task.priority === 'urgent' || task.dueDate < today ? 'critical' : 'warning',
          isDismissed: old && !changed && !nextDay ? old.isDismissed : false, scheduledFor:now };
        if (old) await db.update(alerts).set(values).where(eq(alerts.id,old.id));
        else await db.insert(alerts).values({ ...values, tenantId, type:'task', cattleId:task.cattleId, referenceType:'care_task', referenceId:task.id, dedupeKey:'care:'+tenantId+':'+task.id }).onConflictDoNothing();
        for (const a of existingAlerts.filter(a => a.id !== old?.id)) await db.update(alerts).set({isDismissed:true}).where(eq(alerts.id,a.id));
      }
      for (const item of await stockForecast(tenantId, today)) {
        const key = 'stock:'+tenantId+':'+item.id;
        const old = (await rows(alerts,tenantId)).find(a=>a.dedupeKey===key);
        const active = !!(item.lowStock || item.shortage || item.expired.length || item.expiring.length);
        const data:any = { title:'Review stock: '+item.name, message:'Usable '+item.available+' '+item.unit+'; required '+item.required+'; shortage '+item.shortage+'; expired '+item.expired.length+'; expiring '+item.expiring.length,
          severity:item.shortage?'critical':'warning', isDismissed:!active, scheduledFor:now };
        if(old) await db.update(alerts).set(data).where(eq(alerts.id,old.id));
        else if(active) await db.insert(alerts).values({...data,tenantId,type:'inventory',dedupeKey:key}).onConflictDoNothing();
        for(const stale of (await rows(alerts,tenantId)).filter(a=>a.dedupeKey?.startsWith(key+':')&&!a.isDismissed)) await db.update(alerts).set({isDismissed:true}).where(eq(alerts.id,stale.id));
      }
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
        try { await evaluateCare(farm.id); } catch (error) { console.error("Care worker failed for farm", farm.id, error); }
    } catch (error) {
      console.error("Care/report worker failed", error);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 15000).unref();
  setInterval(run, 60000).unref();
}
