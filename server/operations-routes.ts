import type { Express, RequestHandler } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "./db";
import * as s from "@shared/schema";
import {
  addDays,
  farmDay,
  protocolSchema,
  eligibilitySchema,
  daySchema,
  positive,
  nonnegative,
  supplySchema,
  finishedTask,
  lotExpiry,
} from "@shared/care";
import {
  rows,
  owned,
  settings,
  fail,
  animalEvent,
  receiveStock,
  consumeSupplies,
  completeTask,
  createBatch,
  groupMembers,
  effectiveDiet,
  stockForecast,
  buildDailyReport,
  recordEvent,
  triggerProtocols,
  makeTask,
} from "./care-service";
import { validateFarmRequest } from "./request-safety";
import { storage } from "./storage";
import { reportPdf, reportWorkbook } from "./report-export";

export function registerOperations(
  app: Express,
  auth: RequestHandler,
  tenant: RequestHandler,
) {
  const permit =
    (permission: string): RequestHandler =>
    (req, res, next) => {
      if (req.tenantPermissions?.includes(permission)) next();
      else
        res.status(403).json({ error: `Permission required: ${permission}` });
    };
  const wrap =
    (fn: (req: any, res: any) => Promise<any>): RequestHandler =>
    async (req, res) => {
      try {
        await fn(req, res);
      } catch (e: any) {
        res.status(e.status || (e.name === "ZodError" ? 400 : 500)).json({
          error:
            e.status || e.name === "ZodError"
              ? e.message
              : "Unable to complete operation",
        });
        if (!e.status && e.name !== "ZodError") console.error(e);
      }
    };
  const get = (url: string, p: string, fn: any) =>
    app.get(`/api/operations${url}`, auth, tenant, permit(p), wrap(fn));
  const post = (url: string, p: string, fn: any) =>
    app.post(`/api/operations${url}`, auth, tenant, permit(p), wrap(fn));
  const patch = (url: string, p: string, fn: any) =>
    app.patch(`/api/operations${url}`, auth, tenant, permit(p), wrap(fn));
  post("/milk-bulk", "milk.manage", async (req: any, res: any) => {
    const entries = z
      .array(z.record(z.any()))
      .min(1)
      .max(2000)
      .parse(req.body.entries);
    const saved = [];
    for (const entry of entries) {
      await validateFarmRequest({
        ...req,
        path: "/api/milk",
        method: "POST",
        body: entry,
      });
      const row = await storage.createMilkEntry({
        ...entry,
        tenantId: req.tenantId,
        recordedBy: req.user.id,
      });
      saved.push(row);
      await recordEvent(
        req.tenantId,
        "milk_recorded",
        entry.date,
        row,
        entry.cattleId,
        req.user.id,
        "milk",
        row.id,
      );
    }
    res.status(201).json({ entries: saved });
  });
  get("/preferences", "cattle.view", async (req: any, res: any) => {
    const c = await settings(req.tenantId);
    res.json({
      timezone: c.timezone,
      gestationDays: c.gestationDays,
      dryPeriodDays: c.dryPeriodDays,
      heatIntervalDays: c.heatIntervalDays,
      pregnancyTestDays: c.pregnancyTestDays,
      milkingSessions: c.milkingSessions,
      fatMandatory: c.fatMandatory,
      snfMandatory: c.snfMandatory,
    });
  });
  get("/work", "tasks.view", async (req: any, res: any) => {
    const all = await rows(s.tasks, req.tenantId);
    res.json({
      tasks: all,
      batches: await rows(s.workBatches, req.tenantId),
      today: farmDay((await settings(req.tenantId)).timezone),
    });
  });
  get("/people", "tasks.view", async (req: any, res: any) => {
    const [farm] = await db
      .select()
      .from(s.tenants)
      .where(eq(s.tenants.id, req.tenantId));
    const ids = [
      farm.ownerId,
      ...(await rows(s.tenantMembers, req.tenantId))
        .filter((m) => m.isActive)
        .map((m) => m.userId),
    ];
    const users = await db
      .select({
        id: s.users.id,
        firstName: s.users.firstName,
        lastName: s.users.lastName,
      })
      .from(s.users);
    res.json(users.filter((u) => ids.includes(u.id)));
  });
  get("/events", "cattle.view", async (req: any, res: any) =>
    res.json(
      (await rows(s.farmEvents, req.tenantId)).filter(
        (e) => !req.query.cattleId || e.cattleId === req.query.cattleId,
      ),
    ),
  );
  post("/events", "cattle.view", async (req: any, res: any) => {
    const type = req.body.type;
    const need = [
      "treatment",
      "deworming",
      "vaccination",
      "pregnancy_loss",
    ].includes(type)
      ? "health.manage"
      : ["birth", "calving", "dry_off", "expected_calving"].includes(type)
        ? "breeding.manage"
        : "cattle.manage";
    if (need && !req.tenantPermissions.includes(need))
      fail(`Permission required: ${need}`, 403);
    req.body.details = req.body.details || {};
    if (req.body.details.supplies)
      req.body.details.supplies = z
        .array(supplySchema)
        .parse(req.body.details.supplies);
    res
      .status(201)
      .json(await animalEvent(req.tenantId, req.body, req.user.id));
  });
  post("/tasks/:id/complete", "tasks.manage", async (req: any, res: any) =>
    res.json(
      await completeTask(req.tenantId, req.params.id, req.body, req.user.id),
    ),
  );
  patch("/tasks/:id", "tasks.manage", async (req: any, res: any) => {
    const task = await owned(s.tasks, req.tenantId, req.params.id);
    const input = z
      .object({
        status: z.enum([
          "pending",
          "in_progress",
          "postponed",
          "cancelled",
          "excluded",
          "blocked",
        ]),
        reason: z.string().optional(),
        dueDate: daySchema.optional(),
        assignedTo: z.string().nullable().optional(),
        revision: z.number().optional(),
      })
      .parse(req.body);
    if (finishedTask(task.status))
      fail("A completed, cancelled or excluded task cannot be changed", 409);
    if (input.revision != null && input.revision !== task.revision)
      fail("Task changed; refresh before saving", 409);
    if (
      ["postponed", "cancelled", "excluded", "blocked"].includes(
        input.status,
      ) &&
      !input.reason?.trim()
    )
      fail("A reason is required");
    if (input.status === "postponed" && !input.dueDate)
      fail("Enter a new due date");
    const [updated] = await db
      .update(s.tasks)
      .set({
        ...input,
        originalDueDate: task.originalDueDate || task.dueDate,
        revision: task.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(s.tasks.id, task.id))
      .returning();
    await recordEvent(
      req.tenantId,
      "task_updated",
      farmDay((await settings(req.tenantId)).timezone),
      { before: task, task: updated },
      task.cattleId,
      req.user.id,
      "task",
      task.id,
      task.batchId,
    );
    res.json(updated);
  });
  get("/groups", "cattle.view", async (req: any, res: any) => {
    const groups = await rows(s.animalGroups, req.tenantId);
    res.json(
      await Promise.all(
        groups.map(async (g) => ({
          ...g,
          members: await groupMembers(req.tenantId, g),
        })),
      ),
    );
  });
  post("/groups", "cattle.manage", async (req: any, res: any) => {
    const input = z
      .object({
        name: z.string().trim().min(1),
        kind: z.enum(["manual", "dynamic"]),
        cattleIds: z.array(z.string()).default([]),
        criteria: eligibilitySchema.default({}),
      })
      .parse(req.body);
    for (const id of input.cattleIds) await owned(s.cattle, req.tenantId, id);
    const [group] = await db
      .insert(s.animalGroups)
      .values({ tenantId: req.tenantId, ...input })
      .returning();
    res.status(201).json(group);
  });
  post("/batches", "tasks.manage", async (req: any, res: any) => {
    req.body.clinical = z
      .object({
        milkWithdrawalDays: z.coerce.number().int().min(0).max(3650).optional(),
        meatWithdrawalDays: z.coerce.number().int().min(0).max(3650).optional(),
      })
      .parse(req.body.clinical || {});
    req.body.supplies = z.array(supplySchema).parse(req.body.supplies || []);
    for (const supply of req.body.supplies)
      await owned(s.inventoryItems, req.tenantId, supply.itemId);
    if (
      (req.body.supplies.length || Object.keys(req.body.clinical).length) &&
      !req.tenantPermissions.includes("health.manage")
    )
      fail("Health permission is required to prescribe batch supplies", 403);
    res
      .status(201)
      .json(await createBatch(req.tenantId, req.body, req.user.id));
  });
  post("/batches/:id/complete", "tasks.manage", async (req: any, res: any) => {
    await owned(s.workBatches, req.tenantId, req.params.id);
    const ids = z.array(z.string()).min(1).parse(req.body.taskIds);
    const done = [];
    for (const id of new Set(ids)) {
      const t = await owned(s.tasks, req.tenantId, id);
      if (t.batchId !== req.params.id) fail("Task is not in this batch");
      done.push(
        await completeTask(
          req.tenantId,
          id,
          { evidence: req.body.evidence, date: req.body.date },
          req.user.id,
        ),
      );
    }
    res.json({ completed: done });
  });
  get("/protocols", "health.view", async (req: any, res: any) =>
    res.json(await rows(s.careProtocols, req.tenantId)),
  );
  post("/protocols", "health.manage", async (req: any, res: any) => {
    const input = protocolSchema.parse(req.body);
    for (const step of input.steps)
      for (const supply of step.supplies)
        await owned(s.inventoryItems, req.tenantId, supply.itemId);
    if (input.steps.some((t) => t.repeatCount > 1 && !t.repeatEveryDays))
      fail("Repeated steps require an interval");
    const family = input.familyId || crypto.randomUUID();
    const versions = (await rows(s.careProtocols, req.tenantId)).filter(
      (p) => p.familyId === family,
    );
    const [protocol] = await db
      .insert(s.careProtocols)
      .values({
        ...input,
        tenantId: req.tenantId,
        familyId: family,
        version: Math.max(0, ...versions.map((p) => p.version)) + 1,
      })
      .returning();
    res.status(201).json(protocol);
  });
  post(
    "/protocols/:id/approve",
    "health.manage",
    async (req: any, res: any) => {
      const p = await owned(s.careProtocols, req.tenantId, req.params.id);
      if (p.status !== "draft") fail("Only a draft version can be approved");
      if (!req.body.note?.trim())
        fail(
          "Record the reviewing veterinarian or nutritionist and approval reference",
        );
      for (const old of await rows(s.careProtocols, req.tenantId))
        if (old.familyId === p.familyId && old.status === "approved") {
          await db
            .update(s.careProtocols)
            .set({ status: "retired" })
            .where(eq(s.careProtocols.id, old.id));
          if (
            ["expected_calving", "age"].includes(p.trigger) &&
            old.trigger === p.trigger
          ) {
            for (const task of await rows(s.tasks, req.tenantId))
              if (task.protocolId === old.id && !finishedTask(task.status))
                await db
                  .update(s.tasks)
                  .set({
                    status: "cancelled",
                    reason: `Superseded by approved protocol version ${p.version}`,
                    updatedAt: new Date(),
                    revision: task.revision + 1,
                  })
                  .where(eq(s.tasks.id, task.id));
          }
        }
      const [approved] = await db
        .update(s.careProtocols)
        .set({
          status: "approved",
          approvedBy: req.user.id,
          approvalNote: req.body.note,
          approvedAt: new Date(),
        })
        .where(eq(s.careProtocols.id, p.id))
        .returning();
      for (const animal of await rows(s.cattle, req.tenantId)) {
        if (p.trigger === "expected_calving" && animal.expectedCalvingDate)
          await triggerProtocols(
            req.tenantId,
            animal,
            p.trigger,
            animal.expectedCalvingDate,
            animal.breedingCycleId || animal.id,
            animal.breedingCycleId,
          );
        if (p.trigger === "age" && animal.dateOfBirth)
          await triggerProtocols(
            req.tenantId,
            animal,
            p.trigger,
            animal.dateOfBirth,
            animal.id,
          );
      }
      res.json(approved);
    },
  );
  get("/stock", "inventory.view", async (req: any, res: any) => {
    const today = farmDay((await settings(req.tenantId)).timezone);
    res.json({
      forecast: await stockForecast(req.tenantId, today),
      lots: await rows(s.stockLots, req.tenantId),
      ledger: await rows(s.stockLedger, req.tenantId),
      today,
    });
  });
  post("/stock/reconcile", "inventory.manage", async (req: any, res: any) => {
    const input = req.body;
    const item = await owned(s.inventoryItems, req.tenantId, input.itemId);
    const quantity =
      positive.parse(input.packs) * positive.parse(input.unitsPerPack || 1);
    const tracked = (await rows(s.stockLots, req.tenantId))
      .filter((l) => l.itemId === item.id)
      .reduce((n, l) => n + Number(l.quantity), 0);
    if (quantity > Number(item.currentStock) - tracked + 0.000001)
      fail(
        "Quantity exceeds the legacy balance that has not yet been assigned to lots",
        409,
      );
    const lot = await receiveStock(req.tenantId, input, req.user.id, true);
    await db
      .update(s.inventoryItems)
      .set({ currentStock: sql`${s.inventoryItems.currentStock}-${quantity}` })
      .where(eq(s.inventoryItems.id, item.id));
    await recordEvent(
      req.tenantId,
      "legacy_stock_reconciled",
      input.receivedDate,
      { itemId: item.id, lotId: lot.id, quantity },
      null,
      req.user.id,
    );
    res.status(201).json(lot);
  });
  post("/stock/receive", "inventory.manage", async (req: any, res: any) =>
    res
      .status(201)
      .json(await receiveStock(req.tenantId, req.body, req.user.id)),
  );
  post("/stock/:id/move", "inventory.manage", async (req: any, res: any) => {
    const lot = await owned(s.stockLots, req.tenantId, req.params.id);
    const input = z
      .object({
        type: z.enum(["open", "return", "waste", "adjust"]),
        date: daySchema,
        quantity: nonnegative.optional(),
        reason: z.string().trim().min(1),
      })
      .parse(req.body);
    if (input.type === "open") {
      if (lot.openedDate) fail("This lot is already opened");
      if (input.date < lot.receivedDate)
        fail("Opening date cannot precede receipt");
      const [updated] = await db
        .update(s.stockLots)
        .set({ openedDate: input.date })
        .where(eq(s.stockLots.id, lot.id))
        .returning();
      return res.json(updated);
    }
    if (input.quantity == null) fail("Quantity is required");
    let delta =
      input.type === "adjust"
        ? input.quantity - Number(lot.quantity)
        : input.type === "waste"
          ? -input.quantity
          : input.quantity;
    if (Number(lot.quantity) + delta < 0)
      fail("Movement exceeds available stock", 409);
    await db
      .update(s.stockLots)
      .set({ quantity: String(Number(lot.quantity) + delta) })
      .where(eq(s.stockLots.id, lot.id));
    await db
      .update(s.inventoryItems)
      .set({
        currentStock: sql`${s.inventoryItems.currentStock}+${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(s.inventoryItems.id, lot.itemId));
    const [entry] = await db
      .insert(s.stockLedger)
      .values({
        tenantId: req.tenantId,
        lotId: lot.id,
        itemId: lot.itemId,
        type: input.type,
        quantity: String(delta),
        cost: String(Math.abs(delta) * Number(lot.unitCost)),
        date: input.date,
        reason: input.reason,
        recordedBy: req.user.id,
      })
      .returning();
    res.json(entry);
  });
  get("/diets", "feed.view", async (req: any, res: any) =>
    res.json(await rows(s.dietPlans, req.tenantId)),
  );
  post("/diets", "feed.manage", async (req: any, res: any) => {
    const input = z
      .object({
        name: z.string().trim().min(1),
        cattleId: z.string().nullable().optional(),
        groupId: z.string().nullable().optional(),
        startDate: daySchema,
        endDate: daySchema.nullable().optional(),
        instructions: z.string().trim().min(1),
        ingredients: z
          .array(
            z.object({
              itemId: z.string(),
              quantity: positive,
              dryMatterPercent: positive.max(100).optional(),
            }),
          )
          .min(1),
      })
      .parse(req.body);
    if (!!input.cattleId === !!input.groupId)
      fail("Choose either one animal or one group");
    if (input.endDate && input.endDate < input.startDate)
      fail("End date precedes start date");
    for (const i of input.ingredients)
      await owned(s.inventoryItems, req.tenantId, i.itemId);
    const [diet] = await db
      .insert(s.dietPlans)
      .values({
        tenantId: req.tenantId,
        ...input,
        status: "approved",
        approvedBy: req.user.id,
      })
      .returning();
    res.status(201).json(diet);
  });
  post("/diets/:id/end", "feed.manage", async (req: any, res: any) => {
    await owned(s.dietPlans, req.tenantId, req.params.id);
    const [d] = await db
      .update(s.dietPlans)
      .set({ endDate: daySchema.parse(req.body.date) })
      .where(eq(s.dietPlans.id, req.params.id))
      .returning();
    res.json(d);
  });
  get("/diet/:id", "feed.view", async (req: any, res: any) =>
    res.json(
      await effectiveDiet(
        req.tenantId,
        await owned(s.cattle, req.tenantId, req.params.id),
        daySchema.parse(req.query.date || farmDay()),
      ),
    ),
  );
  post("/feeding", "feed.manage", async (req: any, res: any) => {
    const animal = await owned(s.cattle, req.tenantId, req.body.cattleId);
    const date = daySchema.parse(req.body.date);
    const diet = await effectiveDiet(req.tenantId, animal, date);
    if (!diet) fail("No approved diet applies to this animal and date");
    const factor = positive.parse(req.body.factor || 1);
    const refusal = nonnegative.parse(req.body.refusal || 0);
    const supply = await consumeSupplies(
      req.tenantId,
      diet.ingredients.map((i: any) => ({
        itemId: i.itemId,
        quantity: i.quantity * factor,
      })),
      date,
      req.user.id,
      animal.id,
    );
    const event = await recordEvent(
      req.tenantId,
      "feeding",
      date,
      {
        dietId: diet.id,
        diet: diet.name,
        ingredients: diet.ingredients,
        factor,
        refusal,
        notes: req.body.notes,
        ...supply,
      },
      animal.id,
      req.user.id,
    );
    await db.insert(s.cattleCosts).values({
      tenantId: req.tenantId,
      cattleId: animal.id,
      date,
      category: "feed",
      amount: String(supply.cost),
      description: diet.name,
      sourceType: "event",
      sourceId: event.id,
      createdBy: req.user.id,
    });
    res.status(201).json(event);
  });
  post("/milk-disposition", "milk.manage", async (req: any, res: any) => {
    const input = z
      .object({
        date: daySchema,
        kind: z.enum([
          "opening_stock",
          "calf_feed",
          "household",
          "discarded",
          "closing_stock",
        ]),
        quantity: nonnegative,
        notes: z.string().default(""),
      })
      .parse(req.body);
    if (input.kind === "opening_stock" && !input.notes.trim())
      fail("Explain the source of opening milk stock");
    res
      .status(201)
      .json(
        await recordEvent(
          req.tenantId,
          "milk_disposition",
          input.date,
          input,
          null,
          req.user.id,
        ),
      );
  });
  patch("/milk/:id", "milk.manage", async (req: any, res: any) => {
    const before = await owned(s.milkEntries, req.tenantId, req.params.id);
    const input = z
      .object({ quantity: nonnegative, reason: z.string().trim().min(1) })
      .parse(req.body);
    const [entry] = await db
      .update(s.milkEntries)
      .set({ quantity: String(input.quantity) })
      .where(eq(s.milkEntries.id, before.id))
      .returning();
    await recordEvent(
      req.tenantId,
      "milk_corrected",
      before.date,
      { before, entry, reason: input.reason },
      before.cattleId,
      req.user.id,
    );
    res.json(entry);
  });
  get("/daily-report", "reports.view", async (req: any, res: any) =>
    res.json(
      req.query.id
        ? (await owned(s.dailyReports, req.tenantId, String(req.query.id)))
            .snapshot
        : await buildDailyReport(
            req.tenantId,
            daySchema.parse(
              req.query.date ||
                farmDay((await settings(req.tenantId)).timezone),
            ),
          ),
    ),
  );
  post("/daily-report", "reports.view", async (req: any, res: any) =>
    res
      .status(201)
      .json(
        await buildDailyReport(
          req.tenantId,
          daySchema.parse(req.body.date),
          req.user.id,
          true,
        ),
      ),
  );
  get("/report-archive", "reports.view", async (req: any, res: any) =>
    res.json(
      (await rows(s.dailyReports, req.tenantId))
        .map(({ snapshot, ...r }) => r)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    ),
  );
  get("/daily-report/export", "reports.view", async (req: any, res: any) => {
    const report = req.query.id
      ? (await owned(s.dailyReports, req.tenantId, req.query.id)).snapshot
      : await buildDailyReport(req.tenantId, daySchema.parse(req.query.date));
    if (req.query.format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="daily-report-${report.date}.pdf"`,
      );
      res.send(await reportPdf(report));
    } else {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="daily-report-${report.date}.xlsx"`,
      );
      res.send(await reportWorkbook(report));
    }
  });
  get("/report-schedule", "settings.manage", async (req: any, res: any) =>
    res.json((await rows(s.reportSchedules, req.tenantId))[0] || null),
  );
  post("/report-schedule", "settings.manage", async (req: any, res: any) => {
    const input = z
      .object({
        cutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        status: z.enum(["active", "paused"]),
        recipients: z.array(z.string().regex(/^\+?[1-9]\d{7,14}$/)).default([]),
      })
      .parse(req.body);
    const [row] = await db
      .insert(s.reportSchedules)
      .values({ tenantId: req.tenantId, ...input })
      .onConflictDoUpdate({ target: s.reportSchedules.tenantId, set: input })
      .returning();
    res.json(row);
  });
  get("/quality", "cattle.view", async (req: any, res: any) => {
    const animals = (await rows(s.cattle, req.tenantId)).filter(
      (c) => !c.mergedIntoId,
    );
    const tags = new Map<string, any[]>();
    animals.forEach((c) =>
      tags.set(c.tagNumber.trim().toLowerCase(), [
        ...(tags.get(c.tagNumber.trim().toLowerCase()) || []),
        c,
      ]),
    );
    res.json({
      duplicates: [...tags.values()].filter((g) => g.length > 1),
      statusReview: animals.filter((c) => !c.productionStatus || !c.lifeStage),
      missingBirthDates: animals.filter((c) => !c.dateOfBirth),
    });
  });
  const mergeTables = [
    s.milkEntries,
    s.healthEvents,
    s.tasks,
    s.heats,
    s.inseminations,
    s.pregnancyTests,
    s.calvings,
    s.vaccinations,
    s.cattleCosts,
    s.cattleTransactions,
    s.farmEvents,
    s.stockLedger,
    s.dietPlans,
  ];
  const preview = async (
    tenantId: string,
    sourceId: string,
    targetId: string,
  ) => {
    if (sourceId === targetId) fail("Choose two different animal records");
    const source = await owned(s.cattle, tenantId, sourceId),
      target = await owned(s.cattle, tenantId, targetId);
    if (source.mergedIntoId || target.mergedIntoId)
      fail("A selected animal is already merged");
    const animals = await rows(s.cattle, tenantId);
    const ancestors = (id: string, seen = new Set<string>()): Set<string> => {
      const a = animals.find((a) => a.id === id);
      for (const p of [a?.motherId, a?.fatherId])
        if (p && !seen.has(p)) {
          seen.add(p);
          ancestors(p, seen);
        }
      return seen;
    };
    if (
      ancestors(source.id).has(target.id) ||
      ancestors(target.id).has(source.id)
    )
      fail(
        "These records are linked as ancestors. Correct parentage before merging.",
        409,
      );
    const milk = await rows(s.milkEntries, tenantId);
    const conflicts = milk.filter(
      (m) =>
        m.cattleId === sourceId &&
        milk.some(
          (t) =>
            t.cattleId === targetId &&
            t.date === m.date &&
            t.session === m.session,
        ),
    );
    const counts = [];
    for (const table of mergeTables)
      counts.push({
        table: (table as any)[Symbol.for("drizzle:Name")],
        count: (await rows(table, tenantId)).filter(
          (r) => r.cattleId === sourceId,
        ).length,
      });
    return { source, target, conflicts, counts };
  };
  get("/merge-preview", "cattle.manage", async (req: any, res: any) =>
    res.json(
      await preview(
        req.tenantId,
        String(req.query.source),
        String(req.query.target),
      ),
    ),
  );
  post("/merge", "cattle.manage", async (req: any, res: any) => {
    const p = await preview(req.tenantId, req.body.sourceId, req.body.targetId);
    if (!req.body.reason?.trim()) fail("A merge reason is required");
    if (p.conflicts.length)
      fail("Overlapping milk sessions must be reviewed before merging", 409);
    if (
      req.body.sourceRevision !== p.source.revision ||
      req.body.targetRevision !== p.target.revision
    )
      fail("Animals changed; preview the merge again", 409);
    for (const table of mergeTables)
      for (const r of await rows(table, req.tenantId))
        if (r.cattleId === p.source.id)
          await db
            .update(table)
            .set({ cattleId: p.target.id })
            .where(eq(table.id, r.id));
    for (const animal of await rows(s.cattle, req.tenantId)) {
      const update: any = {};
      if (animal.motherId === p.source.id) update.motherId = p.target.id;
      if (animal.fatherId === p.source.id) update.fatherId = p.target.id;
      if (Object.keys(update).length)
        await db.update(s.cattle).set(update).where(eq(s.cattle.id, animal.id));
    }
    for (const group of await rows(s.animalGroups, req.tenantId))
      if (group.cattleIds.includes(p.source.id))
        await db
          .update(s.animalGroups)
          .set({
            cattleIds: [
              ...new Set<string>(
                group.cattleIds.map((id: string) =>
                  id === p.source.id ? p.target.id : id,
                ),
              ),
            ],
          })
          .where(eq(s.animalGroups.id, group.id));
    for (const birth of await rows(s.calvings, req.tenantId))
      if (birth.calfId === p.source.id)
        await db
          .update(s.calvings)
          .set({ calfId: p.target.id })
          .where(eq(s.calvings.id, birth.id));
    const farmAttachments = new Set(
      (await rows(s.attachments, req.tenantId)).map((a) => a.id),
    );
    for (const link of await db
      .select()
      .from(s.attachmentLinks)
      .where(
        and(
          eq(s.attachmentLinks.entityType, "cattle"),
          eq(s.attachmentLinks.entityId, p.source.id),
        ),
      ))
      if (farmAttachments.has(link.attachmentId))
        await db
          .update(s.attachmentLinks)
          .set({ entityId: p.target.id })
          .where(eq(s.attachmentLinks.id, link.id));
    await db
      .update(s.cattle)
      .set({
        mergedIntoId: p.target.id,
        status: "merged",
        revision: p.source.revision + 1,
      })
      .where(eq(s.cattle.id, p.source.id));
    await db
      .update(s.cattle)
      .set({ revision: p.target.revision + 1 })
      .where(eq(s.cattle.id, p.target.id));
    res.json(
      await recordEvent(
        req.tenantId,
        "identity_merged",
        farmDay(),
        { ...p, reason: req.body.reason },
        p.target.id,
        req.user.id,
      ),
    );
  });
}
