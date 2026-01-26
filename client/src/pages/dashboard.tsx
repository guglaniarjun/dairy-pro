import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Milk,
  Heart,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { Cattle, MilkEntry, Task, Alert } from "@shared/schema";

interface DashboardStats {
  totalCattle: number;
  milkingCattle: number;
  todayMilk: number;
  yesterdayMilk: number;
  pendingTasks: number;
  activeAlerts: number;
  healthIssues: number;
  upcomingCalvings: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentMilk, isLoading: milkLoading } = useQuery<MilkEntry[]>({
    queryKey: ["/api/milk", "recent"],
  });

  const { data: pendingTasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", "pending"],
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts", "active"],
  });

  const milkChange = stats ? ((stats.todayMilk - stats.yesterdayMilk) / (stats.yesterdayMilk || 1)) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your farm overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/milk/new">
            <Button className="gap-2" data-testid="button-add-milk">
              <Plus className="w-4 h-4" />
              Record Milk
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/milk/new">
          <Card className="cursor-pointer hover-elevate transition-all" data-testid="quick-action-milk">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Milk className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Milk Entry</p>
                <p className="text-xs text-muted-foreground">Record now</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/health/new">
          <Card className="cursor-pointer hover-elevate transition-all" data-testid="quick-action-health">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Cow Sick</p>
                <p className="text-xs text-muted-foreground">Report issue</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/feed/new">
          <Card className="cursor-pointer hover-elevate transition-all" data-testid="quick-action-feed">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Heart className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Feed Given</p>
                <p className="text-xs text-muted-foreground">Log feeding</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/cattle/new">
          <Card className="cursor-pointer hover-elevate transition-all" data-testid="quick-action-cattle">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Add Cattle</p>
                <p className="text-xs text-muted-foreground">New entry</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cattle</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-foreground" data-testid="stat-total-cattle">
                    {stats?.totalCattle || 0}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.milkingCattle || 0} milking
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Milk</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-20 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-foreground" data-testid="stat-today-milk">
                    {stats?.todayMilk?.toFixed(1) || "0"} L
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  {milkChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`text-xs ${milkChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {Math.abs(milkChange).toFixed(1)}% from yesterday
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Milk className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-foreground" data-testid="stat-pending-tasks">
                    {stats?.pendingTasks || 0}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Due today
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                {statsLoading ? (
                  <Skeleton className="h-8 w-12 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-foreground" data-testid="stat-active-alerts">
                    {stats?.activeAlerts || 0}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.healthIssues || 0} health issues
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tasks and Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg">Today's Tasks</CardTitle>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-tasks">
                  View all
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : pendingTasks && pendingTasks.length > 0 ? (
                <div className="space-y-3">
                  {pendingTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                      data-testid={`task-item-${task.id}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        task.priority === "urgent" ? "bg-red-500" :
                        task.priority === "high" ? "bg-orange-500" :
                        task.priority === "medium" ? "bg-yellow-500" : "bg-green-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.type}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">All caught up! No pending tasks.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg">Active Alerts</CardTitle>
              <Link href="/alerts">
                <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-alerts">
                  View all
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : alerts && alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        alert.severity === "critical" ? "bg-red-50 dark:bg-red-900/20" :
                        alert.severity === "warning" ? "bg-amber-50 dark:bg-amber-900/20" :
                        "bg-blue-50 dark:bg-blue-900/20"
                      }`}
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                        alert.severity === "critical" ? "text-red-500" :
                        alert.severity === "warning" ? "text-amber-500" :
                        "text-blue-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No active alerts. Everything looks good!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Pregnancy Checks</p>
                    <p className="text-xs text-muted-foreground">Due this week</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Expected Calving</p>
                    <p className="text-xs text-muted-foreground">In 5 days</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold">
                    5
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Vaccinations Due</p>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Milk</span>
                  <span className="font-semibold text-foreground">1,245.5 L</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avg per Cow</span>
                  <span className="font-semibold text-foreground">12.8 L</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-semibold text-foreground">62,275</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Feed Cost</span>
                  <span className="font-semibold text-foreground">18,500</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
