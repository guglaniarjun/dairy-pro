import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import { db } from "./db";
import {
  alerts,
  calvings,
  cattle,
  farmSettings,
  inseminations,
  inventoryItems,
  milkEntries,
  notificationRules,
  pregnancyTests,
  tenants,
  vaccinations,
  whatsappLogs,
  type NotificationRule,
  type Tenant,
} from "@shared/schema";
import { whatsappWebGateway } from "./whatsapp-web";

type RuleLike = NotificationRule | (Partial<NotificationRule> & Pick<NotificationRule, "ruleType">);

const DEFAULT_RULES: RuleLike[] = [
  { ruleType: "heat_due", name: "Heat due", isEnabled: true, offsetsDays: [21], channels: ["app"], severity: "warning", recipientScope: "tenant_owner" },
  { ruleType: "pregnancy_test_due", name: "Pregnancy test due", isEnabled: true, offsetsDays: [30], channels: ["app"], severity: "warning", recipientScope: "tenant_owner" },
  { ruleType: "vaccination_due", name: "Vaccination due", isEnabled: true, offsetsDays: [14, 3, 0], channels: ["app"], severity: "warning", recipientScope: "tenant_owner" },
  { ruleType: "low_stock", name: "Low stock", isEnabled: true, offsetsDays: [0], channels: ["app"], severity: "warning", recipientScope: "tenant_owner" },
];

const dayKey = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const daysBetween = (later: Date, earlier: Date) => Math.floor((Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate()) - Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate())) / 86400000);

function renderTemplate(template: string | null | undefined, values: Record<string, string | number>) {
  const source = template || "{{title}}\n{{message}}";
  return source.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => String(values[key] ?? ""));
}

async function recipientPhones(tenant: Tenant, rule: RuleLike): Promise<string[]> {
  const custom = Array.isArray(rule.customRecipients) ? rule.customRecipients : [];
  if (rule.recipientScope === "custom") return custom;
  if (rule.recipientScope === "all_tenant_owners") {
    const activeTenants = await db.select().from(tenants).where(eq(tenants.isActive, true));
    const settings = await db.select().from(farmSettings);
    return activeTenants
      .map(t => settings.find(s => s.tenantId === t.id)?.phone || t.phone)
      .filter((phone): phone is string => !!phone);
  }
  const [settings] = await db.select().from(farmSettings).where(eq(farmSettings.tenantId, tenant.id)).limit(1);
  return [settings?.phone || tenant.phone, ...custom].filter((phone): phone is string => !!phone);
}

async function createAlert(
  tenant: Tenant,
  rule: RuleLike,
  data: { title: string; message: string; type: string; cattleId?: string | null; referenceType: string; referenceId: string; occurrenceKey: string },
) {
  const ruleKey = rule.id || rule.ruleType;
  const dedupeKey = `${tenant.id}:${ruleKey}:${data.referenceType}:${data.referenceId}:${data.occurrenceKey}`;
  const [created] = await db.insert(alerts).values({
    tenantId: tenant.id,
    ruleId: rule.id || null,
    dedupeKey,
    type: data.type,
    severity: rule.severity || "warning",
    title: data.title,
    message: data.message,
    cattleId: data.cattleId || null,
    referenceType: data.referenceType,
    referenceId: data.referenceId,
    scheduledFor: new Date(),
  }).onConflictDoNothing({ target: alerts.dedupeKey }).returning();

  if (!created || !Array.isArray(rule.channels) || !rule.channels.includes("whatsapp")) return;
  const phones = Array.from(new Set(await recipientPhones(tenant, rule)));
  const message = renderTemplate(rule.messageTemplate, {
    farm: tenant.name,
    title: data.title,
    message: data.message,
    cattle: data.title.split(":").slice(-1)[0]?.trim() || "",
  });
  for (const phone of phones) {
    await db.insert(whatsappLogs).values({
      tenantId: tenant.id,
      toPhone: phone,
      messageType: "text",
      message,
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
      triggerType: rule.ruleType,
      referenceType: "alert",
      referenceId: created.id,
    });
  }
}

