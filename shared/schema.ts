import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, date, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
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
  notes: text("notes"),
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
  notes: text("notes"),
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
  ruleId: varchar("rule_id"),
  dedupeKey: text("dedupe_key"),
  scheduledFor: timestamp("scheduled_for"),
  isRead: boolean("is_read").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("alerts_tenant_idx").on(table.tenantId),
  uniqueIndex("alerts_dedupe_key_idx").on(table.dedupeKey),
]);

// =====================================================
// SYSTEM SETTINGS (Super Admin - Global Storage Config)
// =====================================================

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  isSecret: boolean("is_secret").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// TENANT SETTINGS (for accounting mode, etc.)
// =====================================================

export const tenantSettings = pgTable("tenant_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  // Accounting Mode
  accountingMode: text("accounting_mode").notNull().default("simple"), // simple, full
  // Byproduct Settings
  byproductInventoryEnabled: boolean("byproduct_inventory_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =====================================================
// CATTLE TRANSACTIONS (Purchase & Sale)
// =====================================================

export const cattleTransactions = pgTable("cattle_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  type: text("type").notNull(), // purchase, sale
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  // Party details
  partyName: text("party_name"),
  partyPhone: text("party_phone"),
  partyAddress: text("party_address"),
  // Payment details
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, partial, paid
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").default("cash"), // cash, bank, upi, cheque
  // For sale - P/L calculation
  purchaseCostAtSale: decimal("purchase_cost_at_sale", { precision: 12, scale: 2 }),
  totalCostsAtSale: decimal("total_costs_at_sale", { precision: 12, scale: 2 }),
  milkRevenueAtSale: decimal("milk_revenue_at_sale", { precision: 12, scale: 2 }),
  profitLoss: decimal("profit_loss", { precision: 12, scale: 2 }),
  // Audit
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("cattle_tx_tenant_idx").on(table.tenantId),
  index("cattle_tx_cattle_idx").on(table.cattleId),
]);

export const cattlePayments = pgTable("cattle_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  transactionId: varchar("transaction_id").notNull().references(() => cattleTransactions.id),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("cash"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cost allocation to cattle (for P/L calculation)
export const cattleCosts = pgTable("cattle_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  cattleId: varchar("cattle_id").notNull().references(() => cattle.id),
  date: date("date").notNull(),
  category: text("category").notNull(), // feed, medicine, vet, labor, insurance, other
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  allocationMethod: text("allocation_method").default("direct"), // direct, proportional
  sourceType: text("source_type"), // expense, treatment, feeding
  sourceId: varchar("source_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("cattle_costs_tenant_idx").on(table.tenantId),
  index("cattle_costs_cattle_idx").on(table.cattleId),
]);

// =====================================================
// BYPRODUCTS MODULE
// =====================================================

export const byproductTypes = pgTable("byproduct_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  unit: text("unit").notNull().default("kg"), // kg, liters, units, bags
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

export const byproductTransactions = pgTable("byproduct_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  byproductTypeId: varchar("byproduct_type_id").notNull().references(() => byproductTypes.id),
  type: text("type").notNull(), // purchase, sale
  date: date("date").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  // Party details
  partyName: text("party_name"),
  partyPhone: text("party_phone"),
  // Payment
  paymentStatus: text("payment_status").notNull().default("paid"), // pending, partial, paid
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }),
  paymentMethod: text("payment_method").default("cash"),
  // Inventory update (optional)
  updateInventory: boolean("update_inventory").default(false),
  // Audit
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("byproduct_tx_tenant_idx").on(table.tenantId),
  index("byproduct_tx_type_idx").on(table.byproductTypeId),
]);

export const byproductInventory = pgTable("byproduct_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  byproductTypeId: varchar("byproduct_type_id").notNull().references(() => byproductTypes.id),
  currentStock: decimal("current_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  avgCost: decimal("avg_cost", { precision: 10, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("byproduct_inv_tenant_idx").on(table.tenantId),
  index("byproduct_inv_unique_idx").on(table.tenantId, table.byproductTypeId),
]);

// =====================================================
// UNIVERSAL ATTACHMENTS
// =====================================================

export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  storageKey: text("storage_key").notNull(), // S3/Supabase path
  fileType: text("file_type").notNull(), // image, document, audio
  uploadedBy: varchar("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("attachments_tenant_idx").on(table.tenantId),
]);

