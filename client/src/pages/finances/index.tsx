import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  IndianRupee,
  Download,
  PiggyBank,
} from "lucide-react";
import type { Expense, Income } from "@shared/schema";

export default function FinancesPage() {
  const [periodFilter, setPeriodFilter] = useState<string>("month");

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: incomes, isLoading: incomesLoading } = useQuery<Income[]>({
    queryKey: ["/api/incomes"],
  });

  const totalIncome = incomes?.reduce(
    (sum, i) => sum + parseFloat(i.amount), 0
  ) || 0;

  const totalExpense = expenses?.reduce(
    (sum, e) => sum + parseFloat(e.amount), 0
  ) || 0;

  const netProfit = totalIncome - totalExpense;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finances</h1>
          <p className="text-muted-foreground">Track income and expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" data-testid="button-export">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Link href="/finances/expense/new">
            <Button variant="outline" className="gap-2" data-testid="button-add-expense">
              <Receipt className="w-4 h-4" />
              Add Expense
            </Button>
          </Link>
          <Link href="/finances/income/new">
            <Button className="gap-2" data-testid="button-add-income">
              <Plus className="w-4 h-4" />
              Add Income
            </Button>
          </Link>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex justify-end">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-period">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 flex items-center gap-1" data-testid="stat-total-income">
                  <IndianRupee className="w-5 h-5" />
                  {totalIncome.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center gap-1" data-testid="stat-total-expense">
                  <IndianRupee className="w-5 h-5" />
                  {totalExpense.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${netProfit >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-2xl font-bold flex items-center gap-1 ${netProfit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`} data-testid="stat-net-profit">
                  <IndianRupee className="w-5 h-5" />
                  {Math.abs(netProfit).toLocaleString("en-IN")}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${netProfit >= 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                <Wallet className={`w-6 h-6 ${netProfit >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <PiggyBank className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="income" data-testid="tab-income">Income</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(expensesLoading || incomesLoading) ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ...(incomes?.map((i) => ({ ...i, type: "income" as const })) || []),
                      ...(expenses?.map((e) => ({ ...e, type: "expense" as const })) || []),
                    ]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 10)
                      .map((item) => (
                        <TableRow key={item.id} data-testid={`transaction-${item.id}`}>
                          <TableCell>
                            {format(new Date(item.date), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>{item.description || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={item.type === "income" ? "text-green-600" : "text-red-600"}>
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${item.type === "income" ? "text-green-600" : "text-red-600"}`}>
                            {item.type === "income" ? "+" : "-"}
                            {parseFloat(item.amount).toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Income Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {incomesLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : incomes && incomes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomes.map((income) => (
                      <TableRow key={income.id}>
                        <TableCell>{format(new Date(income.date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{income.description || "-"}</TableCell>
                        <TableCell>{income.customerName || "-"}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          +{parseFloat(income.amount).toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">No income records yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Expense Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {expensesLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : expenses && expenses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(new Date(expense.date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{expense.description || "-"}</TableCell>
                        <TableCell>{expense.vendorName || "-"}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          -{parseFloat(expense.amount).toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">No expense records yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
