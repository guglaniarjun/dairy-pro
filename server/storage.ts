import { eq, desc, and, gte, lte, sql, lt, gt } from "drizzle-orm";
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
  milkSales,
  subscriptionPlans,
  tenantSubscriptions,
  whatsappConfigs,
  whatsappLogs,
  notificationRules,
  farmSettings,
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
  type SubscriptionPlan,
  type TenantSubscription,
  type WhatsappConfig,
  type WhatsappLog,
  type NotificationRule,
  type FarmSettings,
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
  getDashboardStats(tenantId: string): Promise<Record<string, any>>;

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

  // Subscription Plans
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlanByCode(code: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan>;

  // Tenant Subscriptions
  getTenantSubscription(tenantId: string): Promise<TenantSubscription | undefined>;
  createTenantSubscription(data: Partial<TenantSubscription>): Promise<TenantSubscription>;
  updateTenantSubscription(id: string, data: Partial<TenantSubscription>): Promise<TenantSubscription | undefined>;

  // WhatsApp
  getWhatsappConfig(tenantId: string): Promise<WhatsappConfig | undefined>;
  upsertWhatsappConfig(data: Partial<WhatsappConfig>): Promise<WhatsappConfig>;
  getWhatsappLogs(tenantId: string, limit?: number): Promise<WhatsappLog[]>;
  createWhatsappLog(data: Partial<WhatsappLog>): Promise<WhatsappLog>;
  updateWhatsappLog(id: string, data: Partial<WhatsappLog>): Promise<WhatsappLog | undefined>;

  // Notification Rules
  getNotificationRules(tenantId: string): Promise<NotificationRule[]>;
  upsertNotificationRule(data: Partial<NotificationRule>): Promise<NotificationRule>;

  // Farm Settings
  getFarmSettings(tenantId: string): Promise<FarmSettings | undefined>;
  upsertFarmSettings(data: Partial<FarmSettings>): Promise<FarmSettings>;

  // Cattle detail queries
  getMilkEntriesByCattle(cattleId: string): Promise<MilkEntry[]>;
  getHealthEventsByCattle(cattleId: string): Promise<HealthEvent[]>;
  getInseminationsByCattle(cattleId: string): Promise<Insemination[]>;
  getHeatsByCattle(cattleId: string): Promise<Heat[]>;
  getPregnancyTestsByCattle(cattleId: string): Promise<PregnancyTest[]>;
  getCalvingsByCattle(cattleId: string): Promise<any[]>;
  getVaccinationsByCattle(cattleId: string): Promise<any[]>;

  // Vaccination due
  getVaccinationsDue(tenantId: string): Promise<any[]>;

  // Breeding analytics
  getBreedingAnalytics(tenantId: string): Promise<any>;

  // Finance analytics
  getFinanceAnalytics(tenantId: string): Promise<any>;
  getMilkSalesByTenant(tenantId: string): Promise<any[]>;
  createMilkSale(data: any): Promise<any>;
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
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // All active cattle
    const allCattle = await db.select().from(cattle).where(
      and(eq(cattle.tenantId, tenantId), eq(cattle.status, "active"))
    );

    const milkingCattle = allCattle.filter(c => c.stage === "milking");
    const pregnantCattle = allCattle.filter(c => c.stage === "pregnant");
    const dryCattle = allCattle.filter(c => c.stage === "dry");

    // Milk stats
    const todayMilkResult = await db.select({ total: sql<number>`COALESCE(SUM(${milkEntries.quantity}::numeric), 0)` })
      .from(milkEntries).where(and(eq(milkEntries.tenantId, tenantId), eq(milkEntries.date, today)));

    const yesterdayMilkResult = await db.select({ total: sql<number>`COALESCE(SUM(${milkEntries.quantity}::numeric), 0)` })
      .from(milkEntries).where(and(eq(milkEntries.tenantId, tenantId), eq(milkEntries.date, yesterday)));

    const monthMilkResult = await db.select({ total: sql<number>`COALESCE(SUM(${milkEntries.quantity}::numeric), 0)` })
      .from(milkEntries).where(and(eq(milkEntries.tenantId, tenantId), gte(milkEntries.date, monthStart)));

    const todayMilk = Number(todayMilkResult[0]?.total || 0);
    const monthMilk = Number(monthMilkResult[0]?.total || 0);
    const herdAvgMilk = milkingCattle.length > 0 ? todayMilk / milkingCattle.length : 0;
    const daysInMonth = now.getDate();
    const monthAvgMilk = daysInMonth > 0 ? monthMilk / daysInMonth : 0;

    // Pending tasks & alerts
    const pendingTasksResult = await db.select().from(tasks).where(
      and(eq(tasks.tenantId, tenantId), eq(tasks.status, "pending"))
    );
    const activeAlertsResult = await db.select().from(alerts).where(
      and(eq(alerts.tenantId, tenantId), eq(alerts.isDismissed, false))
    );

    // Health
    const healthIssuesResult = await db.select().from(healthEvents).where(
      and(eq(healthEvents.tenantId, tenantId), eq(healthEvents.status, "active"))
    );

    // Breeding: expected events in next 30 days
    // Expected heat: cattle in milking/open stage without recent insemination in last 21 days
    // Pregnancy tests due: inseminations from 28-45 days ago without pregnancy test
    const recentInseminations = await db.select().from(inseminations).where(
      and(eq(inseminations.tenantId, tenantId))
    );
    const recentPregnancyTests = await db.select().from(pregnancyTests).where(
      and(eq(pregnancyTests.tenantId, tenantId))
    );
    const recentCalvings = await db.select().from(calvings).where(
      and(eq(calvings.tenantId, tenantId))
    );

    // PT due: inseminations 28-45 days ago with no positive pregnancy test
    const ptDueCattleIds = new Set<number>();
    for (const ins of recentInseminations) {
      const insDate = new Date(ins.date);
      const daysAgo = Math.floor((now.getTime() - insDate.getTime()) / 86400000);
      if (daysAgo >= 28 && daysAgo <= 60) {
        const hasPT = recentPregnancyTests.some(pt => pt.cattleId === ins.cattleId && new Date(pt.testDate) > insDate);
        if (!hasPT) ptDueCattleIds.add(ins.cattleId!);
      }
    }

    // Expected calving: pregnant cattle with expected date in next 30 days
    // Use last insemination + 280 days
    const calvingDueCattleIds = new Set<number>();
    const dryOffDueCattleIds = new Set<number>();
    for (const ins of recentInseminations) {
      const cattle_rec = allCattle.find(c => c.id === ins.cattleId);
      if (!cattle_rec || cattle_rec.stage !== "pregnant") continue;
      const expectedCalving = new Date(new Date(ins.date).getTime() + 280 * 86400000);
      const daysToCalving = Math.floor((expectedCalving.getTime() - now.getTime()) / 86400000);
      if (daysToCalving >= 0 && daysToCalving <= 30) calvingDueCattleIds.add(ins.cattleId!);
      if (daysToCalving >= 60 && daysToCalving <= 75) dryOffDueCattleIds.add(ins.cattleId!); // dry 60 days before
    }

    // Expected heat: milking cows not inseminated in last 21 days
    const expectedHeatCattle = allCattle.filter(c => {
      if (c.stage !== "milking" && c.stage !== "heifer") return false;
      const lastIns = recentInseminations.filter(i => i.cattleId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      const lastHeat = recentCalvings.filter(h => h.cattleId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      const referenceDate = lastIns?.date || lastHeat?.date;
      if (!referenceDate) return false;
      const daysAgo = Math.floor((now.getTime() - new Date(referenceDate).getTime()) / 86400000);
      return daysAgo >= 18 && daysAgo <= 28;
    });

    // Repeat breeders: 3+ failed inseminations
    const insCountByCattle: Record<number, number> = {};
    for (const ins of recentInseminations) {
      if (ins.cattleId) insCountByCattle[ins.cattleId] = (insCountByCattle[ins.cattleId] || 0) + 1;
    }
    const repeatBreeders = Object.entries(insCountByCattle).filter(([, count]) => count >= 3).length;
    const openCattle = allCattle.filter(c => c.stage !== "pregnant" && c.stage !== "heifer" && c.stage !== "calf" && c.stage !== "dry").length;

    // Vaccination stats
    const allVaccinations = await db.select().from(vaccinations).where(eq(vaccinations.tenantId, tenantId));
    const vaccinationDue = allVaccinations.filter(v => {
      if (!v.nextDueDate) return false;
      const due = new Date(v.nextDueDate);
      return due >= now && due <= in30Days;
    }).length;
    const vaccinationOverdue = allVaccinations.filter(v => {
      if (!v.nextDueDate) return false;
      return new Date(v.nextDueDate) < now;
    }).length;

    // Finance
    const monthExpenses = await db.select({ total: sql<number>`COALESCE(SUM(${expenses.amount}::numeric), 0)` })
      .from(expenses).where(and(eq(expenses.tenantId, tenantId), gte(expenses.date, monthStart)));
    const monthIncomes = await db.select({ total: sql<number>`COALESCE(SUM(${incomes.amount}::numeric), 0)` })
      .from(incomes).where(and(eq(incomes.tenantId, tenantId), gte(incomes.date, monthStart)));
    const unpaidMilkSales = await db.select({ total: sql<number>`COALESCE(SUM(${milkSales.totalAmount}::numeric), 0)` })
      .from(milkSales).where(and(eq(milkSales.tenantId, tenantId), eq(milkSales.paymentStatus, "pending")));

    const monthExpense = Number(monthExpenses[0]?.total || 0);
    const monthRevenue = Number(monthIncomes[0]?.total || 0);
    const pendingReceivables = Number(unpaidMilkSales[0]?.total || 0);

    // Cost per kg milk (month)
    const costPerKgMilk = monthMilk > 0 ? monthExpense / monthMilk : null;

    // Tenant plan
    const tenant_rec = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const currentPlan = tenant_rec[0]?.plan || "free";
    const maxCattle = tenant_rec[0]?.maxCattle || 5;

    // Conception rate: positive PT / total inseminations
    const positivePTs = recentPregnancyTests.filter(pt => pt.result === "positive").length;
    const conceptionRate = recentInseminations.length > 0
      ? Math.round((positivePTs / recentInseminations.length) * 100)
      : null;

    return {
      // Herd
      totalCattle: allCattle.length,
      milkingCattle: milkingCattle.length,
      pregnantCattle: pregnantCattle.length,
      dryCattle: dryCattle.length,
      // Milk
      todayMilk,
      yesterdayMilk: Number(yesterdayMilkResult[0]?.total || 0),
      monthMilk,
      herdAvgMilk: Math.round(herdAvgMilk * 10) / 10,
      monthAvgMilk: Math.round(monthAvgMilk * 10) / 10,
      // Tasks & Alerts
      pendingTasks: pendingTasksResult.length,
      activeAlerts: activeAlertsResult.length,
      activeHealthIssues: healthIssuesResult.length,
      healthIssues: healthIssuesResult.length,
      // Breeding expected events
      expectedHeat: expectedHeatCattle.length,
      pregnancyTestDue: ptDueCattleIds.size,
      expectedCalving: calvingDueCattleIds.size,
      dryOffDue: dryOffDueCattleIds.size,
      openCattle,
      repeatBreeders,
      totalInseminations: recentInseminations.length,
      conceptionRate,
      // Health
      vaccinationDue,
      vaccinationOverdue,
      dewormingDue: 0,
      // Finance
      monthExpense,
      monthRevenue,
      pendingReceivables,
      costPerKgMilk,
      // Plan
      currentPlan,
      maxCattle,
      upcomingCalvings: calvingDueCattleIds.size,
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

  // Subscription Plans
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlanByCode(code: string): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, code)).limit(1);
    return result[0];
  }

  async createSubscriptionPlan(data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(data as any).returning();
    return created;
  }

  // Tenant Subscriptions
  async getTenantSubscription(tenantId: string): Promise<TenantSubscription | undefined> {
    const result = await db.select().from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .orderBy(desc(tenantSubscriptions.createdAt))
      .limit(1);
    return result[0];
  }

  async createTenantSubscription(data: Partial<TenantSubscription>): Promise<TenantSubscription> {
    const [created] = await db.insert(tenantSubscriptions).values(data as any).returning();
    return created;
  }

  async updateTenantSubscription(id: string, data: Partial<TenantSubscription>): Promise<TenantSubscription | undefined> {
    const [updated] = await db.update(tenantSubscriptions).set({ ...data, updatedAt: new Date() }).where(eq(tenantSubscriptions.id, id)).returning();
    return updated;
  }

  // WhatsApp
  async getWhatsappConfig(tenantId: string): Promise<WhatsappConfig | undefined> {
    const result = await db.select().from(whatsappConfigs).where(eq(whatsappConfigs.tenantId, tenantId)).limit(1);
    return result[0];
  }

  async upsertWhatsappConfig(data: Partial<WhatsappConfig>): Promise<WhatsappConfig> {
    if (!data.tenantId) throw new Error("tenantId required");
    const existing = await this.getWhatsappConfig(data.tenantId);
    if (existing) {
      const [updated] = await db.update(whatsappConfigs).set({ ...data, updatedAt: new Date() }).where(eq(whatsappConfigs.tenantId, data.tenantId)).returning();
      return updated;
    }
    const [created] = await db.insert(whatsappConfigs).values(data as any).returning();
    return created;
  }

  async getWhatsappLogs(tenantId: string, limit = 50): Promise<WhatsappLog[]> {
    return db.select().from(whatsappLogs).where(eq(whatsappLogs.tenantId, tenantId)).orderBy(desc(whatsappLogs.createdAt)).limit(limit);
  }

  async createWhatsappLog(data: Partial<WhatsappLog>): Promise<WhatsappLog> {
    const [created] = await db.insert(whatsappLogs).values(data as any).returning();
    return created;
  }

  async updateWhatsappLog(id: string, data: Partial<WhatsappLog>): Promise<WhatsappLog | undefined> {
    const [updated] = await db.update(whatsappLogs).set(data).where(eq(whatsappLogs.id, id)).returning();
    return updated;
  }

  // Notification Rules
  async getNotificationRules(tenantId: string): Promise<NotificationRule[]> {
    return db.select().from(notificationRules).where(eq(notificationRules.tenantId, tenantId));
  }

  async upsertNotificationRule(data: Partial<NotificationRule>): Promise<NotificationRule> {
    if (!data.tenantId || !data.ruleType) throw new Error("tenantId and ruleType required");
    const existing = await db.select().from(notificationRules)
      .where(and(eq(notificationRules.tenantId, data.tenantId), eq(notificationRules.ruleType, data.ruleType)))
      .limit(1);
    if (existing[0]) {
      const [updated] = await db.update(notificationRules).set({ ...data, updatedAt: new Date() }).where(eq(notificationRules.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(notificationRules).values(data as any).returning();
    return created;
  }

  // Farm Settings
  async getFarmSettings(tenantId: string): Promise<FarmSettings | undefined> {
    const result = await db.select().from(farmSettings).where(eq(farmSettings.tenantId, tenantId)).limit(1);
    return result[0];
  }

  async upsertFarmSettings(data: Partial<FarmSettings>): Promise<FarmSettings> {
    if (!data.tenantId) throw new Error("tenantId required");
    const existing = await this.getFarmSettings(data.tenantId);
    if (existing) {
      const [updated] = await db.update(farmSettings).set({ ...data, updatedAt: new Date() }).where(eq(farmSettings.tenantId, data.tenantId)).returning();
      return updated;
    }
    const [created] = await db.insert(farmSettings).values(data as any).returning();
    return created;
  }

  // Cattle detail queries
  async getMilkEntriesByCattle(cattleId: string): Promise<MilkEntry[]> {
    return db.select().from(milkEntries).where(eq(milkEntries.cattleId, cattleId)).orderBy(desc(milkEntries.date));
  }

  async getHealthEventsByCattle(cattleId: string): Promise<HealthEvent[]> {
    return db.select().from(healthEvents).where(eq(healthEvents.cattleId, cattleId)).orderBy(desc(healthEvents.date));
  }

  async getInseminationsByCattle(cattleId: string): Promise<Insemination[]> {
    return db.select().from(inseminations).where(eq(inseminations.cattleId, cattleId)).orderBy(desc(inseminations.date));
  }

  async getHeatsByCattle(cattleId: string): Promise<Heat[]> {
    return db.select().from(heats).where(eq(heats.cattleId, cattleId)).orderBy(desc(heats.detectedAt));
  }

  async getPregnancyTestsByCattle(cattleId: string): Promise<PregnancyTest[]> {
    return db.select().from(pregnancyTests).where(eq(pregnancyTests.cattleId, cattleId)).orderBy(desc(pregnancyTests.testDate));
  }

  async getCalvingsByCattle(cattleId: string): Promise<any[]> {
    return db.select().from(calvings).where(eq(calvings.cattleId, cattleId)).orderBy(desc(calvings.date));
  }

  async getVaccinationsByCattle(cattleId: string): Promise<any[]> {
    return db.select().from(vaccinations).where(eq(vaccinations.cattleId, cattleId)).orderBy(desc(vaccinations.date));
  }

  // Vaccination due
  async getVaccinationsDue(tenantId: string): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    const future30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    return db.select({
      id: vaccinations.id,
      cattleId: vaccinations.cattleId,
      vaccineName: vaccinations.vaccineName,
      date: vaccinations.date,
      nextDueDate: vaccinations.nextDueDate,
    }).from(vaccinations)
      .where(and(
        eq(vaccinations.tenantId, tenantId),
        lte(vaccinations.nextDueDate, future30)
      ))
      .orderBy(vaccinations.nextDueDate);
  }

  // Breeding analytics
  async getBreedingAnalytics(tenantId: string): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const allCattle = await db.select().from(cattle).where(and(eq(cattle.tenantId, tenantId), eq(cattle.status, "active")));
    const allHeats = await db.select().from(heats).where(eq(heats.tenantId, tenantId));
    const allInseminations = await db.select().from(inseminations).where(eq(inseminations.tenantId, tenantId));
    const allPregnancyTests = await db.select().from(pregnancyTests).where(eq(pregnancyTests.tenantId, tenantId));
    const allCalvings = await db.select().from(calvings).where(eq(calvings.tenantId, tenantId));

    const pregnant = allCattle.filter(c => c.stage === "pregnant").length;
    const dry = allCattle.filter(c => c.stage === "dry").length;
    const heifer = allCattle.filter(c => c.stage === "heifer").length;
    const milking = allCattle.filter(c => c.stage === "milking").length;

    const positiveTests = allPregnancyTests.filter(p => p.result === "positive").length;
    const conceptionRate = allInseminations.length > 0 ? Math.round((positiveTests / allInseminations.length) * 100) : 0;

    // Expected events in next 14 days
    const future14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const expectedCalvings = allPregnancyTests.filter(p => p.expectedCalvingDate && p.expectedCalvingDate >= today && p.expectedCalvingDate <= future14).length;
    const expectedPregnancyTests = allInseminations.filter(i => {
      const testDue = new Date(new Date(i.date).getTime() + 30 * 86400000).toISOString().split('T')[0];
      return testDue >= today && testDue <= future14;
    }).length;

    return {
      totalCattle: allCattle.length,
      pregnant,
      dry,
      heifer,
      milking,
      openCattle: allCattle.filter(c => c.stage !== "pregnant" && c.stage !== "dry" && c.stage !== "heifer" && c.stage !== "calf").length,
      conceptionRate,
      expectedCalvings,
      expectedPregnancyTests,
      totalInseminations: allInseminations.length,
      totalCalvings: allCalvings.length,
    };
  }

  // Finance analytics
  async getFinanceAnalytics(tenantId: string): Promise<any> {
    const thisMonth = new Date();
    const firstDay = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const monthExpenses = await db.select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}::numeric), 0)`
    }).from(expenses).where(and(eq(expenses.tenantId, tenantId), gte(expenses.date, firstDay)));

    const monthIncomes = await db.select({
      total: sql<number>`COALESCE(SUM(${incomes.amount}::numeric), 0)`
    }).from(incomes).where(and(eq(incomes.tenantId, tenantId), gte(incomes.date, firstDay)));

    const pendingReceivables = await db.select({
      total: sql<number>`COALESCE(SUM(${cattleTransactions.amount}::numeric - COALESCE(${cattleTransactions.paidAmount}::numeric, 0)), 0)`
    }).from(cattleTransactions).where(and(
      eq(cattleTransactions.tenantId, tenantId),
      eq(cattleTransactions.type, "sale"),
    ));

    const pendingPayables = await db.select({
      total: sql<number>`COALESCE(SUM(${cattleTransactions.amount}::numeric - COALESCE(${cattleTransactions.paidAmount}::numeric, 0)), 0)`
    }).from(cattleTransactions).where(and(
      eq(cattleTransactions.tenantId, tenantId),
      eq(cattleTransactions.type, "purchase"),
    ));

    const totalExpenses = Number(monthExpenses[0]?.total || 0);
    const totalIncomes = Number(monthIncomes[0]?.total || 0);

    return {
      totalExpenses,
      totalIncomes,
      netProfit: totalIncomes - totalExpenses,
      pendingReceivables: Number(pendingReceivables[0]?.total || 0),
      pendingPayables: Number(pendingPayables[0]?.total || 0),
    };
  }

  async getMilkSalesByTenant(tenantId: string): Promise<any[]> {
    return db.select().from(milkSales).where(eq(milkSales.tenantId, tenantId)).orderBy(desc(milkSales.date));
  }

  async createMilkSale(data: any): Promise<any> {
    const [created] = await db.insert(milkSales).values(data as any).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