// Polymorphic link table for attachments
export const attachmentLinks = pgTable("attachment_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attachmentId: varchar("attachment_id").notNull().references(() => attachments.id),
  entityType: text("entity_type").notNull(), // cattle, health_event, treatment, milk_entry, expense, income, cattle_transaction, byproduct_transaction, etc.
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("attachment_links_entity_idx").on(table.entityType, table.entityId),
]);

// =====================================================
// SUBSCRIPTION PLANS & BILLING
// =====================================================

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  maxCattle: integer("max_cattle").notNull(),
  maxUsers: integer("max_users").notNull().default(5),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
  features: jsonb("features").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenantSubscriptions = pgTable("tenant_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default("active"), // active, expired, grace, cancelled
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  gracePeriodDays: integer("grace_period_days").default(7),
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, yearly
  amount: decimal("amount", { precision: 10, scale: 2 }),
  paymentGateway: text("payment_gateway"), // razorpay, stripe
  externalSubscriptionId: text("external_subscription_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("tenant_sub_tenant_idx").on(table.tenantId),
]);

// =====================================================
// WHATSAPP CONFIG & LOGS
// =====================================================

export const whatsappConfigs = pgTable("whatsapp_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  mode: text("mode").notNull().default("disabled"), // disabled, web, api
  // Web mode
  webSessionStatus: text("web_session_status").default("disconnected"), // connected, disconnected, qr_pending
  webQrCode: text("web_qr_code"),
  webPhoneNumber: text("web_phone_number"),
  webLastConnected: timestamp("web_last_connected"),
  // API mode
  apiProvider: text("api_provider"), // 360dialog, twilio, wati, meta
  apiKey: text("api_key"),
  apiPhoneNumberId: text("api_phone_number_id"),
  apiBusinessAccountId: text("api_business_account_id"),
  apiWebhookSecret: text("api_webhook_secret"),
  // Common
  fromPhoneNumber: text("from_phone_number"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const whatsappLogs = pgTable("whatsapp_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  toPhone: text("to_phone").notNull(),
  messageType: text("message_type").notNull(), // text, template
  templateName: text("template_name"),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed, read
  externalMessageId: text("external_message_id"),
  errorMessage: text("error_message"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at").defaultNow(),
  triggerType: text("trigger_type"), // heat_due, pregnancy_due, vaccination_due, payment_reminder, test
  referenceType: text("reference_type"),
  referenceId: varchar("reference_id"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("whatsapp_logs_tenant_idx").on(table.tenantId),
]);

// =====================================================
// NOTIFICATION RULES
// =====================================================

export const notificationRules = pgTable("notification_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull().default("Notification rule"),
  ruleType: text("rule_type").notNull(), // birth_followup, death, milk_drop, heat_due, pregnancy_test_due, vaccination_due, low_stock, cattle_parameter
  isEnabled: boolean("is_enabled").notNull().default(true),
  daysBeforeEvent: integer("days_before_event").default(1),
  offsetsDays: jsonb("offsets_days").$type<number[]>().default([0]),
  cattleId: varchar("cattle_id").references(() => cattle.id),
  cattleStage: text("cattle_stage"),
  conditions: jsonb("conditions").$type<{
    parameter?: string;
    operator?: "lt" | "lte" | "eq" | "gte" | "gt" | "drop_percent";
    value?: number | string;
    lookbackDays?: number;
  }>().default({}),
  severity: text("severity").notNull().default("warning"),
  channels: jsonb("channels").$type<string[]>().default(["app"]), // app, whatsapp, email
  recipientScope: text("recipient_scope").notNull().default("tenant_owner"), // tenant_owner, custom, all_tenant_owners
  customRecipients: jsonb("custom_recipients").$type<string[]>().default([]),
  messageTemplate: text("message_template"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("notif_rules_tenant_idx").on(table.tenantId),
  index("notif_rules_type_idx").on(table.ruleType),
]);

// =====================================================
// FARM CONFIGURATION (extended tenant settings)
// =====================================================

export const farmSettings = pgTable("farm_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id).unique(),
  // Farm info
  farmName: text("farm_name"),
  logoUrl: text("logo_url"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  // Locale
  currency: text("currency").notNull().default("INR"),
  currencySymbol: text("currency_symbol").notNull().default("₹"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
  language: text("language").notNull().default("en"),
  // Milk settings
  milkUnit: text("milk_unit").notNull().default("liters"),
  milkingSessions: integer("milking_sessions").notNull().default(2), // 2 or 3
  session1Name: text("session1_name").notNull().default("Morning"),
  session2Name: text("session2_name").notNull().default("Evening"),
  session3Name: text("session3_name").default("Night"),
  fatMandatory: boolean("fat_mandatory").notNull().default(false),
  snfMandatory: boolean("snf_mandatory").notNull().default(false),
  milkDropAlertPercent: decimal("milk_drop_alert_percent", { precision: 5, scale: 2 }).default("20"),
  // Breeding / Reproduction
  heatIntervalDays: integer("heat_interval_days").notNull().default(21),
  gestationDays: integer("gestation_days").notNull().default(280),
  dryPeriodDays: integer("dry_period_days").notNull().default(60),
  pregnancyTestDays: integer("pregnancy_test_days").notNull().default(30),
  heiferInseminationAgeDays: integer("heifer_insemination_age_days").notNull().default(365),
  // Billing
  cattleLimitWarningPercent: integer("cattle_limit_warning_percent").notNull().default(80),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// New module schemas
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTenantSettingsSchema = createInsertSchema(tenantSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCattleTransactionSchema = createInsertSchema(cattleTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCattlePaymentSchema = createInsertSchema(cattlePayments).omit({ id: true, createdAt: true });
export const insertCattleCostSchema = createInsertSchema(cattleCosts).omit({ id: true, createdAt: true });
export const insertByproductTransactionSchema = createInsertSchema(byproductTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertByproductInventorySchema = createInsertSchema(byproductInventory).omit({ id: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, createdAt: true });
export const insertAttachmentLinkSchema = createInsertSchema(attachmentLinks).omit({ id: true, createdAt: true });

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

// New module types
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type TenantSettings = typeof tenantSettings.$inferSelect;
export type InsertTenantSettings = z.infer<typeof insertTenantSettingsSchema>;
export type CattleTransaction = typeof cattleTransactions.$inferSelect;
export type InsertCattleTransaction = z.infer<typeof insertCattleTransactionSchema>;
export type CattlePayment = typeof cattlePayments.$inferSelect;
export type InsertCattlePayment = z.infer<typeof insertCattlePaymentSchema>;
export type CattleCost = typeof cattleCosts.$inferSelect;
export type InsertCattleCost = z.infer<typeof insertCattleCostSchema>;
export type ByproductType = typeof byproductTypes.$inferSelect;
export type ByproductTransaction = typeof byproductTransactions.$inferSelect;
export type InsertByproductTransaction = z.infer<typeof insertByproductTransactionSchema>;
export type ByproductInventory = typeof byproductInventory.$inferSelect;
export type InsertByproductInventory = z.infer<typeof insertByproductInventorySchema>;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type AttachmentLink = typeof attachmentLinks.$inferSelect;

// New Phase 2 schemas
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true });
export const insertTenantSubscriptionSchema = createInsertSchema(tenantSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappConfigSchema = createInsertSchema(whatsappConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappLogSchema = createInsertSchema(whatsappLogs).omit({ id: true, createdAt: true });
export const insertNotificationRuleSchema = createInsertSchema(notificationRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFarmSettingsSchema = createInsertSchema(farmSettings).omit({ id: true, createdAt: true, updatedAt: true });

// New Phase 2 types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
export type InsertTenantSubscription = z.infer<typeof insertTenantSubscriptionSchema>;
export type WhatsappConfig = typeof whatsappConfigs.$inferSelect;
export type InsertWhatsappConfig = z.infer<typeof insertWhatsappConfigSchema>;
export type WhatsappLog = typeof whatsappLogs.$inferSelect;
export type InsertWhatsappLog = z.infer<typeof insertWhatsappLogSchema>;
export type NotificationRule = typeof notificationRules.$inferSelect;
export type InsertNotificationRule = z.infer<typeof insertNotificationRuleSchema>;
export type FarmSettings = typeof farmSettings.$inferSelect;
export type InsertFarmSettings = z.infer<typeof insertFarmSettingsSchema>;
export type InsertAttachmentLink = z.infer<typeof insertAttachmentLinkSchema>;
