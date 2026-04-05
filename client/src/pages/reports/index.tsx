import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, Download, TrendingUp, Milk, Heart, Wallet, Calendar,
  FileText, ChevronRight, Activity, Users, Syringe,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const INR = (v: number) => `₹${v.toLocaleString("en-IN")}`;
const fmtDate = (d: string) => { try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; } };

function exportCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, icon, color, href }: any) {
  const bg: Record<string, string> = {
    blue: "bg-blue-100 dark:bg-blue-900/30",
    green: "bg-green-100 dark:bg-green-900/30",
    purple: "bg-purple-100 dark:bg-purple-900/30",
    amber: "bg-amber-100 dark:bg-amber-900/30",
  };
  const text: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    purple: "text-purple-600 dark:text-purple-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  const inner = (
    <Card className={href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg[color]}`}>
          <span className={text[color]}>{icon}</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
          {href && <p className={`text-xs mt-0.5 ${text[color]}`}>View →</p>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState("month");
  const { toast } = useToast();

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const { data: milkEntries = [] } = useQuery<any[]>({ queryKey: ["/api/milk"] });
  const { data: healthEvents = [] } = useQuery<any[]>({ queryKey: ["/api/health"] });
  const { data: vaccinations = [] } = useQuery<any[]>({ queryKey: ["/api/vaccinations"] });
  const { data: expenses = [] } = useQuery<any[]>({ queryKey: ["/api/expenses"] });
  const { data: incomes = [] } = useQuery<any[]>({ queryKey: ["/api/incomes"] });
  const { data: inseminations = [] } = useQuery<any[]>({ queryKey: ["/api/breeding/inseminations"] });
  const { data: pregnancyTests = [] } = useQuery<any[]>({ queryKey: ["/api/breeding/pregnancy-tests"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  const getCowName = (id: any) => {
    const c = cattle.find((c: any) => c.id === id || c.id === Number(id));
    return c?.name || c?.tagNumber || `#${id}`;
  };

  const now = new Date();
  const startDate = period === "week" ? new Date(now.getTime() - 7 * 86400000) :
    period === "month" ? startOfMonth(now) :
    period === "quarter" ? startOfMonth(subMonths(now, 2)) :
    new Date(now.getFullYear(), 0, 1);

  const inPeriod = (d: any[], key = "date") =>
    d.filter((i: any) => { try { return new Date(i[key]) >= startDate; } catch { return true; } });

  const pMilk = inPeriod(milkEntries);
  const pExpenses = inPeriod(expenses);
  const pIncomes = inPeriod(incomes);
  const pHealth = inPeriod(healthEvents);
  const pIns = inPeriod(inseminations);
  const pPT = inPeriod(pregnancyTests);

  const totalMilk = pMilk.reduce((s: number, m: any) => s + parseFloat(m.quantity || 0), 0);
  const totalRevenue = pIncomes.reduce((s: number, i: any) => s + parseFloat(i.amount || 0), 0);
  const totalExpense = pExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0);

  // Cattle-wise milk summary
  const milkByCattle: Record<string, { name: string; total: number; days: Set<string>; sessions: number }> = {};
  pMilk.forEach((m: any) => {
    if (!milkByCattle[m.cattleId]) milkByCattle[m.cattleId] = { name: getCowName(m.cattleId), total: 0, days: new Set(), sessions: 0 };
    milkByCattle[m.cattleId].total += parseFloat(m.quantity || 0);
    milkByCattle[m.cattleId].days.add(m.date);
    milkByCattle[m.cattleId].sessions++;
  });

  // Daily milk summary
  const milkByDay: Record<string, number> = {};
  pMilk.forEach((m: any) => {
    milkByDay[m.date] = (milkByDay[m.date] || 0) + parseFloat(m.quantity || 0);
  });
  const dailyMilk = Object.entries(milkByDay).sort(([a], [b]) => b.localeCompare(a));

  // Expense breakdown by category
  const expByCat: Record<string, number> = {};
  pExpenses.forEach((e: any) => {
    const cat = e.expenseHead || "Other";
    expByCat[cat] = (expByCat[cat] || 0) + parseFloat(e.amount || 0);
  });

  // Breeding metrics
  const positivePT = pPT.filter((p: any) => p.result === "positive").length;
  const conceptionRate = pIns.length > 0 ? ((positivePT / pIns.length) * 100).toFixed(1) : null;

  // Health by type
  const healthByType: Record<string, number> = {};
  pHealth.forEach((h: any) => {
    healthByType[h.eventType || "other"] = (healthByType[h.eventType || "other"] || 0) + 1;
  });

  // Herd composition
  const byStatus: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  cattle.forEach((c: any) => {
    if (c.status !== "sold" && c.status !== "dead") {
      byStatus[c.status || "active"] = (byStatus[c.status || "active"] || 0) + 1;
      byStage[c.stage || "milking"] = (byStage[c.stage || "milking"] || 0) + 1;
    }
  });

  const periodLabel = period === "week" ? "This Week" : period === "month" ? "This Month" :
    period === "quarter" ? "This Quarter" : "This Year";

  // Export functions
  const exportMilkReport = () => {
    const rows = [
      ["Date", "Cow", "Session", "Quantity (L)", "FAT%", "SNF%"],
      ...pMilk.map((m: any) => [fmtDate(m.date), getCowName(m.cattleId), m.session, m.quantity, m.fat || "", m.snf || ""])
    ];
    exportCSV(rows, `milk-report-${period}.csv`);
    toast({ title: "Milk report exported" });
  };

  const exportFinanceReport = () => {
    const rows = [
      ["Date", "Type", "Description", "Category", "Amount (₹)", "Party"],
      ...pIncomes.map((i: any) => [fmtDate(i.date), "Income", i.description || "", i.incomeHead || "", i.amount, i.customerName || ""]),
      ...pExpenses.map((e: any) => [fmtDate(e.date), "Expense", e.description || "", e.expenseHead || "", `-${e.amount}`, e.vendorName || ""]),
    ];
    exportCSV(rows, `finance-report-${period}.csv`);
    toast({ title: "Finance report exported" });
  };

  const exportCattleReport = () => {
    const rows = [
      ["Tag", "Name", "Breed", "Age", "Gender", "Status", "Stage"],
      ...cattle.map((c: any) => [c.tagNumber || "", c.name || "", c.breed || "", c.age || "", c.gender || "", c.status || "", c.stage || ""])
    ];
    exportCSV(rows, `cattle-report.csv`);
    toast({ title: "Cattle report exported" });
  };

  const exportHealthReport = () => {
    const rows = [
      ["Date", "Cow", "Type", "Severity", "Diagnosis", "Status"],
      ...pHealth.map((h: any) => [fmtDate(h.date), getCowName(h.cattleId), h.eventType || "", h.severity || "", h.diagnosis || h.description || "", h.status || ""])
    ];
    exportCSV(rows, `health-report-${period}.csv`);
    toast({ title: "Health report exported" });
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm">Generate and export farm reports</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]" data-testid="select-period">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Stats — click to navigate to the relevant module */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <StatCard label="Total Milk" value={`${totalMilk.toFixed(0)} L`} icon={<Milk className="w-5 h-5" />} color="blue" href="/milk" />
        <StatCard label="Revenue" value={INR(totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} color="green" href="/finances?tab=income" />
        <StatCard label="Expenses" value={INR(totalExpense)} icon={<Wallet className="w-5 h-5" />} color="purple" href="/finances?tab=expenses" />
        <StatCard label="Conception Rate" value={conceptionRate ? `${conceptionRate}%` : "—"} icon={<Heart className="w-5 h-5" />} color="amber" href="/breeding?tab=pregnancy" />
      </div>

      <Tabs defaultValue="milk" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="milk" className="text-xs">🥛 Milk ({pMilk.length})</TabsTrigger>
          <TabsTrigger value="cattle" className="text-xs">🐄 Cattle ({cattle.length})</TabsTrigger>
          <TabsTrigger value="health" className="text-xs">🏥 Health ({pHealth.length})</TabsTrigger>
          <TabsTrigger value="finance" className="text-xs">💰 Finance</TabsTrigger>
          <TabsTrigger value="breeding" className="text-xs">♻️ Breeding</TabsTrigger>
        </TabsList>

        {/* Milk Report */}
        <TabsContent value="milk">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={exportMilkReport} className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Daily milk trend chart */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily Milk Trend — {periodLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyMilk.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyMilk.slice(0, 30).reverse().map(([date, qty]) => ({ date: format(parseISO(date), "dd/MM"), qty: Math.round(qty * 10) / 10 }))}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit=" L" />
                      <Tooltip formatter={(v: any) => [`${v} L`, "Milk"]} />
                      <Bar dataKey="qty" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Cow-wise summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cattle-wise Milk</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(milkByCattle).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {Object.entries(milkByCattle).sort(([, a], [, b]) => b.total - a.total).map(([cattleId, { name, total, days, sessions }]) => (
                      <div key={cattleId} className="py-1.5 border-b last:border-0">
                        <div className="flex justify-between text-sm mb-1">
                          <Link href={`/cattle/${cattleId}`}>
                            <span className="font-medium truncate max-w-[120px] text-primary hover:underline cursor-pointer">{name}</span>
                          </Link>
                          <Link href={`/milk?cattleId=${cattleId}`}>
                            <span className="font-medium text-blue-600 hover:underline cursor-pointer">{total.toFixed(1)} L →</span>
                          </Link>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${(total / Math.max(...Object.values(milkByCattle).map(c => c.total))) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{sessions} sessions · {days.size} days</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Session breakdown */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Session Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {["morning", "evening", "night"].map(session => {
                    const total = pMilk.filter((m: any) => m.session === session).reduce((s: number, m: any) => s + parseFloat(m.quantity || 0), 0);
                    const pct = totalMilk > 0 ? (total / totalMilk * 100).toFixed(0) : 0;
                    return (
                      <div key={session} className="text-center p-3 rounded-lg bg-muted/40">
                        <p className="text-lg">{session === "morning" ? "🌅" : session === "evening" ? "🌆" : "🌙"}</p>
                        <p className="text-xl font-bold">{total.toFixed(1)} L</p>
                        <p className="text-xs text-muted-foreground capitalize">{session} ({pct}%)</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cattle Report */}
        <TabsContent value="cattle">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={exportCattleReport} className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Herd by Stage</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(byStage).map(([stage, count]) => (
                    <Link key={stage} href={`/cattle?stage=${stage}`}>
                      <div className="flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity py-0.5">
                        <span className="text-sm capitalize text-primary hover:underline">{stage}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-muted">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${(count / cattle.length) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium w-8 text-right">{count}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Herd by Status</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(byStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{status}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${(count / cattle.length) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Full Cattle List</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-y-auto divide-y">
                  {cattle.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 py-2">
                      <span className="text-xs text-muted-foreground w-16">{c.tagNumber}</span>
                      <span className="flex-1 text-sm font-medium">{c.name || "—"}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{c.stage}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{c.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Health Report */}
        <TabsContent value="health">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={exportHealthReport} className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Health Events by Type</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(healthByType).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No health events in {periodLabel.toLowerCase()}</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(healthByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="text-sm capitalize">{type}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Vaccination Stats</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Vaccinated</span>
                    <span className="font-medium">{vaccinations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">In Period</span>
                    <span className="font-medium">{inPeriod(vaccinations).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Compliance</span>
                    <span className="font-medium text-green-600">
                      {cattle.length > 0 ? `${Math.min(100, Math.round((vaccinations.length / cattle.length) * 100))}%` : "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Finance Report */}
        <TabsContent value="finance">
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={exportFinanceReport} className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Expense Breakdown</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(expByCat).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No expenses in {periodLabel.toLowerCase()}</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(expByCat).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between items-center py-1">
                        <span className="text-sm">{cat}</span>
                        <span className="text-sm font-medium text-red-600">{INR(amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Income vs Expense</CardTitle></CardHeader>
              <CardContent>
                {(totalRevenue > 0 || totalExpense > 0) && (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={[
                      { name: "Revenue", amount: totalRevenue, fill: "#22c55e" },
                      { name: "Expense", amount: totalExpense, fill: "#ef4444" },
                      { name: "Profit", amount: Math.max(0, totalRevenue - totalExpense), fill: "#3b82f6" },
                    ]} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={60} />
                      <Tooltip formatter={(v: any) => INR(v)} />
                      <Bar dataKey="amount" radius={[0, 3, 3, 0]}>
                        {[{ fill: "#22c55e" }, { fill: "#ef4444" }, { fill: "#3b82f6" }].map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="space-y-4 mt-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Revenue</span>
                      <span className="text-green-600 font-medium">{INR(totalRevenue)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-green-500" style={{ width: totalRevenue > totalExpense ? "100%" : `${(totalRevenue / totalExpense) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Expenses</span>
                      <span className="text-red-600 font-medium">{INR(totalExpense)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-red-500" style={{ width: totalExpense > totalRevenue ? "100%" : `${(totalExpense / totalRevenue) * 100}%` }} />
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between font-semibold">
                      <span>Net P&L</span>
                      <span className={totalRevenue >= totalExpense ? "text-green-600" : "text-red-600"}>
                        {totalRevenue >= totalExpense ? "+" : ""}{INR(totalRevenue - totalExpense)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Breeding Report */}
        <TabsContent value="breeding">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Breeding Metrics — {periodLabel}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Inseminations</span>
                    <span className="font-medium">{pIns.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pregnancy Tests Done</span>
                    <span className="font-medium">{pPT.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Positive Confirmations</span>
                    <span className="font-medium text-green-600">{positivePT}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conception Rate</span>
                    <span className="font-medium text-blue-600">{conceptionRate ? `${conceptionRate}%` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Currently Pregnant</span>
                    <span className="font-medium">{stats?.pregnantCattle || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Open Cattle</span>
                    <span className="font-medium">{stats?.openCattle || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Herd Reproductive Status</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { label: "Pregnant", count: stats?.pregnantCattle || 0, color: "bg-purple-500" },
                    { label: "Milking", count: stats?.milkingCattle || 0, color: "bg-blue-500" },
                    { label: "Dry", count: stats?.dryCattle || 0, color: "bg-amber-500" },
                    { label: "Open", count: stats?.openCattle || 0, color: "bg-orange-500" },
                  ].map(({ label, count, color }) => {
                    const total = cattle.filter((c: any) => c.gender === "female").length || 1;
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-sm w-20">{label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
