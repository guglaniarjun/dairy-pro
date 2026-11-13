import { breedingOverview } from "@shared/farm-overview";
import { inStage } from "@shared/care";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus,
  Search,
  Heart,
  Syringe,
  Baby,
  Calendar,
  AlertCircle,
  Thermometer,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  X,
  ArrowLeft,
} from "lucide-react";

const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), "dd MMM yyyy") : "—";

function DaysChip({ days, label }: { days: number; label: string }) {
  const color =
    days < 0
      ? "bg-red-100 text-red-800"
      : days <= 3
        ? "bg-orange-100 text-orange-800"
        : days <= 7
          ? "bg-amber-100 text-amber-800"
          : "bg-green-100 text-green-800";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {days < 0
        ? `${Math.abs(days)}d overdue`
        : days === 0
          ? "Today"
          : `In ${days}d`}
    </span>
  );
}

export default function BreedingPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const urlFilter = params.get("filter") || "all";
  const urlTab = params.get("tab") || "expected";
  const urlCattleId = params.get("cattleId");
  const [searchQuery, setSearchQuery] = useState("");
  const [cattleFilter, setCattleFilter] = useState<string>(
    urlCattleId || "all",
  );
  const [activeTab, setActiveTab] = useState(
    urlTab === "heats"
      ? "heats"
      : urlTab === "ai"
        ? "ai"
        : urlTab === "pregnancy"
          ? "pregnancy"
          : urlTab === "calving"
            ? "calving"
            : "expected",
  );

  useEffect(() => {
    setCattleFilter(urlCattleId || "all");
  }, [urlCattleId]);
  useEffect(() => {
    setActiveTab(
      urlTab === "heats"
        ? "heats"
        : urlTab === "ai"
          ? "ai"
          : urlTab === "pregnancy"
            ? "pregnancy"
            : urlTab === "calving"
              ? "calving"
              : "expected",
    );
  }, [urlTab, urlFilter, urlCattleId]);

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const { data: heats = [], isLoading: heatsLoading } = useQuery<any[]>({
    queryKey: ["/api/breeding/heats"],
  });
  const { data: inseminations = [] } = useQuery<any[]>({
    queryKey: ["/api/breeding/inseminations"],
  });
  const { data: pregnancyTests = [] } = useQuery<any[]>({
    queryKey: ["/api/breeding/pregnancy-tests"],
  });
  const { data: calvings = [] } = useQuery<any[]>({
    queryKey: ["/api/breeding/calvings"],
  });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  const getCow = (id: number | string) =>
    cattle.find((c: any) => c.id === id || c.id === Number(id));
  const getCowName = (id: number | string) => {
    const c = getCow(id);
    return c?.name || c?.tagNumber || `#${id}`;
  };

  // Compute expected events
  const now = new Date();
  const { data: config } = useQuery<any>({
    queryKey: ["/api/operations/preferences"],
  });
  const overview = breedingOverview(cattle, inseminations, pregnancyTests, calvings, heats, config || {});
  const selected = (c: any) => cattleFilter === "all" || c.id === cattleFilter;
  const show = (filter: string) => urlFilter === "all" || urlFilter === filter;
  const heatDue = show("heat-due") ? overview.heatDue.filter(selected) : [];
  const ptDue = show("pt-due") ? overview.ptDue.filter(p => selected(p.cow)) : [];
  const calvingDue = show("calving-due") ? overview.calvingDue.filter(p => selected(p.cow)) : [];
  const dryDue = show("dry-due") ? overview.dryDue.filter(p => selected(p.cow)) : [];
  const repeatBreeders = show("repeat") ? overview.repeatBreeders.filter(p => selected(p.cow)) : [];
  const breedableCattle = overview.open;
  const pregnantCount = overview.pregnant.length;
  const contextHref = (path: string) => cattleFilter === "all" ? path : `${path}?cattleId=${encodeURIComponent(cattleFilter)}`;

  const filteredHeats = heats.filter((h: any) => {
    const matchesSearch = getCowName(h.cattleId)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCattle =
      cattleFilter === "all" || String(h.cattleId) === String(cattleFilter);
    return matchesSearch && matchesCattle;
  });

  const filteredInseminations = inseminations.filter((i: any) => {
    const matchesSearch = getCowName(i.cattleId)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCattle =
      cattleFilter === "all" || String(i.cattleId) === String(cattleFilter);
    return matchesSearch && matchesCattle;
  });

  const filteredPTs = pregnancyTests.filter((pt: any) => {
    const matchesSearch = getCowName(pt.cattleId)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCattle =
      cattleFilter === "all" || String(pt.cattleId) === String(cattleFilter);
    return matchesSearch && matchesCattle;
  });

  const filteredCalvings = calvings.filter((c: any) => {
    const matchesSearch = getCowName(c.cattleId)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCattle =
      cattleFilter === "all" || String(c.cattleId) === String(cattleFilter);
    return matchesSearch && matchesCattle;
  });

  const filteredCow =
    cattleFilter !== "all"
      ? cattle.find((c: any) => String(c.id) === String(cattleFilter))
      : null;

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Breeding & Reproduction</h1>
          <p className="text-muted-foreground text-sm">
            Track heats, AI, pregnancies and calvings
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={contextHref("/breeding/heat")}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="button-record-heat"
            >
              <Heart className="w-4 h-4" /> Record Heat
            </Button>
          </Link>
          <Link href={contextHref("/breeding/ai")}>
            <Button
              size="sm"
              className="gap-1.5"
              data-testid="button-record-ai"
            >
              <Syringe className="w-4 h-4" /> Record AI
            </Button>
          </Link>
        </div>
      </div>

      {/* Cattle filter banner */}
      {filteredCow && (
        <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 dark:bg-pink-950/30 rounded-lg text-sm border border-pink-200 dark:border-pink-800">
          <Link href={`/cattle/${(filteredCow as any).id}`}>
            <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
              <ArrowLeft className="w-3 h-3" />{" "}
              {(filteredCow as any).name || (filteredCow as any).tagNumber}
            </Button>
          </Link>
          <span className="text-muted-foreground">Breeding records for</span>
          <Badge className="bg-pink-100 text-pink-800">
            {(filteredCow as any).name || (filteredCow as any).tagNumber}
          </Badge>
          <button
            onClick={() => setCattleFilter("all")}
            className="ml-auto text-xs text-pink-600 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Show all
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
        <StatCard
          label="Breedable"
          value={breedableCattle.length}
          color="pink"
          icon="🐄"
          href="/breeding?filter=open"
        />
        <StatCard
          label="Pregnant"
          value={pregnantCount}
          color="purple"
          icon="🤰"
          href="/breeding?tab=pregnancy"
        />
        <StatCard
          label="Heat Due"
          value={overview.heatDue.length}
          color="orange"
          icon="🌡️"
          href="/breeding?filter=heat-due"
        />
        <StatCard
          label="PT Due"
          value={overview.ptDue.length}
          color="amber"
          icon="🔬"
          href="/breeding?filter=pt-due"
        />
        <StatCard
          label="Calving Soon"
          value={overview.calvingDue.length}
          color="green"
          icon="🐄"
          href="/breeding?filter=calving-due"
        />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(tab) => navigate(`/breeding?tab=${tab}${cattleFilter !== "all" ? `&cattleId=${cattleFilter}` : ""}`)} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="expected" className="text-xs">
            🗓️ Expected ({heatDue.length + ptDue.length + calvingDue.length + dryDue.length})
          </TabsTrigger>
          <TabsTrigger
            value="heats"
            className="text-xs"
            data-testid="tab-heats"
          >
            Heats ({filteredHeats.length})
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs" data-testid="tab-ai">
            AI Records ({filteredInseminations.length})
          </TabsTrigger>
          <TabsTrigger
            value="pregnancy"
            className="text-xs"
            data-testid="tab-pregnancy"
          >
            Pregnancy ({overview.pregnant.filter(selected).length})
          </TabsTrigger>
          <TabsTrigger
            value="calving"
            className="text-xs"
            data-testid="tab-calving"
          >
            Calvings ({filteredCalvings.length})
          </TabsTrigger>
        </TabsList>

        {/* Expected Events */}
        <TabsContent value="expected">
          <div className="space-y-4">
            {urlFilter !== "all" && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm">
              <strong>{({ "heat-due": "Expected heat", "pt-due": "Pregnancy tests", "calving-due": "Expected calving", "dry-due": "Dry off", open: "Open cattle", repeat: "Repeat breeders" } as Record<string, string>)[urlFilter] || urlFilter}</strong>
              <span>Overdue and next 30 days</span><Link className="text-primary underline" href="/breeding">Clear filter</Link>
            </div>}
            {urlFilter === "open" && <ExpectedSection title="Open cattle" count={overview.open.filter(selected).length} items={overview.open.filter(selected)} renderItem={(c: any) => <div className="flex flex-wrap justify-between gap-2"><Link href={`/cattle/${c.id}`} className="text-primary">{c.tagNumber} {c.name}</Link><Link href={`/breeding/heat?cattleId=${c.id}`}><Button size="sm" variant="outline">Record heat</Button></Link></div>} />}
            {/* Heat Due */}
            <ExpectedSection
              title="🌡️ Heat Expected"
              count={heatDue.length}
              color="orange"
              items={heatDue}
              renderItem={(c: any) => (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-lg">
                    🌡️
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/cattle/${c.id}`}>
                      <p className="font-medium hover:underline truncate">
                        {c.name || c.tagNumber}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.refType}: {fmtDate(c.refDate)} · Stage: {c.stage}
                    </p>
                  </div>
                  <DaysChip days={c.expectedIn} label="heat" />
                  <Link href={`/breeding/heat?cattleId=${c.id}`}>
                    <Button size="sm" variant="outline" className="text-xs min-h-10">
                      Record
                    </Button>
                  </Link>
                </div>
              )}
            />

            {/* PT Due */}
            <ExpectedSection
              title="🔬 Pregnancy Test Due"
              count={ptDue.length}
              color="amber"
              items={ptDue}
              renderItem={(item: any) => (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-lg">
                    🔬
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/cattle/${item.cattleId}`}>
                      <p className="font-medium hover:underline truncate">
                        {getCowName(item.cattleId)}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      AI on {fmtDate(item.date)} · {item.daysAgo}d ago
                    </p>
                  </div>
                  <DaysChip days={item.dueDays} label="PT" />
                  <Link
                    href={`/breeding/pregnancy-test?cattleId=${item.cattleId}&inseminationId=${item.id}`}
                  >
                    <Button size="sm" variant="outline" className="text-xs min-h-10">
                      Record
                    </Button>
                  </Link>
                </div>
              )}
            />

            {/* Calving Due */}
            <ExpectedSection
              title="🐄 Expected Calvings"
              count={calvingDue.length}
              color="teal"
              items={calvingDue}
              renderItem={(item: any) => (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-lg">
                    🐄
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/cattle/${item.cow?.id}`}>
                      <p className="font-medium hover:underline truncate">
                        {getCowName(item.cattleId)}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      AI on {fmtDate(item.date)} · Due{" "}
                      {fmtDate(item.cow.expectedCalvingDate)}
                    </p>
                  </div>
                  <DaysChip days={item.daysToCalving} label="calving" />
                  <Link href={`/breeding/calving?cattleId=${item.cattleId}`}>
                    <Button size="sm" variant="outline" className="text-xs min-h-10">
                      Record
                    </Button>
                  </Link>
                </div>
              )}
            />

            {/* Dry Off Due */}
            {dryDue.length > 0 && (
              <ExpectedSection
                title="🛑 Dry Off Due"
                count={dryDue.length}
                color="purple"
                items={dryDue}
                renderItem={(item: any) => (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-lg">
                      🛑
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/cattle/${item.cow?.id}`}>
                        <p className="font-medium hover:underline truncate">
                          {getCowName(item.cattleId)}
                        </p>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Calving due in {item.daysToCalving}d · Dry period: {config?.dryPeriodDays || 60}d
                      </p>
                    </div>
                    <DaysChip days={item.dryDaysLeft} label="dry" />
                    <Link href={`/care?tab=events&type=dry_off&cattleId=${item.cattleId}`}><Button size="sm" variant="outline">Record dry off</Button></Link>
                  </div>
                )}
              />
            )}

            {/* Repeat Breeders */}
            {repeatBreeders.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Repeat Breeders (
                    {repeatBreeders.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {repeatBreeders.map((rb: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-950/30"
                    >
                      <div className="flex-1">
                        <Link href={`/cattle/${rb.cow?.id}`}>
                          <p className="font-medium hover:underline">
                            {rb.cow?.name || rb.cow?.tagNumber}
                          </p>
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {rb.count} inseminations — no pregnancy confirmed
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {rb.count} AI
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {heatDue.length === 0 &&
              ptDue.length === 0 &&
              calvingDue.length === 0 &&
              dryDue.length === 0 && repeatBreeders.length === 0 && urlFilter !== "open" && (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-400 mb-4" />
                  <p className="text-muted-foreground">
                    No matching breeding actions due or expected in the next 30 days
                  </p>
                </div>
              )}
          </div>
        </TabsContent>

        {/* Heats Tab */}
        <TabsContent value="heats">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by cow..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-heats"
              />
            </div>
          </div>
          {heatsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredHeats.length > 0 ? (
            <div className="space-y-2">
              {filteredHeats.map((heat: any) => (
                <Card
                  key={heat.id}
                  className="hover:shadow-md transition-shadow"
                  data-testid={`heat-${heat.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-lg">
                      🌡️
                    </div>
                    <div className="flex-1">
                      <Link href={`/cattle/${heat.cattleId}`}>
                        <p className="font-medium hover:underline">
                          {getCowName(heat.cattleId)}
                        </p>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {heat.detectedAt
                          ? format(
                              new Date(heat.detectedAt),
                              "dd MMM yyyy, h:mm a",
                            )
                          : "—"}
                      </p>
                    </div>
                    <Badge className="capitalize bg-pink-100 text-pink-800">
                      {heat.intensity}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🌡️"
              title="No heat records"
              cta="Record Heat"
              href={contextHref("/breeding/heat")}
              testId="button-add-first-heat"
            />
          )}
        </TabsContent>

        {/* AI Records Tab */}
        <TabsContent value="ai">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by cow..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {filteredInseminations.length > 0 ? (
            <div className="space-y-2">
              {filteredInseminations.map((ins: any) => {
                const positivePT = pregnancyTests.find(
                  (pt: any) =>
                    pt.cattleId === ins.cattleId &&
                    new Date(pt.testDate) > new Date(ins.date) &&
                    pt.result === "positive",
                );
                return (
                  <Card
                    key={ins.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg">
                        💉
                      </div>
                      <div className="flex-1">
                        <Link href={`/cattle/${ins.cattleId}`}>
                          <p className="font-medium hover:underline">
                            {getCowName(ins.cattleId)}
                          </p>
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(ins.date)} ·{" "}
                          {ins.method?.toUpperCase() || "AI"} ·{" "}
                          {ins.bullName || ins.semenId || "Unknown Semen"}
                        </p>
                      </div>
                      {positivePT ? (
                        <Badge className="bg-green-100 text-green-800">
                          Pregnant
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inseminated</Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="💉"
              title="No AI records"
              cta="Record AI"
              href={contextHref("/breeding/ai")}
            />
          )}
        </TabsContent>

        {/* Pregnancy Tests Tab */}
        <TabsContent value="pregnancy">
          <Card className="mb-4"><CardHeader><CardTitle className="text-base">Currently pregnant ({overview.pregnant.filter(selected).length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {overview.pregnant.filter(selected).map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div><Link className="font-medium text-primary hover:underline" href={`/cattle/${c.id}`}>{c.tagNumber} {c.name}</Link>
                  <p className="text-sm text-muted-foreground">{c.expectedCalvingDate ? `Expected calving: ${fmtDate(c.expectedCalvingDate)}` : "Expected calving date not recorded"}</p></div>
                <Link href={`/breeding/calving?cattleId=${c.id}`}><Button variant="outline" size="sm">Record calving</Button></Link>
              </div>)}
              {!overview.pregnant.filter(selected).length && <p>No currently pregnant cattle.</p>}
            </CardContent></Card>
          <h2 className="font-semibold mb-3">Pregnancy test history ({filteredPTs.length})</h2>
          {filteredPTs.length > 0 ? (
            <div className="space-y-2">
              {filteredPTs.map((pt: any) => (
                <Card key={pt.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${pt.result === "positive" ? "bg-green-100" : "bg-red-100"}`}
                    >
                      {pt.result === "positive" ? "✅" : "❌"}
                    </div>
                    <div className="flex-1">
                      <Link href={`/cattle/${pt.cattleId}`}>
                        <p className="font-medium hover:underline">
                          {getCowName(pt.cattleId)}
                        </p>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(pt.testDate)} · {pt.method || "Manual"}
                      </p>
                    </div>
                    <Badge
                      className={
                        pt.result === "positive"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {pt.result}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🔬"
              title="No pregnancy tests"
              cta="Add Test Result"
              href={contextHref("/breeding/pregnancy-test")}
            />
          )}
        </TabsContent>

        {/* Calvings Tab */}
        <TabsContent value="calving">
          {filteredCalvings.length > 0 ? (
            <div className="space-y-2">
              {filteredCalvings.map((c: any) => (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-lg">
                      🐄
                    </div>
                    <div className="flex-1">
                      <Link href={`/cattle/${c.cattleId}`}>
                        <p className="font-medium hover:underline">
                          {getCowName(c.cattleId)}
                        </p>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(c.date)} · {c.outcome} · {c.calfGender || "?"}{" "}
                        calf
                      </p>
                    </div>
                    <Badge
                      variant={c.outcome === "normal" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {c.outcome}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🐄"
              title="No calving records"
              cta="Record Calving"
              href={contextHref("/breeding/calving")}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
  href,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
  href?: string;
}) {
  const bg: Record<string, string> = {
    pink: "bg-pink-50 dark:bg-pink-950/40",
    purple: "bg-purple-50 dark:bg-purple-950/40",
    orange: "bg-orange-50 dark:bg-orange-950/40",
    amber: "bg-amber-50 dark:bg-amber-950/40",
    green: "bg-green-50 dark:bg-green-950/40",
    teal: "bg-teal-50 dark:bg-teal-950/40",
  };
  const inner = (
    <div
      className={`rounded-xl p-3 text-center ${bg[color] || "bg-muted"} ${href ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
    >
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ExpectedSection({ title, count, color, items, renderItem }: any) {
  const bg: Record<string, string> = {
    orange: "border-orange-200",
    amber: "border-amber-200",
    teal: "border-teal-200",
    purple: "border-purple-200",
  };
  if (items.length === 0) return null;
  return (
    <Card className={`border-l-4 ${bg[color] || ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {title}{" "}
          <Badge variant="secondary" className="ml-1 text-xs">
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item: any, i: number) => (
          <div key={i} className="p-2 rounded-lg bg-muted/30">
            {renderItem(item)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, cta, href, testId }: any) {
  return (
    <div className="text-center py-12">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-muted-foreground mb-4">{title}</p>
      <Link href={href}>
        <Button className="gap-2" data-testid={testId}>
          <Plus className="w-4 h-4" /> {cta}
        </Button>
      </Link>
    </div>
  );
}