function matchesScope(rule: RuleLike, cow: typeof cattle.$inferSelect) {
  return (!rule.cattleId || rule.cattleId === cow.id) && (!rule.cattleStage || rule.cattleStage === cow.stage);
}

function compare(actual: number, operator: string | undefined, expected: number) {
  if (operator === "lt") return actual < expected;
  if (operator === "lte") return actual <= expected;
  if (operator === "gt") return actual > expected;
  if (operator === "gte") return actual >= expected;
  return actual === expected;
}

export async function evaluateTenantRules(tenantId: string): Promise<void> {
  const [tenant] = await db.select().from(tenants).where(and(eq(tenants.id, tenantId), eq(tenants.isActive, true))).limit(1);
  if (!tenant) return;
  const configured = await db.select().from(notificationRules).where(eq(notificationRules.tenantId, tenantId));
  const configuredTypes = new Set(configured.map(rule => rule.ruleType));
  const rules: RuleLike[] = [...configured, ...DEFAULT_RULES.filter(rule => !configuredTypes.has(rule.ruleType))];
  const now = new Date();
  const today = dayKey(now);
  const cows = await db.select().from(cattle).where(eq(cattle.tenantId, tenantId));

  for (const rule of rules.filter(r => r.isEnabled !== false)) {
    const offsets = Array.isArray(rule.offsetsDays) && rule.offsetsDays.length ? rule.offsetsDays : [rule.daysBeforeEvent ?? 0];

    if (rule.ruleType === "birth_followup") {
      const births = await db.select().from(calvings).where(eq(calvings.tenantId, tenantId));
      for (const birth of births) {
        const ageDays = daysBetween(now, new Date(birth.date));
        if (!offsets.includes(ageDays)) continue;
        const calf = birth.calfId ? cows.find(c => c.id === birth.calfId) : undefined;
        const mother = cows.find(c => c.id === birth.cattleId);
        const scopedCow = calf || mother;
        if (scopedCow && !matchesScope(rule, scopedCow)) continue;
        const cattleName = calf?.name || calf?.tagNumber || "new calf";
        await createAlert(tenant, rule, {
          type: "health", cattleId: calf?.id || mother?.id, referenceType: "birth_followup", referenceId: birth.id,
          occurrenceKey: `day-${ageDays}`, title: `Calf follow-up: ${cattleName}`,
          message: ageDays === 0 ? `${cattleName} was born today. Complete the newborn-care checklist.` : `${cattleName} is ${ageDays} days old. Complete the configured follow-up care.`,
        });
      }
      continue;
    }

    if (rule.ruleType === "death") {
      for (const cow of cows.filter(c => c.status === "dead" && matchesScope(rule, c))) {
        const eventDate = cow.updatedAt || cow.createdAt || now;
        const elapsed = daysBetween(now, new Date(eventDate));
        if (!offsets.includes(elapsed)) continue;
        await createAlert(tenant, rule, {
          type: "health", cattleId: cow.id, referenceType: "cattle_death", referenceId: cow.id,
          occurrenceKey: `day-${elapsed}`, title: `Cattle death recorded: ${cow.name || cow.tagNumber}`,
          message: `${cow.name || cow.tagNumber} is recorded as dead. Review records and complete the configured follow-up.`,
        });
      }
      continue;
    }

    if (rule.ruleType === "milk_drop") {
      const records = await db.select().from(milkEntries).where(eq(milkEntries.tenantId, tenantId)).orderBy(asc(milkEntries.date));
      const lookback = Number(rule.conditions?.lookbackDays || 7);
      const threshold = Number(rule.conditions?.value || 20);
      for (const cow of cows.filter(c => matchesScope(rule, c))) {
        const totals = new Map<string, number>();
        records.filter(r => r.cattleId === cow.id).forEach(r => totals.set(r.date, (totals.get(r.date) || 0) + Number(r.quantity || 0)));
        const dates = Array.from(totals.keys()).sort();
        if (dates.length < 2) continue;
        const latestDate = dates[dates.length - 1];
        const previous = dates.slice(Math.max(0, dates.length - lookback - 1), -1).map(d => totals.get(d) || 0).filter(v => v > 0);
        if (!previous.length) continue;
        const average = previous.reduce((sum, value) => sum + value, 0) / previous.length;
        const latest = totals.get(latestDate) || 0;
        const drop = average > 0 ? ((average - latest) / average) * 100 : 0;
        if (drop < threshold) continue;
        await createAlert(tenant, rule, {
          type: "production", cattleId: cow.id, referenceType: "milk_drop", referenceId: cow.id,
          occurrenceKey: latestDate, title: `Milk production low: ${cow.name || cow.tagNumber}`,
          message: `${cow.name || cow.tagNumber} produced ${latest.toFixed(1)} L versus a ${average.toFixed(1)} L average, a ${Math.round(drop)}% drop.`,
        });
      }
      continue;
    }

    if (rule.ruleType === "cattle_parameter") {
      const parameter = rule.conditions?.parameter || "lactationNumber";
      const expected = Number(rule.conditions?.value || 0);
      for (const cow of cows.filter(c => matchesScope(rule, c))) {
        const actual = parameter === "ageDays" && cow.dateOfBirth ? daysBetween(now, new Date(cow.dateOfBirth)) : Number((cow as any)[parameter] ?? 0);
        if (!compare(actual, rule.conditions?.operator, expected)) continue;
        await createAlert(tenant, rule, {
          type: "cattle", cattleId: cow.id, referenceType: "cattle_parameter", referenceId: cow.id,
          occurrenceKey: `${today}:${parameter}:${actual}`, title: `${rule.name}: ${cow.name || cow.tagNumber}`,
          message: `${parameter} is ${actual}; configured condition is ${rule.conditions?.operator || "eq"} ${expected}.`,
        });
      }
      continue;
    }

    if (rule.ruleType === "heat_due") {
      const services = await db.select().from(inseminations).where(eq(inseminations.tenantId, tenantId));
      const births = await db.select().from(calvings).where(eq(calvings.tenantId, tenantId));
      for (const cow of cows.filter(c => ["milking", "heifer"].includes(c.stage) && matchesScope(rule, c))) {
        const dates = [...services.filter(x => x.cattleId === cow.id).map(x => x.date), ...births.filter(x => x.cattleId === cow.id).map(x => x.date)].sort();
        const latest = dates[dates.length - 1];
        if (!latest || !offsets.includes(daysBetween(now, new Date(latest)))) continue;
        await createAlert(tenant, rule, { type: "breeding", cattleId: cow.id, referenceType: "heat_due", referenceId: cow.id, occurrenceKey: today, title: `Heat due: ${cow.name || cow.tagNumber}`, message: `${cow.name || cow.tagNumber} is due for heat observation.` });
      }
      continue;
    }

    if (rule.ruleType === "pregnancy_test_due") {
      const services = await db.select().from(inseminations).where(eq(inseminations.tenantId, tenantId));
      const tests = await db.select().from(pregnancyTests).where(eq(pregnancyTests.tenantId, tenantId));
      for (const service of services) {
        const cow = cows.find(c => c.id === service.cattleId);
        const elapsed = daysBetween(now, new Date(service.date));
        if (!cow || !matchesScope(rule, cow) || !offsets.includes(elapsed) || tests.some(t => t.cattleId === cow.id && new Date(t.testDate) > new Date(service.date))) continue;
        await createAlert(tenant, rule, { type: "breeding", cattleId: cow.id, referenceType: "pt_due", referenceId: service.id, occurrenceKey: `day-${elapsed}`, title: `Pregnancy test due: ${cow.name || cow.tagNumber}`, message: `${cow.name || cow.tagNumber} was inseminated ${elapsed} days ago.` });
      }
      continue;
    }

    if (rule.ruleType === "vaccination_due") {
      const records = await db.select().from(vaccinations).where(eq(vaccinations.tenantId, tenantId));
      for (const vaccination of records) {
        if (!vaccination.nextDueDate) continue;
        const cow = cows.find(c => c.id === vaccination.cattleId);
        const daysUntil = daysBetween(new Date(vaccination.nextDueDate), now);
        if (!cow || !matchesScope(rule, cow) || !offsets.includes(daysUntil)) continue;
        await createAlert(tenant, rule, { type: "health", cattleId: cow.id, referenceType: "vaccination", referenceId: vaccination.id, occurrenceKey: `before-${daysUntil}`, title: `Vaccination due: ${cow.name || cow.tagNumber}`, message: `${vaccination.vaccineName} is due ${daysUntil === 0 ? "today" : `in ${daysUntil} day(s)`}.` });
      }
      continue;
    }

    if (rule.ruleType === "low_stock") {
      const items = await db.select().from(inventoryItems).where(and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.isActive, true)));
      for (const item of items) {
        const current = Number(item.currentStock || 0);
        const threshold = Number(rule.conditions?.value ?? item.minStock ?? 0);
        if (current > threshold) continue;
        await createAlert(tenant, rule, { type: "inventory", referenceType: "inventory_item", referenceId: item.id, occurrenceKey: `${today}:${current}`, title: `Low stock: ${item.name}`, message: `${item.name} has ${current} ${item.unit}; threshold is ${threshold}.` });
      }
    }
  }
}

