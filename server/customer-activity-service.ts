import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import * as s from "@shared/schema";
import { addDays, daySchema, farmDay } from "@shared/care";
import { cents, decimal } from "@shared/sales";
import { customerAccount } from "@shared/customer-account";
import { fail, owned, recordEvent, rows, settings } from "./care-service";

const activityFields = z.object({
  customerId: z.string().min(1),
  kind: z
    .enum(["delivery_change", "collection", "follow_up"])
    .default("follow_up"),
  title: z.string().trim().min(1).max(180),
  instructions: z.string().trim().max(2000).default(""),
  dueDate: daySchema,
  dueTime: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm farm time")
      .nullable(),
  ),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedTo: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().min(1).nullable(),
  ),
  status: z.enum(["pending", "in_progress"]).default("pending"),
});
const updateFields = activityFields
  .partial()
  .extend({ revision: z.number().int().positive() })
  .strict();
const finishFields = z
  .object({
    revision: z.number().int().positive(),
    notes: z.string().trim().min(1).max(2000),
  })
  .strict();

export async function customerActivityPeople(tenantId: string) {
  const [farm] = await db
    .select()
    .from(s.tenants)
    .where(eq(s.tenants.id, tenantId));
  if (!farm) fail("Farm not found", 404);
  const members = await rows(s.tenantMembers, tenantId);
  const ids = new Set([
    farm.ownerId,
    ...members.filter((m) => m.isActive).map((m) => m.userId),
  ]);
  const people = await db
    .select({
      id: s.users.id,
      firstName: s.users.firstName,
      lastName: s.users.lastName,
    })
    .from(s.users);
  return people
    .filter((p) => ids.has(p.id))
    .map((p) => ({
      id: p.id,
      name:
        [p.firstName, p.lastName].filter(Boolean).join(" ") ||
        "Farm team member",
    }));
}

export async function saveCustomerActivity(
  tenantId: string,
  actor: string,
  raw: unknown,
  id?: string,
) {
  const before = id ? await owned(s.customerActivities, tenantId, id) : null;
  if (before && ["completed", "cancelled"].includes(before.status))
    fail("This activity is closed. Create a new follow-up instead.", 409);
  const input = id
    ? updateFields.parse(raw)
    : activityFields.strict().parse(raw);
  if (before && (!("revision" in input) || input.revision !== before.revision))
    fail("This activity changed. Refresh before saving.", 409);
  const { revision: _revision, ...changes } = input as any;
  const data = before
    ? activityFields.parse({ ...before, ...changes })
    : changes;
  const customer = await owned(s.salesCustomers, tenantId, data.customerId);
  if (!before && !customer.active) fail("Choose an active customer");
  if (
    data.assignedTo &&
    !(await customerActivityPeople(tenantId)).some(
      (p) => p.id === data.assignedTo,
    )
  )
    fail("Assign this activity to an active member of this farm");
  const now = new Date();
  const [result] = before
    ? await db
        .update(s.customerActivities)
        .set({
          ...data,
          updatedAt: now,
          updatedBy: actor,
          revision: before.revision + 1,
        })
        .where(
          and(
            eq(s.customerActivities.id, id!),
            eq(s.customerActivities.tenantId, tenantId),
            eq(s.customerActivities.revision, before.revision),
          ),
        )
        .returning()
    : await db
        .insert(s.customerActivities)
        .values({ ...data, tenantId, createdBy: actor, updatedBy: actor })
        .returning();
  if (!result) fail("This activity changed. Refresh before saving.", 409);
  await recordEvent(
    tenantId,
    before ? "customer_activity_updated" : "customer_activity_created",
    farmDay((await settings(tenantId)).timezone),
    {
      activityId: result.id,
      customerId: result.customerId,
      title: result.title,
      dueDate: result.dueDate,
      status: result.status,
    },
    null,
    actor,
    "customer_activity",
    result.id,
  );
  return result;
}

