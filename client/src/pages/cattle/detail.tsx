import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  ArrowLeft, Tag, Calendar, Milk, Heart, Stethoscope, Leaf,
  Wallet, FileText, Clock, Edit, TrendingUp, TrendingDown,
  Activity, CheckCircle2, XCircle, Baby, Syringe, Scale
} from "lucide-react";

const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), "dd MMM yyyy") : "—";

const fmtNum = (n: any, decimals = 1) =>
  n != null ? Number(n).toFixed(decimals) : "—";

function calcAge(dob: string | null | undefined) {
  if (!dob) return "—";
  const days = differenceInDays(new Date(), parseISO(dob));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

function calcDIM(lastCalving: string | null | undefined) {
  if (!lastCalving) return null;
  return differenceInDays(new Date(), parseISO(lastCalving));
}

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    milking: "bg-blue-100 text-blue-800",
    pregnant: "bg-purple-100 text-purple-800",
    dry: "bg-amber-100 text-amber-800",
    heifer: "bg-green-100 text-green-800",
    calf: "bg-pink-100 text-pink-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[stage] || "bg-gray-100 text-gray-800"}`}>
      {stage.charAt(0).toUpperCase() + stage.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    sold: "bg-red-100 text-red-800",
    dead: "bg-gray-200 text-gray-700",
    culled: "bg-orange-100 text-orange-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function CattleDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: cow, isLoading: cowLoading } = useQuery<any>({
    queryKey: ["/api/cattle", id],
    queryFn: () => fetch(`/api/cattle/${id}`).then(r => r.json()),
  });

  const { data: breeds } = useQuery<any[]>({ queryKey: ["/api/breeds"] });

  const { data: milkEntries = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/milk-entries`],
    queryFn: () => fetch(`/api/cattle/${id}/milk-entries`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: healthEvents = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/health-events`],
    queryFn: () => fetch(`/api/cattle/${id}/health-events`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: inseminations = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/inseminations`],
    queryFn: () => fetch(`/api/cattle/${id}/inseminations`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: heats = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/heats`],
    queryFn: () => fetch(`/api/cattle/${id}/heats`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: pregnancyTests = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/pregnancy-tests`],
    queryFn: () => fetch(`/api/cattle/${id}/pregnancy-tests`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: calvings = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/calvings`],
    queryFn: () => fetch(`/api/cattle/${id}/calvings`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: vaccinations = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/vaccinations`],
    queryFn: () => fetch(`/api/cattle/${id}/vaccinations`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: costs = [] } = useQuery<any[]>({
    queryKey: [`/api/cattle/${id}/costs`],
    queryFn: () => fetch(`/api/cattle/${id}/costs`).then(r => r.json()),
    enabled: !!id,
  });

  const { data: plSummary } = useQuery<any>({
    queryKey: [`/api/cattle/${id}/pl-summary`],
    queryFn: () => fetch(`/api/cattle/${id}/pl-summary`).then(r => r.json()),
    enabled: !!id,
  });

  if (cowLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!cow || cow.error) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Cattle not found</p>
        <Link href="/cattle"><Button variant="outline" className="mt-4">Back to Cattle</Button></Link>
      </div>
    );
  }

  const breedName = breeds?.find(b => b.id === cow.breedId)?.name || "Unknown Breed";
  const lastCalving = calvings[0]?.date;
  const dim = calcDIM(lastCalving);

  // Milk stats
  const last30DaysMilk = milkEntries.filter(m => {
    const entryDate = parseISO(m.date);
    return differenceInDays(new Date(), entryDate) <= 30;
  });
  const totalMilk30Days = last30DaysMilk.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
  const avgDailyMilk = last30DaysMilk.length > 0 ? totalMilk30Days / 30 : 0;

  // Finance
  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Last pregnancy test
  const lastPT = pregnancyTests[0];
  const lastInsemination = inseminations[0];

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <Link href="/cattle">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Cattle
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-sm">{cow.name || cow.tagNumber}</span>
      </div>

      {/* Hero Header */}
      <Card className="border-2">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Avatar */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-2xl">
              🐄
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-bold">{cow.name || "Unnamed"}</h1>
                <StatusBadge status={cow.status} />
                <StageBadge stage={cow.stage} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Tag: {cow.tagNumber}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Age: {calcAge(cow.dateOfBirth)}</span>
                <span>{breedName}</span>
                <span>{cow.gender === "female" ? "Female" : "Male"}</span>
                {cow.lactationNumber > 0 && <span>Lactation #{cow.lactationNumber}</span>}
              </div>
            </div>
            <Link href={`/cattle/new?edit=${cow.id}`}>
              <Button variant="outline" size="sm" className="gap-1 flex-shrink-0">
                <Edit className="w-4 h-4" /> Edit
              </Button>
            </Link>
          </div>

          {/* Quick KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmtNum(avgDailyMilk)} L</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Avg Daily Milk</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300">{dim != null ? `${dim}d` : "—"}</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">DIM</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-700 dark:text-green-300">{fmtNum(totalMilk30Days, 0)} L</div>
              <div className="text-xs text-green-600 dark:text-green-400">Last 30 Days</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300">₹{totalCosts.toLocaleString("en-IN")}</div>
              <div className="text-xs text-amber-600 dark:text-amber-400">Total Costs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="info" className="text-xs">Basic Info</TabsTrigger>
          <TabsTrigger value="breeding" className="text-xs">Breeding</TabsTrigger>
          <TabsTrigger value="milk" className="text-xs">Milking</TabsTrigger>
          <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
          <TabsTrigger value="finance" className="text-xs">Financials</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
        </TabsList>

        {/* Basic Info */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Identification</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Tag Number" value={cow.tagNumber} />
                <Row label="Name" value={cow.name || "—"} />
                <Row label="Breed" value={breedName} />
                <Row label="Gender" value={cow.gender} />
                <Row label="Date of Birth" value={fmtDate(cow.dateOfBirth)} />
                <Row label="Age" value={calcAge(cow.dateOfBirth)} />
                <Row label="Source" value={cow.source} />
                <Row label="Date of Entry" value={fmtDate(cow.dateOfEntry)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Production Status</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Stage" value={<StageBadge stage={cow.stage} />} />
                <Row label="Status" value={<StatusBadge status={cow.status} />} />
                <Row label="Lactation Number" value={cow.lactationNumber || 0} />
                <Row label="Last Calving" value={fmtDate(lastCalving)} />
                <Row label="DIM (Days in Milk)" value={dim != null ? `${dim} days` : "—"} />
                <Row label="Last Heat" value={heats[0] ? fmtDate(heats[0].detectedAt?.split('T')[0]) : "—"} />
                <Row label="Last AI" value={inseminations[0] ? fmtDate(inseminations[0].date) : "—"} />
                <Row label="Pregnancy Status" value={lastPT ? <Badge variant={lastPT.result === "positive" ? "default" : "secondary"}>{lastPT.result}</Badge> : "—"} />
              </CardContent>
            </Card>
            {cow.notes && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{cow.notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Breeding Timeline */}
        <TabsContent value="breeding">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Heats" value={heats.length} icon={<Heart className="w-4 h-4 text-pink-500" />} color="pink" />
              <StatCard label="Inseminations" value={inseminations.length} icon={<Activity className="w-4 h-4 text-blue-500" />} color="blue" />
              <StatCard label="Pregnancies" value={pregnancyTests.filter(p => p.result === "positive").length} icon={<Baby className="w-4 h-4 text-purple-500" />} color="purple" />
              <StatCard label="Calvings" value={calvings.length} icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} color="green" />
            </div>
            {/* Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Breeding Timeline
                  <Link href={`/breeding/heat?cattleId=${id}`}>
                    <Button size="sm" variant="outline">Record Heat</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {heats.length === 0 && inseminations.length === 0 && calvings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No breeding records yet</p>
                ) : (
                  <div className="space-y-3">
                    {[
                      ...heats.map(h => ({ type: "heat", date: h.detectedAt?.split('T')[0] || h.date, data: h })),
                      ...inseminations.map(i => ({ type: "ai", date: i.date, data: i })),
                      ...pregnancyTests.map(p => ({ type: "pt", date: p.testDate, data: p })),
                      ...calvings.map(c => ({ type: "calving", date: c.date, data: c })),
                    ].sort((a, b) => b.date?.localeCompare(a.date || "") || 0).slice(0, 15).map((event, i) => (
                      <BreedingEvent key={i} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Milk History */}
        <TabsContent value="milk">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Entries" value={milkEntries.length} icon={<Milk className="w-4 h-4 text-blue-500" />} color="blue" />
              <StatCard label="30-Day Total" value={`${fmtNum(totalMilk30Days, 0)} L`} icon={<TrendingUp className="w-4 h-4 text-green-500" />} color="green" />
              <StatCard label="Daily Avg" value={`${fmtNum(avgDailyMilk)} L`} icon={<Activity className="w-4 h-4 text-purple-500" />} color="purple" />
              <StatCard label="Sessions" value={milkEntries.filter(m => m.fat).length > 0 ? "With FAT" : "Basic"} icon={<Scale className="w-4 h-4 text-amber-500" />} color="amber" />
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Milk Records
                  <Link href={`/milk/new?cattleId=${id}`}>
                    <Button size="sm" variant="outline">Add Entry</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {milkEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No milk entries yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left py-2 pr-3">Date</th>
                          <th className="text-left py-2 pr-3">Session</th>
                          <th className="text-right py-2 pr-3">Qty (L)</th>
                          <th className="text-right py-2 pr-3">FAT%</th>
                          <th className="text-right py-2">SNF%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {milkEntries.slice(0, 30).map((m, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-3">{fmtDate(m.date)}</td>
                            <td className="py-2 pr-3 capitalize">{m.session}</td>
                            <td className="py-2 pr-3 text-right font-medium">{fmtNum(m.quantity)}</td>
                            <td className="py-2 pr-3 text-right">{m.fat ? fmtNum(m.fat) : "—"}</td>
                            <td className="py-2 text-right">{m.snf ? fmtNum(m.snf) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Health & Vaccination */}
        <TabsContent value="health">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Health Events" value={healthEvents.length} icon={<Stethoscope className="w-4 h-4 text-red-500" />} color="red" />
              <StatCard label="Active Issues" value={healthEvents.filter(h => h.status === "active").length} icon={<XCircle className="w-4 h-4 text-orange-500" />} color="orange" />
              <StatCard label="Vaccinations" value={vaccinations.length} icon={<Syringe className="w-4 h-4 text-green-500" />} color="green" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    Health Events
                    <Link href={`/health/new?cattleId=${id}`}>
                      <Button size="sm" variant="outline">Add</Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {healthEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No health events</p>
                  ) : (
                    <div className="space-y-2">
                      {healthEvents.slice(0, 10).map((h, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-sm">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${h.status === "active" ? "bg-red-500" : "bg-green-500"}`} />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{h.eventType} — {h.description || h.diagnosis || ""}</div>
                            <div className="text-xs text-muted-foreground">{fmtDate(h.date)} · {h.severity}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    Vaccination History
                    <Link href={`/health?tab=vaccination&cattleId=${id}`}>
                      <Button size="sm" variant="outline">Add</Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vaccinations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No vaccinations recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {vaccinations.map((v, i) => (
                        <div key={i} className="p-2 rounded-lg bg-muted/30 text-sm">
                          <div className="font-medium">{v.vaccineName}</div>
                          <div className="text-xs text-muted-foreground flex gap-2">
                            <span>Given: {fmtDate(v.date)}</span>
                            {v.nextDueDate && <span>Next: {fmtDate(v.nextDueDate)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Financials */}
        <TabsContent value="finance">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Purchase Cost" value={`₹${Number(plSummary?.purchaseCost || 0).toLocaleString("en-IN")}`} icon={<Wallet className="w-4 h-4 text-red-500" />} color="red" />
              <StatCard label="Other Costs" value={`₹${totalCosts.toLocaleString("en-IN")}`} icon={<TrendingDown className="w-4 h-4 text-orange-500" />} color="orange" />
              <StatCard label="Milk Revenue" value={`₹${Number(plSummary?.milkRevenue || 0).toLocaleString("en-IN")}`} icon={<Milk className="w-4 h-4 text-blue-500" />} color="blue" />
              <StatCard label="Total Invested" value={`₹${(Number(plSummary?.purchaseCost || 0) + totalCosts).toLocaleString("en-IN")}`} icon={<TrendingUp className="w-4 h-4 text-purple-500" />} color="purple" />
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Cost Records
                  <Link href={`/cattle/pl?cattleId=${id}`}>
                    <Button size="sm" variant="outline">View P/L</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {costs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No costs recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left py-2 pr-3">Date</th>
                          <th className="text-left py-2 pr-3">Category</th>
                          <th className="text-left py-2 pr-3">Description</th>
                          <th className="text-right py-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costs.map((c, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-3">{fmtDate(c.date)}</td>
                            <td className="py-2 pr-3 capitalize">{c.category}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{c.description || "—"}</td>
                            <td className="py-2 text-right font-medium">₹{Number(c.amount).toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  ...heats.map(h => ({ type: "heat", date: h.detectedAt?.split('T')[0], label: `Heat detected (${h.intensity || "normal"})`, icon: "🌡️" })),
                  ...inseminations.map(i => ({ type: "ai", date: i.date, label: `Insemination (${i.method?.toUpperCase() || "AI"})`, icon: "💉" })),
                  ...pregnancyTests.map(p => ({ type: "pt", date: p.testDate, label: `Pregnancy test: ${p.result}`, icon: p.result === "positive" ? "✅" : "❌" })),
                  ...calvings.map(c => ({ type: "calving", date: c.date, label: `Calving — ${c.outcome} ${c.calfGender || ""} calf`, icon: "🐄" })),
                  ...healthEvents.map(h => ({ type: "health", date: h.date, label: `${h.eventType}: ${h.description || h.diagnosis || ""}`, icon: "🏥" })),
                  ...vaccinations.map(v => ({ type: "vaccination", date: v.date, label: `Vaccination: ${v.vaccineName}`, icon: "💊" })),
                  ...milkEntries.slice(0, 10).map(m => ({ type: "milk", date: m.date, label: `Milk: ${Number(m.quantity).toFixed(1)}L (${m.session})`, icon: "🥛" })),
                ].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 30).map((event, i) => (
                  <div key={i} className="flex gap-3 items-start text-sm">
                    <div className="w-8 flex-shrink-0 text-center">{event.icon}</div>
                    <div className="flex-1 border-b pb-2">
                      <div className="font-medium">{event.label}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(event.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: any; color: string }) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950",
    green: "bg-green-50 dark:bg-green-950",
    red: "bg-red-50 dark:bg-red-950",
    orange: "bg-orange-50 dark:bg-orange-950",
    purple: "bg-purple-50 dark:bg-purple-950",
    amber: "bg-amber-50 dark:bg-amber-950",
    pink: "bg-pink-50 dark:bg-pink-950",
  };
  return (
    <div className={`rounded-lg p-3 ${bg[color] || "bg-muted"}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="font-bold text-lg">{value}</div>
    </div>
  );
}

function BreedingEvent({ event }: { event: any }) {
  const icons: Record<string, string> = { heat: "🌡️", ai: "💉", pt: "🔬", calving: "🐄" };
  const labels: Record<string, string> = { heat: "Heat Detected", ai: "Insemination (AI)", pt: "Pregnancy Test", calving: "Calving" };
  const colors: Record<string, string> = {
    heat: "border-pink-200 bg-pink-50 dark:bg-pink-950/30",
    ai: "border-blue-200 bg-blue-50 dark:bg-blue-950/30",
    pt: "border-purple-200 bg-purple-50 dark:bg-purple-950/30",
    calving: "border-green-200 bg-green-50 dark:bg-green-950/30",
  };
  return (
    <div className={`flex gap-3 items-start p-3 rounded-lg border text-sm ${colors[event.type] || ""}`}>
      <div className="text-xl flex-shrink-0">{icons[event.type]}</div>
      <div>
        <div className="font-medium">{labels[event.type]}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {event.date ? format(parseISO(event.date), "dd MMM yyyy") : "—"}
          {event.type === "pt" && event.data?.result && ` · Result: ${event.data.result}`}
          {event.type === "ai" && event.data?.method && ` · ${event.data.method?.toUpperCase()}`}
          {event.type === "heat" && event.data?.intensity && ` · ${event.data.intensity}`}
        </div>
      </div>
    </div>
  );
}
