import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replit_integrations/auth";
import { upload, uploadFile, deleteFile, getFileType } from "./upload";

// Extend Express Request to include user with Replit Auth claims
declare global {
  namespace Express {
    interface Request {
      user?: {
        claims: {
          sub: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          profile_image_url?: string | null;
        };
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
        recordedBy: req.user!.claims.sub,
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
        recordedBy: req.user!.claims.sub,
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
        recordedBy: req.user!.claims.sub,
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
        recordedBy: req.user!.claims.sub,
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
        detectedBy: req.user!.claims.sub,
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
  // SYSTEM SETTINGS (Super Admin - Storage Config)
  // =====================================================

  app.get("/api/admin/system-settings", isAuthenticated, async (req, res) => {
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

  app.post("/api/admin/system-settings", isAuthenticated, async (req, res) => {
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
  app.get("/api/admin/storage-config", isAuthenticated, async (req, res) => {
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
        createdBy: req.user!.claims.sub,
      });
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Cattle transaction create error:", error);
      res.status(500).json({ error: "Failed to create cattle transaction" });
    }
  });

  app.get("/api/cattle-transactions/:id", isAuthenticated, withTenant, async (req, res) => {
    try {
      const transaction = await storage.getCattleTransactionById(req.params.id);
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
      const payments = await storage.getCattlePaymentsByTransaction(req.params.id);
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
        createdBy: req.user!.claims.sub,
      });
      
      // Update transaction paid amount
      const transaction = await storage.getCattleTransactionById(req.params.id);
      if (transaction) {
        const payments = await storage.getCattlePaymentsByTransaction(req.params.id);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const status = totalPaid >= Number(transaction.amount) ? "paid" : "partial";
        await storage.updateCattleTransaction(req.params.id, {
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
      const cattleId = req.params.id;
      
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
      const costs = await storage.getCattleCostsByCattle(req.params.id);
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
        createdBy: req.user!.claims.sub,
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
        createdBy: req.user!.claims.sub,
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

      const { url, storageKey } = await uploadFile(req.file, req.tenantId!);
      
      const attachment = await storage.createAttachment({
        id: crypto.randomUUID(),
        tenantId: req.tenantId,
        fileName: req.file.originalname,
        fileType: getFileType(req.file.mimetype),
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storageUrl: url,
        storageKey: storageKey,
        uploadedBy: (req as any).user.claims.sub,
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
      const { entityType, entityId } = req.params;
      
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
      const attachment = await storage.getAttachmentById(req.params.id);
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

      await storage.deleteAttachment(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Attachment delete error:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  // Check storage configuration
  app.get("/api/storage/status", isAuthenticated, async (req, res) => {
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
      const entries = await storage.getMilkEntriesByCattle(req.params.id);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch milk entries" });
    }
  });

  app.get("/api/cattle/:id/health-events", isAuthenticated, withTenant, async (req, res) => {
    try {
      const events = await storage.getHealthEventsByCattle(req.params.id);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch health events" });
    }
  });

  app.get("/api/cattle/:id/inseminations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getInseminationsByCattle(req.params.id);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inseminations" });
    }
  });

  app.get("/api/cattle/:id/heats", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getHeatsByCattle(req.params.id);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch heats" });
    }
  });

  app.get("/api/cattle/:id/pregnancy-tests", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getPregnancyTestsByCattle(req.params.id);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pregnancy tests" });
    }
  });

  app.get("/api/cattle/:id/calvings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getCalvingsByCattle(req.params.id);
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch calvings" });
    }
  });

  app.get("/api/cattle/:id/vaccinations", isAuthenticated, withTenant, async (req, res) => {
    try {
      const records = await storage.getVaccinationsByCattle(req.params.id);
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
      const settings = await storage.getFarmSettings(req.tenantId!);
      res.json(settings || {
        currency: "INR", currencySymbol: "₹", timezone: "Asia/Kolkata",
        milkingSessions: 2, session1Name: "Morning", session2Name: "Evening",
        heatIntervalDays: 21, gestationDays: 280, dryPeriodDays: 60, pregnancyTestDays: 30,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch farm settings" });
    }
  });

  app.put("/api/farm-settings", isAuthenticated, withTenant, async (req, res) => {
    try {
      const settings = await storage.upsertFarmSettings({
        ...req.body,
        tenantId: req.tenantId,
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to update farm settings" });
    }
  });

  // =====================================================
  // WHATSAPP CONFIG & LOGS
  // =====================================================

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
      const config = await storage.getWhatsappConfig(req.tenantId!);
      if (!config || config.mode === "disabled") {
        return res.status(400).json({ error: "WhatsApp not configured" });
      }

      const log = await storage.createWhatsappLog({
        tenantId: req.tenantId,
        toPhone: phone,
        messageType: "text",
        message,
        status: "pending",
        triggerType: "test",
      });

      // In production: call actual WhatsApp API here
      // For now, simulate success after 1s
      setTimeout(async () => {
        await storage.updateWhatsappLog(log.id, {
          status: config.mode === "api" ? "sent" : "sent",
          sentAt: new Date(),
        });
      }, 1000);

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

  app.put("/api/notification-rules/:ruleType", isAuthenticated, withTenant, async (req, res) => {
    try {
      const rule = await storage.upsertNotificationRule({
        ...req.body,
        tenantId: req.tenantId,
        ruleType: req.params.ruleType,
      });
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification rule" });
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

  return httpServer;
}
