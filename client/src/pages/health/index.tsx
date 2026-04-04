import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Stethoscope, AlertTriangle, CheckCircle2, Clock,
  Syringe, Pill, Calendar, Activity, XCircle,
} from "lucide-react";

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; }
};

function DaysBadge({ days }: { days: number }) {
  if (days < 0) return <Badge variant="destructive" className="text-xs">{Math.abs(days)}d overdue</Badge>;
  if (days === 0) return <Badge className="bg-red-500 text-white text-xs">Today</Badge>;
  if (days <= 7) return <Badge className="bg-orange-100 text-orange-800 text-xs">In {days}d</Badge>;
  return <Badge variant="secondary" className="text-xs">In {days}d</Badge>;
}

export default function HealthPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const { toast } = useToast();

  const { data: healthEvents = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/health"] });
  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const { data: vaccinationsDue = [] } = useQuery<any[]>({ queryKey: ["/api/vaccinations/due"] });
  const { data: vaccinations = [] } = useQuery<any[]>({ queryKey: ["/api/vaccinations"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/health/${id}`, { status: "resolved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health"] });
      toast({ title: "Issue marked as resolved" });
    },
  });

  const getCowName = (id: number | string) => {
    const c = cattle.find((c: any) => c.id === id || c.id === Number(id));
    return c?.name || c?.tagNumber || `#${id}`;
  };

  const filteredEvents = healthEvents.filter((e: any) => {
    const matchesSearch = getCowName(e.cattleId).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || e.eventType === typeFilter;
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const now = new Date();
  const vacOverdue = vaccinationsDue.filter((v: any) => differenceInDays(parseISO(v.nextDueDate), now) < 0).length;
  const vacDueSoon = vaccinationsDue.filter((v: any) => {
    const d = differenceInDays(parseISO(v.nextDueDate), now);
    return d >= 0 && d <= 7;
  }).length;

  // Group vaccination due by cattle
  const vacDueByCattle: Record<string, any[]> = {};
  vaccinationsDue.forEach((v: any) => {
    const name = getCowName(v.cattleId);
    if (!vacDueByCattle[name]) vacDueByCattle[name] = [];
    vacDueByCattle[name].push(v);
  });

  const getSeverityColor = (s: string) => ({
    critical: "bg-red-100 text-red-800",
    severe: "bg-orange-100 text-orange-800",
    moderate: "bg-amber-100 text-amber-800",
    mild: "bg-green-100 text-green-800",
  }[s] || "bg-muted text-muted-foreground");

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Health Management</h1>
          <p className="text-muted-foreground text-sm">Track health events, vaccinations and treatments</p>
        </div>
        <div className="flex gap-2">
          <Link href="/health/vaccination">
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-vaccination">
              <Syringe className="w-4 h-4" /> Vaccinate
            </Button>
          </Link>
          <Link href="/health/new">
            <Button size="sm" className="gap-1.5" data-testid="button-report-illness">
              <Plus className="w-4 h-4" /> Report Issue
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/40 text-center">
          <div className="text-2xl font-bold text-red-600">{healthEvents.filter((e: any) => e.status === "active").length}</div>
          <div className="text-xs text-muted-foreground">Active Issues</div>
        </div>
        <div className="rounded-xl p-3 bg-orange-50 dark:bg-orange-950/40 text-center">
          <div className="text-2xl font-bold text-orange-600">{vacOverdue}</div>
          <div className="text-xs text-muted-foreground">Vac. Overdue</div>
        </div>
        <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/40 text-center">
          <div className="text-2xl font-bold text-amber-600">{vacDueSoon}</div>
          <div className="text-xs text-muted-foreground">Due This Week</div>
        </div>
        <div className="rounded-xl p-3 bg-green-50 dark:bg-green-950/40 text-center">
          <div className="text-2xl font-bold text-green-600">{healthEvents.filter((e: any) => e.status === "resolved").length}</div>
          <div className="text-xs text-muted-foreground">Resolved</div>
        </div>
      </div>

      <Tabs defaultValue="issues" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="issues" className="text-xs">Health Issues ({healthEvents.filter((e: any) => e.status === "active").length})</TabsTrigger>
          <TabsTrigger value="vaccinations" className="text-xs">Vaccinations Due ({vaccinationsDue.length})</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">Vaccination History ({vaccinations.length})</TabsTrigger>
        </TabsList>

        {/* Health Issues Tab */}
        <TabsContent value="issues">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by cow..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-health" />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]" data-testid="select-type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="illness">Illness</SelectItem>
                  <SelectItem value="injury">Injury</SelectItem>
                  <SelectItem value="vaccination">Vaccination</SelectItem>
                  <SelectItem value="deworming">Deworming</SelectItem>
                  <SelectItem value="checkup">Checkup</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="chronic">Chronic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : filteredEvents.length > 0 ? (
            <div className="space-y-2">
              {filteredEvents.map((event: any) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow" data-testid={`health-event-${event.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        event.status === "active" ? "bg-red-100" :
                        event.status === "resolved" ? "bg-green-100" : "bg-muted"
                      }`}>
                        {event.eventType === "vaccination" ? <Syringe className="w-5 h-5 text-blue-600" /> :
                         event.eventType === "deworming" ? <Pill className="w-5 h-5 text-purple-600" /> :
                         <Stethoscope className="w-5 h-5 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link href={`/cattle/${event.cattleId}`}>
                              <p className="font-semibold hover:underline">{getCowName(event.cattleId)}</p>
                            </Link>
                            <p className="text-sm text-muted-foreground capitalize">
                              {event.eventType} — {event.diagnosis || event.description || "No details"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{fmtDate(event.date)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={`capitalize text-xs ${getSeverityColor(event.severity || "moderate")}`}>{event.severity}</Badge>
                            <Badge variant={event.status === "active" ? "destructive" : "secondary"} className="text-xs capitalize">{event.status}</Badge>
                          </div>
                        </div>
                        {event.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs text-green-700 border-green-300"
                            onClick={() => resolveMutation.mutate(event.id)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Resolved
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-400 mb-4" />
              <p className="font-semibold text-lg mb-1">All healthy!</p>
              <p className="text-muted-foreground text-sm">No health issues to report.</p>
            </div>
          )}
        </TabsContent>

        {/* Vaccinations Due Tab */}
        <TabsContent value="vaccinations">
          {vaccinationsDue.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-400 mb-4" />
              <p className="font-semibold text-lg mb-1">All vaccinations up to date!</p>
              <p className="text-muted-foreground text-sm">No vaccinations due in the next 30 days.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(vacDueByCattle).map(([cowName, vacs]) => (
                <Card key={cowName} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">💉</div>
                      <div className="flex-1">
                        <p className="font-semibold">{cowName}</p>
                        <p className="text-xs text-muted-foreground">{vacs.length} vaccination(s) due</p>
                      </div>
                    </div>
                    <div className="space-y-1 ml-13 pl-13">
                      {vacs.map((v: any, i: number) => {
                        const dueInDays = differenceInDays(parseISO(v.nextDueDate), now);
                        return (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
                            <span className="text-sm">{v.vaccineName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{fmtDate(v.nextDueDate)}</span>
                              <DaysBadge days={dueInDays} />
                              <Link href={`/health/vaccination?cattleId=${v.cattleId}&vaccine=${encodeURIComponent(v.vaccineName)}`}>
                                <Button size="sm" variant="outline" className="h-6 text-xs px-2">Record</Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Vaccination History Tab */}
        <TabsContent value="history">
          {vaccinations.length === 0 ? (
            <div className="text-center py-12">
              <Syringe className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No vaccination records yet</p>
              <Link href="/health/vaccination">
                <Button className="mt-4 gap-2">
                  <Plus className="w-4 h-4" /> Record Vaccination
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {vaccinations.slice().reverse().map((v: any) => (
                <Card key={v.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">💉</div>
                    <div className="flex-1">
                      <Link href={`/cattle/${v.cattleId}`}>
                        <p className="font-medium hover:underline">{getCowName(v.cattleId)}</p>
                      </Link>
                      <p className="text-xs text-muted-foreground">{v.vaccineName} · {fmtDate(v.date)}</p>
                    </div>
                    {v.nextDueDate && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Next due</p>
                        <p className="text-xs font-medium">{fmtDate(v.nextDueDate)}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
