import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  tenants,
  tenantMembers,
  cattle,
  breeds,
  milkEntries,
  healthEvents,
  treatments,
  vaccinations,
  vaccines,
  tasks,
  alerts,
  expenses,
  incomes,
  expenseHeads,
  incomeHeads,
  inventoryItems,
  inventoryCategories,
  inventoryTransactions,
  feedItems,
  feedInventory,
  feedingRecords,
  heats,
  inseminations,
  pregnancyTests,
  calvings,
  medicines,
  systemSettings,
  tenantSettings,
  cattleTransactions,
  cattlePayments,
  cattleCosts,
  byproductTypes,
  byproductTransactions,
  byproductInventory,
  attachments,
  attachmentLinks,
  type User,
  type InsertUser,
  type Tenant,
  type Cattle,
  type MilkEntry,
  type HealthEvent,
  type Task,
  type Alert,
  type Expense,
  type Income,
  type InventoryItem,
  type FeedingRecord,
  type Heat,
  type Insemination,
  type Breed,
  type FeedItem,
  type FeedInventory,
  type PregnancyTest,
  type SystemSettings,
  type TenantSettings,
  type CattleTransaction,
  type CattlePayment,
  type CattleCost,
  type ByproductType,
  type ByproductTransaction,
  type ByproductInventory,
  type Attachment,
  type AttachmentLink,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;

  // Tenants
  getTenantByOwnerId(ownerId: string): Promise<Tenant | undefined>;
  createTenant(data: Partial<Tenant>): Promise<Tenant>;
  getTenantById(id: string): Promise<Tenant | undefined>;

  // Cattle
  getCattleByTenant(tenantId: string): Promise<Cattle[]>;
  getCattleById(id: string): Promise<Cattle | undefined>;
  createCattle(data: Partial<Cattle>): Promise<Cattle>;
  updateCattle(id: string, data: Partial<Cattle>): Promise<Cattle | undefined>;

  // Breeds (Master Data)
  getAllBreeds(): Promise<Breed[]>;
  createBreed(data: Partial<Breed>): Promise<Breed>;

  // Vaccines (Master Data)
  getAllVaccines(): Promise<any[]>;

  // Feed Items (Master Data)
  getAllFeedItems(): Promise<FeedItem[]>;

  // Expense Heads (Master Data)
  getAllExpenseHeads(): Promise<any[]>;

  // Income Heads (Master Data)
  getAllIncomeHeads(): Promise<any[]>;

  // Inventory Categories (Master Data)
  getAllInventoryCategories(): Promise<any[]>;

  // Milk Entries
  getMilkEntriesByTenant(tenantId: string): Promise<MilkEntry[]>;
  createMilkEntry(data: Partial<MilkEntry>): Promise<MilkEntry>;

  // Health Events
  getHealthEventsByTenant(tenantId: string): Promise<HealthEvent[]>;
  createHealthEvent(data: Partial<HealthEvent>): Promise<HealthEvent>;
  updateHealthEvent(id: string, data: Partial<HealthEvent>): Promise<HealthEvent | undefined>;

  // Tasks
  getTasksByTenant(tenantId: string): Promise<Task[]>;
  createTask(data: Partial<Task>): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<Task | undefined>;

  // Alerts
  getAlertsByTenant(tenantId: string): Promise<Alert[]>;
  createAlert(data: Partial<Alert>): Promise<Alert>;
  updateAlert(id: string, data: Partial<Alert>): Promise<Alert | undefined>;

  // Expenses
  getExpensesByTenant(tenantId: string): Promise<Expense[]>;
  createExpense(data: Partial<Expense>): Promise<Expense>;

  // Incomes
  getIncomesByTenant(tenantId: string): Promise<Income[]>;
  createIncome(data: Partial<Income>): Promise<Income>;

  // Inventory
  getInventoryItemsByTenant(tenantId: string): Promise<InventoryItem[]>;
  createInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem>;

  // Feed
  getAllFeedItems(): Promise<FeedItem[]>;
  getFeedInventoryByTenant(tenantId: string): Promise<FeedInventory[]>;
  getFeedingRecordsByTenant(tenantId: string): Promise<FeedingRecord[]>;
  createFeedingRecord(data: Partial<FeedingRecord>): Promise<FeedingRecord>;

  // Breeding
  getHeatsByTenant(tenantId: string): Promise<Heat[]>;
  createHeat(data: Partial<Heat>): Promise<Heat>;
  getInseminationsByTenant(tenantId: string): Promise<Insemination[]>;
  createInsemination(data: Partial<Insemination>): Promise<Insemination>;
  getPregnancyTestsByTenant(tenantId: string): Promise<PregnancyTest[]>;

  // Dashboard Stats
  getDashboardStats(tenantId: string): Promise<{
    totalCattle: number;
    milkingCattle: number;
    todayMilk: number;
    yesterdayMilk: number;
    pendingTasks: number;
    activeAlerts: number;
    healthIssues: number;
    upcomingCalvings: number;
  }>;

  // System Settings (Super Admin)
  getSystemSetting(key: string): Promise<SystemSettings | undefined>;
  setSystemSetting(key: string, value: string, isSecret?: boolean): Promise<SystemSettings>;
  getAllSystemSettings(): Promise<SystemSettings[]>;

  // Tenant Settings
  getTenantSettings(tenantId: string): Promise<TenantSettings | undefined>;
  upsertTenantSettings(data: Partial<TenantSettings>): Promise<TenantSettings>;

  // Cattle Transactions
  getCattleTransactionsByTenant(tenantId: string): Promise<CattleTransaction[]>;
  getCattleTransactionById(id: string): Promise<CattleTransaction | undefined>;
  createCattleTransaction(data: Partial<CattleTransaction>): Promise<CattleTransaction>;
  updateCattleTransaction(id: string, data: Partial<CattleTransaction>): Promise<CattleTransaction | undefined>;

  // Cattle Payments
  getCattlePaymentsByTransaction(transactionId: string): Promise<CattlePayment[]>;
  createCattlePayment(data: Partial<CattlePayment>): Promise<CattlePayment>;

  // Cattle Costs
  getCattleCostsByCattle(cattleId: string): Promise<CattleCost[]>;
  getCattleCostsByTenant(tenantId: string): Promise<CattleCost[]>;
  createCattleCost(data: Partial<CattleCost>): Promise<CattleCost>;

  // Byproduct Types (Master Data)
  getAllByproductTypes(): Promise<ByproductType[]>;

  // Byproduct Transactions
  getByproductTransactionsByTenant(tenantId: string): Promise<ByproductTransaction[]>;
  createByproductTransaction(data: Partial<ByproductTransaction>): Promise<ByproductTransaction>;

  // Byproduct Inventory
  getByproductInventoryByTenant(tenantId: string): Promise<ByproductInventory[]>;
  upsertByproductInventory(data: Partial<ByproductInventory>): Promise<ByproductInventory>;

  // Attachments
  createAttachment(data: Partial<Attachment>): Promise<Attachment>;
  getAttachmentById(id: string): Promise<Attachment | undefined>;
  getAttachmentsByEntity(entityType: string, entityId: string): Promise<Attachment[]>;
  createAttachmentLink(data: Partial<AttachmentLink>): Promise<AttachmentLink>;
  deleteAttachment(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: InsertUser): Promise<User> {
    const existing = await db.select().from(users).where(eq(users.id, userData.id)).limit(1);
    
    if (existing[0]) {
      const [updated] = await db
        .update(users)
        .set({ ...userData, updatedAt: new Date() })
        .where(eq(users.id, userData.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(users).values(userData).returning();
    return created;
  }

  // Tenants
  async getTenantByOwnerId(ownerId: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.ownerId, ownerId)).limit(1);
    return result[0];
  }

  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(data as any).returning();
    return created;
  }

  async getTenantById(id: string): Promise<Tenant | undefined> {
    const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return result[0];
  }

  // Cattle
  async getCattleByTenant(tenantId: string): Promise<Cattle[]> {
    return db.select().from(cattle).where(eq(cattle.tenantId, tenantId)).orderBy(desc(cattle.createdAt));
  }

  async getCattleById(id: string): Promise<Cattle | undefined> {
    const result = await db.select().from(cattle).where(eq(cattle.id, id)).limit(1);
    return result[0];
  }

  async createCattle(data: Partial<Cattle>): Promise<Cattle> {
    const [created] = await db.insert(cattle).values(data as any).returning();
    return created;
  }

  async updateCattle(id: string, data: Partial<Cattle>): Promise<Cattle | undefined> {
    const [updated] = await db.update(cattle).set({ ...data, updatedAt: new Date() }).where(eq(cattle.id, id)).returning();
    return updated;
  }

  // Breeds
  async getAllBreeds(): Promise<Breed[]> {
    return db.select().from(breeds).where(eq(breeds.isActive, true));
  }

  async createBreed(data: Partial<Breed>): Promise<Breed> {
    const [created] = await db.insert(breeds).values(data as any).returning();
    return created;
  }

  async getAllVaccines(): Promise<any[]> {
    return db.select().from(vaccines).where(eq(vaccines.isActive, true));
  }

  async getAllFeedItems(): Promise<FeedItem[]> {
    return db.select().from(feedItems).where(eq(feedItems.isActive, true));
  }

  async getAllExpenseHeads(): Promise<any[]> {
    return db.select().from(expenseHeads).where(eq(expenseHeads.isActive, true));
  }

  async getAllIncomeHeads(): Promise<any[]> {
    return db.select().from(incomeHeads).where(eq(incomeHeads.isActive, true));
  }

  async getAllInventoryCategories(): Promise<any[]> {
    return db.select().from(inventoryCategories);
  }

  // Milk Entries
  async getMilkEntriesByTenant(tenantId: string): Promise<MilkEntry[]> {
    return db.select().from(milkEntries).where(eq(milkEntries.tenantId, tenantId)).orderBy(desc(milkEntries.date));
  }

  async createMilkEntry(data: Partial<MilkEntry>): Promise<MilkEntry> {
    const [created] = await db.insert(milkEntries).values(data as any).returning();
    return created;
  }

  // Health Events
  async getHealthEventsByTenant(tenantId: string): Promise<HealthEvent[]> {
    return db.select().from(healthEvents).where(eq(healthEvents.tenantId, tenantId)).orderBy(desc(healthEvents.date));
  }

  async createHealthEvent(data: Partial<HealthEvent>): Promise<HealthEvent> {
    const [created] = await db.insert(healthEvents).values(data as any).returning();
    return created;
  }

  async updateHealthEvent(id: string, data: Partial<HealthEvent>): Promise<HealthEvent | undefined> {
    const [updated] = await db.update(healthEvents).set(data).where(eq(healthEvents.id, id)).returning();
    return updated;
  }

  // Tasks
  async getTasksByTenant(tenantId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.tenantId, tenantId)).orderBy(desc(tasks.createdAt));
  }

  async createTask(data: Partial<Task>): Promise<Task> {
    const [created] = await db.insert(tasks).values(data as any).returning();
    return created;
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return updated;
  }

  // Alerts
  async getAlertsByTenant(tenantId: string): Promise<Alert[]> {
    return db.select().from(alerts).where(eq(alerts.tenantId, tenantId)).orderBy(desc(alerts.createdAt));
  }

  async createAlert(data: Partial<Alert>): Promise<Alert> {
    const [created] = await db.insert(alerts).values(data as any).returning();
    return created;
  }

  async updateAlert(id: string, data: Partial<Alert>): Promise<Alert | undefined> {
    const [updated] = await db.update(alerts).set(data).where(eq(alerts.id, id)).returning();
    return updated;
  }

  // Expenses
  async getExpensesByTenant(tenantId: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.tenantId, tenantId)).orderBy(desc(expenses.date));
  }

  async createExpense(data: Partial<Expense>): Promise<Expense> {
    const [created] = await db.insert(expenses).values(data as any).returning();
    return created;
  }

  // Incomes
  async getIncomesByTenant(tenantId: string): Promise<Income[]> {
    return db.select().from(incomes).where(eq(incomes.tenantId, tenantId)).orderBy(desc(incomes.date));
  }

  async createIncome(data: Partial<Income>): Promise<Income> {
    const [created] = await db.insert(incomes).values(data as any).returning();
    return created;
  }

  // Inventory
  async getInventoryItemsByTenant(tenantId: string): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
  }

  async createInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
    const [created] = await db.insert(inventoryItems).values(data as any).returning();
    return created;
  }

  // Feed
  async getAllFeedItems(): Promise<FeedItem[]> {
    return db.select().from(feedItems).where(eq(feedItems.isActive, true));
  }

  async getFeedInventoryByTenant(tenantId: string): Promise<FeedInventory[]> {
    return db.select().from(feedInventory).where(eq(feedInventory.tenantId, tenantId));
  }

  async getFeedingRecordsByTenant(tenantId: string): Promise<FeedingRecord[]> {
    return db.select().from(feedingRecords).where(eq(feedingRecords.tenantId, tenantId)).orderBy(desc(feedingRecords.date));
  }

  async createFeedingRecord(data: Partial<FeedingRecord>): Promise<FeedingRecord> {
    const [created] = await db.insert(feedingRecords).values(data as any).returning();
    return created;
  }

  // Breeding
  async getHeatsByTenant(tenantId: string): Promise<Heat[]> {
    return db.select().from(heats).where(eq(heats.tenantId, tenantId)).orderBy(desc(heats.detectedAt));
  }

  async createHeat(data: Partial<Heat>): Promise<Heat> {
    const [created] = await db.insert(heats).values(data as any).returning();
    return created;
  }

  async getInseminationsByTenant(tenantId: string): Promise<Insemination[]> {
    return db.select().from(inseminations).where(eq(inseminations.tenantId, tenantId)).orderBy(desc(inseminations.date));
  }

  async createInsemination(data: Partial<Insemination>): Promise<Insemination> {
    const [created] = await db.insert(inseminations).values(data as any).returning();
    return created;
  }

  async getPregnancyTestsByTenant(tenantId: string): Promise<PregnancyTest[]> {
    return db.select().from(pregnancyTests).where(eq(pregnancyTests.tenantId, tenantId)).orderBy(desc(pregnancyTests.testDate));
  }

  // Dashboard Stats
  async getDashboardStats(tenantId: string) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const allCattle = await db.select().from(cattle).where(
      and(eq(cattle.tenantId, tenantId), eq(cattle.status, "active"))
    );

    const milkingCattle = allCattle.filter(c => c.stage === "milking");

    const todayMilkResult = await db.select({ 
      total: sql<number>`COALESCE(SUM(${milkEntries.quantity}::numeric), 0)` 
    })
      .from(milkEntries)
      .where(and(
        eq(milkEntries.tenantId, tenantId),
        eq(milkEntries.date, today)
      ));

    const yesterdayMilkResult = await db.select({ 
      total: sql<number>`COALESCE(SUM(${milkEntries.quantity}::numeric), 0)` 
    })
      .from(milkEntries)
      .where(and(
        eq(milkEntries.tenantId, tenantId),
        eq(milkEntries.date, yesterday)
      ));

    const pendingTasksResult = await db.select().from(tasks).where(
      and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"))
    );

    const activeAlertsResult = await db.select().from(alerts).where(
      and(eq(alerts.tenantId, tenantId), eq(alerts.isDismissed, false))
    );

    const healthIssuesResult = await db.select().from(healthEvents).where(
      and(eq(healthEvents.tenantId, tenantId), eq(healthEvents.status, "active"))
    );

    return {
      totalCattle: allCattle.length,
      milkingCattle: milkingCattle.length,
      todayMilk: Number(todayMilkResult[0]?.total || 0),
      yesterdayMilk: Number(yesterdayMilkResult[0]?.total || 0),
      pendingTasks: pendingTasksResult.length,
      activeAlerts: activeAlertsResult.length,
      healthIssues: healthIssuesResult.length,
      upcomingCalvings: 0,
    };
  }

  // System Settings
  async getSystemSetting(key: string): Promise<SystemSettings | undefined> {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    return result[0];
  }

  async setSystemSetting(key: string, value: string, isSecret = false): Promise<SystemSettings> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      const [updated] = await db
        .update(systemSettings)
        .set({ value, isSecret, updatedAt: new Date() })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings).values({ key, value, isSecret }).returning();
    return created;
  }

  async getAllSystemSettings(): Promise<SystemSettings[]> {
    return db.select().from(systemSettings);
  }

  // Tenant Settings
  async getTenantSettings(tenantId: string): Promise<TenantSettings | undefined> {
    const result = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
    return result[0];
  }

  async upsertTenantSettings(data: Partial<TenantSettings>): Promise<TenantSettings> {
    if (!data.tenantId) throw new Error("tenantId required");
    const existing = await this.getTenantSettings(data.tenantId);
    if (existing) {
      const [updated] = await db
        .update(tenantSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tenantSettings.tenantId, data.tenantId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(tenantSettings).values(data as any).returning();
    return created;
  }

  // Cattle Transactions
  async getCattleTransactionsByTenant(tenantId: string): Promise<CattleTransaction[]> {
    return db.select().from(cattleTransactions).where(eq(cattleTransactions.tenantId, tenantId)).orderBy(desc(cattleTransactions.date));
  }

  async getCattleTransactionById(id: string): Promise<CattleTransaction | undefined> {
    const result = await db.select().from(cattleTransactions).where(eq(cattleTransactions.id, id)).limit(1);
    return result[0];
  }

  async createCattleTransaction(data: Partial<CattleTransaction>): Promise<CattleTransaction> {
    const [created] = await db.insert(cattleTransactions).values(data as any).returning();
    return created;
  }

  async updateCattleTransaction(id: string, data: Partial<CattleTransaction>): Promise<CattleTransaction | undefined> {
    const [updated] = await db.update(cattleTransactions).set({ ...data, updatedAt: new Date() }).where(eq(cattleTransactions.id, id)).returning();
    return updated;
  }

  // Cattle Payments
  async getCattlePaymentsByTransaction(transactionId: string): Promise<CattlePayment[]> {
    return db.select().from(cattlePayments).where(eq(cattlePayments.transactionId, transactionId)).orderBy(desc(cattlePayments.date));
  }

  async createCattlePayment(data: Partial<CattlePayment>): Promise<CattlePayment> {
    const [created] = await db.insert(cattlePayments).values(data as any).returning();
    return created;
  }

  // Cattle Costs
  async getCattleCostsByCattle(cattleId: string): Promise<CattleCost[]> {
    return db.select().from(cattleCosts).where(eq(cattleCosts.cattleId, cattleId)).orderBy(desc(cattleCosts.date));
  }

  async getCattleCostsByTenant(tenantId: string): Promise<CattleCost[]> {
    return db.select().from(cattleCosts).where(eq(cattleCosts.tenantId, tenantId)).orderBy(desc(cattleCosts.date));
  }

  async createCattleCost(data: Partial<CattleCost>): Promise<CattleCost> {
    const [created] = await db.insert(cattleCosts).values(data as any).returning();
    return created;
  }

  // Byproduct Types
  async getAllByproductTypes(): Promise<ByproductType[]> {
    return db.select().from(byproductTypes).where(eq(byproductTypes.isActive, true));
  }

  // Byproduct Transactions
  async getByproductTransactionsByTenant(tenantId: string): Promise<ByproductTransaction[]> {
    return db.select().from(byproductTransactions).where(eq(byproductTransactions.tenantId, tenantId)).orderBy(desc(byproductTransactions.date));
  }

  async createByproductTransaction(data: Partial<ByproductTransaction>): Promise<ByproductTransaction> {
    const [created] = await db.insert(byproductTransactions).values(data as any).returning();
    return created;
  }

  // Byproduct Inventory
  async getByproductInventoryByTenant(tenantId: string): Promise<ByproductInventory[]> {
    return db.select().from(byproductInventory).where(eq(byproductInventory.tenantId, tenantId));
  }

  async upsertByproductInventory(data: Partial<ByproductInventory>): Promise<ByproductInventory> {
    if (!data.tenantId || !data.byproductTypeId) throw new Error("tenantId and byproductTypeId required");
    const existing = await db.select().from(byproductInventory)
      .where(and(eq(byproductInventory.tenantId, data.tenantId), eq(byproductInventory.byproductTypeId, data.byproductTypeId)))
      .limit(1);
    if (existing[0]) {
      const [updated] = await db
        .update(byproductInventory)
        .set({ ...data, lastUpdated: new Date() })
        .where(eq(byproductInventory.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(byproductInventory).values(data as any).returning();
    return created;
  }

  // Attachments
  async createAttachment(data: Partial<Attachment>): Promise<Attachment> {
    const [created] = await db.insert(attachments).values(data as any).returning();
    return created;
  }

  async getAttachmentById(id: string): Promise<Attachment | undefined> {
    const result = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    return result[0];
  }

  async getAttachmentsByEntity(entityType: string, entityId: string): Promise<Attachment[]> {
    const links = await db.select().from(attachmentLinks)
      .where(and(eq(attachmentLinks.entityType, entityType), eq(attachmentLinks.entityId, entityId)));
    if (links.length === 0) return [];
    const attachmentIds = links.map(l => l.attachmentId);
    const results: Attachment[] = [];
    for (const id of attachmentIds) {
      const att = await this.getAttachmentById(id);
      if (att) results.push(att);
    }
    return results;
  }

  async createAttachmentLink(data: Partial<AttachmentLink>): Promise<AttachmentLink> {
    const [created] = await db.insert(attachmentLinks).values(data as any).returning();
    return created;
  }

  async deleteAttachment(id: string): Promise<void> {
    await db.delete(attachmentLinks).where(eq(attachmentLinks.attachmentId, id));
    await db.delete(attachments).where(eq(attachments.id, id));
  }
}

export const storage = new DatabaseStorage();
