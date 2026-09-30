import crypto from "node:crypto";
import { and, eq, sql, desc } from "drizzle-orm";
import { db } from "./db";
import {
  cattle,
  tasks,
  farmSettings,
  farmEvents,
  careProtocols,
  stockLots,
  stockLedger,
  inventoryItems,
  inventoryTransactions,
  animalGroups,
  workBatches,
  dietPlans,
  cattleCosts,
  calvings,
  alerts,
  tenants,
  milkEntries,
  milkSales,
  expenses,
  incomes,
  auditLogs,
  dailyReports,
  healthEvents,
  treatments,
  vaccinations,
  heats,
  inseminations,
  pregnancyTests,
  feedingRecords,
  cattleTransactions,
  cattlePayments,
  byproductTransactions,
  users,
} from "@shared/schema";
import {
  addDays,
  farmDay,
  finishedTask,
  lotExpiry,
  matchesAnimal,
  positive,
  daySchema,
  protocolSchema,
  eventSchema,
  isLactating,
  farmMidnight,
} from "@shared/care";
export class FarmError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function fail(message: string, status = 400): never {
  throw new FarmError(message, status);
}
export async function owned(table: any, tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.tenantId, tenantId)));
  return row || fail("Record not found in this farm", 404);
}
export async function rows(table: any, tenantId: string): Promise<any[]> {
  return db.select().from(table).where(eq(table.tenantId, tenantId));
}
export async function settings(tenantId: string) {
  return (
    (await rows(farmSettings, tenantId))[0] || {
      timezone: "Asia/Kolkata",
      gestationDays: 280,
      dryPeriodDays: 60,
      heatIntervalDays: 21,
      pregnancyTestDays: 30,
      milkingSessions: 2,
    }
  );
}
export async function recordEvent(
  tenantId: string,
  type: string,
  date: string,
  payload: any,
  cattleId?: string | null,
  recordedBy?: string,
  sourceType?: string,
  sourceId?: string,
  batchId?: string | null,
) {
  const [event] = await db
    .insert(farmEvents)
    .values({
      tenantId,
      type,
      date,
      payload,
      cattleId,
      recordedBy,
      sourceType,
      sourceId,
      batchId,
    })
    .returning();
  return event;
}
export async function assertTag(
  tenantId: string,
  tag: string,
  exceptId?: string,
) {
  if (!tag?.trim()) fail("Animal tag is required");
  const match = (await rows(cattle, tenantId)).find(
    (c) =>
      !c.mergedIntoId &&
      c.id !== exceptId &&
      c.tagNumber.trim().toLowerCase() === tag.trim().toLowerCase(),
  );
  if (match)
    fail(
      `Tag ${tag} already belongs to another animal. Review duplicates before adding another.`,
      409,
    );
}
export async function assertCapacity(tenantId: string, extra = 1) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  const count = (await rows(cattle, tenantId)).filter(
    (c) => c.status === "active" && !c.mergedIntoId,
  ).length;
  if (tenant && tenant.maxCattle > 0 && count + extra > tenant.maxCattle)
    fail("The farm's animal allowance would be exceeded", 409);
}
export async function isMilkWithheld(
  tenantId: string,
  animalId: string,
  date: string,
) {
  const healthIds = new Set(
    (await rows(healthEvents, tenantId))
      .filter((h) => h.cattleId === animalId)
      .map((h) => h.id),
  );
  const legacy = (await rows(treatments, tenantId)).some(
    (t) =>
      healthIds.has(t.healthEventId) &&
      t.date <= date &&
      (t.withdrawalEndsAt ||
        (Number(t.withdrawalDays) > 0
          ? addDays(t.date, Number(t.withdrawalDays))
          : "")) >= date,
  );
  if (legacy) return true;
  const events = (await rows(farmEvents, tenantId)).filter(
    (e) => e.cattleId === animalId && e.date <= date,
  );
  return events.some((e) => {
    const days =
      e.payload?.milkWithdrawalDays ?? e.payload?.clinical?.milkWithdrawalDays;
    return (
      Number(days) > 0 &&
      ["treatment", "deworming", "vaccination", "task_completed"].includes(
        e.type,
      ) &&
      addDays(e.date, Number(days)) >= date
    );
  });
}
export async function makeTask(tenantId: string, data: any) {
  const [task] = await db
    .insert(tasks)
    .values({ tenantId, ...data })
    .onConflictDoNothing()
    .returning();
  return task;
}
export async function triggerProtocols(
  tenantId: string,
  animal: any,
  trigger: string,
  anchor: string,
  sourceId: string,
  cycleId?: string,
) {
  const versions = await rows(careProtocols, tenantId);
  const protocols = versions.filter(
    (p) =>
      p.status === "approved" &&
      p.trigger === trigger &&
      matchesAnimal(animal, p.eligibility, anchor),
  );
  for (const p of protocols)
    for (const [index, step] of p.steps.entries()) {
      for (
        let occurrence = 0;
        occurrence < (step.repeatCount || 1);
        occurrence++
      ) {
        const sourceKey = `protocol:${p.id}:${sourceId}:${animal.id}:${index}:${occurrence}`;
        const priorIds = versions
          .filter((v) => v.familyId === p.familyId && v.id !== p.id)
          .map((v) => v.id);
        const prior = (await rows(tasks, tenantId)).filter(
          (t) =>
            priorIds.includes(t.protocolId) &&
            t.sourceKey?.endsWith(
              `:${sourceId}:${animal.id}:${index}:${occurrence}`,
            ),
        );
        // A version change must never repeat a completed dose or observation.
        if (prior.some((t) => t.status === "completed")) continue;
        const dueDate = addDays(
          anchor,
          step.offsetDays + occurrence * (step.repeatEveryDays || 0),
        );
        const existing = (await rows(tasks, tenantId)).find(
          (t) => t.sourceKey === sourceKey,
        );
        if (existing && !finishedTask(existing.status))
          await db
            .update(tasks)
            .set({
              dueDate,
              updatedAt: new Date(),
              revision: sql`${tasks.revision}+1`,
            })
            .where(eq(tasks.id, existing.id));
        else if (!existing)
          await makeTask(tenantId, {
            cattleId: animal.id,
            title: step.title,
            description: step.instructions,
            type: step.type,
            assignedTo: step.assignedTo || null,
            dueDate,
            originalDueDate: dueDate,
            trigger,
            cycleId,
            sourceKey,
            protocolId: p.id,
            protocolVersion: p.version,
            supplies: step.supplies,
            clinical: {
              milkWithdrawalDays: step.milkWithdrawalDays,
              meatWithdrawalDays: step.meatWithdrawalDays,
            },
            evidenceRequired: step.evidenceRequired,
          });
      }
    }
}
export async function schedulePregnancy(
  tenantId: string,
  animal: any,
  expected: string,
  actor?: string,
) {
  daySchema.parse(expected);
  const cfg = await settings(tenantId);
  const cycle =
    ["served", "pregnant"].includes(animal.reproductiveStatus) &&
    animal.breedingCycleId
      ? animal.breedingCycleId
      : crypto.randomUUID();
  await db
    .update(cattle)
    .set({
      expectedCalvingDate: expected,
      reproductiveStatus: "pregnant",
      breedingCycleId: cycle,
      revision: sql`${cattle.revision}+1`,
      updatedAt: new Date(),
    })
    .where(eq(cattle.id, animal.id));
  const updated = {
    ...animal,
    expectedCalvingDate: expected,
    reproductiveStatus: "pregnant",
    breedingCycleId: cycle,
  };
  const due = [
    {
      suffix: "dry",
      title: "Review and carry out planned dry-off",
      days: -cfg.dryPeriodDays,
      type: "breeding",
    },
    {
      suffix: "calving",
      title: "Expected calving: monitor and prepare",
      days: 0,
      type: "breeding",
    },
  ];
  for (const item of due) {
    const sourceKey = `pregnancy:${animal.id}:${cycle}:${item.suffix}`;
    const date = addDays(expected, item.days);
    const old = (await rows(tasks, tenantId)).find(
      (t) => t.sourceKey === sourceKey,
    );
    if (old && !finishedTask(old.status))
      await db
        .update(tasks)
        .set({ dueDate: date, updatedAt: new Date() })
        .where(eq(tasks.id, old.id));
    else if (!old)
      await makeTask(tenantId, {
        cattleId: animal.id,
        title: item.title,
        type: item.type,
        dueDate: date,
        originalDueDate: date,
        sourceKey,
        trigger: "expected_calving",
        cycleId: cycle,
      });
  }
  await triggerProtocols(
    tenantId,
    updated,
    "expected_calving",
    expected,
    cycle,
    cycle,
  );
  return updated;
}
export async function closePregnancy(
  tenantId: string,
  animal: any,
  reason: string,
) {
  for (const task of await rows(tasks, tenantId))
    if (
      task.cattleId === animal.id &&
      task.cycleId === animal.breedingCycleId &&
      ["expected_calving", "insemination", "heat"].includes(task.trigger) &&
      !finishedTask(task.status)
    )
      await db
        .update(tasks)
        .set({ status: "cancelled", reason, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));
}
export async function consumeSupplies(
  tenantId: string,
  supplies: any[],
  date: string,
  actor?: string,
  cattleId?: string | null,
  taskId?: string,
  selections?: Record<string, string>,
) {
  let cost = 0;
  const consumed: any[] = [];
  for (const supply of supplies) {
    let remaining = positive.parse(supply.quantity);
    const item = await owned(inventoryItems, tenantId, supply.itemId);
    const lots = (await rows(stockLots, tenantId))
      .filter(
        (l) =>
          l.itemId === item.id &&
          Number(l.quantity) > 0 &&
          lotExpiry(l) >= date &&
          l.receivedDate <= date &&
          (!selections?.[item.id] || selections[item.id] === l.id),
      )
      .sort(
        (a, b) =>
          lotExpiry(a).localeCompare(lotExpiry(b)) ||
          a.receivedDate.localeCompare(b.receivedDate),
      );
    if (lots.reduce((n, l) => n + Number(l.quantity), 0) + 0.000001 < remaining)
      fail(
        `Insufficient unexpired stock of ${item.name}. Need ${remaining} ${item.unit}.`,
        409,
      );
    for (const lot of lots) {
      if (remaining <= 0.000001) break;
      const qty = Math.min(remaining, Number(lot.quantity));
      const lineCost = qty * Number(lot.unitCost);
      await db
        .update(stockLots)
        .set({ quantity: String(Number(lot.quantity) - qty) })
        .where(eq(stockLots.id, lot.id));
      await db.insert(stockLedger).values({
        tenantId,
        lotId: lot.id,
        itemId: item.id,
        type: "issue",
        quantity: String(-qty),
        cost: String(lineCost),
        cattleId,
        taskId,
        date,
        recordedBy: actor,
      });
      await db.insert(inventoryTransactions).values({
        tenantId,
        itemId: item.id,
        type: "issue",
        quantity: String(qty),
        unitCost: lot.unitCost,
        totalCost: String(lineCost),
        batchNumber: lot.batchNumber,
        referenceType: taskId ? "task" : "animal_event",
        referenceId: taskId || cattleId,
        recordedBy: actor,
      });
      cost += lineCost;
      remaining -= qty;
      consumed.push({
        itemId: item.id,
        item: item.name,
        unit: item.unit,
        lotId: lot.id,
        batch: lot.batchNumber,
        quantity: qty,
        cost: lineCost,
      });
    }
    await db
      .update(inventoryItems)
      .set({
        currentStock: sql`${inventoryItems.currentStock}-${supply.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, item.id));
  }
  return { cost, consumed };
}
export async function receiveStock(
  tenantId: string,
  input: any,
  actor?: string,
  opening = false,
) {
  const item = await owned(inventoryItems, tenantId, input.itemId);
  const packs = positive.parse(input.packs ?? input.quantity);
  const units = positive.parse(input.unitsPerPack ?? 1);
  const quantity = packs * units;
  const date = daySchema.parse(input.receivedDate);
  const expiry = input.expiryDate ? daySchema.parse(input.expiryDate) : null;
  if (expiry && expiry < date) fail("Expiry must not precede receipt date");
  if (!input.batchNumber?.trim())
    fail("A supplier batch or traceable receipt number is required");
  const unitCost = Number(input.packCost ?? 0) / units;
  if (!Number.isFinite(unitCost) || unitCost < 0) fail("Invalid purchase cost");
  const [lot] = await db
    .insert(stockLots)
    .values({
      tenantId,
      itemId: item.id,
      batchNumber: input.batchNumber.trim(),
      receivedDate: date,
      expiryDate: expiry,
      quantity: String(quantity),
      unitCost: String(unitCost),
      supplier: input.supplier,
      invoice: input.invoice,
      location: input.location,
      usableDays: input.usableDays
        ? positive.int().parse(input.usableDays)
        : null,
    })
    .returning();
  await db.insert(stockLedger).values({
    tenantId,
    lotId: lot.id,
    itemId: item.id,
    type: opening ? "opening_reconciliation" : "receipt",
    quantity: String(quantity),
    cost: opening ? "0" : String(quantity * unitCost),
    date,
    recordedBy: actor,
  });
  await db.insert(inventoryTransactions).values({
    tenantId,
    itemId: item.id,
    type: opening ? "adjustment" : "purchase",
    quantity: String(quantity),
    unitCost: String(unitCost),
    totalCost: opening ? "0" : String(quantity * unitCost),
    batchNumber: lot.batchNumber,
    expiryDate: expiry,
    recordedBy: actor,
  });
  await db
    .update(inventoryItems)
    .set({
      currentStock: sql`${inventoryItems.currentStock}+${quantity}`,
      lastPurchasePrice: String(unitCost),
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, item.id));
  await recordEvent(
    tenantId,
    "stock_received",
    date,
    { item: item.name, lot, quantity, unit: item.unit },
    null,
    actor,
  );
  return lot;
}
export async function completeTask(
  tenantId: string,
  id: string,
  input: any,
  actor?: string,
) {
  const task = await owned(tasks, tenantId, id);
  if (task.status === "completed") return task;
  if (task.cattleId) {
    const animal = await owned(cattle, tenantId, task.cattleId);
    if (animal.status !== "active" || animal.mergedIntoId)
      fail("This animal is no longer active; review or cancel the task", 409);
  }
  if (finishedTask(task.status))
    fail("This task has been cancelled or excluded", 409);
  if (input.revision != null && input.revision !== task.revision)
    fail("This task changed. Refresh before completing it.", 409);
  if (task.evidenceRequired && !input.evidence?.trim())
    fail("Completion evidence is required");
  const cfg = await settings(tenantId);
  const date = daySchema.parse(input.date || farmDay(cfg.timezone));
  if (date > farmDay(cfg.timezone))
    fail("An action cannot be completed in the future");
  if (
    task.sourceKey?.startsWith("pregnancy:") &&
    task.sourceKey.endsWith(":dry")
  ) {
    await animalEvent(
      tenantId,
      {
        cattleId: task.cattleId,
        type: "dry_off",
        date,
        notes: input.evidence || "Dry-off task completed",
        details: {},
      },
      actor,
    );
  }
  const supply = await consumeSupplies(
    tenantId,
    task.supplies || [],
    date,
    actor,
    task.cattleId,
    id,
    input.lots,
  );
  if (task.cattleId && supply.cost)
    await db.insert(cattleCosts).values({
      tenantId,
      cattleId: task.cattleId,
      date,
      category: task.type === "feeding" ? "feed" : "medicine",
      description: task.title,
      amount: String(supply.cost),
      sourceType: "task",
      sourceId: id,
    } as any);
  if (task.cattleId && task.clinical) {
    const animal = await owned(cattle, tenantId, task.cattleId);
    const hold: any = {};
    for (const [key, field] of [
      ["milkWithdrawalDays", "milkWithholdUntil"],
      ["meatWithdrawalDays", "meatWithholdUntil"],
    ]) {
      const days = task.clinical[key];
      if (days != null && days > 0) {
        const until = farmMidnight(addDays(date, days + 1), cfg.timezone);
        hold[field] =
          animal[field] && new Date(animal[field]) > until
            ? animal[field]
            : until;
      }
    }
    if (Object.keys(hold).length)
      await db.update(cattle).set(hold).where(eq(cattle.id, animal.id));
  }
  const [updated] = await db
    .update(tasks)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedBy: actor,
      evidence: { notes: input.evidence || "", ...supply },
      updatedAt: new Date(),
      revision: sql`${tasks.revision}+1`,
    })
    .where(eq(tasks.id, id))
    .returning();
  await recordEvent(
    tenantId,
    "task_completed",
    date,
    {
      title: task.title,
      taskId: id,
      ...supply,
      clinical: task.clinical,
      evidence: input.evidence,
    },
    task.cattleId,
    actor,
    "task",
    id,
    task.batchId,
  );
  if (task.isRecurring) {
    const interval =
      ({ daily: 1, weekly: 7, monthly: 30 } as any)[task.recurringPattern] ||
      Number(task.recurringPattern);
    if (!Number.isInteger(interval) || interval < 1)
      fail(
        "Recurring tasks require daily, weekly, monthly, or a positive interval in days",
      );
    await makeTask(tenantId, {
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      cattleId: task.cattleId,
      assignedTo: task.assignedTo,
      isRecurring: true,
      recurringPattern: task.recurringPattern,
      supplies: task.supplies,
      clinical: task.clinical,
      evidenceRequired: task.evidenceRequired,
      dueDate: addDays(task.dueDate || date, interval),
      sourceKey: `recurrence:${id}`,
    });
  }
  return updated;
}
export async function animalEvent(tenantId: string, raw: any, actor?: string) {
  const input = eventSchema.parse(raw);
  let animal = await owned(cattle, tenantId, input.cattleId);
  if (animal.mergedIntoId || animal.status !== "active")
    fail("Choose an active animal");
  const detail = input.details;
  const cfg = await settings(tenantId);
  const today = farmDay(cfg.timezone);
  if (input.type !== "expected_calving" && input.date > today)
    fail("Record actual events on or before today; use tasks for future work");
  const event = await recordEvent(
    tenantId,
    input.type,
    input.date,
    { ...detail, notes: input.notes },
    animal.id,
    actor,
  );
  const patch: any = {
    updatedAt: new Date(),
    revision: sql`${cattle.revision}+1`,
  };
  if (input.type === "expected_calving") {
    animal = await schedulePregnancy(
      tenantId,
      animal,
      daySchema.parse(detail.expectedDate || input.date),
      actor,
    );
  }
  if (input.type === "dry_off") {
    if (animal.gender !== "female")
      fail("Only female animals can be dried off");
    patch.productionStatus = "dry";
    patch.stage = "dry";
    for (const t of await rows(tasks, tenantId))
      if (
        t.cattleId === animal.id &&
        t.sourceKey?.endsWith(":dry") &&
        !finishedTask(t.status)
      )
        await db
          .update(tasks)
          .set({
            status: "completed",
            completedAt: new Date(),
            completedBy: actor,
          })
          .where(eq(tasks.id, t.id));
    await makeTask(tenantId, {
      cattleId: animal.id,
      title: "Review dry-period diet and transition plan",
      type: "feeding",
      dueDate: input.date,
      sourceKey: `dry-diet:${event.id}`,
      priority: "high",
    });
  }
  if (input.type === "pregnancy_loss") {
    await closePregnancy(tenantId, animal, "Pregnancy loss recorded");
    patch.reproductiveStatus = "lost";
    patch.breedingCycleId = null;
    patch.expectedCalvingDate = null;
    patch.healthStatus = "under_care";
    await makeTask(tenantId, {
      cattleId: animal.id,
      title: "Veterinary review following pregnancy loss",
      type: "health",
      priority: "urgent",
      dueDate: input.date,
      sourceKey: `loss:${event.id}`,
      evidenceRequired: true,
    });
  }
  if (["birth", "calving"].includes(input.type)) {
    if (animal.gender !== "female")
      fail("Choose the mother for a calving record");
    const calves = detail.calves || [];
    if (detail.outcome !== "stillborn" && !calves.length)
      fail("Enter at least one calf tag for a live birth");
    await assertCapacity(tenantId, calves.length);
    await closePregnancy(tenantId, animal, "Calving recorded");
    patch.reproductiveStatus = "unserved";
    patch.breedingCycleId = null;
    patch.productionStatus = "lactating";
    patch.lifeStage = "adult";
    patch.stage = "milking";
    patch.expectedCalvingDate = null;
    patch.lactationNumber = (animal.lactationNumber || 0) + 1;
    for (const calf of calves) {
      await assertTag(tenantId, calf.tagNumber);
      if (!["female", "male"].includes(calf.gender))
        fail("Calf sex is required");
      const [born] = await db
        .insert(cattle)
        .values({
          tenantId,
          tagNumber: calf.tagNumber.trim(),
          gender: calf.gender,
          species: animal.species,
          breedId: animal.breedId,
          dateOfBirth: input.date,
          dateOfEntry: input.date,
          source: "born",
          motherId: animal.id,
          stage: "calf",
          lifeStage: "calf",
          productionStatus: "not_lactating",
          reproductiveStatus: "unserved",
          weightKg: calf.weight ? String(positive.parse(calf.weight)) : null,
          pen: detail.pen || animal.pen,
        })
        .returning();
      await db.insert(calvings).values({
        tenantId,
        cattleId: animal.id,
        date: input.date,
        calfId: born.id,
        calfGender: born.gender,
        calfWeight: born.weightKg,
        outcome: "live",
        notes: input.notes,
      });
      await recordEvent(
        tenantId,
        "born",
        input.date,
        { motherId: animal.id, birthWeight: born.weightKg },
        born.id,
        actor,
        "event",
        event.id,
      );
      await triggerProtocols(tenantId, born, "birth", input.date, born.id);
      await triggerProtocols(tenantId, born, "age", input.date, born.id);
      await makeTask(tenantId, {
        cattleId: born.id,
        title: "Record newborn assessment, colostrum and calf care plan",
        type: "health",
        dueDate: input.date,
        priority: "high",
        sourceKey: `newborn:${born.id}`,
        evidenceRequired: true,
      });
    }
    if (!calves.length)
      await db.insert(calvings).values({
        tenantId,
        cattleId: animal.id,
        date: input.date,
        outcome: "stillborn",
        notes: input.notes,
      });
    await makeTask(tenantId, {
      cattleId: animal.id,
      title: "Post-calving health and diet review",
      type: "health",
      priority: "high",
      dueDate: input.date,
      sourceKey: `postpartum:${event.id}`,
    });
    await triggerProtocols(
      tenantId,
      { ...animal, ...patch },
      "calving",
      input.date,
      event.id,
    );
  }
  if (input.type === "weight")
    patch.weightKg = String(positive.parse(detail.weight));
  if (input.type === "pen_move") {
    if (!detail.pen?.trim()) fail("Enter the new pen");
    patch.pen = detail.pen;
  }
  if (input.type === "weaning") patch.lifeStage = "weaned_calf";
  if (input.type === "status_change") {
    for (const [key, options] of Object.entries({
      lifeStage: ["calf", "weaned_calf", "heifer", "adult"],
      productionStatus: ["lactating", "dry", "not_lactating"],
      reproductiveStatus: ["unserved", "served", "pregnant", "lost"],
      healthStatus: ["healthy", "under_care", "quarantine"],
      status: ["active", "sold", "dead", "culled"],
    }))
      if (detail[key]) {
        if (!options.includes(detail[key])) fail(`Invalid ${key}`);
        patch[key] = detail[key];
      }
  }
  if (["treatment", "deworming", "vaccination"].includes(input.type)) {
    if (!detail.instructions?.trim())
      fail("Record the approved clinical instructions or prescription");
    const used = await consumeSupplies(
      tenantId,
      detail.supplies || [],
      input.date,
      actor,
      animal.id,
    );
    await db
      .update(farmEvents)
      .set({ payload: { ...event.payload, ...used } })
      .where(eq(farmEvents.id, event.id));
    if (used.cost)
      await db.insert(cattleCosts).values({
        tenantId,
        cattleId: animal.id,
        date: input.date,
        category: "medicine",
        description: detail.instructions,
        amount: String(used.cost),
        sourceType: "event",
        sourceId: event.id,
      } as any);
    for (const [key, field] of [
      ["milkWithdrawalDays", "milkWithholdUntil"],
      ["meatWithdrawalDays", "meatWithholdUntil"],
    ])
      if (detail[key] != null) {
        const days = Number(detail[key]);
        if (!Number.isInteger(days) || days < 0 || days > 3650)
          fail("Invalid withdrawal interval");
        if (days === 0) continue;
        const until = farmMidnight(addDays(input.date, days + 1), cfg.timezone);
        const old = animal[field];
        patch[field] = old && new Date(old) > until ? old : until;
      }
    if (detail.repeatAfterDays)
      await makeTask(tenantId, {
        cattleId: animal.id,
        title: `Repeat ${input.type}: ${detail.instructions}`,
        description: input.notes,
        type: "health",
        dueDate: addDays(
          input.date,
          positive.int().parse(detail.repeatAfterDays),
        ),
        sourceKey: `repeat:${event.id}`,
        supplies: detail.supplies || [],
        clinical: {
          milkWithdrawalDays: detail.milkWithdrawalDays,
          meatWithdrawalDays: detail.meatWithdrawalDays,
        },
        evidenceRequired: true,
      });
  }
  await db.update(cattle).set(patch).where(eq(cattle.id, animal.id));
  if (!["expected_calving", "birth", "calving"].includes(input.type))
    await triggerProtocols(
      tenantId,
      { ...animal, ...patch },
      input.type,
      input.date,
      event.id,
      animal.breedingCycleId,
    );
  return event;
}
export async function groupMembers(tenantId: string, group: any) {
  return (await rows(cattle, tenantId)).filter((c) =>
    group.kind === "dynamic"
      ? matchesAnimal(c, group.criteria)
      : c.status === "active" &&
        !c.mergedIntoId &&
        group.cattleIds.includes(c.id),
  );
}
export async function createBatch(
  tenantId: string,
  input: any,
  actor?: string,
) {
  const group = input.groupId
    ? await owned(animalGroups, tenantId, input.groupId)
    : null;
  const animals = group
    ? await groupMembers(tenantId, group)
    : await Promise.all(
        [...new Set<string>(input.cattleIds || [])].map((id) =>
          owned(cattle, tenantId, id),
        ),
      );
  if (!animals.length) fail("Select at least one animal");
  if (!input.title?.trim()) fail("Enter the batch action");
  daySchema.parse(input.date);
  const [batch] = await db
    .insert(workBatches)
    .values({
      tenantId,
      title: input.title,
      date: input.date,
      groupId: input.groupId || null,
      createdBy: actor,
    })
    .returning();
  for (const animal of animals) {
    if (animal.status !== "active" || animal.mergedIntoId)
      fail("Batch contains an inactive animal");
    const duplicate = (await rows(tasks, tenantId)).find(
      (t) =>
        t.cattleId === animal.id &&
        t.title.trim().toLowerCase() === input.title.trim().toLowerCase() &&
        t.dueDate === input.date &&
        !finishedTask(t.status),
    );
    await makeTask(tenantId, {
      batchId: batch.id,
      cattleId: animal.id,
      title: input.title,
      type: input.type || "health",
      dueDate: input.date,
      assignedTo: input.assignedTo || null,
      description: input.instructions,
      supplies: input.supplies || [],
      clinical: input.clinical || null,
      sourceKey: `batch:${batch.id}:${animal.id}`,
      evidenceRequired: true,
      ...(duplicate
        ? {
            status: "excluded",
            reason: `Already scheduled in task ${duplicate.id}`,
          }
        : {}),
    });
  }
  return batch;
}
export async function effectiveDiet(
  tenantId: string,
  animal: any,
  date: string,
) {
  const plans = (await rows(dietPlans, tenantId)).filter(
    (p) =>
      p.status === "approved" &&
      p.startDate <= date &&
      (!p.endDate || p.endDate >= date),
  );
  const direct = plans
    .filter((p) => p.cattleId === animal.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (direct.length) return direct[0];
  const groups = await rows(animalGroups, tenantId);
  const applicable = [];
  for (const p of plans.filter((p) => p.groupId)) {
    const group = groups.find((g) => g.id === p.groupId);
    if (
      group &&
      (await groupMembers(tenantId, group)).some((c) => c.id === animal.id)
    )
      applicable.push(p);
  }
  if (applicable.length > 1)
    fail(
      `Animal ${animal.tagNumber} has overlapping group diets; add an individual diet or end an overlapping plan`,
      409,
    );
  return applicable[0] || null;
}
export async function stockForecast(tenantId: string, date: string) {
  const items = await rows(inventoryItems, tenantId),
    lots = await rows(stockLots, tenantId),
    work = await rows(tasks, tenantId);
  const horizon = addDays(date, 14);
  return items.map((item) => {
    const own = lots.filter((l) => l.itemId === item.id);
    const available = own
      .filter((l) => lotExpiry(l) >= date)
      .reduce((n, l) => n + Number(l.quantity), 0);
    const required = work
      .filter(
        (t) => !finishedTask(t.status) && t.dueDate && t.dueDate <= horizon,
      )
      .flatMap((t) => t.supplies || [])
      .filter((s) => s.itemId === item.id)
      .reduce((n, s) => n + Number(s.quantity), 0);
    return {
      ...item,
      available,
      required,
      reserved: required,
      shortage: Math.max(0, required - available),
      lowStock: available < Number(item.minStock),
      expired: own.filter((l) => lotExpiry(l) < date && Number(l.quantity) > 0),
      expiring: own.filter(
        (l) =>
          lotExpiry(l) >= date &&
          lotExpiry(l) <= horizon &&
          Number(l.quantity) > 0,
      ),
      untracked: Math.max(
        0,
        Number(item.currentStock) -
          own.reduce((n, l) => n + Number(l.quantity), 0),
      ),
    };
  });
}
export async function buildDailyReport(
  tenantId: string,
  date: string,
  actor?: string,
  save = false,
) {
  daySchema.parse(date);
  const cfg = await settings(tenantId);
  const generatedAt = new Date().toISOString();
  const [
    animals,
    events,
    work,
    batches,
    milk,
    sales,
    audit,
    stock,
    income,
    expense,
  ] = await Promise.all([
    rows(cattle, tenantId),
    rows(farmEvents, tenantId),
    rows(tasks, tenantId),
    rows(workBatches, tenantId),
    rows(milkEntries, tenantId),
    rows(milkSales, tenantId),
    rows(auditLogs, tenantId),
    stockForecast(tenantId, date),
    rows(incomes, tenantId),
    rows(expenses, tenantId),
  ]);
  const onDay = (v: any) => v && farmDay(cfg.timezone, new Date(v)) === date;
  const todayEvents = events.filter(
    (e) => e.date === date || onDay(e.createdAt),
  );
  const todayMilk = milk.filter((m) => m.date === date);
  const staff = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users);
  const describe = (records: any[]) =>
    records.forEach((r) => {
      if (r.cattleId)
        r.animalTag = animals.find((a) => a.id === r.cattleId)?.tagNumber;
      for (const key of ["recordedBy", "completedBy", "assignedTo", "userId"])
        if (r[key]) {
          const person = staff.find((u) => u.id === r[key]);
          r[`${key}Name`] = person
            ? [person.firstName, person.lastName].filter(Boolean).join(" ") ||
              r[key]
            : r[key];
        }
    });
  describe(todayMilk);
  describe(todayEvents);
  describe(work);
  describe(audit);
  const todaySales = sales.filter((s) => s.date === date);
  const produced = todayMilk.reduce((s, r) => s + Number(r.quantity), 0);
  const discardedAtMilking = todayMilk
    .filter((m) => m.destination === "discarded")
    .reduce((n, m) => n + Number(m.quantity), 0);
  const sold = todaySales.reduce((s, r) => s + Number(r.quantity), 0);
  const disposition = todayEvents.filter(
    (e) => e.type === "milk_disposition" && e.date === date,
  );
  const opening = disposition
    .filter((e) => e.payload.kind === "opening_stock")
    .reduce((n, e) => n + Number(e.payload.quantity || 0), 0);
  const used = disposition
    .filter((e) => e.payload.kind !== "opening_stock" && !e.payload.milkEntryId)
    .reduce((n, e) => n + Number(e.payload.quantity || 0), 0);
  const relevant = work.filter(
    (t) =>
      t.dueDate &&
      t.dueDate <= addDays(date, 14) &&
      (!finishedTask(t.status) || onDay(t.completedAt) || onDay(t.updatedAt)),
  );
  const legacy: any[] = [];
  for (const [label, table, key] of [
    ["health", healthEvents, "date"],
    ["vaccination", vaccinations, "date"],
    ["heat", heats, "detectedAt"],
    ["insemination", inseminations, "date"],
    ["pregnancy_test", pregnancyTests, "testDate"],
    ["calving", calvings, "date"],
    ["feeding", feedingRecords, "date"],
    ["animal_transaction", cattleTransactions, "date"],
    ["byproduct", byproductTransactions, "date"],
    ["animal_payment", cattlePayments, "date"],
  ] as const)
    for (const r of await rows(table, tenantId))
      if (String(r[key]).slice(0, 10) === date || onDay(r.createdAt))
        legacy.push({ type: label, ...r });
  const healthRecords = await rows(healthEvents, tenantId);
  for (const treatment of await rows(treatments, tenantId))
    if (treatment.date === date || onDay(treatment.createdAt))
      legacy.push({
        type: "treatment",
        ...treatment,
        cattleId: healthRecords.find((h) => h.id === treatment.healthEventId)
          ?.cattleId,
      });
  describe(legacy);
  const report: any = {
    date,
    timezone: cfg.timezone,
    generatedAt,
    cutoff: generatedAt,
    revision: null,
    milk: {
      produced,
      opening,
      discardedAtMilking,
      saleable: produced - discardedAtMilking,
      sold,
      used,
      unallocated:
        Math.round(
          (opening + produced - discardedAtMilking - sold - used) * 1000,
        ) / 1000,
      entries: todayMilk,
      sales: todaySales,
      dispositions: disposition,
      missing: animals
        .filter(isLactating)
        .map((a) => ({
          id: a.id,
          tag: a.tagNumber,
          missingSessions:
            cfg.milkingSessions -
            new Set(
              todayMilk
                .filter((m) => m.cattleId === a.id)
                .map((m) => m.session),
            ).size,
        }))
        .filter((a) => a.missingSessions > 0),
    },
    events: todayEvents,
    entries: legacy,
    tasks: relevant,
    batches: batches
      .filter((b) => relevant.some((t) => t.batchId === b.id))
      .map((b) => ({
        ...b,
        animals: work
          .filter((t) => t.batchId === b.id)
          .map((t) => ({
            ...t,
            tag: animals.find((a) => a.id === t.cattleId)?.tagNumber,
          })),
        completed: work.filter(
          (t) => t.batchId === b.id && t.status === "completed",
        ).length,
        total: work.filter((t) => t.batchId === b.id).length,
      })),
    stock,
    stockMovements: (await rows(stockLedger, tenantId)).filter(
      (l) => l.date === date,
    ),
    finance: {
      income: income.filter((r) => r.date === date),
      expenses: expense.filter((r) => r.date === date),
      milkSales: todaySales,
      costs: (await rows(cattleCosts, tenantId)).filter((r) => r.date === date),
    },
    audit: audit.filter((a) => onDay(a.createdAt)),
    animals: animals
      .filter((a) => !a.mergedIntoId)
      .map((a) => ({
        ...a,
        events: todayEvents.filter((e) => e.cattleId === a.id),
        entries: legacy.filter((e) => e.cattleId === a.id),
        milk: todayMilk.filter((e) => e.cattleId === a.id),
        tasks: relevant.filter((t) => t.cattleId === a.id),
        noActivity:
          !todayEvents.some((e) => e.cattleId === a.id) &&
          !legacy.some((e) => e.cattleId === a.id) &&
          !todayMilk.some((e) => e.cattleId === a.id),
      })),
  };
  if (save) {
    const prior = (await rows(dailyReports, tenantId)).filter(
      (r) => r.date === date,
    );
    report.revision = Math.max(0, ...prior.map((r) => r.revision)) + 1;
    const [saved] = await db
      .insert(dailyReports)
      .values({
        tenantId,
        date,
        revision: report.revision,
        snapshot: report,
        generatedBy: actor,
      })
      .returning();
    return { ...report, reportId: saved.id };
  }
  return report;
}
