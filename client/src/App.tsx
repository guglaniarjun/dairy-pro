import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth.tsx";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Skeleton } from "@/components/ui/skeleton";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import DashboardPage from "@/pages/dashboard";
import CattleListPage from "@/pages/cattle/index";
import AddCattlePage from "@/pages/cattle/new";
import MilkRecordsPage from "@/pages/milk/index";
import AddMilkEntryPage from "@/pages/milk/new";
import HealthPage from "@/pages/health/index";
import TasksPage from "@/pages/tasks/index";
import FinancesPage from "@/pages/finances/index";
import InventoryPage from "@/pages/inventory/index";
import ReportsPage from "@/pages/reports/index";
import BreedingPage from "@/pages/breeding/index";
import RecordHeatPage from "@/pages/breeding/heat";
import RecordAIPage from "@/pages/breeding/ai";
import RecordPregnancyTestPage from "@/pages/breeding/pregnancy-test";
import RecordCalvingPage from "@/pages/breeding/calving";
import FeedPage from "@/pages/feed/index";
import RecordFeedingPage from "@/pages/feed/new";
import FeedFormulationPage from "@/pages/feed/formulation";
import HealthNewPage from "@/pages/health/new";
import VaccinationPage from "@/pages/health/vaccination";
import ExpenseNewPage from "@/pages/finances/expense-new";
import IncomeNewPage from "@/pages/finances/income-new";
import TaskNewPage from "@/pages/tasks/new";
import InventoryNewPage from "@/pages/inventory/new";
import InventoryPurchasePage from "@/pages/inventory/purchase";
import InventoryIssuePage from "@/pages/inventory/issue";
import AlertsPage from "@/pages/alerts/index";
import SettingsPage from "@/pages/settings/index";
import CattlePurchasePage from "@/pages/cattle-transactions/purchase";
import CattleSalePage from "@/pages/cattle-transactions/sale";
import CattlePLDashboard from "@/pages/cattle/pl-dashboard";
import CattleDetailPage from "@/pages/cattle/detail";
import ByproductsPage from "@/pages/byproducts/index";
import BillingPage from "@/pages/billing/index";
import ImportExportPage from "@/pages/import-export/index";
import NotFound from "@/pages/not-found";

function LoadingSpinner() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
          <svg
            className="w-8 h-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-4 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "15.5rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
            <SidebarTrigger
              data-testid="button-sidebar-toggle"
              className="h-8 w-8 rounded-lg hover:bg-accent transition-colors"
            />
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </SidebarProvider>
  );
}

function AppRouter() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    const path = window.location.pathname;
    if (path === "/login") return <LoginPage />;
    if (path === "/register") return <RegisterPage />;
    return <LandingPage />;
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/cattle" component={CattleListPage} />
        <Route path="/cattle/new" component={AddCattlePage} />
        <Route path="/cattle/purchase" component={CattlePurchasePage} />
        <Route path="/cattle/sale" component={CattleSalePage} />
        <Route path="/cattle/pl" component={CattlePLDashboard} />
        <Route path="/cattle/:id" component={CattleDetailPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/byproducts" component={ByproductsPage} />
        <Route path="/milk" component={MilkRecordsPage} />
        <Route path="/milk/new" component={AddMilkEntryPage} />
        <Route path="/health" component={HealthPage} />
        <Route path="/health/new" component={HealthNewPage} />
        <Route path="/health/vaccination" component={VaccinationPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/finances" component={FinancesPage} />
        <Route path="/finances/expense/new" component={ExpenseNewPage} />
        <Route path="/finances/income/new" component={IncomeNewPage} />
        <Route path="/tasks/new" component={TaskNewPage} />
        <Route path="/inventory" component={InventoryPage} />
        <Route path="/inventory/new" component={InventoryNewPage} />
        <Route path="/inventory/purchase" component={InventoryPurchasePage} />
        <Route path="/inventory/issue" component={InventoryIssuePage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/breeding" component={BreedingPage} />
        <Route path="/breeding/heat" component={RecordHeatPage} />
        <Route path="/breeding/ai" component={RecordAIPage} />
        <Route path="/breeding/pregnancy-test" component={RecordPregnancyTestPage} />
        <Route path="/breeding/calving" component={RecordCalvingPage} />
        <Route path="/feed" component={FeedPage} />
        <Route path="/feed/new" component={RecordFeedingPage} />
        <Route path="/feed/formulation" component={FeedFormulationPage} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/import-export" component={ImportExportPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dairy-farm-theme">
        <TooltipProvider>
          <AuthProvider>
            <AppRouter />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
