import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Search,
  DollarSign,
  ShoppingCart,
  Wallet,
  PiggyBank,
} from "lucide-react";

interface CattlePLData {
  id: string;
  tagNumber: string;
  name: string | null;
  status: string;
  stage: string;
  purchaseCost: number;
  totalCosts: number;
  milkRevenue: number;
  saleAmount: number;
  totalInvestment: number;
  profitLoss: number | null;
  unrealizedPL: number | null;
  purchaseDate: string | null;
  saleDate: string | null;
}

export default function CattlePLDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: plData, isLoading } = useQuery<CattlePLData[]>({
    queryKey: ["/api/cattle-pl"],
  });

  const filteredData = plData?.filter((item) => {
    const matchesSearch =
      item.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalPurchaseCost = filteredData?.reduce((sum, item) => sum + item.purchaseCost, 0) || 0;
  const totalCosts = filteredData?.reduce((sum, item) => sum + item.totalCosts, 0) || 0;
  const totalSaleAmount = filteredData?.filter(i => i.status === "sold").reduce((sum, item) => sum + item.saleAmount, 0) || 0;
  const totalProfit = filteredData?.filter(i => i.profitLoss !== null).reduce((sum, item) => sum + (item.profitLoss || 0), 0) || 0;
  const soldCount = filteredData?.filter(i => i.status === "sold").length || 0;
  const activeCount = filteredData?.filter(i => i.status === "active").length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cattle">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cattle Profit/Loss Dashboard</h1>
          <p className="text-muted-foreground">
            Track financial performance of your cattle
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Purchase</p>
                <p className="text-lg font-bold" data-testid="text-total-purchase">
                  {formatCurrency(totalPurchaseCost)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Wallet className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Other Costs</p>
                <p className="text-lg font-bold" data-testid="text-total-costs">
                  {formatCurrency(totalCosts)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sale Revenue</p>
                <p className="text-lg font-bold" data-testid="text-total-sales">
                  {formatCurrency(totalSaleAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {totalProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Profit/Loss</p>
                <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} data-testid="text-net-pl">
                  {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search cattle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({plData?.length || 0})</SelectItem>
              <SelectItem value="active">Active ({activeCount})</SelectItem>
              <SelectItem value="sold">Sold ({soldCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Link href="/cattle/purchase">
            <Button variant="outline" data-testid="button-record-purchase">
              Record Purchase
            </Button>
          </Link>
          <Link href="/cattle/sale">
            <Button data-testid="button-record-sale">
              Record Sale
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Individual Cattle P/L</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredData && filteredData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cattle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Purchase</TableHead>
                    <TableHead className="text-right">Other Costs</TableHead>
                    <TableHead className="text-right">Total Investment</TableHead>
                    <TableHead className="text-right">Sale Amount</TableHead>
                    <TableHead className="text-right">P/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} data-testid={`row-cattle-${item.id}`}>
                      <TableCell>
                        <Link href={`/cattle/${item.id}`}>
                          <div className="hover:underline cursor-pointer">
                            <span className="font-medium">{item.name || item.tagNumber}</span>
                            {item.name && (
                              <span className="text-xs text-muted-foreground ml-2">
                                #{item.tagNumber}
                              </span>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "sold" ? "secondary" : "default"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.purchaseCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.totalCosts)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalInvestment)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.status === "sold" ? formatCurrency(item.saleAmount) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.profitLoss !== null ? (
                          <span className={`font-bold ${item.profitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {item.profitLoss >= 0 ? '+' : ''}{formatCurrency(item.profitLoss)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <PiggyBank className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No cattle records found</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your cattle purchases to see profit/loss data here.
              </p>
              <Link href="/cattle/purchase">
                <Button data-testid="button-first-purchase">
                  Record First Purchase
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