export async function closeCustomerActivity(
  tenantId: string,
  actor: string,
  id: string,
  raw: unknown,
  cancelled = false,
) {
  const input = finishFields.parse(raw);
  const before = await owned(s.customerActivities, tenantId, id);
  if (before.revision !== input.revision)
    fail("This activity changed. Refresh before closing it.", 409);
  if (["completed", "cancelled"].includes(before.status))
    fail("This activity is already closed", 409);
  const now = new Date();
  const [result] = await db
    .update(s.customerActivities)
    .set({
      status: cancelled ? "cancelled" : "completed",
      updatedAt: now,
      updatedBy: actor,
      revision: before.revision + 1,
      ...(cancelled
        ? {
            cancelledAt: now,
            cancelledBy: actor,
            cancellationReason: input.notes,
          }
        : {
            completedAt: now,
            completedBy: actor,
            completionNotes: input.notes,
          }),
    })
    .where(
      and(
        eq(s.customerActivities.id, id),
        eq(s.customerActivities.tenantId, tenantId),
        eq(s.customerActivities.revision, before.revision),
      ),
    )
    .returning();
  if (!result) fail("This activity changed. Refresh before closing it.", 409);
  await recordEvent(
    tenantId,
    cancelled ? "customer_activity_cancelled" : "customer_activity_completed",
    farmDay((await settings(tenantId)).timezone),
    {
      activityId: id,
      customerId: before.customerId,
      title: before.title,
      notes: input.notes,
    },
    null,
    actor,
    "customer_activity",
    id,
  );
  return result;
}

// Derived collection reminders reflect the existing invoice/receipt allocation as of this day.
// They are not editable tasks and do not record or imply a new payment.
export async function customerActivitiesOverview(
  tenantId: string,
  date: string,
  customerId?: string,
  includeHistory = false,
) {
  daySchema.parse(date);
  if (customerId) await owned(s.salesCustomers, tenantId, customerId);
  const [manual, customers, sales, receipts, people] = await Promise.all([
    rows(s.customerActivities, tenantId),
    rows(s.salesCustomers, tenantId),
    rows(s.dairySales, tenantId),
    rows(s.salesPayments, tenantId),
    customerActivityPeople(tenantId),
  ]);
  const horizon = addDays(date, 30);
  const timezone = (await settings(tenantId)).timezone;
  const onDay = (v: Date | string | null) =>
    v && farmDay(timezone, new Date(v)) === date;
  const activities: any[] = manual
    .filter(
      (a) =>
        (!customerId || a.customerId === customerId) &&
        (includeHistory ||
          (["pending", "in_progress"].includes(a.status)
            ? a.dueDate <= horizon
            : onDay(a.completedAt) || onDay(a.cancelledAt))),
    )
    .map((a) => ({
      ...a,
      source: "manual",
      editable: true,
      customerName:
        customers.find((c) => c.id === a.customerId)?.name || "Customer",
      assignedToName:
        people.find((p) => p.id === a.assignedTo)?.name || "Unassigned",
      completedByName:
        people.find((p) => p.id === a.completedBy)?.name || a.completedBy,
      cancelledByName:
        people.find((p) => p.id === a.cancelledBy)?.name || a.cancelledBy,
      href: `/customers?customer=${encodeURIComponent(a.customerId)}#customer-activities`,
    }));
  for (const customer of customers.filter(
    (c) => !customerId || c.id === customerId,
  )) {
    const account = customerAccount(
      sales.filter((v) => v.customerId === customer.id),
      receipts.filter((v) => v.customerId === customer.id),
      date,
    );
    const groups = new Map<string, number>();
    for (const sale of account.entries) {
      const due = sale.dueDate || sale.date;
      if (cents(sale.outstanding) > 0 && due <= horizon)
        groups.set(due, (groups.get(due) || 0) + cents(sale.outstanding));
    }
    for (const [dueDate, amount] of groups)
      activities.push({
        id: `payment-due:${customer.id}:${dueDate}`,
        customerId: customer.id,
        customerName: customer.name,
        kind: "collection",
        title: "Payment collection due",
        instructions: `Rs ${decimal(amount)} outstanding on bills due ${dueDate}. Derived from sales and recorded payments as of ${date}; record a receipt to settle.`,
        amount: decimal(amount),
        dueDate,
        dueTime: null,
        priority: dueDate < date ? "high" : "medium",
        assignedTo: null,
        assignedToName: "Unassigned",
        status: "pending",
        source: "payment_due",
        editable: false,
        href: `/customers?customer=${encodeURIComponent(customer.id)}`,
      });
  }
  const priority: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return activities.sort(
    (a, b) =>
      priority[a.priority] - priority[b.priority] ||
      a.dueDate.localeCompare(b.dueDate) ||
      (a.dueTime || "23:59").localeCompare(b.dueTime || "23:59") ||
      a.customerName.localeCompare(b.customerName),
  );
}
