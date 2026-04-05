import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  Milk, Heart, Stethoscope, TrendingUp, TrendingDown, AlertTriangle,
  Plus, ArrowRight, Calendar, CheckCircle2, Clock, Syringe, Baby,
  Wallet, Thermometer, Activity, BarChart3, Users, Leaf,
} from "lucide-react";

function KPICard({
  label, value, sub, icon, color, href, loading
}: {
  label: string; value: any; sub?: string; icon: any; color: string; href?: string; loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900",
    green: "bg-green-50 dark:bg-green-950/40 border-green-100 dark:border-green-900",
    red: "bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900",
    orange: "bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900",
    purple: "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900",
    amber: "bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900",
    pink: "bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900",
    teal: "bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900",
  };
  const iconColor: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50",
    green: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50",
    red: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50",
    orange: "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50",
    purple: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50",
    pink: "text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/50",
    teal: "text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/50",
  };
  const Icon = icon;
  const inner = (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${href ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${colorMap[color] || ""}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor[color] || ""}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold leading-tight mt-0.5">{value ?? "—"}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {href && (
        <Link href={href}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
            View all <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<any[]>({
    queryKey: ["/api/alerts", "active"],
  });

  const milkChange = stats
    ? ((stats.todayMilk - stats.yesterdayMilk) / (stats.yesterdayMilk || 1)) * 100
    : 0;

  const s = stats || {};

  return (
    <div className="p-3 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/milk/new">
            <Button size="sm" className="gap-1.5" data-testid="button-add-milk">
              <Plus className="w-4 h-4" /> Record Milk
            </Button>
          </Link>
          <Link href="/cattle/new">
            <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-add-cattle">
              <Plus className="w-4 h-4" /> Add Cattle
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {[
          { label: "Milk Entry", href: "/milk/new", icon: Milk, color: "bg-blue-500" },
          { label: "Sick Cow", href: "/health/new", icon: Stethoscope, color: "bg-red-500" },
          { label: "Record Heat", href: "/breeding/heat", icon: Heart, color: "bg-pink-500" },
          { label: "Add Cattle", href: "/cattle/new", icon: Plus, color: "bg-purple-500" },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/40 hover:bg-muted cursor-pointer transition-colors text-center">
              <div className={`w-9 h-9 rounded-lg ${a.color} flex items-center justify-center`}>
                <a.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium leading-tight">{a.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* KPI Group 1: Herd Summary */}
      <div>
        <SectionHeader title="🐄 Herd Summary" href="/cattle" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <KPICard label="Total Cattle" value={s.totalCattle} sub={`${s.milkingCattle || 0} milking`} icon={Heart} color="green" href="/cattle" loading={isLoading} />
          <KPICard label="Milking" value={s.milkingCattle} sub="Active lactation" icon={Milk} color="blue" href="/cattle?stage=milking" loading={isLoading} />
          <KPICard label="Pregnant" value={s.pregnantCattle} sub="Confirmed" icon={Baby} color="purple" href="/cattle?stage=pregnant" loading={isLoading} />
          <KPICard label="Dry" value={s.dryCattle} sub="Not milking" icon={Activity} color="amber" href="/cattle?stage=dry" loading={isLoading} />
        </div>
      </div>

      {/* KPI Group 2: Expected Events */}
      <div>
        <SectionHeader title="📅 Expected Actions (Next 30 Days)" href="/breeding" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <KPICard label="Expected Heat" value={s.expectedHeat} sub="Heat cycle due" icon={Thermometer} color="pink" href="/breeding?filter=heat-due" loading={isLoading} />
          <KPICard label="Pregnancy Test Due" value={s.pregnancyTestDue} sub="After insemination" icon={Activity} color="orange" href="/breeding?filter=pt-due" loading={isLoading} />
          <KPICard label="Expected Calving" value={s.expectedCalving} sub="Within 30 days" icon={Baby} color="teal" href="/breeding?filter=calving-due" loading={isLoading} />
          <KPICard label="Dry Off Due" value={s.dryOffDue} sub="60d before calving" icon={Clock} color="amber" href="/breeding?filter=dry-due" loading={isLoading} />
        </div>
      </div>

      {/* KPI Group 3: Milk Snapshot */}
      <div>
        <SectionHeader title="🥛 Milk Snapshot" href="/milk" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <KPICard
            label="Today's Milk"
            value={`${(s.todayMilk || 0).toFixed(1)} L`}
            sub={`${milkChange >= 0 ? "▲" : "▼"} ${Math.abs(milkChange).toFixed(1)}% vs yesterday`}
            icon={Milk}
            color={milkChange >= 0 ? "green" : "red"}
            href="/milk"
            loading={isLoading}
          />
          <KPICard label="Month Total" value={`${(s.monthMilk || 0).toFixed(0)} L`} sub="This month" icon={BarChart3} color="blue" href="/milk" loading={isLoading} />
          <KPICard label="Herd Avg/Day" value={`${(s.herdAvgMilk || 0).toFixed(1)} L`} sub="Per milking cow" icon={TrendingUp} color="teal" href="/milk" loading={isLoading} />
          <KPICard label="Month Avg" value={`${(s.monthAvgMilk || 0).toFixed(1)} L/day`} sub="30-day rolling" icon={Activity} color="purple" href="/reports" loading={isLoading} />
        </div>
      </div>

      {/* KPI Group 4: Finance Snapshot */}
      <div>
        <SectionHeader title="💰 Finance Snapshot" href="/finances" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <KPICard label="This Month Revenue" value={`₹${(s.monthRevenue || 0).toLocaleString("en-IN")}`} sub="Milk + byproducts" icon={TrendingUp} color="green" href="/finances?tab=income" loading={isLoading} />
          <KPICard label="This Month Expense" value={`₹${(s.monthExpense || 0).toLocaleString("en-IN")}`} sub="All categories" icon={TrendingDown} color="red" href="/finances?tab=expenses" loading={isLoading} />
          <KPICard label="Receivables" value={`₹${(s.pendingReceivables || 0).toLocaleString("en-IN")}`} sub="Unpaid milk sales" icon={Wallet} color="orange" href="/finances?tab=income" loading={isLoading} />
          <KPICard label="Cost/kg Milk" value={s.costPerKgMilk ? `₹${Number(s.costPerKgMilk).toFixed(2)}` : "—"} sub="Feed+health/milk" icon={BarChart3} color="purple" href="/reports" loading={isLoading} />
        </div>
      </div>

      {/* KPI Group 5: Health & Vaccination */}
      <div>
        <SectionHeader title="💉 Health & Vaccination" href="/health" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <KPICard label="Active Health Issues" value={s.activeHealthIssues} sub="Under treatment" icon={Stethoscope} color="red" href="/health" loading={isLoading} />
          <KPICard label="Vaccination Due" value={s.vaccinationDue} sub="Next 30 days" icon={Syringe} color="orange" href="/health?tab=vaccination" loading={isLoading} />
          <KPICard label="Overdue Vaccinations" value={s.vaccinationOverdue} sub="Past due date" icon={AlertTriangle} color="red" href="/health?tab=vaccination" loading={isLoading} />
          <KPICard label="Deworming Due" value={s.dewormingDue} sub="Next 30 days" icon={Activity} color="amber" href="/health?tab=vaccination" loading={isLoading} />
        </div>
      </div>

      {/* KPI Group 6: Breeding Performance */}
      <div>
        <SectionHeader title="♻️ Breeding Performance" href="/breeding" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <KPICard label="Open Cattle" value={s.openCattle} sub="Not pregnant" icon={Heart} color="orange" href="/breeding?filter=open" loading={isLoading} />
          <KPICard label="Repeat Breeders" value={s.repeatBreeders} sub="3+ failed AIs" icon={AlertTriangle} color="red" href="/breeding?filter=repeat" loading={isLoading} />
          <KPICard label="Conception Rate" value={s.conceptionRate ? `${s.conceptionRate}%` : "—"} sub="AI success rate" icon={Activity} color="teal" href="/reports" loading={isLoading} />
          <KPICard label="Total Inseminations" value={s.totalInseminations} sub="All time" icon={Users} color="purple" href="/breeding" loading={isLoading} />
        </div>
      </div>

      {/* Bottom: Alerts + Upcoming */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionHeader title="🔔 Active Alerts" href="/alerts" />
          <Card>
            <CardContent className="p-4">
              {alertsLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : alerts.length > 0 ? (
                <div className="space-y-2">
                  {alerts.slice(0, 6).map((alert: any) => (
                    <div
                      key={alert.id}
                      className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                        alert.severity === "critical" ? "bg-red-50 dark:bg-red-950/30" :
                        alert.severity === "warning" ? "bg-amber-50 dark:bg-amber-950/30" :
                        "bg-blue-50 dark:bg-blue-950/30"
                      }`}
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        alert.severity === "critical" ? "text-red-500" :
                        alert.severity === "warning" ? "text-amber-500" : "text-blue-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-muted-foreground text-xs">{alert.message}</p>
                      </div>
                      {alert.cattleId && (
                        <Link href={`/cattle/${alert.cattleId}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">View</Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-3" />
                  <p className="text-muted-foreground text-sm">No active alerts — everything looks good!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <SectionHeader title="📆 Upcoming Events" />
          <Card>
            <CardContent className="p-4 space-y-2">
              {isLoading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <>
                  <EventRow icon="🌡️" label="Heats Due" value={s.expectedHeat} color="pink" href="/breeding?filter=heat-due" />
                  <EventRow icon="🔬" label="Pregnancy Tests" value={s.pregnancyTestDue} color="orange" href="/breeding?filter=pt-due" />
                  <EventRow icon="🐄" label="Expected Calvings" value={s.expectedCalving} color="teal" href="/breeding?filter=calving-due" />
                  <EventRow icon="💉" label="Vaccinations Due" value={s.vaccinationDue} color="amber" href="/health?tab=vaccination" />
                  <EventRow icon="💊" label="Deworming Due" value={s.dewormingDue} color="green" href="/health?tab=vaccination" />
                </>
              )}
            </CardContent>
          </Card>

          {/* Plan Usage */}
          <Card className="mt-3">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Plan Usage</p>
              <div className="flex justify-between text-sm mb-1">
                <span>Cattle</span>
                <span className="font-medium">{s.totalCattle || 0} / {s.maxCattle || 5}</span>
              </div>
              <Progress value={Math.min(((s.totalCattle || 0) / (s.maxCattle || 5)) * 100, 100)} className="h-1.5" />
              <div className="mt-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground capitalize">{s.currentPlan || "Free"} Plan</span>
                <Link href="/billing">
                  <Button variant="ghost" className="text-xs h-auto p-0 text-primary underline-offset-2 hover:underline">Upgrade</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EventRow({ icon, label, value, color, href }: { icon: string; label: string; value: any; color: string; href: string }) {
  const colorMap: Record<string, string> = {
    pink: "bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300",
    orange: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300",
    teal: "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300",
    amber: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
    green: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300",
  };
  return (
    <Link href={href}>
      <div className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer hover:opacity-80 ${colorMap[color] || "bg-muted"}`}>
        <span className="text-sm flex items-center gap-2">
          <span>{icon}</span> {label}
        </span>
        <span className="font-bold">{value ?? 0}</span>
      </div>
    </Link>
  );
}
