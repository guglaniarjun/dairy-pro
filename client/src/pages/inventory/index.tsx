import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Plus, Search, Package, AlertTriangle, Leaf, Pill, Wrench, ArrowDownRight, ArrowUpRight, ChevronRight, X
} from "lucide-react";
import type { InventoryItem, FeedInventory } from "@shared/schema";

const TABS = ["all", "low-stock", "feed", "medicine", "equipment"] as const;

function StatCard({ label, value, icon, colorClass, borderClass, href }: {
  label: string; value: string | number; icon: React.ReactNode;
  colorClass: string; borderClass?: string; href?: string;
}) {
  const inner = (
    <Card className={`${borderClass || ""} ${href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {href && <p className="text-xs text-primary mt-1 flex items-center gap-1">View details <ChevronRight className="w-3 h-3" /></p>}
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const search = useSearch();

  const rawTab = new URLSearchParams(search).get("tab") || "all";
  const urlTab = TABS.includes(rawTab as any) ? rawTab : "all";
  const [activeTab, setActiveTab] = useState(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const { data: items, isLoading } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const { data: feedInventory } = useQuery<FeedInventory[]>({ queryKey: ["/api/feed/inventory"] });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
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

  const lowStockItems = items?.filter(
    (item) => item.minStock && parseFloat(item.currentStock) <= parseFloat(item.minStock)
  ).length || 0;

  const totalValue = items?.reduce(
    (sum, item) => sum + (parseFloat(item.currentStock) * parseFloat(item.avgCost || "0")), 0
  ) || 0;

  // Category-based filtering using item name heuristics (fallback since no categoryId)
  const getCategory = (item: InventoryItem): string => {
    const name = item.name.toLowerCase();
    if (name.includes("vaccine") || name.includes("medicine") || name.includes("antibiotic") ||
      name.includes("injection") || name.includes("tablet") || name.includes("syrup") ||
      name.includes("deworm") || name.includes("teat") || name.includes("antiseptic")) return "medicine";
    if (name.includes("fodder") || name.includes("hay") || name.includes("straw") ||
      name.includes("silage") || name.includes("concentrate") || name.includes("bran") ||
      name.includes("meal") || name.includes("grain") || name.includes("feed") ||
      name.includes("mineral") || name.includes("salt") || name.includes("molasses")) return "feed";
    if (name.includes("rope") || name.includes("bucket") || name.includes("equipment") ||
      name.includes("tool") || name.includes("pump") || name.includes("machine")) return "equipment";
    return "other";
  };

  const filterItems = (tab: string) => {
    let list = items || [];
    if (searchQuery) list = list.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (tab === "low-stock") return list.filter(i => i.minStock && parseFloat(i.currentStock) <= parseFloat(i.minStock));
    if (tab === "feed") return list.filter(i => getCategory(i) === "feed");
    if (tab === "medicine") return list.filter(i => getCategory(i) === "medicine");
    if (tab === "equipment") return list.filter(i => getCategory(i) === "equipment");
    return list;
  };

  function ItemsTable({ tab }: { tab: string }) {
    const list = filterItems(tab);
    if (isLoading) return (
      <div className="p-6 space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
    );
    if (!list.length) return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {tab === "low-stock" ? "No low-stock items" : "No items found"}
        </h3>
        <p className="text-muted-foreground mb-4">
          {tab === "low-stock" ? "All items are well-stocked" : "Add items to your inventory"}
        </p>
        {tab === "all" && (
          <Link href="/inventory/new">
            <Button className="gap-2" data-testid="button-add-first-item">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          </Link>
        )}
      </div>
    );
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead>Stock Level</TableHead>
            <TableHead className="text-right">Avg Cost</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((item) => {
            const stockLevel = getStockLevel(item.currentStock, item.minStock, item.maxStock);
            const cat = getCategory(item);
            const value = parseFloat(item.currentStock) * parseFloat(item.avgCost || "0");
            return (
              <TableRow key={item.id} className="hover:bg-muted/30 cursor-default" data-testid={`inventory-row-${item.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {cat === "medicine" ? <Pill className="w-4 h-4 text-blue-500" /> :
                      cat === "feed" ? <Leaf className="w-4 h-4 text-green-500" /> :
                      cat === "equipment" ? <Wrench className="w-4 h-4 text-gray-500" /> :
                      <Package className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-medium">{item.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs">{cat}</Badge>
                </TableCell>
                <TableCell>
                  <span className={`font-semibold ${stockLevel.level === "critical" ? "text-red-600" : stockLevel.level === "low" ? "text-amber-600" : ""}`}>
                    {parseFloat(item.currentStock).toFixed(1)} {item.unit}
                  </span>
                  {item.minStock && <span className="text-xs text-muted-foreground ml-1">(min: {item.minStock})</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 w-32">
                    <Progress value={stockLevel.percent} className="h-2" />
                    <Badge
                      variant="outline"
                      className={`text-xs ${stockLevel.level === "critical" ? "text-red-600 border-red-300" : stockLevel.level === "low" ? "text-amber-600 border-amber-300" : "text-green-600 border-green-300"}`}
                    >
                      {stockLevel.level}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">₹{parseFloat(item.avgCost || "0").toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">₹{value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

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
              <ArrowDownRight className="w-4 h-4" /> Record Purchase
            </Button>
          </Link>
          <Link href="/inventory/issue">
            <Button className="gap-2" data-testid="button-issue">
              <ArrowUpRight className="w-4 h-4" /> Issue Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats — each card is clickable */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Items"
          value={items?.length || 0}
          icon={<Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
          colorClass="bg-blue-100 dark:bg-blue-900/30"
          href="/inventory?tab=all"
        />
        <StatCard
          label="Low Stock Items"
          value={lowStockItems}
          icon={<AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
          colorClass="bg-amber-100 dark:bg-amber-900/30"
          borderClass={lowStockItems > 0 ? "border-amber-400" : ""}
          href="/inventory?tab=low-stock"
        />
        <StatCard
          label="Feed Items"
          value={filterItems("feed").length}
          icon={<Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />}
          colorClass="bg-green-100 dark:bg-green-900/30"
          href="/inventory?tab=feed"
        />
        <StatCard
          label="Total Value (₹)"
          value={`₹${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          icon={<span className="text-lg font-bold text-purple-600">₹</span>}
          colorClass="bg-purple-100 dark:bg-purple-900/30"
        />
      </div>

      {/* Low-stock banner */}
      {lowStockItems > 0 && activeTab !== "low-stock" && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 cursor-pointer hover:opacity-80"
          onClick={() => handleTabChange("low-stock")}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            <strong>{lowStockItems} item{lowStockItems > 1 ? "s" : ""}</strong> below minimum stock level
          </span>
          <span className="text-xs text-amber-600 flex items-center gap-1">View low stock <ChevronRight className="w-3 h-3" /></span>
        </div>
      )}

      {/* Low-stock active banner */}
      {activeTab === "low-stock" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Showing only <strong>low stock items</strong></span>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto text-xs gap-1" onClick={() => handleTabChange("all")}>
            <X className="w-3 h-3" /> Show all
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="all" data-testid="tab-all">All ({items?.length || 0})</TabsTrigger>
            <TabsTrigger value="low-stock" data-testid="tab-low-stock" className={lowStockItems > 0 ? "text-amber-600" : ""}>
              Low Stock {lowStockItems > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">{lowStockItems}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="feed" data-testid="tab-feed">Feed ({filterItems("feed").length})</TabsTrigger>
            <TabsTrigger value="medicine" data-testid="tab-medicine">Medicine ({filterItems("medicine").length})</TabsTrigger>
            <TabsTrigger value="equipment" data-testid="tab-equipment">Equipment ({filterItems("equipment").length})</TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-xs ml-auto">
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

        <Card>
          <CardContent className="p-0">
            <TabsContent value="all" className="mt-0"><ItemsTable tab="all" /></TabsContent>
            <TabsContent value="low-stock" className="mt-0"><ItemsTable tab="low-stock" /></TabsContent>
            <TabsContent value="feed" className="mt-0"><ItemsTable tab="feed" /></TabsContent>
            <TabsContent value="medicine" className="mt-0"><ItemsTable tab="medicine" /></TabsContent>
            <TabsContent value="equipment" className="mt-0"><ItemsTable tab="equipment" /></TabsContent>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 mt-3">
          <Link href="/inventory/new">
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-add-item">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          </Link>
        </div>
      </Tabs>
    </div>
  );
}
