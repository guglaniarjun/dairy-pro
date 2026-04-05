import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Plus, Search, Leaf, Package, TrendingUp, Calculator, Download, ChevronRight, X
} from "lucide-react";
import type { FeedingRecord, FeedItem, Cattle } from "@shared/schema";

export default function FeedPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const search = useSearch();

  const urlCattleId = new URLSearchParams(search).get("cattleId") || null;
  const urlTab = new URLSearchParams(search).get("tab") || "records";
  const [activeTab, setActiveTab] = useState(urlTab);

  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const { data: feedingRecords, isLoading } = useQuery<FeedingRecord[]>({
    queryKey: ["/api/feed/records"],
  });

  const { data: feedItems } = useQuery<FeedItem[]>({
    queryKey: ["/api/feed/items"],
  });

  const { data: cattle } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const getCattle = (cattleId: string | null) => {
    if (!cattleId) return null;
    return cattle?.find((c) => c.id === cattleId) || null;
  };

  const getCattleName = (cattleId: string | null) => {
    if (!cattleId) return "All Cattle";
    const cow = getCattle(cattleId);
    return cow?.name || cow?.tagNumber || "Unknown";
  };

  const getFeedName = (feedItemId: string) => {
    const item = feedItems?.find((f) => f.id === feedItemId);
    return item?.name || "Unknown";
  };

  // Filter records by cattleId if set
  const baseRecords = feedingRecords?.filter((r) => !urlCattleId || r.cattleId === urlCattleId) || [];
  const filteredRecords = searchQuery
    ? baseRecords.filter((r) => {
        const cowName = getCattleName(r.cattleId).toLowerCase();
        const feedName = getFeedName(r.feedItemId).toLowerCase();
        return cowName.includes(searchQuery.toLowerCase()) || feedName.includes(searchQuery.toLowerCase());
      })
    : baseRecords;

  const filteredCattle = getCattle(urlCattleId);

  const todayTotal = baseRecords.reduce((sum, r) => sum + parseFloat(r.actualQuantity), 0);
  const avgPerCow = cattle && cattle.length > 0 && todayTotal > 0 ? todayTotal / cattle.length : 0;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feed Management</h1>
          <p className="text-muted-foreground">Track feeding and diet plans</p>
        </div>
        <div className="flex gap-2">
          <Link href="/feed/formulation">
            <Button variant="outline" className="gap-2" data-testid="button-formulation">
              <Calculator className="w-4 h-4" /> Diet Formulation
            </Button>
          </Link>
          <Link href={`/feed/new${urlCattleId ? `?cattleId=${urlCattleId}` : ""}`}>
            <Button className="gap-2" data-testid="button-record-feed">
              <Plus className="w-4 h-4" /> Record Feeding
            </Button>
          </Link>
        </div>
      </div>

      {/* Cattle filter banner */}
      {urlCattleId && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800 text-sm">
          <Leaf className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-green-800 dark:text-green-200 flex-1">
            Showing feed records for <strong>{filteredCattle ? (filteredCattle.name || filteredCattle.tagNumber) : "selected cattle"}</strong>
            {filteredCattle && (
              <Link href={`/cattle/${urlCattleId}`}>
                <span className="ml-2 underline text-xs">View cattle profile <ChevronRight className="w-3 h-3 inline" /></span>
              </Link>
            )}
          </span>
          <Link href="/feed">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
              <X className="w-3 h-3" /> Show all
            </Button>
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleTabChange("records")} data-testid="stat-total-feed">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{urlCattleId ? "Cow's Total" : "Total Feed Given"}</p>
                <p className="text-3xl font-bold text-foreground">{todayTotal.toFixed(1)} kg</p>
                <p className="text-xs text-primary mt-1 flex items-center gap-1">View records <ChevronRight className="w-3 h-3" /></p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleTabChange("items")} data-testid="stat-feed-items">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Feed Items</p>
                <p className="text-3xl font-bold text-foreground">{feedItems?.length || 0}</p>
                <p className="text-xs text-primary mt-1 flex items-center gap-1">View items <ChevronRight className="w-3 h-3" /></p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-avg-per-cow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg per Cow</p>
                <p className="text-3xl font-bold text-foreground">{avgPerCow > 0 ? `${avgPerCow.toFixed(1)} kg` : "—"}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-records-count">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Records</p>
                <p className="text-3xl font-bold text-foreground">{baseRecords.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="records" data-testid="tab-records">Records ({baseRecords.length})</TabsTrigger>
          <TabsTrigger value="items" data-testid="tab-items">Feed Items</TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">Diet Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-6">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by cattle or feed..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-feed"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Cow</TableHead>
                      <TableHead>Feed</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const cow = getCattle(record.cattleId);
                      return (
                        <TableRow key={record.id} className="hover:bg-muted/30" data-testid={`feed-record-${record.id}`}>
                          <TableCell>{format(new Date(record.date), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            {cow ? (
                              <Link href={`/cattle/${record.cattleId}`}>
                                <span className="text-primary hover:underline font-medium cursor-pointer">
                                  {cow.name || cow.tagNumber}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">All Cattle</span>
                            )}
                          </TableCell>
                          <TableCell>{getFeedName(record.feedItemId)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{record.session}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {parseFloat(record.actualQuantity).toFixed(1)} kg
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <Leaf className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {urlCattleId ? "No feed records for this cattle" : "No feeding records"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {urlCattleId ? "Record feeding to track this animal's nutrition" : "Start recording daily feed consumption"}
                  </p>
                  <Link href={`/feed/new${urlCattleId ? `?cattleId=${urlCattleId}` : ""}`}>
                    <Button className="gap-2" data-testid="button-add-first-feed">
                      <Plus className="w-4 h-4" /> Record Feeding
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Feed Items ({feedItems?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {feedItems && feedItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Protein %</TableHead>
                      <TableHead className="text-right">Energy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{item.category}</Badge>
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">
                          {item.crudeProtein ? parseFloat(item.crudeProtein).toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.energy ? parseFloat(item.energy).toFixed(1) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">No feed items configured</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <Card className="p-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <Calculator className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Diet Plans</h3>
              <p className="text-muted-foreground mb-4">
                Create custom diet formulations for different cattle groups
              </p>
              <Link href="/feed/formulation">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Create Diet Plan
                </Button>
              </Link>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
