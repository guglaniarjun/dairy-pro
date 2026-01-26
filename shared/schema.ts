import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, date, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// =====================================================
// TENANCY & SUBSCRIPTION SYSTEM
// =====================================================

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: varchar("owner_id").notNull(),
  plan: text("plan").notNull().default("free"), // free, demo, paid
  planExpiresAt: timestamp("plan_expires_at"),
  maxCattle: integer("max_cattle").notNull().default(2),
  isActive: boolean("is_active").notNull().default(true),
  address: text("address"),
  phone: text("phone"),
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tenantMembers = pgTable("tenant_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("worker"), // owner, manager, worker
  permissions: jsonb("permissions").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// CATTLE MANAGEMENT
// =====================================================

export const cattle = pgTable("cattle", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  tagNumber: text("tag_number").notNull(),
  name: text("name"),
  breedId: varchar("breed_id").references(() => breeds.id),
  gender: text("gender").notNull().default("female"), // male, female
  dateOfBirth: date("date_of_birth"),
  dateOfEntry: date("date_of_entry").notNull(),
  source: text("source").notNull().default("born"), // born, purchased
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }),
  motherId: varchar("mother_id"),
  fatherId: varchar("father_id"),
  status: text("status").notNull().default("active"), // active, sold, dead, culled
  stage: text("stage").notNull().default("heifer"), // calf, heifer, milking, dry, pregnant
  lactationNumber: integer("lactation_number").default(0),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("cattle_tenant_idx").on(table.tenantId),
  index("cattle_tag_idx").on(table.tenantId, table.tagNumber),
]);

export const breeds = pgTable("breeds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type").notNull().default("dairy"), // dairy, dual, beef
  origin: text("origin"),
  avgMilkYield: decimal("avg_milk_yield", { precision: 6, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
});

// =====================================================
// BREEDING & REPRODUCTION
// =====================================================

