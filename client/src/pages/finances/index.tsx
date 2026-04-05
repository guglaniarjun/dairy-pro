import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { format, startOfMonth, subMonths, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Plus, TrendingUp, TrendingDown, Receipt,
  IndianRupee, Download, BarChart3, ChevronRight
} from "lucide-react";

const INR = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN")}`;
const fmtDate = (d: string) => { try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; } };

const VALID_TABS = ["transactions", "income", "expenses", "analysis"] as const;

function KPICard({ label, value, sub, color, href }: { label: string; value: string; sub?: string; color: string; href?: string }) {
  const c: Record<string, string> = {
    green: "border-l-green-500 bg-green-50/50 dark:bg-green-950/20",
    red: "border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
    blue: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
    purple: "border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20",
    amber: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
    orange: "border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20",
  };
  const textColor: Record<string, string> = {
    green: "text-green-700 dark:text-green-400",
    red: "text-red-700 dark:text-red-400",
    blue: "text-blue-700 dark:text-blue-400",
    purple: "text-purple-700 dark:text-purple-400",
    amber: "text-amber-700 dark:text-amber-400",
    orange: "text-orange-700 dark:text-orange-400",
  };
  const inner = (
    <Card className={`border-l-4 ${c[color]} ${href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-xl font-bold ${textColor[color]}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {href && <p className="text-xs text-primary mt-1 flex items-center gap-1">View details <ChevronRight className="w-3 h-3" /></p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function CategoryBreakdown({ items, colorClass, onCategoryClick }: { items: [string, number][]; colorClass: string; onCategoryClick?: (cat: string) => void }) {
  if (!items.length) return <p className="text-sm text-muted-foreground py-4 text-center">No data</p>;
  const max = Math.max(...items.map(([, v]) => v));
  return (
    <div className="space-y-2">
      {items.sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
        <div key={cat} className={onCategoryClick ? "cursor-pointer hover:opacity-80" : ""} onClick={() => onCategoryClick?.(cat)}>
          <div className="flex justify-between text-sm mb-0.5">
            <span className="text-foreground truncate">{cat}</span>
            <span className="font-medium ml-2 flex-shrink-0">{INR(val)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(val / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FinancesPage() {
  const [periodFilter, setPeriodFilter] = useState<string>("month");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const search = useSearch();

  const rawTab = new URLSearchParams(search).get("tab") || "transactions";
  const urlTab = VALID_TABS.includes(rawTab as any) ? rawTab : "transactions";
  const [activeTab, setActiveTab] = useState(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const { data: expenses = [], isLoading: expLoading } = useQuery<any[]>({ queryKey: ["/api/expenses"] });
  const { data: incomes = [], isLoading: incLoading } = useQuery<any[]>({ queryKey: ["/api/incomes"] });
  const { data: milkSales = [] } = useQuery<any[]>({ queryKey: ["/api/milk-sales"] });
  const { data: feedRecords = [] } = useQuery<any[]>({ queryKey: ["/api/feed/records"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  const now = new Date();
  const startDate = periodFilter === "week"
    ? new Date(now.getTime() - 7 * 86400000)
    : periodFilter === "month"
    ? startOfMonth(now)
    : periodFilter === "quarter"
    ? startOfMonth(subMonths(now, 2))
    : new Date(now.getFullYear(), 0, 1);

  const filterByPeriod = (d: any[]) =>
    d.filter((item: any) => {
      try { return new Date(item.date) >= startDate; } catch { return true; }
    });

  const periodExpenses = filterByPeriod(expenses);
  const periodIncomes = filterByPeriod(incomes);

  const totalIncome = periodIncomes.reduce((s: number, i: any) => s + parseFloat(i.amount || 0), 0);
  const totalExpense = periodExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;
  const milkSalesTotal = filterByPeriod(milkSales).reduce((s: number, ms: any) => s + parseFloat(ms.totalAmount || 0), 0);
  const feedCostTotal = filterByPeriod(feedRecords).reduce((s: number, f: any) => s + parseFloat(f.totalCost || 0), 0);
  const monthMilk = stats?.monthMilk || 0;
  const costPerKg = monthMilk > 0 ? totalExpense / monthMilk : null;

  const periodLabel = periodFilter === "week" ? "This Week" :
    periodFilter === "month" ? "This Month" :
    periodFilter === "quarter" ? "This Quarter" : "This Year";

  // Category breakdown
  const expByCat: Record<string, number> = {};
  periodExpenses.forEach((e: any) => {
    const cat = e.expenseHead || e.category || "Other";
    expByCat[cat] = (expByCat[cat] || 0) + parseFloat(e.amount || 0);
  });
  const incByCat: Record<string, number> = {};
  periodIncomes.forEach((i: any) => {
    const cat = i.incomeHead || i.category || "Other";
    incByCat[cat] = (incByCat[cat] || 0) + parseFloat(i.amount || 0);
  });

  // All transactions sorted
  const allTxns = [
    ...periodIncomes.map((i: any) => ({ ...i, txType: "income" })),
    ...periodExpenses.map((e: any) => ({ ...e, txType: "expense" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Category-filtered lists
  const filteredIncomes = categoryFilter
    ? periodIncomes.filter((i: any) => (i.incomeHead || i.category || "Other") === categoryFilter)
    : periodIncomes;
  const filteredExpenses = categoryFilter
    ? periodExpenses.filter((e: any) => (e.expenseHead || e.category || "Other") === categoryFilter)
    : periodExpenses;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCategoryFilter(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finances</h1>
          <p className="text-muted-foreground text-sm">Track income, expenses and profitability</p>
        </div>
        <div className="flex gap-2">
          <Link href="/finances/expense/new">
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-add-expense">
              <Receipt className="w-4 h-4" /> Expense
            </Button>
          </Link>
          <Link href="/finances/income/new">
            <Button size="sm" className="gap-1.5" data-testid="button-add-income">
              <Plus className="w-4 h-4" /> Income
            </Button>
          </Link>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex justify-end">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-period">
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

      {/* KPI Cards — each navigates to the relevant tab */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        <KPICard
          label="Total Revenue"
          value={INR(totalIncome)}
          sub={periodLabel}
          color="green"
          href="/finances?tab=income"
        />
        <KPICard
          label="Total Expenses"
          value={INR(totalExpense)}
          sub={periodLabel}
          color="red"
          href="/finances?tab=expenses"
        />
        <KPICard
          label="Net Profit"
          value={`${netProfit >= 0 ? "+" : "-"}${INR(netProfit)}`}
          sub={totalIncome > 0 ? `${((netProfit / totalIncome) * 100).toFixed(1)}% margin` : ""}
          color={netProfit >= 0 ? "blue" : "orange"}
          href="/finances?tab=analysis"
        />
        <KPICard
          label="Milk Sales"
          value={INR(milkSalesTotal)}
          sub="Milk revenue"
          color="purple"
          href="/finances?tab=income"
        />
        <KPICard
          label="Feed Cost"
          value={INR(feedCostTotal)}
          sub="Feed expenses"
          color="amber"
          href="/finances?tab=expenses"
        />
        {costPerKg !== null ? (
          <KPICard label="Cost/kg Milk" value={`₹${costPerKg.toFixed(2)}`} sub={`${monthMilk.toFixed(0)}L produced`} color="blue" href="/finances?tab=analysis" />
        ) : (
          <KPICard label="Cost/kg Milk" value="—" sub="No milk data" color="blue" />
        )}
      </div>

      {/* Category filter banner */}
      {categoryFilter && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 text-sm">
          <BarChart3 className="w-4 h-4 text-amber-600" />
          <span>Filtered by category: <strong>{categoryFilter}</strong></span>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto text-xs" onClick={() => setCategoryFilter(null)}>
            Show all
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="transactions" className="text-xs" data-testid="tab-transactions">Transactions ({allTxns.length})</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs" data-testid="tab-analysis">Cost Analysis</TabsTrigger>
          <TabsTrigger value="income" className="text-xs" data-testid="tab-income">Income ({periodIncomes.length})</TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs" data-testid="tab-expenses">Expenses ({periodExpenses.length})</TabsTrigger>
        </TabsList>

        {/* All Transactions */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Transactions — {periodLabel}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleTabChange("income")}>Income Only</Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleTabChange("expenses")}>Expenses Only</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(expLoading || incLoading) ? (
                <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : allTxns.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No transactions in {periodLabel.toLowerCase()}</div>
              ) : (
                <div className="divide-y">
                  {allTxns.slice(0, 50).map((t: any) => (
                    <div key={`${t.txType}-${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`transaction-${t.id}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.txType === "income" ? "bg-green-100" : "bg-red-100"}`}>
                        {t.txType === "income" ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.description || t.expenseHead || t.incomeHead || (t.txType === "income" ? "Income" : "Expense")}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(t.date)} · {t.vendorName || t.customerName || (t.txType === "income" ? "Income" : "Expense")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold text-sm flex-shrink-0 ${t.txType === "income" ? "text-green-600" : "text-red-600"}`}>
                          {t.txType === "income" ? "+" : "-"}{INR(parseFloat(t.amount))}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted"
                          onClick={() => {
                            const cat = t.txType === "income" ? (t.incomeHead || "Other") : (t.expenseHead || "Other");
                            setCategoryFilter(cat);
                            handleTabChange(t.txType === "income" ? "income" : "expenses");
                          }}
                        >
                          {t.txType === "income" ? (t.incomeHead || "Income") : (t.expenseHead || "Expense")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Analysis */}
        <TabsContent value="analysis">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Expense Breakdown — click to filter</CardTitle></CardHeader>
              <CardContent>
                <CategoryBreakdown
                  items={Object.entries(expByCat)}
                  colorClass="bg-red-400"
                  onCategoryClick={(cat) => { setCategoryFilter(cat); handleTabChange("expenses"); }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Breakdown — click to filter</CardTitle></CardHeader>
              <CardContent>
                <CategoryBreakdown
                  items={Object.entries(incByCat)}
                  colorClass="bg-green-400"
                  onCategoryClick={(cat) => { setCategoryFilter(cat); handleTabChange("income"); }}
                />
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Key Metrics — {periodLabel}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20 cursor-pointer hover:opacity-80" onClick={() => handleTabChange("income")}>
                    <p className="text-xl font-bold text-green-700">{INR(totalIncome)}</p>
                    <p className="text-xs text-muted-foreground">Revenue →</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20 cursor-pointer hover:opacity-80" onClick={() => handleTabChange("expenses")}>
                    <p className="text-xl font-bold text-red-700">{INR(totalExpense)}</p>
                    <p className="text-xs text-muted-foreground">Expenses →</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/40">
                    <p className={`text-xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{INR(netProfit)}</p>
                    <p className="text-xs text-muted-foreground">Net P&L</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/40">
                    <p className="text-xl font-bold">{costPerKg ? `₹${costPerKg.toFixed(2)}` : "—"}</p>
                    <p className="text-xs text-muted-foreground">Cost/kg Milk</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Income Tab */}
        <TabsContent value="income">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Income Records — {periodLabel}</CardTitle>
              <Link href="/finances/income/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" /> Add Income
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {filteredIncomes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  {categoryFilter ? `No income in "${categoryFilter}"` : `No income records in ${periodLabel.toLowerCase()}`}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredIncomes.map((i: any) => (
                    <div key={i.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`income-row-${i.id}`}>
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{i.description || i.incomeHead || "Income"}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(i.date)} · {i.customerName || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-green-600 text-sm">+{INR(parseFloat(i.amount))}</p>
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setCategoryFilter(categoryFilter === (i.incomeHead || "Other") ? null : (i.incomeHead || "Other"))}
                        >
                          {i.incomeHead || "Other"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Expense Records — {periodLabel}</CardTitle>
              <Link href="/finances/expense/new">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Receipt className="w-4 h-4" /> Add Expense
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  {categoryFilter ? `No expenses in "${categoryFilter}"` : `No expense records in ${periodLabel.toLowerCase()}`}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredExpenses.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`expense-row-${e.id}`}>
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.description || e.expenseHead || "Expense"}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(e.date)} · {e.vendorName || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-red-600 text-sm">-{INR(parseFloat(e.amount))}</p>
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted"
                          onClick={() => setCategoryFilter(categoryFilter === (e.expenseHead || "Other") ? null : (e.expenseHead || "Other"))}
                        >
                          {e.expenseHead || "Other"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
