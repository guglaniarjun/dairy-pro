import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  Search,
  Package,
  AlertTriangle,
  Leaf,
  Pill,
  Wrench,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import type { InventoryItem, FeedInventory } from "@shared/schema";

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: items, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: feedInventory } = useQuery<FeedInventory[]>({
    queryKey: ["/api/feed/inventory"],
  });

  const filteredItems = items?.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const lowStockItems = items?.filter(
    (item) => item.minStock && parseFloat(item.currentStock) <= parseFloat(item.minStock)
  ).length || 0;

  const totalValue = items?.reduce(
    (sum, item) => sum + (parseFloat(item.currentStock) * (parseFloat(item.avgCost || "0"))),
    0
  ) || 0;

  const getCategoryIcon = (categoryId: string | null) => {
    return <Package className="w-4 h-4" />;
  };

  const getStockLevel = (current: string, min: string | null, max: string | null) => {
    const currentVal = parseFloat(current);
    const minVal = min ? parseFloat(min) : 0;
    const maxVal = max ? parseFloat(max) : currentVal * 2;
    
    if (currentVal <= minVal) return { level: "critical", color: "bg-red-500", percent: 10 };
    if (currentVal <= minVal * 1.5) return { level: "low", color: "bg-amber-500", percent: 30 };
    const percent = Math.min(100, (currentVal / maxVal) * 100);
    return { level: "normal", color: "bg-green-500", percent };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">Manage feed, medicine, and supplies</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/purchase">
            <Button variant="outline" className="gap-2" data-testid="button-purchase">
              <ArrowDownRight className="w-4 h-4" />
              Record Purchase
            </Button>
          </Link>
          <Link href="/inventory/issue">
            <Button className="gap-2" data-testid="button-issue">
              <ArrowUpRight className="w-4 h-4" />
              Issue Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-3xl font-bold text-foreground">{items?.length || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={lowStockItems > 0 ? "border-amber-500" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
                <p className="text-3xl font-bold text-amber-600">{lowStockItems}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Feed Items</p>
                <p className="text-3xl font-bold text-foreground">{feedInventory?.length || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-3xl font-bold text-foreground">
                  {totalValue.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="text-lg">₹</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="feed" data-testid="tab-feed">Feed</TabsTrigger>
          <TabsTrigger value="medicine" data-testid="tab-medicine">Medicine</TabsTrigger>
          <TabsTrigger value="equipment" data-testid="tab-equipment">Equipment</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* Search */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-inventory"
              />
            </div>
          </div>

          <TabsContent value="all" className="mt-0">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredItems && filteredItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Current Stock</TableHead>
                        <TableHead>Stock Level</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const stockLevel = getStockLevel(item.currentStock, item.minStock, item.maxStock);
                        return (
                          <TableRow key={item.id} data-testid={`inventory-row-${item.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(item.categoryId)}
                                <span className="font-medium">{item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.sku || "-"}
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">
                                {parseFloat(item.currentStock).toFixed(1)} {item.unit}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 w-32">
                                <Progress value={stockLevel.percent} className="h-2" />
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${stockLevel.level === "critical" ? "text-red-600" : stockLevel.level === "low" ? "text-amber-600" : "text-green-600"}`}
                                >
                                  {stockLevel.level}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              ₹{parseFloat(item.avgCost || "0").toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No inventory items
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Start by adding items to your inventory
                    </p>
                    <Link href="/inventory/new">
                      <Button className="gap-2" data-testid="button-add-first-item">
                        <Plus className="w-4 h-4" />
                        Add Item
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feed" className="mt-0">
            <Card className="p-6">
              <p className="text-muted-foreground text-center">Feed inventory items will appear here</p>
            </Card>
          </TabsContent>

          <TabsContent value="medicine" className="mt-0">
            <Card className="p-6">
              <p className="text-muted-foreground text-center">Medicine inventory items will appear here</p>
            </Card>
          </TabsContent>

          <TabsContent value="equipment" className="mt-0">
            <Card className="p-6">
              <p className="text-muted-foreground text-center">Equipment inventory items will appear here</p>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
