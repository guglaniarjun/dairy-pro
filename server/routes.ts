import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replit_integrations/auth";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        profileImageUrl?: string | null;
      };
      tenantId?: string;
    }
  }
}

// Middleware to get current user's tenant
async function withTenant(req: any, res: Response, next: NextFunction) {
  if (!req.user || !req.user.claims) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const userId = req.user.claims.sub;
    let tenant = await storage.getTenantByOwnerId(userId);
    
    if (!tenant) {
      // Create default tenant for new user
      const firstName = req.user.claims.first_name || "My";
      tenant = await storage.createTenant({
        name: `${firstName}'s Farm`,
        slug: `farm-${userId.substring(0, 8)}`,
        ownerId: userId,
        plan: "free",
        maxCattle: 2,
        isActive: true,
      });
    }

    req.tenantId = tenant.id;
    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
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
      const cattle = await storage.getCattleById(req.params.id);
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
      const existing = await storage.getCattleById(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ error: "Cattle not found" });
      }
      const updated = await storage.updateCattle(req.params.id, req.body);
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
      const updated = await storage.updateHealthEvent(req.params.id, req.body);
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
      const updated = await storage.updateTask(req.params.id, req.body);
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
      const updated = await storage.updateAlert(req.params.id, req.body);
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

  return httpServer;
}
