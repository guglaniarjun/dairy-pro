import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { upload, uploadFile, deleteFile, getFileType } from "./upload";
import { whatsappWebGateway } from "./whatsapp-web";
import { evaluateTenantRules, processWhatsappOutbox, queueWhatsappBroadcast, queueWhatsappMessage } from "./notification-engine";

import type { User as AppUser } from "@shared/models/auth";
import { allTenantPermissions, effectivePermissions, tenantRoles, type TenantPermission } from "@shared/rbac";

declare global {
  namespace Express {
    interface User extends AppUser {}
    interface Request {
      tenantId?: string;
      tenantRole?: string;
      tenantPermissions?: string[];
    }
  }
}

const routeParam = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

function permissionForRequest(req: Request): TenantPermission | null {
  const path = req.path;
  const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  const match = (module: string) => `${module}.${write ? "manage" : "view"}` as TenantPermission;
  if (path.startsWith("/api/team")) return "team.manage";
  if (path.startsWith("/api/billing")) return "billing.manage";
  if (path.startsWith("/api/import") || path.startsWith("/api/export")) return "import_export.manage";
  if (path.startsWith("/api/settings") || path.startsWith("/api/farm-settings") || path.startsWith("/api/notification-rules") || path.startsWith("/api/whatsapp")) return "settings.manage";
  if (path.startsWith("/api/dashboard")) return "dashboard.view";
  if (/^\/api\/cattle\/[^/]+\/milk-entries/.test(path)) return "milk.view";
  if (/^\/api\/cattle\/[^/]+\/(health-events|vaccinations)/.test(path)) return "health.view";
  if (/^\/api\/cattle\/[^/]+\/(heats|inseminations|pregnancy-tests|calvings)/.test(path)) return "breeding.view";
  if (/^\/api\/cattle\/[^/]+\/(costs|pl-summary)/.test(path) || path.startsWith("/api/cattle-pl")) return match("finances");
  if (path.startsWith("/api/cattle")) return match("cattle");
  if (path.startsWith("/api/milk")) return match("milk");
  if (path.startsWith("/api/breeding")) return match("breeding");
  if (path.startsWith("/api/health") || path.startsWith("/api/vaccinations")) return match("health");
  if (path.startsWith("/api/feed")) return match("feed");
  if (path.startsWith("/api/inventory")) return match("inventory");
  if (path.startsWith("/api/expenses") || path.startsWith("/api/incomes") || path.startsWith("/api/finance")) return match("finances");
  if (path.startsWith("/api/byproduct")) return match("byproducts");
  if (path.startsWith("/api/tasks")) return match("tasks");
  if (path.startsWith("/api/alerts")) return write ? "alerts.view" : "alerts.view";
  return null;
}

// Resolve the user's tenant and enforce role permissions for every tenant-scoped route.
async function withTenant(req: any, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user.id;
    const selectedTenantId = isSuperAdminUser(req.user) ? req.session?.adminTenantId : undefined;
    if (selectedTenantId) {
      const selectedTenant = await storage.getTenantById(selectedTenantId);
      if (selectedTenant) {
        req.tenantId = selectedTenant.id;
        req.tenantRole = "super_admin";
        req.tenantPermissions = allTenantPermissions;
        return next();
      }
      delete req.session.adminTenantId;
    }
    let tenant = await storage.getTenantByOwnerId(userId);
    let role = "owner";
    let permissionOverrides: string[] = [];

    if (!tenant) {
      const membership = await storage.getTenantMemberByUserId(userId);
      if (membership) {
        if (!membership.isActive) return res.status(403).json({ error: "Your farm account has been deactivated" });
        tenant = await storage.getTenantById(membership.tenantId);
        role = membership.role;
        permissionOverrides = Array.isArray(membership.permissions) ? membership.permissions : [];
      }
    }
    
    if (!tenant) {
      // Create default tenant for new user
      const firstName = req.user.firstName || "My";
      const slugSuffix = `${userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6)}-${Date.now().toString(36)}`;
      tenant = await storage.createTenant({
        name: `${firstName}'s Farm`,
        slug: `farm-${slugSuffix}`,
        ownerId: userId,
        plan: "free",
        maxCattle: 2,
        isActive: true,
      });
    }

    if (!tenant.isActive && !isSuperAdminUser(req.user)) {
      return res.status(403).json({ error: "This DairyFlow tenant has been suspended. Contact the administrator." });
    }

    req.tenantId = tenant.id;
    req.tenantRole = role;
    req.tenantPermissions = effectivePermissions(role, permissionOverrides);
    const requiredPermission = permissionForRequest(req);
    if (requiredPermission && !req.tenantPermissions.includes(requiredPermission)) {
      return res.status(403).json({ error: `Your ${role} role does not have permission to perform this action` });
    }
    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

function isSuperAdminUser(user: Partial<AppUser> | undefined) {
  const configured = process.env.SUPER_ADMIN_EMAILS || "guglaniarjun";
  const allowed = configured.split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  return !!user?.email && allowed.includes(user.email.toLowerCase());
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isSuperAdminUser(req.user)) return res.status(403).json({ error: "Super Admin access required" });
  next();
}

function subscriptionPlanPayload(body: any, partial = false) {
  const payload: Record<string, unknown> = {};
  const textFields = ["name", "code", "priceMonthly"] as const;
  for (const field of textFields) {
    if (body[field] !== undefined) payload[field] = String(body[field]).trim();
  }
  if (body.priceYearly !== undefined) payload.priceYearly = body.priceYearly === null || body.priceYearly === "" ? null : String(body.priceYearly).trim();
  for (const field of ["maxCattle", "maxUsers", "sortOrder"] as const) {
    if (body[field] !== undefined) {
      const value = Number(body[field]);
      if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
      payload[field] = value;
    }
  }
  if (body.features !== undefined) {
    if (!Array.isArray(body.features)) throw new Error("features must be an array");
    payload.features = body.features.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 50);
  }
  if (body.isActive !== undefined) payload.isActive = body.isActive === true;
  if (!partial && (!payload.name || !payload.code || payload.maxCattle === undefined || payload.maxUsers === undefined || payload.priceMonthly === undefined)) {
    throw new Error("name, code, limits, and monthly price are required");
  }
  return payload;
}

const notificationRuleTypes = new Set(["birth_followup", "death", "milk_drop", "heat_due", "pregnancy_test_due", "vaccination_due", "low_stock", "cattle_parameter"]);

