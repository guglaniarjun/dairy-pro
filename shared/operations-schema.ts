import {
  pgTable,
  varchar,
  text,
  jsonb,
  timestamp,
  date,
  decimal,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// Tenant and animal ownership is checked in the same transaction as every operation.
const id = () =>
  varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const tenant = () => varchar("tenant_id").notNull();
export const farmEvents = pgTable(
  "farm_events",
  {
    id: id(),
    tenantId: tenant(),
    cattleId: varchar("cattle_id"),
    batchId: varchar("batch_id"),
    type: text("type").notNull(),
    date: date("date").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    sourceType: text("source_type"),
    sourceId: varchar("source_id"),
    recordedBy: varchar("recorded_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("farm_events_tenant_date_idx").on(t.tenantId, t.date)],
);
export const careProtocols = pgTable(
  "care_protocols",
  {
    id: id(),
    tenantId: tenant(),
    familyId: varchar("family_id").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("draft"),
    trigger: text("trigger").notNull(),
    eligibility: jsonb("eligibility")
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    steps: jsonb("steps").$type<any[]>().notNull().default([]),
    approvedBy: varchar("approved_by"),
    approvalNote: text("approval_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    approvedAt: timestamp("approved_at"),
  },
  (t) => [
    uniqueIndex("protocol_version_idx").on(t.tenantId, t.familyId, t.version),
  ],
);
export const animalGroups = pgTable("animal_groups", {
  id: id(),
  tenantId: tenant(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("manual"),
  cattleIds: jsonb("cattle_ids").$type<string[]>().notNull().default([]),
  criteria: jsonb("criteria")
    .$type<Record<string, any>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const workBatches = pgTable("work_batches", {
  id: id(),
  tenantId: tenant(),
  title: text("title").notNull(),
  groupId: varchar("group_id"),
  date: date("date").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const stockLots = pgTable(
  "stock_lots",
  {
    id: id(),
    tenantId: tenant(),
    itemId: varchar("item_id").notNull(),
    batchNumber: text("batch_number").notNull(),
    expiryDate: date("expiry_date"),
    receivedDate: date("received_date").notNull(),
    openedDate: date("opened_date"),
    usableDays: integer("usable_days"),
    quantity: decimal("quantity", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    unitCost: decimal("unit_cost", { precision: 14, scale: 4 })
      .notNull()
      .default("0"),
    supplier: text("supplier"),
    invoice: text("invoice"),
    location: text("location"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("stock_lots_item_idx").on(t.tenantId, t.itemId)],
);
export const stockLedger = pgTable("stock_ledger", {
  id: id(),
  tenantId: tenant(),
  lotId: varchar("lot_id").notNull(),
  itemId: varchar("item_id").notNull(),
  type: text("type").notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
  cost: decimal("cost", { precision: 14, scale: 4 }).notNull().default("0"),
  cattleId: varchar("cattle_id"),
  taskId: varchar("task_id"),
  date: date("date").notNull(),
  reason: text("reason"),
  recordedBy: varchar("recorded_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const dietPlans = pgTable("diet_plans", {
  id: id(),
  tenantId: tenant(),
  name: text("name").notNull(),
  cattleId: varchar("cattle_id"),
  groupId: varchar("group_id"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  trigger: text("trigger"),
  ingredients: jsonb("ingredients").$type<any[]>().notNull(),
  instructions: text("instructions"),
  approvedBy: varchar("approved_by"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const dailyReports = pgTable(
  "daily_reports",
  {
    id: id(),
    tenantId: tenant(),
    date: date("date").notNull(),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, any>>().notNull(),
    generatedBy: varchar("generated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_report_revision_idx").on(t.tenantId, t.date, t.revision),
  ],
);
export const operationReceipts = pgTable(
  "operation_receipts",
  {
    id: id(),
    tenantId: tenant(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response"),
    statusCode: integer("status_code").notNull().default(200),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("operation_receipt_key_idx").on(t.tenantId, t.key)],
);
export const reportSchedules = pgTable(
  "report_schedules",
  {
    id: id(),
    tenantId: tenant(),
    cutoff: text("cutoff").notNull().default("23:00"),
    status: text("status").notNull().default("active"),
    recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
    lastDate: date("last_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("report_schedule_tenant_idx").on(t.tenantId)],
);
