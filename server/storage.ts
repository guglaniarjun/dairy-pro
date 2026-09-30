import { eq, desc, asc, and, gte, lte, sql, lt, gt } from "drizzle-orm";
import { db } from "./db";
import { breedingMetrics } from "./farm-metrics";
import { assertTag, assertCapacity, receiveStock, consumeSupplies, rows, fail, settings, recordEvent } from "./care-service";
import { isLactating, farmDay, addDays, positive, nonnegative } from "@shared/care";
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
  type UpsertUser,
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
  upsertUser(user: UpsertUser): Promise<User>;

  // Tenants
  getTenantByOwnerId(ownerId: string): Promise<Tenant | undefined>;
  createTenant(data: Partial<Tenant>): Promise<Tenant>;
  getTenantById(id: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | undefined>;
  getTenantMemberCount(tenantId: string): Promise<number>;
  getTenantMemberByUserId(userId: string): Promise<any | undefined>;
  getTenantMemberById(id: string): Promise<any | undefined>;
  getTenantMembersWithUsers(tenantId: string): Promise<any[]>;
  createTenantMember(data: any): Promise<any>;
  updateTenantMember(id: string, data: any): Promise<any | undefined>;

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
  generateSmartAlerts(tenantId: string): Promise<void>;

  // Expenses
  getExpensesByTenant(tenantId: string): Promise<Expense[]>;
  createExpense(data: Partial<Expense>): Promise<Expense>;

  // Incomes
  getIncomesByTenant(tenantId: string): Promise<Income[]>;
  createIncome(data: Partial<Income>): Promise<Income>;

  // Inventory
  getInventoryItemsByTenant(tenantId: string): Promise<InventoryItem[]>;
  createInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem>;
  getInventoryTransactionsByTenant(tenantId: string): Promise<any[]>;
  createInventoryTransaction(data: any): Promise<any>;

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
  getAllSubscriptionPlansForAdmin(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlanByCode(code: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined>;

  // Tenant Subscriptions
  getTenantSubscription(tenantId: string): Promise<TenantSubscription | undefined>;
  createTenantSubscription(data: Partial<TenantSubscription>): Promise<TenantSubscription>;
  updateTenantSubscription(id: string, data: Partial<TenantSubscription>): Promise<TenantSubscription | undefined>;

  // WhatsApp
  getWhatsappConfig(tenantId: string): Promise<WhatsappConfig | undefined>;
  upsertWhatsappConfig(data: Partial<WhatsappConfig>): Promise<WhatsappConfig>;
  getWhatsappLogs(tenantId: string, limit?: number): Promise<WhatsappLog[]>;
  getAllWhatsappLogs(limit?: number): Promise<WhatsappLog[]>;
  createWhatsappLog(data: Partial<WhatsappLog>): Promise<WhatsappLog>;
  updateWhatsappLog(id: string, data: Partial<WhatsappLog>): Promise<WhatsappLog | undefined>;

  // Notification Rules
  getNotificationRules(tenantId: string): Promise<NotificationRule[]>;
  getNotificationRuleById(id: string): Promise<NotificationRule | undefined>;
  createNotificationRule(data: Partial<NotificationRule>): Promise<NotificationRule>;
  updateNotificationRule(id: string, data: Partial<NotificationRule>): Promise<NotificationRule | undefined>;
  deleteNotificationRule(id: string): Promise<void>;
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

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (!userData.id) {
      const [created] = await db.insert(users).values(userData).returning();
      return created;
    }
    const userId = userData.id;
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (existing[0]) {
      const [updated] = await db
        .update(users)
        .set({ ...userData, updatedAt: new Date() })
        .where(eq(users.id, userId))
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

  async getAllTenants(): Promise<Tenant[]> {
    return db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updated;
  }

  async getTenantMemberCount(tenantId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.isActive, true)));
    // Owners are stored on tenants, while additional users live in tenant_members.
    return 1 + (result?.count || 0);
  }

  async getTenantMemberByUserId(userId: string): Promise<any | undefined> {
    const [membership] = await db.select().from(tenantMembers)
      .where(eq(tenantMembers.userId, userId))
      .limit(1);
    return membership;
  }

  async getTenantMemberById(id: string): Promise<any | undefined> {
    const [membership] = await db.select().from(tenantMembers).where(eq(tenantMembers.id, id)).limit(1);
    return membership;
  }

  async getTenantMembersWithUsers(tenantId: string): Promise<any[]> {
    return db.select({ membership: tenantMembers, user: users })
      .from(tenantMembers)
      .innerJoin(users, eq(tenantMembers.userId, users.id))
      .where(eq(tenantMembers.tenantId, tenantId))
      .orderBy(asc(users.firstName), asc(users.email));
  }

  async createTenantMember(data: any): Promise<any> {
    const [created] = await db.insert(tenantMembers).values(data).returning();
    return created;
  }

  async updateTenantMember(id: string, data: any): Promise<any | undefined> {
    const [updated] = await db.update(tenantMembers).set(data).where(eq(tenantMembers.id, id)).returning();
    return updated;
  }

  // Cattle
  async getCattleByTenant(tenantId: string): Promise<Cattle[]> {
    return db.select().from(cattle).where(eq(cattle.tenantId, tenantId)).orderBy(asc(cattle.tagNumber));
  }

  async getCattleById(id: string): Promise<Cattle | undefined> {
    const result = await db.select().from(cattle).where(eq(cattle.id, id)).limit(1);
    return result[0];
  }

  async createCattle(data: Partial<Cattle>): Promise<Cattle> {
    await assertTag(data.tenantId!, data.tagNumber!);
    await assertCapacity(data.tenantId!);
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
    nonnegative.parse(data.quantity);
    if ((await rows(milkEntries,data.tenantId!)).some(m=>m.cattleId===data.cattleId&&m.date===data.date&&m.session===data.session)) fail("Milk already exists for this animal, date and session",409);
    const [created] = await db.insert(milkEntries).values(data as any).returning();
    if((data as any).destination === "discarded") await recordEvent(data.tenantId!,"milk_disposition",data.date!,{kind:"discarded",quantity:Number(data.quantity),milkEntryId:created.id,notes:"Recorded separately from bulk milk"},data.cattleId,data.recordedBy||undefined);
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
    const opening=Number(data.currentStock||0);
    const [created] = await db.insert(inventoryItems).values({...data,currentStock:"0"} as any).returning();
    if(opening>0) await receiveStock(data.tenantId!,{itemId:created.id,quantity:opening,packCost:data.avgCost||0,batchNumber:"OPENING",receivedDate:farmDay((await settings(data.tenantId!)).timezone)});
    return created;
  }

  async getInventoryTransactionsByTenant(tenantId: string): Promise<any[]> {
    return db.select().from(inventoryTransactions)
      .where(eq(inventoryTransactions.tenantId, tenantId))
      .orderBy(desc(inventoryTransactions.createdAt));
  }

  async createInventoryTransaction(data: any): Promise<any> {
    const date=farmDay((await settings(data.tenantId)).timezone);
    if(data.type === "purchase" || data.type === "return") return receiveStock(data.tenantId,{...data,receivedDate:date,batchNumber:data.batchNumber||`RECEIPT-${Date.now()}`,packCost:data.unitCost||0},data.recordedBy);
    if(data.type === "issue") return consumeSupplies(data.tenantId,[{itemId:data.itemId,quantity:positive.parse(data.quantity)}],date,data.recordedBy,data.cattleId);
    return fail("Use Stock Lots to record wastage and adjustments against a specific lot");
  }

  // Feed
  async getFeedInventoryByTenant(tenantId: string): Promise<FeedInventory[]> {
    return db.select().from(feedInventory).where(eq(feedInventory.tenantId, tenantId));
  }

  async getFeedingRecordsByTenant(tenantId: string): Promise<FeedingRecord[]> {
    return db.select().from(feedingRecords).where(eq(feedingRecords.tenantId, tenantId)).orderBy(desc(feedingRecords.date));
  }

  async createFeedingRecord(data: Partial<FeedingRecord>): Promise<FeedingRecord> {
    let remaining=positive.parse(data.actualQuantity); let cost=0;
    const lots=(await rows(feedInventory,data.tenantId!)).filter(l=>l.feedItemId===data.feedItemId&&(!l.expiryDate||l.expiryDate>=data.date!)&&Number(l.quantity)>0).sort((a,b)=>(a.expiryDate||"9999").localeCompare(b.expiryDate||"9999"));
    if(lots.reduce((n,l)=>n+Number(l.quantity),0)<remaining)fail("Insufficient feed inventory; receive feed or use the approved diet and stock-lot workflow",409);
    for(const lot of lots){if(remaining<=0)break;const quantity=Math.min(remaining,Number(lot.quantity));await db.update(feedInventory).set({quantity:String(Number(lot.quantity)-quantity),updatedAt:new Date()}).where(eq(feedInventory.id,lot.id));cost+=quantity*Number(lot.unitCost||0);remaining-=quantity;}
    const [created] = await db.insert(feedingRecords).values(data as any).returning();
    if(data.cattleId)await db.insert(cattleCosts).values({tenantId:data.tenantId!,cattleId:data.cattleId,date:data.date!,category:"feed",amount:String(cost),sourceType:"feeding",sourceId:created.id,description:"Recorded feeding"});
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
    const cfg = await settings(tenantId);
    const today = farmDay(cfg.timezone);
    const yesterday = addDays(today,-1);
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86400000);
    const monthStart = today.slice(0,7)+"-01";

    // All active cattle
    const allCattle = await db.select().from(cattle).where(
      and(eq(cattle.tenantId, tenantId), eq(cattle.status, "active"))
    );

    const milkingCattle = allCattle.filter(isLactating);
    const pregnantCattle = allCattle.filter(c => c.reproductiveStatus === "pregnant" || (!c.reproductiveStatus && c.stage === "pregnant"));
    const dryCattle = allCattle.filter(c => c.productionStatus === "dry" || (!c.productionStatus && c.stage === "dry"));

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

    const breeding = await breedingMetrics(tenantId);
    const vaccinationsAll = await rows(vaccinations,tenantId);
    const currentVaccinations = vaccinationsAll.filter(v=>!vaccinationsAll.some(n=>n.cattleId===v.cattleId&&n.vaccineId===v.vaccineId&&n.date>v.date));
    const vaccinationDue = currentVaccinations.filter(v=>v.nextDueDate&&v.nextDueDate>=today&&v.nextDueDate<=addDays(today,14)).length;
    const vaccinationOverdue = currentVaccinations.filter(v=>v.nextDueDate&&v.nextDueDate<today).length;
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
      expectedHeat: breeding.expectedHeat,
      pregnancyTestDue: breeding.pregnancyTestDue,
      expectedCalving: breeding.expectedCalving,
      dryOffDue: breeding.dryOffDue,
      openCattle: breeding.openCattle,
      repeatBreeders: breeding.repeatBreeders,
      totalInseminations: breeding.totalInseminations,
      conceptionRate: breeding.conceptionRate,
      // Health
      vaccinationDue,
      vaccinationOverdue,
      dewormingDue: breeding.dewormingDue,
      // Finance
      monthExpense,
      monthRevenue,
      pendingReceivables,
      costPerKgMilk,
      // Plan
      currentPlan,
      maxCattle,
      upcomingCalvings: breeding.expectedCalving,
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
    const paid = Number(data.paidAmount || 0);
    if(!Number.isFinite(paid)||paid<0||paid>Number(data.amount)) fail("Invalid paid amount");
    const [created] = await db.insert(cattleTransactions).values({...data,paymentStatus:paid>=Number(data.amount)?"paid":paid>0?"partial":"pending"} as any).returning();
    if(paid>0) await db.insert(cattlePayments).values({tenantId:data.tenantId!,transactionId:created.id,date:data.date!,amount:String(paid),paymentMethod:data.paymentMethod||"cash",createdBy:data.createdBy});
    if(data.type === "sale") await db.update(cattle).set({status:"sold",updatedAt:new Date()}).where(eq(cattle.id,data.cattleId!));
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

  async getAllSubscriptionPlansForAdmin(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
  }

  async getSubscriptionPlanByCode(code: string): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.code, code)).limit(1);
    return result[0];
  }

  async createSubscriptionPlan(data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(data as any).returning();
    return created;
  }

  async updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, id)).returning();
    return updated;
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

  async getAllWhatsappLogs(limit = 100): Promise<WhatsappLog[]> {
    return db.select().from(whatsappLogs).orderBy(desc(whatsappLogs.createdAt)).limit(limit);
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

  async getNotificationRuleById(id: string): Promise<NotificationRule | undefined> {
    const [rule] = await db.select().from(notificationRules).where(eq(notificationRules.id, id)).limit(1);
    return rule;
  }

  async createNotificationRule(data: Partial<NotificationRule>): Promise<NotificationRule> {
    const [created] = await db.insert(notificationRules).values(data as any).returning();
    return created;
  }

  async updateNotificationRule(id: string, data: Partial<NotificationRule>): Promise<NotificationRule | undefined> {
    const [updated] = await db.update(notificationRules).set({ ...data, updatedAt: new Date() }).where(eq(notificationRules.id, id)).returning();
    return updated;
  }

  async deleteNotificationRule(id: string): Promise<void> {
    await db.delete(notificationRules).where(eq(notificationRules.id, id));
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
  async getBreedingAnalytics(tenantId: string): Promise<any> { return breedingMetrics(tenantId); }

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

  // Smart Alerts Auto-Generation
  async generateSmartAlerts(tenantId: string): Promise<void> {
    const { evaluateTenantRules } = await import("./notification-engine");
    await evaluateTenantRules(tenantId);
  }
}

export const storage = new DatabaseStorage();
