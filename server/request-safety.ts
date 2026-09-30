import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, transactionContext } from "./db";
import * as s from "@shared/schema";
import {
  addDays,
  farmDay,
  daySchema,
  isLactating,
  nonnegative,
  positive,
  finishedTask,
} from "@shared/care";
import {
  owned,
  rows,
  fail,
  FarmError,
  settings,
  assertTag,
  assertCapacity,
  recordEvent,
  triggerProtocols,
  schedulePregnancy,
  animalEvent,
  closePregnancy,
  makeTask,
  completeTask,
  isMilkWithheld,
} from "./care-service";

const roots: Record<string, any> = {
  cattle: s.cattle,
  health: s.healthEvents,
  tasks: s.tasks,
  alerts: s.alerts,
  "cattle-transactions": s.cattleTransactions,
  inventory: s.inventoryItems,
  "notification-rules": s.notificationRules,
  team: s.tenantMembers,
};
const bodyRefs: Record<string, any> = {
  cattleId: s.cattle,
  motherId: s.cattle,
  fatherId: s.cattle,
  heatId: s.heats,
  inseminationId: s.inseminations,
  itemId: s.inventoryItems,
  transactionId: s.cattleTransactions,
  groupId: s.animalGroups,
  lotId: s.stockLots,
  protocolId: s.careProtocols,
};
export async function validateFarmRequest(req: any) {
  const tenant = req.tenantId;
  const body = req.body || {};
  const parts = req.path.split("/").filter(Boolean);
  let before: any = null;
  if (
    roots[parts[1]] &&
    parts[2] &&
    !["transactions", "due"].includes(parts[2])
  )
    before = await owned(roots[parts[1]], tenant, parts[2]);
  for (const [key, table] of Object.entries(bodyRefs))
    if (body[key]) await owned(table, tenant, body[key]);
  if (req.method === "GET") return before;
  for (const field of [
    "tenantId",
    "id",
    "createdAt",
    "updatedAt",
    "completedBy",
    "recordedBy",
    "createdBy",
    "mergedIntoId",
  ])
    delete body[field];
  for (const [key, value] of Object.entries(body)) {
    if (
      [
        "date",
        "dateOfBirth",
        "dateOfEntry",
        "testDate",
        "nextDueDate",
        "dueDate",
        "expectedCalvingDate",
        "expiryDate",
      ].includes(key) &&
      value
    )
      daySchema.parse(value);
    if (
      [
        "quantity",
        "amount",
        "pricePerLiter",
        "pricePerUnit",
        "unitCost",
        "totalCost",
        "purchasePrice",
        "cost",
        "fat",
        "snf",
        "minStock",
        "maxStock",
        "currentStock",
      ].includes(key) &&
      value != null &&
      value !== ""
    )
      nonnegative.parse(value);
  }
  if (body.assignedTo) {
    const people = await rows(s.tenantMembers, tenant);
    const [farm] = await db
      .select()
      .from(s.tenants)
      .where(eq(s.tenants.id, tenant));
    if (
      body.assignedTo !== farm?.ownerId &&
      !people.some((p) => p.userId === body.assignedTo && p.isActive)
    )
      fail("Choose an active farm team member");
  }
  if (
    req.path.startsWith("/api/cattle") &&
    !req.path.startsWith("/api/cattle-transactions")
  ) {
    for (const [key, allowed] of Object.entries({
      species: ["cattle", "buffalo"],
      lifeStage: ["calf", "weaned_calf", "heifer", "adult"],
      productionStatus: ["lactating", "dry", "not_lactating"],
      reproductiveStatus: ["unserved", "served", "pregnant", "lost"],
    }))
      if (body[key] && !allowed.includes(body[key]))
        fail("Invalid animal status");
    if (body.weightKg) positive.parse(body.weightKg);
    if (body.gender === "male" && body.productionStatus === "lactating")
      fail("Male animals cannot be lactating");
    if (parts[2] && (body.motherId === parts[2] || body.fatherId === parts[2]))
      fail("An animal cannot be its own parent");
  }
  if (req.path.startsWith("/api/tasks")) {
    for (const key of [
      "sourceKey",
      "batchId",
      "cycleId",
      "protocolId",
      "protocolVersion",
      "supplies",
      "clinical",
      "trigger",
      "evidence",
      "completedAt",
    ])
      delete body[key];
    if (
      body.status &&
      !["pending", "in_progress", "completed", "cancelled"].includes(
        body.status,
      )
    )
      fail("Invalid task status");
    if (
      before &&
      finishedTask(before.status) &&
      body.status &&
      body.status !== before.status
    )
      fail("Completed or cancelled tasks cannot be reopened", 409);
  }
  if (req.path === "/api/cattle" && req.method === "POST") {
    await assertCapacity(tenant);
    await assertTag(tenant, body.tagNumber);
  }
  if (
    req.path.startsWith("/api/cattle/") &&
    parts.length === 3 &&
    body.tagNumber
  )
    await assertTag(tenant, body.tagNumber, parts[2]);
  if (req.path === "/api/milk") {
    nonnegative.parse(body.quantity);
    const animal = await owned(s.cattle, tenant, body.cattleId);
    if (!isLactating(animal))
      fail(
        "This animal is not marked as lactating. Review its production status first.",
      );
    if (!["bulk", "discarded"].includes(body.destination || "bulk"))
      fail("Choose bulk milk or discarded milk");
    if (
      (await isMilkWithheld(tenant, animal.id, body.date)) &&
      body.destination !== "discarded"
    )
      fail(
        "Milk withdrawal is active. Record this milk as discarded; do not add it to bulk milk.",
        409,
      );
    const cfg = await settings(tenant);
    if (body.date > farmDay(cfg.timezone))
      fail("Milk production cannot be recorded in the future");
    if (
      ![
        "morning",
        "evening",
        ...(cfg.milkingSessions === 3 ? ["night"] : []),
      ].includes(body.session)
    )
      fail("Choose a configured milking session");
    if (cfg.fatMandatory && (body.fat == null || body.fat === ""))
      fail("Fat measurement is required");
    if (cfg.snfMandatory && (body.snf == null || body.snf === ""))
      fail("SNF measurement is required");
    if (Number(body.fat) > 100 || Number(body.snf) > 100)
      fail("Fat and SNF must be between 0 and 100");
    if (
      (await rows(s.milkEntries, tenant)).some(
        (m) =>
          m.cattleId === body.cattleId &&
          m.date === body.date &&
          m.session === body.session,
      )
    )
      fail(
        "Milk already exists for this animal, date and session. Correct the existing entry.",
        409,
      );
  }
  if (req.path === "/api/milk-sales") {
    positive.parse(body.quantity);
    positive.parse(body.pricePerLiter);
    const production = (await rows(s.milkEntries, tenant))
      .filter((m) => m.date === body.date && m.destination !== "discarded")
      .reduce((n, m) => n + Number(m.quantity), 0);
    const sold = (await rows(s.milkSales, tenant))
      .filter((m) => m.date === body.date)
      .reduce((n, m) => n + Number(m.quantity), 0);
    const uses = (await rows(s.farmEvents, tenant)).filter(
      (e) => e.type === "milk_disposition" && e.date === body.date,
    );
    const opening = uses
      .filter((e) => e.payload.kind === "opening_stock")
      .reduce((n, e) => n + Number(e.payload.quantity), 0);
    const used = uses
      .filter(
        (e) =>
          !["opening_stock", "closing_stock"].includes(e.payload.kind) &&
          !e.payload.milkEntryId,
      )
      .reduce((n, e) => n + Number(e.payload.quantity), 0);
    if (Number(body.quantity) > production + opening - sold - used + 0.0001)
      fail(
        "Sale exceeds recorded saleable milk. Record production or explained opening stock first.",
        409,
      );
    body.totalAmount = String(
      Math.round(Number(body.quantity) * Number(body.pricePerLiter) * 100) /
        100,
    );
  }
  if (req.path === "/api/inventory/transactions") {
    positive.parse(body.quantity);
    if (
      !["purchase", "issue", "return", "wastage", "adjustment"].includes(
        body.type,
      )
    )
      fail("Invalid stock movement");
    if (body.type === "adjustment" && !body.notes?.trim())
      fail("An adjustment requires a reason");
  }
  if (req.path.includes("/payments")) {
    positive.parse(body.amount);
    const tx = await owned(s.cattleTransactions, tenant, parts[2]);
    const paid = (await rows(s.cattlePayments, tenant))
      .filter((p) => p.transactionId === tx.id)
      .reduce((n, p) => n + Number(p.amount), 0);
    if (paid + Number(body.amount) > Number(tx.amount) + 0.001)
      fail("Payment exceeds the outstanding balance");
  }
  if (req.path === "/api/breeding/pregnancy-tests") {
    if (!["positive", "negative", "inconclusive"].includes(body.result))
      fail("Invalid pregnancy test result");
    if (body.inseminationId) {
      const service = await owned(s.inseminations, tenant, body.inseminationId);
      if (service.cattleId !== body.cattleId)
        fail("This insemination belongs to a different animal");
    }
  }
  if (
    req.path.startsWith("/api/tasks") &&
    body.status === "completed" &&
    before
  ) {
    if (before.supplies?.length || before.protocolId || before.batchId)
      fail(
        "Complete this care task from Care & Work so supplies and evidence are recorded",
      );
    body.completedAt = new Date();
    body.completedBy = req.user.id;
  }
  if (body.detectedAt) {
    const d = new Date(body.detectedAt);
    if (Number.isNaN(d.valueOf())) fail("Invalid heat observation date");
    body.detectedAt = d;
  }
  if (before && body.revision != null && before.revision !== body.revision)
    fail("This record changed. Refresh before saving.", 409);
  if (before?.revision != null) body.revision = before.revision + 1;
  return before;
}
async function lifecycle(req: any, result: any, before: any) {
  const tenant = req.tenantId,
    actor = req.user.id,
    body = req.body || {},
    cfg = await settings(tenant),
    date = body.date || body.testDate || farmDay(cfg.timezone);
  if (req.path.startsWith("/api/operations") || !result?.id) return;
  if (
    /^\/api\/cattle\/[^/]+$/.test(req.path) &&
    before &&
    result.productionStatus === "dry" &&
    before.productionStatus !== "dry"
  )
    await animalEvent(
      tenant,
      {
        cattleId: result.id,
        type: "dry_off",
        date,
        notes: "Dry status updated in animal record",
        details: {},
      },
      actor,
    );
  if (
    /^\/api\/cattle(?:\/[^/]+)?$/.test(req.path) &&
    result.expectedCalvingDate &&
    result.expectedCalvingDate !== before?.expectedCalvingDate
  )
    await schedulePregnancy(tenant, result, result.expectedCalvingDate, actor);
  if (req.path === "/api/cattle" && req.method === "POST") {
    const production =
      body.productionStatus ||
      (result.stage === "milking"
        ? "lactating"
        : result.stage === "dry"
          ? "dry"
          : result.stage === "pregnant"
            ? null
            : "not_lactating");
    await db
      .update(s.cattle)
      .set({
        lifeStage:
          body.lifeStage ||
          (["calf", "heifer"].includes(result.stage) ? result.stage : "adult"),
        productionStatus: production,
        reproductiveStatus:
          body.reproductiveStatus ||
          (result.stage === "pregnant" ? "pregnant" : "unserved"),
      })
      .where(eq(s.cattle.id, result.id));
    if (result.dateOfBirth)
      await triggerProtocols(
        tenant,
        result,
        "age",
        result.dateOfBirth,
        result.id,
      );
  }
  if (req.path === "/api/breeding/inseminations") {
    let animal = await owned(s.cattle, tenant, body.cattleId);
    const cycle = result.id;
    for (const t of await rows(s.tasks, tenant))
      if (
        t.cattleId === animal.id &&
        ["insemination", "heat"].includes(t.trigger) &&
        !finishedTask(t.status)
      )
        await db
          .update(s.tasks)
          .set({ status: "cancelled", reason: "Superseded by a new service" })
          .where(eq(s.tasks.id, t.id));
    await db
      .update(s.cattle)
      .set({
        reproductiveStatus: "served",
        breedingCycleId: cycle,
        expectedCalvingDate: null,
        updatedAt: new Date(),
      })
      .where(eq(s.cattle.id, animal.id));
    for (const t of [
      {
        title: "Pregnancy confirmation due",
        days: cfg.pregnancyTestDays,
        key: "test",
      },
      {
        title: "Observe expected return to heat (prediction)",
        days: cfg.heatIntervalDays,
        key: "heat",
      },
    ])
      await makeTask(tenant, {
        cattleId: animal.id,
        title: t.title,
        type: "breeding",
        dueDate: addDays(date, t.days),
        trigger: "insemination",
        cycleId: cycle,
        sourceKey: `service:${result.id}:${t.key}`,
      });
    await triggerProtocols(
      tenant,
      { ...animal, breedingCycleId: cycle },
      "insemination",
      date,
      result.id,
      cycle,
    );
  }
  if (req.path === "/api/breeding/pregnancy-tests") {
    const animal = await owned(s.cattle, tenant, body.cattleId);
    const service = body.inseminationId
      ? await owned(s.inseminations, tenant, body.inseminationId)
      : null;
    if (
      service &&
      animal.breedingCycleId &&
      animal.breedingCycleId !== service.id
    )
      fail(
        "Test relates to an earlier breeding cycle. Record it as a historical note.",
        409,
      );
    if (body.result === "positive") {
      const expected =
        body.expectedCalvingDate ||
        (service ? addDays(service.date, cfg.gestationDays) : null);
      if (!expected)
        fail("Provide an expected calving date or a linked service");
      await schedulePregnancy(tenant, animal, expected, actor);
    }
    if (body.result === "negative") {
      await closePregnancy(tenant, animal, "Pregnancy test negative");
      await db
        .update(s.cattle)
        .set({ reproductiveStatus: "unserved", expectedCalvingDate: null })
        .where(eq(s.cattle.id, animal.id));
    }
    if (body.result !== "inconclusive")
      for (const t of await rows(s.tasks, tenant))
        if (
          t.cattleId === animal.id &&
          t.cycleId === animal.breedingCycleId &&
          t.trigger === "insemination" &&
          !finishedTask(t.status)
        )
          await db
            .update(s.tasks)
            .set({
              status: t.sourceKey?.endsWith(":test")
                ? "completed"
                : "cancelled",
              completedAt: new Date(),
              completedBy: actor,
              reason: "Pregnancy test recorded",
            })
            .where(eq(s.tasks.id, t.id));
  }
  if (req.path === "/api/vaccinations" && body.nextDueDate) {
    for (const t of await rows(s.tasks, tenant))
      if (
        t.cattleId === body.cattleId &&
        t.sourceKey?.startsWith(`vaccine:${body.vaccineId}:`) &&
        !finishedTask(t.status)
      )
        await db
          .update(s.tasks)
          .set({ status: "cancelled", reason: "Superseded by recorded dose" })
          .where(eq(s.tasks.id, t.id));
    await makeTask(tenant, {
      cattleId: body.cattleId,
      title: "Vaccination / deworming follow-up",
      description: body.notes,
      type: "health",
      dueDate: body.nextDueDate,
      sourceKey: `vaccine:${body.vaccineId}:${result.id}`,
      evidenceRequired: true,
    });
  }
  if (req.path === "/api/breeding/heats") {
    const animal = await owned(s.cattle, tenant, body.cattleId);
    await makeTask(tenant, {
      cattleId: animal.id,
      title: "Review observed heat and service decision",
      type: "breeding",
      dueDate: date,
      priority: "high",
      sourceKey: `heat:${result.id}`,
      trigger: "heat",
    });
    await triggerProtocols(tenant, animal, "heat", date, result.id);
  }
  if (
    req.path.startsWith("/api/tasks/") &&
    body.status === "completed" &&
    before?.status !== "completed" &&
    before?.isRecurring
  ) {
    const interval =
      ({ daily: 1, weekly: 7, monthly: 30 } as any)[before.recurringPattern] ||
      Number(before.recurringPattern);
    if (!Number.isInteger(interval) || interval < 1)
      fail("Choose a valid recurrence interval");
    await makeTask(tenant, {
      title: before.title,
      type: before.type,
      cattleId: before.cattleId,
      assignedTo: before.assignedTo,
      isRecurring: true,
      recurringPattern: before.recurringPattern,
      dueDate: addDays(before.dueDate || date, interval),
      sourceKey: `recurrence:${before.id}`,
    });
  }
  await recordEvent(
    tenant,
    req.method === "POST" ? "entry_created" : "entry_updated",
    date,
    { module: req.path, before, entry: result },
    result.cattleId ||
      (/^\/api\/cattle(?:\/[^/]+)?$/.test(req.path) ? result.id : null),
    actor,
    req.path,
    result.id,
  );
}
export async function safeTenantRequest(
  req: any,
  res: Response,
  next: NextFunction,
) {
  const originalJson = res.json.bind(res);
  if (req.get("X-Farm-ID") && req.get("X-Farm-ID") !== req.tenantId)
    return res.status(409).json({
      error:
        "The selected farm changed. Return to the original farm before syncing.",
    });
  try {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      await validateFarmRequest(req);
      if (
        req.path.startsWith("/api/dashboard") &&
        !req.tenantPermissions?.includes("finances.view")
      )
        res.json = ((value: any) => {
          const safe = { ...value };
          for (const key of [
            "finance",
            "monthExpense",
            "monthRevenue",
            "pendingReceivables",
            "costPerKgMilk",
          ])
            delete safe[key];
          return originalJson(safe);
        }) as any;
      return next();
    }
    // Multipart handlers perform their own file operations; JSON business writes are transactional.
    if (req.is("multipart/form-data")) {
      await validateFarmRequest(req);
      return next();
    }
    let response: any,
      status = 200;
    await db.transaction(async (tx) =>
      transactionContext.run(tx, async () => {
        // Serialize farm writes, including retries and task/stock completion, across processes.
        await db.execute(
          sql`select pg_advisory_xact_lock(hashtext(${req.tenantId}))`,
        );
        const key = req.get("Idempotency-Key");
        const hash = crypto
          .createHash("sha256")
          .update(
            JSON.stringify({
              user: req.user.id,
              path: req.path,
              method: req.method,
              body: req.body,
            }),
          )
          .digest("hex");
        if (key && key.length > 180) fail("Invalid idempotency key");
        if (key) {
          const old = (await rows(s.operationReceipts, req.tenantId)).find(
            (r) => r.key === key,
          );
          if (old) {
            if (old.requestHash !== hash)
              fail("This retry key was used for different data", 409);
            response = old.response;
            status = old.statusCode;
            return;
          }
        }
        const before = await validateFarmRequest(req);
        response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () =>
              reject(
                new FarmError(
                  "Request timed out; no changes were committed",
                  503,
                ),
              ),
            30000,
          );
          res.json = ((body: any) => {
            clearTimeout(timeout);
            status = res.statusCode;
            if (status >= 400)
              reject(
                new FarmError(
                  body.error || body.message || "Request failed",
                  status,
                ),
              );
            else resolve(body);
            return res;
          }) as any;
          try {
            next();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
        await lifecycle(req, response, before);
        const sensitive = /team|settings|whatsapp|billing/.test(req.path);
        await db.insert(s.auditLogs).values({
          tenantId: req.tenantId,
          userId: req.user.id,
          action: req.method,
          entityType: req.path,
          entityId: response?.id || String(req.params.id || ""),
          oldData: sensitive ? null : before,
          newData: sensitive
            ? { changed: true }
            : req.path === "/api/operations/daily-report"
              ? {
                  reportId: response.reportId,
                  date: response.date,
                  revision: response.revision,
                }
              : response,
          ipAddress: req.ip,
        });
        if (key)
          await db.insert(s.operationReceipts).values({
            tenantId: req.tenantId,
            key,
            requestHash: hash,
            response,
            statusCode: status,
          });
      }),
    );
    res.json = originalJson;
    res.status(status);
    return originalJson(response);
  } catch (error: any) {
    res.json = originalJson;
    const status = error.status || (error.name === "ZodError" ? 400 : 500);
    if (status === 500) console.error("Farm operation failed", error);
    return res.status(status).json({
      error:
        status === 500
          ? "The operation failed and no changes were committed"
          : error.message,
    });
  }
}