export async function evaluateAllTenants(): Promise<void> {
  const active = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.isActive, true));
  for (const tenant of active) await evaluateTenantRules(tenant.id);
}

export async function queueWhatsappMessage(tenantId: string, phone: string, message: string, triggerType = "manual") {
  const [log] = await db.insert(whatsappLogs).values({ tenantId, toPhone: phone, messageType: "text", message, status: "pending", attempts: 0, nextAttemptAt: new Date(), triggerType }).returning();
  return log;
}

export async function queueWhatsappBroadcast(message: string) {
  const activeTenants = await db.select().from(tenants).where(eq(tenants.isActive, true));
  const settings = await db.select().from(farmSettings);
  let queued = 0;
  for (const tenant of activeTenants) {
    const phone = settings.find(s => s.tenantId === tenant.id)?.phone || tenant.phone;
    if (!phone) continue;
    await queueWhatsappMessage(tenant.id, phone, message, "broadcast");
    queued++;
  }
  return queued;
}

export async function processWhatsappOutbox(limit = 25): Promise<void> {
  if (whatsappWebGateway.getStatus().state !== "connected") return;
  const pending = await db.select().from(whatsappLogs).where(and(
    inArray(whatsappLogs.status, ["pending", "failed"]),
    lte(whatsappLogs.nextAttemptAt, new Date()),
  )).orderBy(asc(whatsappLogs.createdAt)).limit(limit);

  for (const log of pending) {
    try {
      const externalMessageId = await whatsappWebGateway.sendText(log.toPhone, log.message);
      await db.update(whatsappLogs).set({ status: "sent", externalMessageId, sentAt: new Date(), attempts: (log.attempts || 0) + 1, errorMessage: null }).where(eq(whatsappLogs.id, log.id));
    } catch (error: any) {
      const attempts = (log.attempts || 0) + 1;
      const delayMinutes = Math.min(60, 2 ** attempts);
      await db.update(whatsappLogs).set({ status: attempts >= 5 ? "failed_permanent" : "failed", attempts, errorMessage: error?.message || String(error), nextAttemptAt: new Date(Date.now() + delayMinutes * 60000) }).where(eq(whatsappLogs.id, log.id));
    }
  }
}

let evaluationRunning = false;
let deliveryRunning = false;

export function startNotificationWorkers() {
  const evaluate = async () => {
    if (evaluationRunning) return;
    evaluationRunning = true;
    try { await evaluateAllTenants(); } catch (error) { console.error("Notification evaluation failed:", error); } finally { evaluationRunning = false; }
  };
  const deliver = async () => {
    if (deliveryRunning) return;
    deliveryRunning = true;
    try { await processWhatsappOutbox(); } catch (error) { console.error("WhatsApp delivery failed:", error); } finally { deliveryRunning = false; }
  };

  setTimeout(evaluate, 5000);
  setTimeout(deliver, 10000);
  setInterval(evaluate, Number(process.env.NOTIFICATION_EVALUATION_INTERVAL_MS || process.env.ALERT_EVALUATION_INTERVAL_MS || 300000));
  setInterval(deliver, Number(process.env.WHATSAPP_DELIVERY_INTERVAL_MS || process.env.NOTIFICATION_DELIVERY_INTERVAL_MS || 30000));
}