function normalizeNotificationRule(body: any, allowGlobalRecipients: boolean) {
  if (!notificationRuleTypes.has(body?.ruleType)) throw new Error("Invalid notification rule type");
  const offsetsDays = Array.from(new Set<number>((Array.isArray(body.offsetsDays) ? body.offsetsDays : [0]).map(Number)))
    .filter(value => Number.isInteger(value) && value >= -365 && value <= 365)
    .slice(0, 20);
  if (!offsetsDays.length) throw new Error("At least one valid day offset is required");
  const channels = (Array.isArray(body.channels) ? body.channels : ["app"]).filter((channel: string) => ["app", "whatsapp"].includes(channel));
  const recipientScope = body.recipientScope === "all_tenant_owners" && !allowGlobalRecipients ? "tenant_owner" : (["tenant_owner", "custom", "all_tenant_owners"].includes(body.recipientScope) ? body.recipientScope : "tenant_owner");
  const customRecipients = (Array.isArray(body.customRecipients) ? body.customRecipients : [])
    .map((phone: unknown) => String(phone).trim()).filter(Boolean).slice(0, 50);
  return {
    name: String(body.name || body.ruleType).trim().slice(0, 120),
    ruleType: body.ruleType,
    isEnabled: body.isEnabled !== false,
    offsetsDays,
    daysBeforeEvent: offsetsDays[0],
    cattleId: body.cattleId || null,
    cattleStage: body.cattleStage || null,
    conditions: typeof body.conditions === "object" && body.conditions ? body.conditions : {},
    severity: ["info", "warning", "critical"].includes(body.severity) ? body.severity : "warning",
    channels: channels.length ? channels : ["app"],
    recipientScope,
    customRecipients,
    messageTemplate: body.messageTemplate ? String(body.messageTemplate).slice(0, 2000) : null,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // =====================================================
  // AUTH ROUTES
  // =====================================================

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const { passwordHash, ...safeUser } = req.user as any;
      const isSuperAdmin = isSuperAdminUser(req.user);
      const actingTenant = isSuperAdmin && req.session?.adminTenantId
        ? await storage.getTenantById(req.session.adminTenantId)
        : undefined;
      const actingFarmProfile = actingTenant ? await storage.getFarmSettings(actingTenant.id) : undefined;
      const ownedTenant = !actingTenant ? await storage.getTenantByOwnerId(req.user.id) : undefined;
      const membership = !actingTenant && !ownedTenant ? await storage.getTenantMemberByUserId(req.user.id) : undefined;
      const tenantRole = actingTenant ? "super_admin" : ownedTenant ? "owner" : membership?.role || null;
      const tenantPermissions = tenantRole
        ? (tenantRole === "super_admin" ? allTenantPermissions : effectivePermissions(tenantRole, membership?.permissions as string[] | undefined))
        : [];
      res.json({
        ...safeUser,
        isSuperAdmin,
        actingTenantId: actingTenant?.id || null,
        actingTenantName: actingFarmProfile?.farmName?.trim() || actingTenant?.name || null,
        tenantId: actingTenant?.id || ownedTenant?.id || membership?.tenantId || null,
        tenantRole,
        tenantPermissions,
      });
    } catch (error) {
      console.error("Auth user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =====================================================
  // DASHBOARD ROUTES
  // =====================================================

  app.get("/api/dashboard/stats", isAuthenticated, withTenant, async (req, res) => {
    try {
      // Fire smart alert generation without blocking stats response
      storage.generateSmartAlerts(req.tenantId!).catch(e => console.warn("Alert gen error:", e));
      const stats = await storage.getDashboardStats(req.tenantId!);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // =====================================================
  // BREEDS (Master Data)
  // =====================================================

  app.get("/api/breeds", async (req, res) => {
    try {
      const breeds = await storage.getAllBreeds();
      res.json(breeds);
    } catch (error) {
      console.error("Breeds fetch error:", error);
      res.status(500).json({ error: "Failed to fetch breeds" });
    }
  });

  app.get("/api/vaccines", async (req, res) => {
    try {
      const vaccines = await storage.getAllVaccines();
      res.json(vaccines);
    } catch (error) {
      console.error("Vaccines fetch error:", error);
      res.status(500).json({ error: "Failed to fetch vaccines" });
    }
  });

  app.get("/api/feed-items", async (req, res) => {
    try {
      const feedItems = await storage.getAllFeedItems();
      res.json(feedItems);
    } catch (error) {
      console.error("Feed items fetch error:", error);
      res.status(500).json({ error: "Failed to fetch feed items" });
    }
  });

  app.get("/api/expense-heads", async (req, res) => {
    try {
      const heads = await storage.getAllExpenseHeads();
      res.json(heads);
    } catch (error) {
      console.error("Expense heads fetch error:", error);
      res.status(500).json({ error: "Failed to fetch expense heads" });
    }
  });

  app.get("/api/income-heads", async (req, res) => {
    try {
      const heads = await storage.getAllIncomeHeads();
      res.json(heads);
    } catch (error) {
      console.error("Income heads fetch error:", error);
      res.status(500).json({ error: "Failed to fetch income heads" });
    }
  });

  app.get("/api/inventory-categories", async (req, res) => {
    try {
      const categories = await storage.getAllInventoryCategories();
      res.json(categories);
    } catch (error) {
      console.error("Inventory categories fetch error:", error);
      res.status(500).json({ error: "Failed to fetch inventory categories" });
    }
  });

  // =====================================================
  // CATTLE ROUTES
  // =====================================================

  app.get("/api/cattle", isAuthenticated, withTenant, async (req, res) => {
    try {
      const cattleList = await storage.getCattleByTenant(req.tenantId!);
      res.json(cattleList);
    } catch (error) {
      console.error("Cattle fetch error:", error);
      res.status(500).json({ error: "Failed to fetch cattle" });
    }
  });

  app.get("/api/cattle/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const cattle = await storage.getCattleById(routeParam(req.params.id));
      if (!cattle || cattle.tenantId !== req.tenantId) {
        return res.status(404).json({ error: "Cattle not found" });
      }
      res.json(cattle);
    } catch (error) {
      console.error("Cattle fetch error:", error);
      res.status(500).json({ error: "Failed to fetch cattle" });
    }
  });

  app.post("/api/cattle", isAuthenticated, withTenant, async (req, res) => {
    try {
      const tenant = await storage.getTenantById(req.tenantId!);
      const activeCattle = (await storage.getCattleByTenant(req.tenantId!)).filter(item => item.status === "active").length;
      if (req.body.status !== "sold" && req.body.status !== "dead" && req.body.status !== "culled" && tenant && activeCattle >= tenant.maxCattle) {
        return res.status(409).json({ error: `This tenant has reached its ${tenant.maxCattle}-cattle plan limit` });
      }
      const cattle = await storage.createCattle({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.status(201).json(cattle);
    } catch (error) {
      console.error("Cattle create error:", error);
      res.status(500).json({ error: "Failed to create cattle" });
    }
  });

  app.patch("/api/cattle/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const existing = await storage.getCattleById(routeParam(req.params.id));
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ error: "Cattle not found" });
      }
      if (req.body.status === "active" && existing.status !== "active") {
        const tenant = await storage.getTenantById(req.tenantId!);
        const activeCattle = (await storage.getCattleByTenant(req.tenantId!)).filter(item => item.status === "active").length;
        if (tenant && activeCattle >= tenant.maxCattle) {
          return res.status(409).json({ error: `This tenant has reached its ${tenant.maxCattle}-cattle plan limit` });
        }
      }
      const updated = await storage.updateCattle(routeParam(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      console.error("Cattle update error:", error);
      res.status(500).json({ error: "Failed to update cattle" });
    }
  });

  // =====================================================
  // MILK ROUTES
  // =====================================================

  app.get("/api/milk", isAuthenticated, withTenant, async (req, res) => {
    try {
      const entries = await storage.getMilkEntriesByTenant(req.tenantId!);
      res.json(entries);
    } catch (error) {
      console.error("Milk fetch error:", error);
      res.status(500).json({ error: "Failed to fetch milk entries" });
    }
  });

  app.post("/api/milk", isAuthenticated, withTenant, async (req, res) => {
    try {
      const entry = await storage.createMilkEntry({
        ...req.body,
        tenantId: req.tenantId,
        recordedBy: req.user!.id,
      });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Milk create error:", error);
      res.status(500).json({ error: "Failed to create milk entry" });
    }
  });

  // =====================================================
  // HEALTH ROUTES
  // =====================================================

  app.get("/api/health", isAuthenticated, withTenant, async (req, res) => {
    try {
      const events = await storage.getHealthEventsByTenant(req.tenantId!);
      res.json(events);
    } catch (error) {
      console.error("Health fetch error:", error);
      res.status(500).json({ error: "Failed to fetch health events" });
    }
  });

  app.post("/api/health", isAuthenticated, withTenant, async (req, res) => {
    try {
      const event = await storage.createHealthEvent({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.status(201).json(event);
    } catch (error) {
      console.error("Health create error:", error);
      res.status(500).json({ error: "Failed to create health event" });
    }
  });

  app.patch("/api/health/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const existing = (await storage.getHealthEventsByTenant(req.tenantId!)).find(item => item.id === id);
      if (!existing) return res.status(404).json({ error: "Health event not found" });
      const updated = await storage.updateHealthEvent(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Health update error:", error);
      res.status(500).json({ error: "Failed to update health event" });
    }
  });

  // =====================================================
  // TASKS ROUTES
  // =====================================================

  app.get("/api/tasks", isAuthenticated, withTenant, async (req, res) => {
    try {
      const tasksList = await storage.getTasksByTenant(req.tenantId!);
      res.json(tasksList);
    } catch (error) {
      console.error("Tasks fetch error:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", isAuthenticated, withTenant, async (req, res) => {
    try {
      const task = await storage.createTask({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.status(201).json(task);
    } catch (error) {
      console.error("Task create error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const existing = (await storage.getTasksByTenant(req.tenantId!)).find(item => item.id === id);
      if (!existing) return res.status(404).json({ error: "Task not found" });
      const updated = await storage.updateTask(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Task update error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // =====================================================
  // ALERTS ROUTES
  // =====================================================

  app.get("/api/alerts", isAuthenticated, withTenant, async (req, res) => {
    try {
      const alertsList = await storage.getAlertsByTenant(req.tenantId!);
      res.json(alertsList);
    } catch (error) {
      console.error("Alerts fetch error:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.patch("/api/alerts/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const id = routeParam(req.params.id);
      const existing = (await storage.getAlertsByTenant(req.tenantId!)).find(item => item.id === id);
      if (!existing) return res.status(404).json({ error: "Alert not found" });
      const updated = await storage.updateAlert(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Alert update error:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  // =====================================================
  // FINANCIAL ROUTES
  // =====================================================

  app.get("/api/expenses", isAuthenticated, withTenant, async (req, res) => {
    try {
      const expensesList = await storage.getExpensesByTenant(req.tenantId!);
      res.json(expensesList);
    } catch (error) {
      console.error("Expenses fetch error:", error);
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", isAuthenticated, withTenant, async (req, res) => {
    try {
      const expense = await storage.createExpense({
        ...req.body,
        tenantId: req.tenantId,
        recordedBy: req.user!.id,
      });
      res.status(201).json(expense);
    } catch (error) {
      console.error("Expense create error:", error);
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.get("/api/incomes", isAuthenticated, withTenant, async (req, res) => {
    try {
      const incomesList = await storage.getIncomesByTenant(req.tenantId!);
      res.json(incomesList);
    } catch (error) {
      console.error("Incomes fetch error:", error);
      res.status(500).json({ error: "Failed to fetch incomes" });
    }
  });

  app.post("/api/incomes", isAuthenticated, withTenant, async (req, res) => {
    try {
      const income = await storage.createIncome({
        ...req.body,
        tenantId: req.tenantId,
        recordedBy: req.user!.id,
      });
      res.status(201).json(income);
    } catch (error) {
      console.error("Income create error:", error);
      res.status(500).json({ error: "Failed to create income" });
    }
  });

  // =====================================================
  // INVENTORY ROUTES
  // =====================================================

  app.get("/api/inventory", isAuthenticated, withTenant, async (req, res) => {
    try {
      const items = await storage.getInventoryItemsByTenant(req.tenantId!);
      res.json(items);
    } catch (error) {
      console.error("Inventory fetch error:", error);
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.post("/api/inventory", isAuthenticated, withTenant, async (req, res) => {
    try {
      const item = await storage.createInventoryItem({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Inventory create error:", error);
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.get("/api/inventory/transactions", isAuthenticated, withTenant, async (req, res) => {
    try {
      const txns = await storage.getInventoryTransactionsByTenant(req.tenantId!);
      res.json(txns);
    } catch (error) {
      console.error("Inventory transactions fetch error:", error);
      res.status(500).json({ error: "Failed to fetch inventory transactions" });
    }
  });

  app.post("/api/inventory/transactions", isAuthenticated, withTenant, async (req, res) => {
    try {
      const txn = await storage.createInventoryTransaction({
        ...req.body,
        tenantId: req.tenantId,
        recordedBy: req.user?.id,
      });
      res.status(201).json(txn);
    } catch (error) {
      console.error("Inventory transaction create error:", error);
      res.status(500).json({ error: "Failed to create inventory transaction" });
    }
  });

  // =====================================================
  // FEED ROUTES
  // =====================================================

  app.get("/api/feed/items", async (req, res) => {
    try {
      const items = await storage.getAllFeedItems();
      res.json(items);
    } catch (error) {
      console.error("Feed items fetch error:", error);
      res.status(500).json({ error: "Failed to fetch feed items" });
    }
  });

  app.get("/api/feed/inventory", isAuthenticated, withTenant, async (req, res) => {
    try {
      const inventory = await storage.getFeedInventoryByTenant(req.tenantId!);
      res.json(inventory);
    } catch (error) {
      console.error("Feed inventory fetch error:", error);
      res.status(500).json({ error: "Failed to fetch feed inventory" });
    }
  });

  app.get("/api/feed/records", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getFeedingRecordsByTenant(req.tenantId!);
      res.json(records);
    } catch (error) {
      console.error("Feed records fetch error:", error);
      res.status(500).json({ error: "Failed to fetch feeding records" });
    }
  });

  app.post("/api/feed/records", isAuthenticated, withTenant, async (req, res) => {
    try {
      const record = await storage.createFeedingRecord({
        ...req.body,
        tenantId: req.tenantId,
        recordedBy: req.user!.id,
      });
      res.status(201).json(record);
    } catch (error) {
      console.error("Feed record create error:", error);
      res.status(500).json({ error: "Failed to create feeding record" });
    }
  });

  // =====================================================
  // BREEDING ROUTES
  // =====================================================

  app.get("/api/breeding/heats", isAuthenticated, withTenant, async (req, res) => {
    try {
      const heatsList = await storage.getHeatsByTenant(req.tenantId!);
      res.json(heatsList);
    } catch (error) {
      console.error("Heats fetch error:", error);
      res.status(500).json({ error: "Failed to fetch heats" });
    }
  });

  app.post("/api/breeding/heats", isAuthenticated, withTenant, async (req, res) => {
    try {
      const heat = await storage.createHeat({
        ...req.body,
        tenantId: req.tenantId,
        detectedBy: req.user!.id,
        detectedAt: new Date(req.body.detectedAt),
      });
      res.status(201).json(heat);
    } catch (error) {
      console.error("Heat create error:", error);
      res.status(500).json({ error: "Failed to create heat record" });
    }
  });

  app.get("/api/breeding/inseminations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const inseminationsList = await storage.getInseminationsByTenant(req.tenantId!);
      res.json(inseminationsList);
    } catch (error) {
      console.error("Inseminations fetch error:", error);
      res.status(500).json({ error: "Failed to fetch inseminations" });
    }
  });

  app.post("/api/breeding/inseminations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const insemination = await storage.createInsemination({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.status(201).json(insemination);
    } catch (error) {
      console.error("Insemination create error:", error);
      res.status(500).json({ error: "Failed to create insemination record" });
    }
  });

  app.get("/api/breeding/pregnancy-tests", isAuthenticated, withTenant, async (req, res) => {
    try {
      const tests = await storage.getPregnancyTestsByTenant(req.tenantId!);
      res.json(tests);
    } catch (error) {
      console.error("Pregnancy tests fetch error:", error);
      res.status(500).json({ error: "Failed to fetch pregnancy tests" });
    }
  });

  // =====================================================
  // SUPER ADMIN CONTROL CENTRE
  // =====================================================

  app.get("/api/admin/overview", isAuthenticated, requireSuperAdmin, async (_req, res) => {
    try {
      const tenantRows = await storage.getAllTenants();
      const tenantsWithUsage = await Promise.all(tenantRows.map(async tenant => {
        const [owner, cattleRows, memberCount, subscription, farmProfile] = await Promise.all([
          storage.getUser(tenant.ownerId),
          storage.getCattleByTenant(tenant.id),
          storage.getTenantMemberCount(tenant.id),
          storage.getTenantSubscription(tenant.id),
          storage.getFarmSettings(tenant.id),
        ]);
        return {
          ...tenant,
          name: farmProfile?.farmName?.trim() || tenant.name,
          address: farmProfile?.address ?? tenant.address,
          phone: farmProfile?.phone ?? tenant.phone,
          owner: owner ? { id: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName } : null,
          cattleCount: cattleRows.length,
          activeCattleCount: cattleRows.filter(item => item.status === "active").length,
          memberCount,
          subscriptionStatus: subscription?.status || null,
        };
      }));
      res.json({
        summary: {
          totalTenants: tenantRows.length,
          activeTenants: tenantRows.filter(item => item.isActive).length,
          totalCattle: tenantsWithUsage.reduce((sum, item) => sum + item.cattleCount, 0),
          paidTenants: tenantRows.filter(item => !["free", "demo"].includes(item.plan)).length,
        },
        tenants: tenantsWithUsage,
      });
    } catch (error) {
      console.error("Super admin overview error:", error);
      res.status(500).json({ error: "Failed to load the control centre" });
    }
  });

  // =====================================================
  // FARM TEAM & ROLE MANAGEMENT
  // =====================================================

  app.get("/api/team", isAuthenticated, withTenant, async (req, res) => {
    try {
      const tenant = await storage.getTenantById(req.tenantId!);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const [owner, memberRows, plan] = await Promise.all([
        storage.getUser(tenant.ownerId),
        storage.getTenantMembersWithUsers(tenant.id),
        storage.getSubscriptionPlanByCode(tenant.plan),
      ]);
      const members = memberRows
        .filter(row => row.user.id !== tenant.ownerId)
        .map(row => ({
          id: row.membership.id,
          userId: row.user.id,
          email: row.user.email,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          role: row.membership.role,
          permissions: row.membership.permissions || [],
          effectivePermissions: effectivePermissions(row.membership.role, row.membership.permissions),
          isActive: row.membership.isActive,
          createdAt: row.membership.createdAt,
          isOwner: false,
        }));
      res.json({
        owner: owner ? { id: `owner-${owner.id}`, userId: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName, role: "owner", permissions: allTenantPermissions, effectivePermissions: allTenantPermissions, isActive: true, isOwner: true } : null,
        members,
        usage: { current: 1 + members.filter(item => item.isActive).length, limit: plan?.maxUsers || 5, plan: plan?.name || tenant.plan },
      });
    } catch (error) {
      console.error("Team fetch error:", error);
      res.status(500).json({ error: "Failed to load farm users" });
    }
  });

  app.post("/api/team", isAuthenticated, withTenant, async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const role = String(req.body.role || "worker");
      const password = String(req.body.password || "");
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "A valid email address is required" });
      if (!tenantRoles.includes(role as any)) return res.status(400).json({ error: "Invalid farm role" });

      const tenant = await storage.getTenantById(req.tenantId!);
      const plan = tenant ? await storage.getSubscriptionPlanByCode(tenant.plan) : undefined;
      const currentUsers = await storage.getTenantMemberCount(req.tenantId!);
      const userLimit = plan?.maxUsers || 5;
      if (currentUsers >= userLimit) return res.status(409).json({ error: `The ${plan?.name || tenant?.plan || "current"} plan allows ${userLimit} users` });

      let user = await authStorage.getUserByEmail(email);
      if (user) {
        const [ownedTenant, existingMembership] = await Promise.all([
          storage.getTenantByOwnerId(user.id),
          storage.getTenantMemberByUserId(user.id),
        ]);
        if (ownedTenant || existingMembership) return res.status(409).json({ error: "This email already belongs to a DairyFlow farm" });
      } else {
        if (password.length < 8) return res.status(400).json({ error: "A temporary password of at least 8 characters is required" });
        user = await authStorage.createUser({
          id: crypto.randomUUID(),
          email,
          firstName: String(req.body.firstName || "").trim() || null,
          lastName: String(req.body.lastName || "").trim() || null,
          passwordHash: await bcrypt.hash(password, 12),
        });
      }

      const requestedPermissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
      const permissions = requestedPermissions.filter((item: unknown) => allTenantPermissions.includes(String(item) as TenantPermission));
      const membership = await storage.createTenantMember({ tenantId: req.tenantId, userId: user.id, role, permissions, isActive: true });
      res.status(201).json({ id: membership.id, userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role, permissions, effectivePermissions: effectivePermissions(role, permissions), isActive: true });
    } catch (error) {
      console.error("Team create error:", error);
      res.status(500).json({ error: "Failed to create farm user" });
    }
  });

  app.patch("/api/team/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const membership = await storage.getTenantMemberById(routeParam(req.params.id));
      if (!membership || membership.tenantId !== req.tenantId) return res.status(404).json({ error: "Farm user not found" });
      const updates: Record<string, unknown> = {};
      if (req.body.role !== undefined) {
        if (!tenantRoles.includes(req.body.role)) return res.status(400).json({ error: "Invalid farm role" });
        updates.role = req.body.role;
      }
      if (req.body.permissions !== undefined) {
        if (!Array.isArray(req.body.permissions)) return res.status(400).json({ error: "Permissions must be an array" });
        updates.permissions = req.body.permissions.filter((item: unknown) => allTenantPermissions.includes(String(item) as TenantPermission));
      }
      if (req.body.isActive !== undefined) {
        if (req.body.isActive === true && !membership.isActive) {
          const tenant = await storage.getTenantById(req.tenantId!);
          const plan = tenant ? await storage.getSubscriptionPlanByCode(tenant.plan) : undefined;
          const userLimit = plan?.maxUsers || 5;
          if (await storage.getTenantMemberCount(req.tenantId!) >= userLimit) return res.status(409).json({ error: `The current plan allows ${userLimit} users` });
        }
        updates.isActive = req.body.isActive === true;
      }
      if (req.body.firstName !== undefined || req.body.lastName !== undefined) {
        await authStorage.updateUser(membership.userId, {
          ...(req.body.firstName !== undefined ? { firstName: String(req.body.firstName).trim() || null } : {}),
          ...(req.body.lastName !== undefined ? { lastName: String(req.body.lastName).trim() || null } : {}),
        });
      }
      res.json(await storage.updateTenantMember(membership.id, updates));
    } catch (error) {
      console.error("Team update error:", error);
      res.status(500).json({ error: "Failed to update farm user" });
    }
  });

  app.post("/api/team/:id/reset-password", isAuthenticated, withTenant, async (req, res) => {
    try {
      const membership = await storage.getTenantMemberById(routeParam(req.params.id));
      if (!membership || membership.tenantId !== req.tenantId) return res.status(404).json({ error: "Farm user not found" });
      const password = String(req.body.password || "");
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      await authStorage.updateUser(membership.userId, { passwordHash: await bcrypt.hash(password, 12) });
      res.status(204).end();
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/admin/tenants/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenant = await storage.getTenantById(routeParam(req.params.id));
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      const [owner, subscription, stats, settings, farmProfile] = await Promise.all([
        storage.getUser(tenant.ownerId),
        storage.getTenantSubscription(tenant.id),
        storage.getDashboardStats(tenant.id),
        storage.getTenantSettings(tenant.id),
        storage.getFarmSettings(tenant.id),
      ]);
      res.json({
        tenant: {
          ...tenant,
          name: farmProfile?.farmName?.trim() || tenant.name,
          address: farmProfile?.address ?? tenant.address,
          phone: farmProfile?.phone ?? tenant.phone,
        },
        owner: owner ? { id: owner.id, email: owner.email, firstName: owner.firstName, lastName: owner.lastName } : null,
        subscription,
        stats,
        settings,
        farmProfile,
      });
    } catch (error) {
      console.error("Super admin tenant detail error:", error);
      res.status(500).json({ error: "Failed to load tenant" });
    }
  });

  app.patch("/api/admin/tenants/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenantId = routeParam(req.params.id);
      const existing = await storage.getTenantById(tenantId);
      if (!existing) return res.status(404).json({ error: "Tenant not found" });

      const allowed: Record<string, unknown> = {};
      for (const field of ["name", "address", "phone", "language"] as const) {
        if (req.body[field] !== undefined) allowed[field] = req.body[field] === null ? null : String(req.body[field]).trim();
      }
      if (req.body.isActive !== undefined) allowed.isActive = req.body.isActive === true;
      if (req.body.planExpiresAt !== undefined) {
        allowed.planExpiresAt = req.body.planExpiresAt ? new Date(req.body.planExpiresAt) : null;
      }
      if (req.body.maxCattle !== undefined) {
        const maxCattle = Number(req.body.maxCattle);
        if (!Number.isInteger(maxCattle) || maxCattle < 0) return res.status(400).json({ error: "Invalid cattle limit" });
        allowed.maxCattle = maxCattle;
      }
      if (req.body.plan !== undefined) {
        const plan = await storage.getSubscriptionPlanByCode(String(req.body.plan));
        if (!plan) return res.status(400).json({ error: "Unknown subscription plan" });
        allowed.plan = plan.code;
        allowed.maxCattle = plan.maxCattle;
      }
      const updated = await storage.updateTenant(tenantId, allowed);
      res.json(updated);
    } catch (error) {
      console.error("Super admin tenant update error:", error);
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  app.post("/api/admin/tenants/:id/access", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    const tenant = await storage.getTenantById(routeParam(req.params.id));
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    req.session.adminTenantId = tenant.id;
    res.json({ tenantId: tenant.id, tenantName: tenant.name });
  });

  app.delete("/api/admin/tenant-access", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    delete req.session.adminTenantId;
    res.status(204).end();
  });

  app.get("/api/admin/subscription-plans", isAuthenticated, requireSuperAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllSubscriptionPlansForAdmin());
    } catch (error) {
      res.status(500).json({ error: "Failed to load subscription plans" });
    }
  });

  app.post("/api/admin/subscription-plans", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const plan = await storage.createSubscriptionPlan(subscriptionPlanPayload(req.body) as any);
      res.status(201).json(plan);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to create subscription plan" });
    }
  });

  app.patch("/api/admin/subscription-plans/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const payload = subscriptionPlanPayload(req.body, true);
      // Plan codes are stable identifiers referenced by tenant records.
      delete payload.code;
      const plan = await storage.updateSubscriptionPlan(routeParam(req.params.id), payload as any);
      if (!plan) return res.status(404).json({ error: "Subscription plan not found" });
      res.json(plan);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to update subscription plan" });
    }
  });

  // =====================================================
  // SYSTEM SETTINGS (Super Admin - Storage Config)
  // =====================================================

  app.get("/api/admin/system-settings", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      // Mask secret values
      const masked = settings.map(s => ({
        ...s,
        value: s.isSecret ? "********" : s.value
      }));
      res.json(masked);
    } catch (error) {
      console.error("System settings fetch error:", error);
      res.status(500).json({ error: "Failed to fetch system settings" });
    }
  });

  app.post("/api/admin/system-settings", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { key, value, isSecret } = req.body;
      if (!key) {
        return res.status(400).json({ error: "Key is required" });
      }
      const setting = await storage.setSystemSetting(key, value, isSecret);
      res.json({ ...setting, value: isSecret ? "********" : setting.value });
    } catch (error) {
      console.error("System settings save error:", error);
      res.status(500).json({ error: "Failed to save system setting" });
    }
  });

  // Get storage config (for client to know if storage is configured)
  app.get("/api/admin/storage-config", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const provider = await storage.getSystemSetting("storage_provider");
      const bucket = await storage.getSystemSetting("storage_bucket");
      res.json({
        configured: !!(provider?.value && provider.value !== "none" && bucket?.value),
        provider: provider?.value || "none"
      });
    } catch (error) {
      res.json({ configured: false, provider: "none" });
    }
  });

  // =====================================================
  // TENANT SETTINGS
  // =====================================================

  app.get("/api/settings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const settings = await storage.getTenantSettings(req.tenantId!);
      res.json(settings || { accountingMode: "simple", byproductInventoryEnabled: false });
    } catch (error) {
      console.error("Tenant settings fetch error:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const settings = await storage.upsertTenantSettings({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.json(settings);
    } catch (error) {
      console.error("Tenant settings update error:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // =====================================================
  // BYPRODUCT TYPES (Master Data)
  // =====================================================

  app.get("/api/byproduct-types", async (req, res) => {
    try {
      const types = await storage.getAllByproductTypes();
      res.json(types);
    } catch (error) {
      console.error("Byproduct types fetch error:", error);
      res.status(500).json({ error: "Failed to fetch byproduct types" });
    }
  });

  // =====================================================
  // CATTLE TRANSACTIONS (Purchase & Sale)
  // =====================================================

  app.get("/api/cattle-transactions", isAuthenticated, withTenant, async (req, res) => {
    try {
      const transactions = await storage.getCattleTransactionsByTenant(req.tenantId!);
      res.json(transactions);
    } catch (error) {
      console.error("Cattle transactions fetch error:", error);
      res.status(500).json({ error: "Failed to fetch cattle transactions" });
    }
  });

  app.post("/api/cattle-transactions", isAuthenticated, withTenant, async (req, res) => {
    try {
      const transaction = await storage.createCattleTransaction({
        ...req.body,
        tenantId: req.tenantId,
        createdBy: req.user!.id,
      });
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Cattle transaction create error:", error);
      res.status(500).json({ error: "Failed to create cattle transaction" });
    }
  });

  app.get("/api/cattle-transactions/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const transaction = await storage.getCattleTransactionById(routeParam(req.params.id));
      if (!transaction || transaction.tenantId !== req.tenantId) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Cattle transaction fetch error:", error);
      res.status(500).json({ error: "Failed to fetch cattle transaction" });
    }
  });

  // Cattle Payments
  app.get("/api/cattle-transactions/:id/payments", isAuthenticated, withTenant, async (req, res) => {
    try {
      const payments = await storage.getCattlePaymentsByTransaction(routeParam(req.params.id));
      res.json(payments);
    } catch (error) {
      console.error("Cattle payments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/cattle-transactions/:id/payments", isAuthenticated, withTenant, async (req, res) => {
    try {
      const payment = await storage.createCattlePayment({
        ...req.body,
        transactionId: req.params.id,
        tenantId: req.tenantId,
        createdBy: req.user!.id,
      });
      
      // Update transaction paid amount
      const transaction = await storage.getCattleTransactionById(routeParam(req.params.id));
      if (transaction) {
        const payments = await storage.getCattlePaymentsByTransaction(routeParam(req.params.id));
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const status = totalPaid >= Number(transaction.amount) ? "paid" : "partial";
        await storage.updateCattleTransaction(routeParam(req.params.id), {
          paidAmount: totalPaid.toString(),
          paymentStatus: status,
        });
      }
      
      res.status(201).json(payment);
    } catch (error) {
      console.error("Cattle payment create error:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // =====================================================
  // CATTLE COSTS AND P/L
  // =====================================================

  // Get P/L data for all cattle (for P/L dashboard)
  app.get("/api/cattle-pl", isAuthenticated, withTenant, async (req, res) => {
    try {
      const cattle = await storage.getCattleByTenant(req.tenantId!);
      const transactions = await storage.getCattleTransactionsByTenant(req.tenantId!);
      
      const plData = await Promise.all(cattle.map(async (cow) => {
        const purchaseTransaction = transactions.find(t => t.cattleId === cow.id && t.type === "purchase");
        const purchaseCost = Number(purchaseTransaction?.amount || 0);
        
        const saleTransaction = transactions.find(t => t.cattleId === cow.id && t.type === "sale");
        const saleAmount = Number(saleTransaction?.amount || 0);
        
        const costs = await storage.getCattleCostsByCattle(cow.id);
        const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount || 0), 0);
        
        const milkRevenue = 0;
        
        const totalInvestment = purchaseCost + totalCosts;
        const totalReturns = saleAmount + milkRevenue;
        const profitLoss = cow.status === "sold" ? totalReturns - totalInvestment : null;
        const unrealizedPL = cow.status !== "sold" ? milkRevenue - totalInvestment : null;
        
        return {
          id: cow.id,
          tagNumber: cow.tagNumber,
          name: cow.name,
          status: cow.status,
          stage: cow.stage,
          purchaseCost,
          totalCosts,
          milkRevenue,
          saleAmount,
          totalInvestment,
          profitLoss,
          unrealizedPL,
          purchaseDate: purchaseTransaction?.date,
          saleDate: saleTransaction?.date,
        };
      }));
      
      res.json(plData);
    } catch (error) {
      console.error("Cattle P/L fetch error:", error);
      res.status(500).json({ error: "Failed to fetch cattle P/L data" });
    }
  });

  // Get P/L summary for a cattle (for sale form)
  app.get("/api/cattle/:id/pl-summary", isAuthenticated, withTenant, async (req, res) => {
    try {
      const cattleId = routeParam(req.params.id);
      
      // Get purchase cost from cattle transactions
      const transactions = await storage.getCattleTransactionsByTenant(req.tenantId!);
      const purchaseTransaction = transactions.find(t => t.cattleId === cattleId && t.type === "purchase");
      const purchaseCost = purchaseTransaction?.amount || "0";
      
      // Get total costs from cattle_costs table
      const costs = await storage.getCattleCostsByCattle(cattleId);
      const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount || 0), 0).toString();
      
      // For now, milk revenue is 0 as we don't have per-cow milk price tracking
      // In future, can be calculated as sum of (quantity * price per liter)
      const milkRevenue = "0";
      
      res.json({
        purchaseCost,
        totalCosts,
        milkRevenue,
      });
    } catch (error) {
      console.error("Cattle P/L summary error:", error);
      res.status(500).json({ error: "Failed to fetch P/L summary" });
    }
  });

  app.get("/api/cattle/:id/costs", isAuthenticated, withTenant, async (req, res) => {
    try {
      const costs = await storage.getCattleCostsByCattle(routeParam(req.params.id));
      res.json(costs);
    } catch (error) {
      console.error("Cattle costs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch cattle costs" });
    }
  });

  app.post("/api/cattle/:id/costs", isAuthenticated, withTenant, async (req, res) => {
    try {
      const cost = await storage.createCattleCost({
        ...req.body,
        cattleId: req.params.id,
        tenantId: req.tenantId,
        createdBy: req.user!.id,
      });
      res.status(201).json(cost);
    } catch (error) {
      console.error("Cattle cost create error:", error);
      res.status(500).json({ error: "Failed to create cattle cost" });
    }
  });

  // =====================================================
  // BYPRODUCT TRANSACTIONS
  // =====================================================

  app.get("/api/byproduct-transactions", isAuthenticated, withTenant, async (req, res) => {
    try {
      const transactions = await storage.getByproductTransactionsByTenant(req.tenantId!);
      res.json(transactions);
    } catch (error) {
      console.error("Byproduct transactions fetch error:", error);
      res.status(500).json({ error: "Failed to fetch byproduct transactions" });
    }
  });

  app.post("/api/byproduct-transactions", isAuthenticated, withTenant, async (req, res) => {
    try {
      const transaction = await storage.createByproductTransaction({
        ...req.body,
        tenantId: req.tenantId,
        createdBy: req.user!.id,
      });
      
      // Update inventory if enabled
      if (req.body.updateInventory) {
        const currentInv = await storage.getByproductInventoryByTenant(req.tenantId!);
        const existing = currentInv.find(i => i.byproductTypeId === req.body.byproductTypeId);
        const currentStock = Number(existing?.currentStock || 0);
        const qty = Number(req.body.quantity);
        const newStock = req.body.type === "purchase" ? currentStock + qty : currentStock - qty;
        
        await storage.upsertByproductInventory({
          tenantId: req.tenantId,
          byproductTypeId: req.body.byproductTypeId,
          currentStock: Math.max(0, newStock).toString(),
        });
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Byproduct transaction create error:", error);
      res.status(500).json({ error: "Failed to create byproduct transaction" });
    }
  });

  // =====================================================
  // BYPRODUCT INVENTORY
  // =====================================================

  app.get("/api/byproduct-inventory", isAuthenticated, withTenant, async (req, res) => {
    try {
      const inventory = await storage.getByproductInventoryByTenant(req.tenantId!);
      res.json(inventory);
    } catch (error) {
      console.error("Byproduct inventory fetch error:", error);
      res.status(500).json({ error: "Failed to fetch byproduct inventory" });
    }
  });

  // =====================================================
  // ATTACHMENTS
  // =====================================================

  // Upload attachment
  app.post("/api/attachments", isAuthenticated, withTenant, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { entityType, entityId } = req.body;
      
      if (!entityType || !entityId) {
        return res.status(400).json({ error: "entityType and entityId are required" });
      }
      
      // Validate entityType
      const validEntityTypes = ["cattle", "milk_record", "milk_entry", "health_record", "breeding_record", "heat_record", "cattle_transaction", "byproduct_transaction"];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type" });
      }

      const { storageKey } = await uploadFile(req.file, req.tenantId!);
      
      const attachment = await storage.createAttachment({
        id: crypto.randomUUID(),
        tenantId: req.tenantId,
        fileName: req.file.originalname,
        fileType: getFileType(req.file.mimetype),
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storageKey: storageKey,
        originalName: req.file.originalname,
        uploadedBy: (req as any).user.id,
      });

      // Create link to entity
      await storage.createAttachmentLink({
        attachmentId: attachment.id,
        entityType,
        entityId,
      });

      res.status(201).json(attachment);
    } catch (error: any) {
      console.error("Attachment upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload attachment" });
    }
  });

  // Get attachments for entity
  app.get("/api/attachments/:entityType/:entityId", isAuthenticated, withTenant, async (req, res) => {
    try {
      const entityType = routeParam(req.params.entityType);
      const entityId = routeParam(req.params.entityId);
      
      // Validate entityType
      const validEntityTypes = ["cattle", "milk_record", "milk_entry", "health_record", "breeding_record", "heat_record", "cattle_transaction", "byproduct_transaction"];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      
      const attachments = await storage.getAttachmentsByEntity(entityType, entityId);
      // Filter to only return attachments belonging to this tenant
      const tenantAttachments = attachments.filter(a => a.tenantId === req.tenantId);
      res.json(tenantAttachments);
    } catch (error) {
      console.error("Attachments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  // Delete attachment
  app.delete("/api/attachments/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const attachment = await storage.getAttachmentById(routeParam(req.params.id));
      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      // Verify tenant ownership
      if (attachment.tenantId !== req.tenantId) {
        return res.status(403).json({ error: "Not authorized to delete this attachment" });
      }

      // Delete from storage
      if (attachment.storageKey) {
        await deleteFile(attachment.storageKey);
      }

      await storage.deleteAttachment(routeParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Attachment delete error:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  // Check storage configuration
  app.get("/api/storage/status", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const provider = settings.find(s => s.key === "storage_provider")?.value;
      const bucket = settings.find(s => s.key === "storage_bucket")?.value;
      
      res.json({
        configured: provider && provider !== "none" && bucket,
        provider: provider || "none",
      });
    } catch (error) {
      console.error("Storage status error:", error);
      res.status(500).json({ error: "Failed to check storage status" });
    }
  });

  // =====================================================
  // CATTLE DETAIL ROUTES
  // =====================================================

  app.get("/api/cattle/:id/milk-entries", isAuthenticated, withTenant, async (req, res) => {
    try {
      const entries = await storage.getMilkEntriesByCattle(routeParam(req.params.id));
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch milk entries" });
    }
  });

  app.get("/api/cattle/:id/health-events", isAuthenticated, withTenant, async (req, res) => {
    try {
      const events = await storage.getHealthEventsByCattle(routeParam(req.params.id));
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch health events" });
    }
  });

  app.get("/api/cattle/:id/inseminations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getInseminationsByCattle(routeParam(req.params.id));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inseminations" });
    }
  });

  app.get("/api/cattle/:id/heats", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getHeatsByCattle(routeParam(req.params.id));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch heats" });
    }
  });

  app.get("/api/cattle/:id/pregnancy-tests", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getPregnancyTestsByCattle(routeParam(req.params.id));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pregnancy tests" });
    }
  });

  app.get("/api/cattle/:id/calvings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getCalvingsByCattle(routeParam(req.params.id));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calvings" });
    }
  });

  app.get("/api/cattle/:id/vaccinations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getVaccinationsByCattle(routeParam(req.params.id));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vaccinations" });
    }
  });

  // =====================================================
  // BREEDING ANALYTICS
  // =====================================================

  app.get("/api/breeding/analytics", isAuthenticated, withTenant, async (req, res) => {
    try {
      const analytics = await storage.getBreedingAnalytics(req.tenantId!);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch breeding analytics" });
    }
  });

  app.get("/api/breeding/calvings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const { calvings } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const { db } = await import("./db");
      const records = await db.select().from(calvings).where(eq(calvings.tenantId, req.tenantId!)).orderBy(desc(calvings.date));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calvings" });
    }
  });

  app.post("/api/breeding/pregnancy-tests", isAuthenticated, withTenant, async (req, res) => {
    try {
      const { pregnancyTests } = await import("@shared/schema");
      const { db } = await import("./db");
      const [created] = await db.insert(pregnancyTests).values({
        ...req.body,
        tenantId: req.tenantId,
      } as any).returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pregnancy test" });
    }
  });

  app.post("/api/breeding/calvings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const { calvings } = await import("@shared/schema");
      const { db } = await import("./db");
      const [created] = await db.insert(calvings).values({
        ...req.body,
        tenantId: req.tenantId,
      } as any).returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create calving" });
    }
  });

  // =====================================================
  // VACCINATION ROUTES
  // =====================================================

  app.get("/api/vaccinations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const { vaccinations } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const { db } = await import("./db");
      const records = await db.select().from(vaccinations).where(eq(vaccinations.tenantId, req.tenantId!)).orderBy(desc(vaccinations.date));
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vaccinations" });
    }
  });

  app.post("/api/vaccinations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const { vaccinations } = await import("@shared/schema");
      const { db } = await import("./db");
      const [created] = await db.insert(vaccinations).values({
        ...req.body,
        tenantId: req.tenantId,
      } as any).returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vaccination" });
    }
  });

  app.get("/api/vaccinations/due", isAuthenticated, withTenant, async (req, res) => {
    try {
      const due = await storage.getVaccinationsDue(req.tenantId!);
      res.json(due);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vaccination due list" });
    }
  });

  // =====================================================
  // MILK SALES
  // =====================================================

  app.get("/api/milk-sales", isAuthenticated, withTenant, async (req, res) => {
    try {
      const sales = await storage.getMilkSalesByTenant(req.tenantId!);
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch milk sales" });
    }
  });

  app.post("/api/milk-sales", isAuthenticated, withTenant, async (req, res) => {
    try {
      const sale = await storage.createMilkSale({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.status(201).json(sale);
    } catch (error) {
      res.status(500).json({ error: "Failed to create milk sale" });
    }
  });

  // =====================================================
  // FINANCE ANALYTICS
  // =====================================================

  app.get("/api/finance/analytics", isAuthenticated, withTenant, async (req, res) => {
    try {
      const analytics = await storage.getFinanceAnalytics(req.tenantId!);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch finance analytics" });
    }
  });

  // =====================================================
  // FARM SETTINGS
  // =====================================================

  app.get("/api/farm-settings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const [settings, tenant] = await Promise.all([
        storage.getFarmSettings(req.tenantId!),
        storage.getTenantById(req.tenantId!),
      ]);
      res.json({
        currency: "INR", currencySymbol: "₹", timezone: "Asia/Kolkata",
        milkingSessions: 2, session1Name: "Morning", session2Name: "Evening",
        heatIntervalDays: 21, gestationDays: 280, dryPeriodDays: 60, pregnancyTestDays: 30,
        ...settings,
        farmName: settings?.farmName?.trim() || tenant?.name || "My Dairy Farm",
        address: settings?.address ?? tenant?.address ?? null,
        phone: settings?.phone ?? tenant?.phone ?? null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch farm settings" });
    }
  });

  app.put("/api/farm-settings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, tenantId: _tenantId, ...profile } = req.body || {};
      const settings = await storage.upsertFarmSettings({
        ...profile,
        tenantId: req.tenantId,
      });
      const tenantUpdates: Record<string, unknown> = {};
      if (profile.farmName !== undefined && String(profile.farmName).trim()) tenantUpdates.name = String(profile.farmName).trim();
      if (profile.address !== undefined) tenantUpdates.address = profile.address ? String(profile.address).trim() : null;
      if (profile.phone !== undefined) tenantUpdates.phone = profile.phone ? String(profile.phone).trim() : null;
      if (profile.language !== undefined) tenantUpdates.language = String(profile.language).trim() || "en";
      if (Object.keys(tenantUpdates).length) await storage.updateTenant(req.tenantId!, tenantUpdates);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update farm settings" });
    }
  });

  // =====================================================
  // WHATSAPP CONFIG & LOGS
  // =====================================================

  // One global WhatsApp Web session, controlled only by the Super Admin.
  app.get("/api/admin/whatsapp-web/status", isAuthenticated, requireSuperAdmin, async (_req, res) => {
    res.json(whatsappWebGateway.getStatus());
  });

  app.get("/api/admin/whatsapp-web/logs", isAuthenticated, requireSuperAdmin, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    res.json(await storage.getAllWhatsappLogs(limit));
  });

  app.post("/api/admin/whatsapp-web/connect", isAuthenticated, requireSuperAdmin, async (req, res) => {
    const phone = String(req.body?.phone || "").trim();
    const start = phone ? whatsappWebGateway.startWithPhoneNumber(phone) : whatsappWebGateway.start();
    start.catch(error => console.error("WhatsApp Web start failed:", error));
    res.status(202).json({ message: phone ? "Phone-number pairing is starting. Use the code when it appears." : "WhatsApp Web is starting. Scan the QR code when it appears." });
  });

  app.post("/api/admin/whatsapp-web/logout", isAuthenticated, requireSuperAdmin, async (_req, res) => {
    await whatsappWebGateway.logout();
    res.json({ message: "WhatsApp Web session disconnected and cleared" });
  });

  app.post("/api/admin/whatsapp-web/test", isAuthenticated, requireSuperAdmin, withTenant, async (req, res) => {
    const { phone, message } = req.body || {};
    if (!phone || !message) return res.status(400).json({ error: "phone and message are required" });
    const log = await queueWhatsappMessage(req.tenantId!, phone, message, "test");
    await processWhatsappOutbox(1);
    res.status(202).json({ message: "Test message queued", logId: log.id });
  });

  app.post("/api/admin/whatsapp-web/broadcast", isAuthenticated, requireSuperAdmin, async (req, res) => {
    const { message } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: "message is required" });
    const queued = await queueWhatsappBroadcast(message.trim());
    res.status(202).json({ message: "Broadcast queued", recipients: queued });
  });

  app.get("/api/whatsapp/config", isAuthenticated, withTenant, async (req, res) => {
    try {
      const config = await storage.getWhatsappConfig(req.tenantId!);
      // Mask API key
      if (config?.apiKey) {
        return res.json({ ...config, apiKey: "••••••••" + config.apiKey.slice(-4) });
      }
      res.json(config || { mode: "disabled", webSessionStatus: "disconnected" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch WhatsApp config" });
    }
  });

  app.put("/api/whatsapp/config", isAuthenticated, withTenant, async (req, res) => {
    try {
      // Don't overwrite masked key
      const existing = await storage.getWhatsappConfig(req.tenantId!);
      const data = { ...req.body, tenantId: req.tenantId };
      if (req.body.apiKey && req.body.apiKey.startsWith("••••••••")) {
        data.apiKey = existing?.apiKey;
      }
      const config = await storage.upsertWhatsappConfig(data);
      res.json({ ...config, apiKey: config.apiKey ? "••••••••" + config.apiKey.slice(-4) : undefined });
    } catch (error) {
      res.status(500).json({ error: "Failed to update WhatsApp config" });
    }
  });

  app.get("/api/whatsapp/logs", isAuthenticated, withTenant, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getWhatsappLogs(req.tenantId!, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch WhatsApp logs" });
    }
  });

  // Send test message
  app.post("/api/whatsapp/test", isAuthenticated, withTenant, async (req, res) => {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ error: "phone and message required" });
      }
      const log = await storage.createWhatsappLog({
        tenantId: req.tenantId,
        toPhone: phone,
        messageType: "text",
        message,
        status: "pending",
        triggerType: "test",
      });

      await processWhatsappOutbox(1);
      res.json({ success: true, logId: log.id, message: "Test message queued" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send test message" });
    }
  });

  // =====================================================
  // NOTIFICATION RULES
  // =====================================================

  app.get("/api/notification-rules", isAuthenticated, withTenant, async (req, res) => {
    try {
      const rules = await storage.getNotificationRules(req.tenantId!);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification rules" });
    }
  });

  app.post("/api/notification-rules", isAuthenticated, withTenant, async (req, res) => {
    try {
      const rule = await storage.createNotificationRule({
        ...normalizeNotificationRule(req.body, isSuperAdminUser(req.user)),
        tenantId: req.tenantId,
      });
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create notification rule" });
    }
  });

  app.put("/api/notification-rules/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const existing = await storage.getNotificationRuleById(req.params.id as string);
      if (!existing || existing.tenantId !== req.tenantId) return res.status(404).json({ error: "Notification rule not found" });
      const rule = await storage.updateNotificationRule(existing.id, normalizeNotificationRule({ ...existing, ...req.body, ruleType: req.body.ruleType || existing.ruleType }, isSuperAdminUser(req.user)));
      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update notification rule" });
    }
  });

  app.delete("/api/notification-rules/:id", isAuthenticated, withTenant, async (req, res) => {
    const existing = await storage.getNotificationRuleById(req.params.id as string);
    if (!existing || existing.tenantId !== req.tenantId) return res.status(404).json({ error: "Notification rule not found" });
    await storage.deleteNotificationRule(existing.id);
    res.status(204).send();
  });

  app.post("/api/notification-rules/run", isAuthenticated, withTenant, async (req, res) => {
    try {
      await evaluateTenantRules(req.tenantId!);
      res.json({ message: "Notification rules evaluated" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to evaluate notification rules" });
    }
  });

  // =====================================================
  // SUBSCRIPTION PLANS & BILLING
  // =====================================================

  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  app.get("/api/billing/subscription", isAuthenticated, withTenant, async (req, res) => {
    try {
      const subscription = await storage.getTenantSubscription(req.tenantId!);
      const plans = await storage.getAllSubscriptionPlans();
      const tenant = await storage.getTenantById(req.tenantId!);
      const cattleCount = (await storage.getCattleByTenant(req.tenantId!)).filter(c => c.status === "active").length;
      res.json({ subscription, plans, tenant, cattleCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch billing info" });
    }
  });

  // Enhanced dashboard stats with full KPI groups
  app.get("/api/dashboard/full-stats", isAuthenticated, withTenant, async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const baseStats = await storage.getDashboardStats(tenantId);
      const breedingAnalytics = await storage.getBreedingAnalytics(tenantId);
      const financeAnalytics = await storage.getFinanceAnalytics(tenantId);
      const vaccinationsDue = await storage.getVaccinationsDue(tenantId);
      const activeAlerts = (await storage.getAlertsByTenant(tenantId)).filter(a => !a.isDismissed && !a.isRead);

      const today = new Date().toISOString().split('T')[0];
      const { milkEntries: meTable } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq, and, gte, sql: drizzleSql } = await import("drizzle-orm");

      // This month milk
      const firstDayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const monthMilkResult = await db.select({
        total: drizzleSql<number>`COALESCE(SUM(${meTable.quantity}::numeric), 0)`,
        avgPerCow: drizzleSql<number>`COALESCE(AVG(${meTable.quantity}::numeric), 0)`,
      }).from(meTable).where(and(eq(meTable.tenantId, tenantId), gte(meTable.date, firstDayMonth)));

      res.json({
        ...baseStats,
        breeding: breedingAnalytics,
        finance: financeAnalytics,
        vaccinationsDue: vaccinationsDue.length,
        activeAlertCount: activeAlerts.length,
        monthMilk: Number(monthMilkResult[0]?.total || 0),
      });
    } catch (error) {
      console.error("Full dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch full stats" });
    }
  });

  // =====================================================================
  // IMPORT / EXPORT ROUTES
  // =====================================================================

  // Helper: convert array of objects to CSV string
  function toCSV(rows: Record<string, any>[], headers: { key: string; label: string }[]): string {
    const headerRow = headers.map(h => `"${h.label}"`).join(",");
    const dataRows = rows.map(row =>
      headers.map(h => {
        const v = row[h.key] ?? "";
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")
    );
    return [headerRow, ...dataRows].join("\n");
  }

  // Helper: convert array of objects to XLSX buffer
  async function toXLSX(rows: Record<string, any>[], headers: { key: string; label: string }[], sheetName: string): Promise<Buffer> {
    const XLSX = await import("xlsx");
    const ws_data = [
      headers.map(h => h.label),
      ...rows.map(row => headers.map(h => row[h.key] ?? "")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }

  // Helper: parse uploaded file (CSV or XLSX) into array of row objects
  async function parseUploadedFile(buffer: Buffer, filename: string): Promise<Record<string, string>[]> {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
    return rows;
  }

  // Helper: send file response
  function sendFile(res: Response, data: string | Buffer, filename: string, format: string) {
    if (format === "xlsx") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
      res.send(data);
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
      res.send("\uFEFF" + data); // BOM for Excel UTF-8
    }
  }

  // ---- EXPORT ENDPOINTS ----

  // Export Cattle
  app.get("/api/export/cattle", isAuthenticated, withTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { format = "csv", status, gender } = req.query as Record<string, string>;
      let rows = await storage.getCattleByTenant(tenantId);
      const breeds = await storage.getAllBreeds();
      const breedMap = Object.fromEntries(breeds.map(b => [b.id, b.name]));
      if (status) rows = rows.filter(r => r.status === status);
      if (gender) rows = rows.filter(r => r.gender === gender);
      const headers = [
        { key: "tagNumber",        label: "Tag Number" },
        { key: "name",             label: "Name" },
        { key: "breedName",        label: "Breed" },
        { key: "gender",           label: "Gender" },
        { key: "dateOfBirth",      label: "Date of Birth" },
        { key: "dateOfEntry",      label: "Date of Entry" },
        { key: "source",           label: "Source" },
        { key: "status",           label: "Status" },
        { key: "stage",            label: "Stage" },
        { key: "lactationNumber",  label: "Lactation No." },
        { key: "purchasePrice",    label: "Purchase Price (₹)" },
        { key: "notes",            label: "Notes" },
      ];
      const data = rows.map(r => ({ ...r, breedName: breedMap[r.breedId || ""] || "" }));
      if (format === "xlsx") {
        const buf = await toXLSX(data, headers, "Cattle");
        sendFile(res, buf, "cattle-export", format);
      } else {
        sendFile(res, toCSV(data, headers), "cattle-export", format);
      }
    } catch (e) { res.status(500).json({ error: "Export failed" }); }
  });

  // Export Milk Entries
  app.get("/api/export/milk", isAuthenticated, withTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { format = "csv", startDate, endDate, cattleId, session } = req.query as Record<string, string>;
      let rows = await storage.getMilkEntriesByTenant(tenantId);
      const cattle = await storage.getCattleByTenant(tenantId);
      const cattleMap = Object.fromEntries(cattle.map(c => [c.id, `${c.tagNumber}${c.name ? " - " + c.name : ""}`]));
      if (startDate) rows = rows.filter(r => r.date >= startDate);
      if (endDate)   rows = rows.filter(r => r.date <= endDate);
      if (cattleId)  rows = rows.filter(r => r.cattleId === cattleId);
      if (session)   rows = rows.filter(r => r.session === session);
      const headers = [
        { key: "date",         label: "Date" },
        { key: "cattleTag",    label: "Cattle (Tag - Name)" },
        { key: "session",      label: "Session" },
        { key: "quantity",     label: "Quantity (L)" },
        { key: "fat",          label: "Fat (%)" },
        { key: "snf",          label: "SNF (%)" },
        { key: "notes",        label: "Notes" },
      ];
      const data = rows.map(r => ({ ...r, cattleTag: cattleMap[r.cattleId] || r.cattleId }));
      if (format === "xlsx") {
        sendFile(res, await toXLSX(data, headers, "Milk Records"), "milk-export", format);
      } else {
        sendFile(res, toCSV(data, headers), "milk-export", format);
      }
    } catch (e) { res.status(500).json({ error: "Export failed" }); }
  });

  // Export Health Events
  app.get("/api/export/health", isAuthenticated, withTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { format = "csv", startDate, endDate, cattleId, eventType } = req.query as Record<string, string>;
      let rows = await storage.getHealthEventsByTenant(tenantId);
      const cattle = await storage.getCattleByTenant(tenantId);
      const cattleMap = Object.fromEntries(cattle.map(c => [c.id, `${c.tagNumber}${c.name ? " - " + c.name : ""}`]));
      if (startDate) rows = rows.filter(r => r.date >= startDate);
      if (endDate)   rows = rows.filter(r => r.date <= endDate);
      if (cattleId)  rows = rows.filter(r => r.cattleId === cattleId);
      if (eventType) rows = rows.filter(r => r.eventType === eventType);
      const headers = [
        { key: "date",        label: "Date" },
        { key: "cattleTag",   label: "Cattle (Tag - Name)" },
        { key: "eventType",   label: "Event Type" },
        { key: "description", label: "Description" },
        { key: "severity",    label: "Severity" },
        { key: "symptoms",    label: "Symptoms" },
        { key: "diagnosis",   label: "Diagnosis" },
        { key: "status",      label: "Status" },
        { key: "notes",       label: "Notes" },
      ];
      const data = rows.map(r => ({ ...r, cattleTag: cattleMap[r.cattleId] || r.cattleId }));
      if (format === "xlsx") {
        sendFile(res, await toXLSX(data, headers, "Health Events"), "health-export", format);
      } else {
        sendFile(res, toCSV(data, headers), "health-export", format);
      }
    } catch (e) { res.status(500).json({ error: "Export failed" }); }
  });

  // Export Breeding (Inseminations)
  app.get("/api/export/breeding", isAuthenticated, withTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { format = "csv", startDate, endDate, cattleId } = req.query as Record<string, string>;
      let rows = await storage.getInseminationsByTenant(tenantId);
      const cattle = await storage.getCattleByTenant(tenantId);
      const cattleMap = Object.fromEntries(cattle.map(c => [c.id, `${c.tagNumber}${c.name ? " - " + c.name : ""}`]));
      if (startDate) rows = rows.filter(r => r.date >= startDate);
      if (endDate)   rows = rows.filter(r => r.date <= endDate);
      if (cattleId)  rows = rows.filter(r => r.cattleId === cattleId);
      const headers = [
        { key: "date",            label: "Date" },
        { key: "cattleTag",       label: "Cattle (Tag - Name)" },
        { key: "method",          label: "Method (ai/natural)" },
        { key: "bullId",          label: "Bull / Semen ID" },
        { key: "semenBatchId",    label: "Semen Batch ID" },
        { key: "pregnancyStatus", label: "Pregnancy Status" },
        { key: "cost",            label: "Cost (₹)" },
        { key: "notes",           label: "Notes" },
      ];
      const data = rows.map(r => ({ ...r, cattleTag: cattleMap[r.cattleId] || r.cattleId }));
      if (format === "xlsx") {
        sendFile(res, await toXLSX(data, headers, "Breeding"), "breeding-export", format);
      } else {
        sendFile(res, toCSV(data, headers), "breeding-export", format);
      }
    } catch (e) { res.status(500).json({ error: "Export failed" }); }
  });

  // Export Feeding Records
  app.get("/api/export/feeding", isAuthenticated, withTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { format = "csv", startDate, endDate, cattleId } = req.query as Record<string, string>;
      let rows = await storage.getFeedingRecordsByTenant(tenantId);
      const cattle = await storage.getCattleByTenant(tenantId);
      const feedItems = await storage.getAllFeedItems();
      const cattleMap = Object.fromEntries(cattle.map(c => [c.id, `${c.tagNumber}${c.name ? " - " + c.name : ""}`]));
      const feedMap = Object.fromEntries(feedItems.map(f => [f.id, f.name]));
      if (startDate) rows = rows.filter(r => r.date >= startDate);
      if (endDate)   rows = rows.filter(r => r.date <= endDate);
      if (cattleId)  rows = rows.filter(r => r.cattleId === cattleId);
      const headers = [
        { key: "date",           label: "Date" },
        { key: "cattleTag",      label: "Cattle (Tag - Name)" },
        { key: "feedItemName",   label: "Feed Item" },
        { key: "session",        label: "Session" },
        { key: "actualQuantity", label: "Quantity (kg)" },
        { key: "notes",          label: "Notes" },
      ];
      const data = rows.map(r => ({
        ...r,
        cattleTag: cattleMap[r.cattleId || ""] || r.cattleId || "All Cattle",
        feedItemName: feedMap[r.feedItemId] || r.feedItemId,
      }));
      if (format === "xlsx") {
        sendFile(res, await toXLSX(data, headers, "Feeding Records"), "feeding-export", format);
      } else {
        sendFile(res, toCSV(data, headers), "feeding-export", format);
      }
    } catch (e) { res.status(500).json({ error: "Export failed" }); }
  });

  // Export Expenses
  app.get("/api/export/expenses", isAuthenticated, withTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { format = "csv", startDate, endDate, category } = req.query as Record<string, string>;
      let rows = await storage.getExpensesByTenant(tenantId);
      const heads = await storage.getAllExpenseHeads();
      const headMap = Object.fromEntries(heads.map(h => [h.id, h.name]));
      if (startDate) rows = rows.filter(r => r.date >= startDate);
      if (endDate)   rows = rows.filter(r => r.date <= endDate);
      if (category)  rows = rows.filter(r => headMap[r.headId || ""] === category || r.headId === category);
      const headers = [
        { key: "date",          label: "Date" },
        { key: "headName",      label: "Category" },
        { key: "description",   label: "Description" },
        { key: "amount",        label: "Amount (₹)" },
        { key: "vendorName",    label: "Vendor" },
        { key: "paymentMethod", label: "Payment Method" },
        { key: "invoiceNumber",   label: "Reference No." },
        { key: "notes",         label: "Notes" },
      ];
      const data = rows.map(r => ({ ...r, headName: headMap[r.headId || ""] || "" }));
      if (format === "xlsx") {
        sendFile(res, await toXLSX(data, headers, "Expenses"), "expenses-export", format);
      } else {
        sendFile(res, toCSV(data, headers), "expenses-export", format);
      }
    } catch (e) { res.status(500).json({ error: "Export failed" }); }
  });

  // Export Incomes
  app.get("/api/export/incomes", isAuthenticated, withTenant, async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      const { format = "csv", startDate, endDate } = req.query as Record<string, string>;
      let rows = await storage.getIncomesByTenant(tenantId);
      const heads = await storage.getAllIncomeHeads();
      const headMap = Object.fromEntries(heads.map(h => [h.id, h.name]));
      if (startDate) rows = rows.filter(r => r.date >= startDate);
      if (endDate)   rows = rows.filter(r => r.date <= endDate);
      const headers = [
        { key: "date",          label: "Date" },
        { key: "headName",      label: "Category" },
        { key: "description",   label: "Description" },
        { key: "amount",        label: "Amount (₹)" },
        { key: "customerName",  label: "Customer" },
        { key: "paymentMethod", label: "Payment Method" },
        { key: "invoiceNumber",   label: "Reference No." },
        { key: "notes",         label: "Notes" },
      ];
      const data = rows.map(r => ({ ...r, headName: headMap[r.headId || ""] || "" }));
      if (format === "xlsx") {
        sendFile(res, await toXLSX(data, headers, "Incomes"), "incomes-export", format);
      } else {
        sendFile(res, toCSV(data, headers), "incomes-export", format);
      }
    } catch (e) { res.status(500).json({ error: "Export failed" }); }
  });

  // ---- IMPORT TEMPLATES ----

  app.get("/api/import/template/:module", async (req, res) => {
    const { module } = req.params;
    const { format = "csv" } = req.query as Record<string, string>;
    const templates: Record<string, { headers: string[]; sample: string[][] }> = {
      cattle: {
        headers: ["Tag Number*", "Name", "Breed Name", "Gender* (male/female)", "Date of Birth (YYYY-MM-DD)", "Date of Entry* (YYYY-MM-DD)", "Source (born/purchased)", "Status (active/sold/dead/culled)", "Stage (calf/heifer/milking/dry/pregnant)", "Lactation No.", "Purchase Price (₹)", "Notes"],
        sample: [["IN001","Lakshmi","Holstein","female","2021-05-10","2021-05-10","born","active","milking","3","","First calving at 2 years"], ["IN002","Gauri","Gir","female","2020-03-15","2020-03-15","purchased","active","dry","4","45000","Purchased from Anand dairy"]],
      },
      milk: {
        headers: ["Date* (YYYY-MM-DD)", "Cattle Tag Number*", "Session* (morning/evening/night)", "Quantity (L)*", "Fat (%)", "SNF (%)", "Notes"],
        sample: [["2026-04-01","IN001","morning","8.5","4.2","8.6",""], ["2026-04-01","IN001","evening","6.2","4.5","8.8",""]],
      },
      health: {
        headers: ["Date* (YYYY-MM-DD)", "Cattle Tag Number*", "Event Type* (illness/injury/vaccination/deworming/checkup)", "Description", "Severity (mild/moderate/severe/critical)", "Symptoms", "Diagnosis", "Notes"],
        sample: [["2026-04-01","IN001","illness","Off feed, dull","moderate","Reduced appetite, dull coat","Suspected mastitis","Sent for vet check"]],
      },
      expenses: {
        headers: ["Date* (YYYY-MM-DD)", "Category Name*", "Description", "Amount (₹)*", "Vendor", "Payment Method (cash/bank/upi/cheque)", "Reference No.", "Notes"],
        sample: [["2026-04-01","Feed & Fodder","Monthly concentrate purchase","12500","Anand Feeds","upi","TXN12345",""]],
      },
      incomes: {
        headers: ["Date* (YYYY-MM-DD)", "Category Name*", "Description", "Amount (₹)*", "Customer", "Payment Method (cash/bank/upi/cheque)", "Reference No.", "Notes"],
        sample: [["2026-04-01","Milk Sale","Morning milk - Co-op","3200","Amul Co-op","bank","","April 1 batch"]],
      },
    };
    const t = templates[module];
    if (!t) return res.status(404).json({ error: "Module not found" });
    const XLSX = await import("xlsx");
    if (format === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.sample]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, module.charAt(0).toUpperCase() + module.slice(1));
      const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${module}-import-template.xlsx"`);
      res.send(buf);
    } else {
      const csv = [t.headers.join(","), ...t.sample.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${module}-import-template.csv"`);
      res.send("\uFEFF" + csv);
    }
  });

  // ---- IMPORT ENDPOINTS ----

  // Import Cattle
  app.post("/api/import/cattle", isAuthenticated, withTenant, upload.single("file"), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const rows = await parseUploadedFile(req.file.buffer, req.file.originalname);
      const breeds = await storage.getAllBreeds();
      const breedMap = Object.fromEntries(breeds.map(b => [b.name.toLowerCase().trim(), b.id]));
      let imported = 0, failed = 0;
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const tagKey = Object.keys(row).find(k => k.toLowerCase().includes("tag"));
        const tagNumber = tagKey ? String(row[tagKey]).trim() : "";
        const entryKey = Object.keys(row).find(k => k.toLowerCase().includes("entry"));
        const dateOfEntry = entryKey ? String(row[entryKey]).trim() : "";
        if (!tagNumber) { errors.push({ row: i + 2, message: "Tag Number is required" }); failed++; continue; }
        if (!dateOfEntry) { errors.push({ row: i + 2, message: "Date of Entry is required" }); failed++; continue; }
        const breedKey = Object.keys(row).find(k => k.toLowerCase().includes("breed"));
        const breedName = breedKey ? String(row[breedKey]).toLowerCase().trim() : "";
        const genderKey = Object.keys(row).find(k => k.toLowerCase().includes("gender"));
        const gender = genderKey ? String(row[genderKey]).toLowerCase().trim() : "female";
        const dobKey = Object.keys(row).find(k => k.toLowerCase().includes("birth"));
        const statusKey = Object.keys(row).find(k => k.toLowerCase().includes("status"));
        const stageKey = Object.keys(row).find(k => k.toLowerCase().includes("stage"));
        const sourceKey = Object.keys(row).find(k => k.toLowerCase().includes("source"));
        const lactKey = Object.keys(row).find(k => k.toLowerCase().includes("lactation"));
        const priceKey = Object.keys(row).find(k => k.toLowerCase().includes("price"));
        const nameKey = Object.keys(row).find(k => k.toLowerCase() === "name");
        const notesKey = Object.keys(row).find(k => k.toLowerCase().includes("notes"));
        try {
          await storage.createCattle({
            tenantId,
            tagNumber,
            name: nameKey ? String(row[nameKey]).trim() || null : null,
            breedId: breedName ? (breedMap[breedName] || null) : null,
            gender: ["male","female"].includes(gender) ? gender : "female",
            dateOfBirth: dobKey && row[dobKey] ? String(row[dobKey]).trim() : null,
            dateOfEntry,
            source: sourceKey ? (["born","purchased"].includes(String(row[sourceKey]).toLowerCase()) ? String(row[sourceKey]).toLowerCase() : "born") : "born",
            status: statusKey ? String(row[statusKey]).toLowerCase().trim() || "active" : "active",
            stage: stageKey ? String(row[stageKey]).toLowerCase().trim() || "heifer" : "heifer",
            lactationNumber: lactKey && row[lactKey] ? parseInt(String(row[lactKey])) || 0 : 0,
            purchasePrice: priceKey && row[priceKey] ? String(row[priceKey]).replace(/[₹,\s]/g,"") : null,
            notes: notesKey ? String(row[notesKey]).trim() || null : null,
          });
          imported++;
        } catch (e: any) {
          errors.push({ row: i + 2, message: e.message || "Insert failed" });
          failed++;
        }
      }
      res.json({ imported, failed, total: rows.length, errors });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Import failed" });
    }
  });

  // Import Milk Entries
  app.post("/api/import/milk", isAuthenticated, withTenant, upload.single("file"), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const rows = await parseUploadedFile(req.file.buffer, req.file.originalname);
      const cattle = await storage.getCattleByTenant(tenantId);
      const cattleTagMap = Object.fromEntries(cattle.map(c => [c.tagNumber.toLowerCase().trim(), c.id]));
      let imported = 0, failed = 0;
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const dateKey = Object.keys(row).find(k => k.toLowerCase().startsWith("date"));
        const tagKey = Object.keys(row).find(k => k.toLowerCase().includes("tag"));
        const sessionKey = Object.keys(row).find(k => k.toLowerCase().includes("session"));
        const qtyKey = Object.keys(row).find(k => k.toLowerCase().includes("quantity") || k.toLowerCase().includes("qty"));
        const fatKey = Object.keys(row).find(k => k.toLowerCase().includes("fat"));
        const snfKey = Object.keys(row).find(k => k.toLowerCase().includes("snf"));
        const notesKey = Object.keys(row).find(k => k.toLowerCase().includes("notes"));
        const date = dateKey ? String(row[dateKey]).trim() : "";
        const tag = tagKey ? String(row[tagKey]).trim().toLowerCase() : "";
        const session = sessionKey ? String(row[sessionKey]).trim().toLowerCase() : "";
        const qty = qtyKey ? String(row[qtyKey]).replace(/[^\d.]/g,"") : "";
        if (!date || !tag || !session || !qty) {
          errors.push({ row: i+2, message: `Missing required fields (date, tag, session, quantity)` });
          failed++; continue;
        }
        const cattleId = cattleTagMap[tag];
        if (!cattleId) { errors.push({ row: i+2, message: `Cattle with tag "${tag}" not found` }); failed++; continue; }
        try {
          await storage.createMilkEntry({
            tenantId, cattleId,
            date,
            session: ["morning","evening","night"].includes(session) ? session : "morning",
            quantity: qty,
            fat: fatKey && row[fatKey] ? String(row[fatKey]).replace(/[^\d.]/g,"") : null,
            snf: snfKey && row[snfKey] ? String(row[snfKey]).replace(/[^\d.]/g,"") : null,
            notes: notesKey ? String(row[notesKey]).trim() || null : null,
          });
          imported++;
        } catch (e: any) {
          errors.push({ row: i+2, message: e.message || "Insert failed" });
          failed++;
        }
      }
      res.json({ imported, failed, total: rows.length, errors });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Import failed" });
    }
  });

  // Import Health Events
  app.post("/api/import/health", isAuthenticated, withTenant, upload.single("file"), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const rows = await parseUploadedFile(req.file.buffer, req.file.originalname);
      const cattle = await storage.getCattleByTenant(tenantId);
      const cattleTagMap = Object.fromEntries(cattle.map(c => [c.tagNumber.toLowerCase().trim(), c.id]));
      let imported = 0, failed = 0;
      const errors: { row: number; message: string }[] = [];
      const validTypes = ["illness","injury","vaccination","deworming","checkup"];
      const validSeverities = ["mild","moderate","severe","critical"];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const keys = Object.keys(row).map(k => k.toLowerCase());
        const get = (partial: string) => { const k = Object.keys(row).find(k => k.toLowerCase().includes(partial)); return k ? String(row[k]).trim() : ""; };
        const date = get("date");
        const tag = get("tag").toLowerCase();
        const eventType = get("event").toLowerCase() || get("type").toLowerCase();
        if (!date || !tag || !eventType) { errors.push({ row: i+2, message: "Missing date, tag or event type" }); failed++; continue; }
        const cattleId = cattleTagMap[tag];
        if (!cattleId) { errors.push({ row: i+2, message: `Cattle "${tag}" not found` }); failed++; continue; }
        const sev = get("severity").toLowerCase();
        try {
          await storage.createHealthEvent({
            tenantId, cattleId,
            date,
            eventType: validTypes.includes(eventType) ? eventType : "checkup",
            description: get("description") || null,
            severity: validSeverities.includes(sev) ? sev : "moderate",
            symptoms: get("symptoms") || null,
            diagnosis: get("diagnosis") || null,
            notes: get("notes") || null,
            status: "active",
          });
          imported++;
        } catch (e: any) {
          errors.push({ row: i+2, message: e.message || "Insert failed" });
          failed++;
        }
      }
      res.json({ imported, failed, total: rows.length, errors });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Import failed" });
    }
  });

  // Import Expenses
  app.post("/api/import/expenses", isAuthenticated, withTenant, upload.single("file"), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const rows = await parseUploadedFile(req.file.buffer, req.file.originalname);
      const heads = await storage.getAllExpenseHeads();
      const headMap = Object.fromEntries(heads.map(h => [h.name.toLowerCase().trim(), h.id]));
      let imported = 0, failed = 0;
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const get = (partial: string) => { const k = Object.keys(row).find(k => k.toLowerCase().includes(partial)); return k ? String(row[k]).trim() : ""; };
        const date = get("date"); const category = get("category").toLowerCase();
        const amount = get("amount").replace(/[₹,\s]/g,"");
        if (!date || !category || !amount) { errors.push({ row: i+2, message: "Missing date, category or amount" }); failed++; continue; }
        const headId = headMap[category];
        if (!headId) { errors.push({ row: i+2, message: `Category "${category}" not found. Use exact name from template.` }); failed++; continue; }
        try {
          await storage.createExpense({
            tenantId, headId, date,
            description: get("description") || null,
            amount,
            vendorName: get("vendor") || null,
            paymentMethod: get("payment") || "cash",
            invoiceNumber: get("reference") || null,
            notes: get("notes") || null,
          });
          imported++;
        } catch (e: any) {
          errors.push({ row: i+2, message: e.message || "Insert failed" });
          failed++;
        }
      }
      res.json({ imported, failed, total: rows.length, errors });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Import failed" });
    }
  });

  // Import Incomes
  app.post("/api/import/incomes", isAuthenticated, withTenant, upload.single("file"), async (req: any, res) => {
    try {
      const tenantId = req.tenantId!;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const rows = await parseUploadedFile(req.file.buffer, req.file.originalname);
      const heads = await storage.getAllIncomeHeads();
      const headMap = Object.fromEntries(heads.map(h => [h.name.toLowerCase().trim(), h.id]));
      let imported = 0, failed = 0;
      const errors: { row: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const get = (partial: string) => { const k = Object.keys(row).find(k => k.toLowerCase().includes(partial)); return k ? String(row[k]).trim() : ""; };
        const date = get("date"); const category = get("category").toLowerCase();
        const amount = get("amount").replace(/[₹,\s]/g,"");
        if (!date || !category || !amount) { errors.push({ row: i+2, message: "Missing date, category or amount" }); failed++; continue; }
        const headId = headMap[category];
        if (!headId) { errors.push({ row: i+2, message: `Category "${category}" not found. Use exact name from template.` }); failed++; continue; }
        try {
          await storage.createIncome({
            tenantId, headId, date,
            description: get("description") || null,
            amount,
            customerName: get("customer") || null,
            paymentMethod: get("payment") || "cash",
            invoiceNumber: get("reference") || null,
            notes: get("notes") || null,
          });
          imported++;
        } catch (e: any) {
          errors.push({ row: i+2, message: e.message || "Insert failed" });
          failed++;
        }
      }
      res.json({ imported, failed, total: rows.length, errors });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Import failed" });
    }
  });

  return httpServer;
}
