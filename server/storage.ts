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
      upcomingCalvings: 0, // Would need calving predictions
    };
  }
}

export const storage = new DatabaseStorage();