export const heats = pgTable("heats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  detectedAt: timestamp("detected_at").notNull(),
  detectedBy: varchar("detected_by"),
  intensity: text("intensity").default("normal"), // weak, normal, strong
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inseminations = pgTable("inseminations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  heatId: varchar("heat_id").references(() => heats.id),
  date: date("date").notNull(),
  method: text("method").notNull().default("ai"), // ai, natural
  bullId: varchar("bull_id"),
  semenBatchId: varchar("semen_batch_id"),
  technicianId: varchar("technician_id"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pregnancyTests = pgTable("pregnancy_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  inseminationId: varchar("insemination_id").references(() => inseminations.id),
  testDate: date("test_date").notNull(),
  result: text("result").notNull(), // positive, negative, inconclusive
  method: text("method").notNull().default("rectal"), // rectal, ultrasound, blood
  testedBy: varchar("tested_by"),
  expectedCalvingDate: date("expected_calving_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calvings = pgTable("calvings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  date: date("date").notNull(),
  calfId: varchar("calf_id"),
  calfGender: text("calf_gender"), // male, female
  calfWeight: decimal("calf_weight", { precision: 6, scale: 2 }),
  calvingEase: text("calving_ease").default("normal"), // easy, normal, difficult, assisted
  outcome: text("outcome").notNull().default("live"), // live, stillborn, abortion
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// MILK MANAGEMENT
// =====================================================

export const milkEntries = pgTable("milk_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  date: date("date").notNull(),
  session: text("session").notNull(), // morning, evening, night
  quantity: decimal("quantity", { precision: 8, scale: 2 }).notNull(),
  fat: decimal("fat", { precision: 4, scale: 2 }),
  snf: decimal("snf", { precision: 4, scale: 2 }),
  recordedBy: varchar("recorded_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("milk_tenant_date_idx").on(table.tenantId, table.date),
  index("milk_cattle_date_idx").on(table.cattleId, table.date),
]);

export const milkSales = pgTable("milk_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  date: date("date").notNull(),
  buyerName: text("buyer_name"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  pricePerLiter: decimal("price_per_liter", { precision: 8, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, partial, paid
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// FEED MANAGEMENT
// =====================================================

export const feedItems = pgTable("feed_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  category: text("category").notNull(), // fodder, concentrate, supplement, mineral
  unit: text("unit").notNull().default("kg"),
  crudeProtein: decimal("crude_protein", { precision: 5, scale: 2 }),
  energy: decimal("energy", { precision: 6, scale: 2 }),
  dryMatter: decimal("dry_matter", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
});

export const feedInventory = pgTable("feed_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  feedItemId: varchar("feed_item_id").notNull().references(() => feedItems.id),
  batchNumber: text("batch_number"),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  purchaseDate: date("purchase_date"),
  expiryDate: date("expiry_date"),
  supplierId: varchar("supplier_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const feedingRecords = pgTable("feeding_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").references(() => cattle.id),
  feedItemId: varchar("feed_item_id").notNull().references(() => feedItems.id),
  date: date("date").notNull(),
  session: text("session").notNull(), // morning, evening
  plannedQuantity: decimal("planned_quantity", { precision: 8, scale: 2 }),
  actualQuantity: decimal("actual_quantity", { precision: 8, scale: 2 }).notNull(),
  recordedBy: varchar("recorded_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// HEALTH & TREATMENT
// =====================================================

export const healthEvents = pgTable("health_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  eventType: text("event_type").notNull(), // illness, injury, vaccination, deworming, checkup
  date: date("date").notNull(),
  description: text("description"),
  severity: text("severity").default("moderate"), // mild, moderate, severe, critical
  symptoms: text("symptoms"),
  diagnosis: text("diagnosis"),
  vetId: varchar("vet_id"),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  status: text("status").notNull().default("active"), // active, resolved, chronic
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const treatments = pgTable("treatments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  healthEventId: varchar("health_event_id").notNull().references(() => healthEvents.id),
  medicineId: varchar("medicine_id").references(() => medicines.id),
  medicineName: text("medicine_name"),
  dosage: text("dosage"),
  route: text("route"), // oral, injection, topical
  date: date("date").notNull(),
  administeredBy: varchar("administered_by"),
  withdrawalDays: integer("withdrawal_days").default(0),
  withdrawalEndsAt: date("withdrawal_ends_at"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicines = pgTable("medicines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  category: text("category").notNull(), // antibiotic, anthelmintic, vaccine, supplement
  defaultWithdrawalDays: integer("default_withdrawal_days").default(0),
  unit: text("unit").notNull().default("ml"),
  isActive: boolean("is_active").notNull().default(true),
});

export const vaccinations = pgTable("vaccinations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  vaccineId: varchar("vaccine_id").references(() => vaccines.id),
  vaccineName: text("vaccine_name").notNull(),
  date: date("date").notNull(),
  batchNumber: text("batch_number"),
  nextDueDate: date("next_due_date"),
  administeredBy: varchar("administered_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vaccines = pgTable("vaccines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  diseaseTarget: text("disease_target"),
  frequencyDays: integer("frequency_days"),
  isActive: boolean("is_active").notNull().default(true),
});

// =====================================================
// INVENTORY MANAGEMENT
// =====================================================

export const inventoryCategories = pgTable("inventory_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // feed, medicine, equipment, packaging, supplement
});

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  categoryId: varchar("category_id").references(() => inventoryCategories.id),
  name: text("name").notNull(),
  sku: text("sku"),
  unit: text("unit").notNull(),
  currentStock: decimal("current_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  minStock: decimal("min_stock", { precision: 12, scale: 2 }).default("0"),
  maxStock: decimal("max_stock", { precision: 12, scale: 2 }),
  avgCost: decimal("avg_cost", { precision: 10, scale: 2 }),
  lastPurchasePrice: decimal("last_purchase_price", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  itemId: varchar("item_id").notNull().references(() => inventoryItems.id),
  type: text("type").notNull(), // purchase, issue, return, adjustment, wastage
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }),
  batchNumber: text("batch_number"),
  expiryDate: date("expiry_date"),
  referenceType: text("reference_type"), // treatment, feeding, sale
  referenceId: varchar("reference_id"),
  notes: text("notes"),
  recordedBy: varchar("recorded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// ACCOUNTING
// =====================================================

export const expenseHeads = pgTable("expense_heads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  category: text("category").notNull(), // feed, medicine, labor, utilities, maintenance, other
  isActive: boolean("is_active").notNull().default(true),
});

export const incomeHeads = pgTable("income_heads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  category: text("category").notNull(), // milk_sale, cattle_sale, manure, other
  isActive: boolean("is_active").notNull().default(true),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  headId: varchar("head_id").notNull().references(() => expenseHeads.id),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  vendorName: text("vendor_name"),
  invoiceNumber: text("invoice_number"),
  paymentMethod: text("payment_method").default("cash"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  recordedBy: varchar("recorded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const incomes = pgTable("incomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  headId: varchar("head_id").notNull().references(() => incomeHeads.id),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  customerName: text("customer_name"),
  invoiceNumber: text("invoice_number"),
  paymentMethod: text("payment_method").default("cash"),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  recordedBy: varchar("recorded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// TASKS & CALENDAR
// =====================================================

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // health, breeding, feeding, milking, maintenance, other
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  dueDate: date("due_date"),
  dueTime: text("due_time"),
  assignedTo: varchar("assigned_to"),
  cattleId: varchar("cattle_id").references(() => cattle.id),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// ALERTS & NOTIFICATIONS
// =====================================================

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  type: text("type").notNull(), // health, breeding, inventory, task, system
  severity: text("severity").notNull().default("info"), // info, warning, critical
  title: text("title").notNull(),
  message: text("message"),
  cattleId: varchar("cattle_id").references(() => cattle.id),
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  isRead: boolean("is_read").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// =====================================================
// AUDIT LOG
// =====================================================

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id"),
  action: text("action").notNull(), // create, update, delete, login, logout
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("audit_tenant_idx").on(table.tenantId),
  index("audit_entity_idx").on(table.entityType, table.entityId),
]);

// =====================================================
// RELATIONS
// =====================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMembers),
  cattle: many(cattle),
  tasks: many(tasks),
  alerts: many(alerts),
}));

export const cattleRelations = relations(cattle, ({ one, many }) => ({
  tenant: one(tenants, { fields: [cattle.tenantId], references: [tenants.id] }),
  breed: one(breeds, { fields: [cattle.breedId], references: [breeds.id] }),
  milkEntries: many(milkEntries),
  healthEvents: many(healthEvents),
  heats: many(heats),
  inseminations: many(inseminations),
  vaccinations: many(vaccinations),
}));

export const milkEntriesRelations = relations(milkEntries, ({ one }) => ({
  tenant: one(tenants, { fields: [milkEntries.tenantId], references: [tenants.id] }),
  cattle: one(cattle, { fields: [milkEntries.cattleId], references: [cattle.id] }),
}));

export const healthEventsRelations = relations(healthEvents, ({ one, many }) => ({
  tenant: one(tenants, { fields: [healthEvents.tenantId], references: [tenants.id] }),
  cattle: one(cattle, { fields: [healthEvents.cattleId], references: [cattle.id] }),
  treatments: many(treatments),
}));

export const treatmentsRelations = relations(treatments, ({ one }) => ({
  healthEvent: one(healthEvents, { fields: [treatments.healthEventId], references: [healthEvents.id] }),
  medicine: one(medicines, { fields: [treatments.medicineId], references: [medicines.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  tenant: one(tenants, { fields: [tasks.tenantId], references: [tenants.id] }),
  cattle: one(cattle, { fields: [tasks.cattleId], references: [cattle.id] }),
}));

// =====================================================
// INSERT SCHEMAS & TYPES
// =====================================================

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCattleSchema = createInsertSchema(cattle).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMilkEntrySchema = createInsertSchema(milkEntries).omit({ id: true, createdAt: true });
export const insertHealthEventSchema = createInsertSchema(healthEvents).omit({ id: true, createdAt: true });
export const insertTreatmentSchema = createInsertSchema(treatments).omit({ id: true, createdAt: true });
export const insertVaccinationSchema = createInsertSchema(vaccinations).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertIncomeSchema = createInsertSchema(incomes).omit({ id: true, createdAt: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertFeedingRecordSchema = createInsertSchema(feedingRecords).omit({ id: true, createdAt: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({ id: true, createdAt: true });
export const insertHeatSchema = createInsertSchema(heats).omit({ id: true, createdAt: true });
export const insertInseminationSchema = createInsertSchema(inseminations).omit({ id: true, createdAt: true });
export const insertPregnancyTestSchema = createInsertSchema(pregnancyTests).omit({ id: true, createdAt: true });
export const insertCalvingSchema = createInsertSchema(calvings).omit({ id: true, createdAt: true });
export const insertMilkSaleSchema = createInsertSchema(milkSales).omit({ id: true, createdAt: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Cattle = typeof cattle.$inferSelect;
export type InsertCattle = z.infer<typeof insertCattleSchema>;
export type Breed = typeof breeds.$inferSelect;
export type MilkEntry = typeof milkEntries.$inferSelect;
export type InsertMilkEntry = z.infer<typeof insertMilkEntrySchema>;
export type MilkSale = typeof milkSales.$inferSelect;
export type InsertMilkSale = z.infer<typeof insertMilkSaleSchema>;
export type HealthEvent = typeof healthEvents.$inferSelect;
export type InsertHealthEvent = z.infer<typeof insertHealthEventSchema>;
export type Treatment = typeof treatments.$inferSelect;
export type InsertTreatment = z.infer<typeof insertTreatmentSchema>;
export type Medicine = typeof medicines.$inferSelect;
export type Vaccination = typeof vaccinations.$inferSelect;
export type InsertVaccination = z.infer<typeof insertVaccinationSchema>;
export type Vaccine = typeof vaccines.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Income = typeof incomes.$inferSelect;
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type ExpenseHead = typeof expenseHeads.$inferSelect;
export type IncomeHead = typeof incomeHeads.$inferSelect;
export type FeedItem = typeof feedItems.$inferSelect;
export type FeedingRecord = typeof feedingRecords.$inferSelect;
export type InsertFeedingRecord = z.infer<typeof insertFeedingRecordSchema>;
export type FeedInventory = typeof feedInventory.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type Heat = typeof heats.$inferSelect;
export type InsertHeat = z.infer<typeof insertHeatSchema>;
export type Insemination = typeof inseminations.$inferSelect;
export type InsertInsemination = z.infer<typeof insertInseminationSchema>;
export type PregnancyTest = typeof pregnancyTests.$inferSelect;
export type InsertPregnancyTest = z.infer<typeof insertPregnancyTestSchema>;
export type Calving = typeof calvings.$inferSelect;
export type InsertCalving = z.infer<typeof insertCalvingSchema>;
export type TenantMember = typeof tenantMembers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
