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
import { Skeleton } from "@/components/ui/skeleton";

import LandingPage from "@/pages/landing";
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
import FeedPage from "@/pages/feed/index";
import AlertsPage from "@/pages/alerts/index";
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
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/cattle" component={CattleListPage} />
        <Route path="/cattle/new" component={AddCattlePage} />
        <Route path="/milk" component={MilkRecordsPage} />
        <Route path="/milk/new" component={AddMilkEntryPage} />
        <Route path="/health" component={HealthPage} />
        <Route path="/health/new" component={HealthPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/finances" component={FinancesPage} />
        <Route path="/inventory" component={InventoryPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/breeding" component={BreedingPage} />
        <Route path="/feed" component={FeedPage} />
        <Route path="/alerts" component={AlertsPage} />
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
