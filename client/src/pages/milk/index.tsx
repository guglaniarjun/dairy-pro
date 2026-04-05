import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Calendar,
  Milk,
  TrendingUp,
  Download,
  X,
  ArrowLeft,
} from "lucide-react";
import type { MilkEntry, Cattle } from "@shared/schema";

export default function MilkRecordsPage() {
  const search = useSearch();
  const urlCattleId = new URLSearchParams(search).get("cattleId");
  const urlDateFilter = new URLSearchParams(search).get("dateFilter");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>(urlDateFilter || "all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [cattleFilter, setCattleFilter] = useState<string>(urlCattleId || "all");

  useEffect(() => { setCattleFilter(urlCattleId || "all"); }, [urlCattleId]);
  useEffect(() => { setDateFilter(urlDateFilter || "all"); }, [urlDateFilter]);

  const { data: milkEntries, isLoading } = useQuery<MilkEntry[]>({
    queryKey: ["/api/milk"],
  });

  const { data: cattle } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const getCattleName = (cattleId: string) => {
    const cow = cattle?.find((c) => c.id === cattleId);
    return cow?.name || cow?.tagNumber || "Unknown";
  };

  const getDateRange = () => {
    const today = new Date();
    switch (dateFilter) {
      case "today":
        return format(today, "yyyy-MM-dd");
      case "yesterday":
        return format(subDays(today, 1), "yyyy-MM-dd");
      case "week":
        return format(subDays(today, 7), "yyyy-MM-dd");
      default:
        return null;
    }
  };

  const filteredEntries = milkEntries?.filter((entry) => {
    const matchesSearch = getCattleName(entry.cattleId)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesSession = sessionFilter === "all" || entry.session === sessionFilter;
    const matchesCattle = cattleFilter === "all" || entry.cattleId === cattleFilter;
    
    if (dateFilter === "all") return matchesSearch && matchesSession && matchesCattle;
    
    const filterDate = getDateRange();
    if (dateFilter === "week") {
      const entryDate = new Date(entry.date);
      const weekAgo = subDays(new Date(), 7);
      return matchesSearch && matchesSession && matchesCattle && entryDate >= weekAgo;
    }
    return matchesSearch && matchesSession && matchesCattle && entry.date === filterDate;
  });

  const todayTotal = filteredEntries?.reduce(
    (sum, entry) => sum + parseFloat(entry.quantity),
    0
  ) || 0;

  const avgPerCow = filteredEntries && filteredEntries.length > 0
    ? todayTotal / filteredEntries.length
    : 0;

  const filteredCow = cattleFilter !== "all" ? cattle?.find(c => c.id === cattleFilter) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Milk Records</h1>
          <p className="text-muted-foreground">Track daily milk production</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" data-testid="button-export">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Link href="/milk/new">
            <Button className="gap-2" data-testid="button-add-milk">
              <Plus className="w-4 h-4" />
              Record Milk
            </Button>
          </Link>
        </div>
      </div>

      {/* Cattle filter banner */}
      {filteredCow && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
          <Link href={`/cattle/${filteredCow.id}`}>
            <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
              <ArrowLeft className="w-3 h-3" /> {filteredCow.name || filteredCow.tagNumber}
            </Button>
          </Link>
          <span className="text-muted-foreground">Showing milk records for</span>
          <Badge className="bg-blue-100 text-blue-800">{filteredCow.name || filteredCow.tagNumber}</Badge>
          <span className="text-muted-foreground">— {filteredEntries?.length || 0} entries</span>
          <button
            onClick={() => setCattleFilter("all")}
            className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Show all
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Total</p>
                <p className="text-3xl font-bold text-foreground" data-testid="stat-today-total">
                  {todayTotal.toFixed(1)} L
                </p>
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
                <p className="text-sm text-muted-foreground">Avg per Cow</p>
                <p className="text-3xl font-bold text-foreground" data-testid="stat-avg-per-cow">
                  {avgPerCow.toFixed(1)} L
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Morning</p>
                <p className="text-3xl font-bold text-foreground">
                  {(filteredEntries?.filter(e => e.session === "morning")
                    .reduce((sum, e) => sum + parseFloat(e.quantity), 0) || 0).toFixed(1)} L
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="text-lg">🌅</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Evening</p>
                <p className="text-3xl font-bold text-foreground">
                  {(filteredEntries?.filter(e => e.session === "evening")
                    .reduce((sum, e) => sum + parseFloat(e.quantity), 0) || 0).toFixed(1)} L
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <span className="text-lg">🌆</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by cow name or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-milk"
          />
        </div>
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-date-filter">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-session-filter">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredEntries && filteredEntries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cow</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Quantity (L)</TableHead>
                  <TableHead className="text-right">FAT %</TableHead>
                  <TableHead className="text-right">SNF %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`milk-row-${entry.id}`}>
                    <TableCell className="font-medium">
                      {format(new Date(entry.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>{getCattleName(entry.cattleId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {entry.session}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {parseFloat(entry.quantity).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {entry.fat ? parseFloat(entry.fat).toFixed(1) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {entry.snf ? parseFloat(entry.snf).toFixed(1) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <Milk className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No milk records found
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || dateFilter !== "today" || sessionFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Start recording milk production"}
              </p>
              <Link href="/milk/new">
                <Button className="gap-2" data-testid="button-add-first-milk">
                  <Plus className="w-4 h-4" />
                  Record First Entry
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
