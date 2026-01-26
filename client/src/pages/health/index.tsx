import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
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
  Plus,
  Search,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Syringe,
  Pill,
} from "lucide-react";
import type { HealthEvent, Cattle } from "@shared/schema";

export default function HealthPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: healthEvents, isLoading } = useQuery<HealthEvent[]>({
    queryKey: ["/api/health"],
  });

  const { data: cattle } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const getCattleName = (cattleId: string) => {
    const cow = cattle?.find((c) => c.id === cattleId);
    return cow?.name || cow?.tagNumber || "Unknown";
  };

  const filteredEvents = healthEvents?.filter((event) => {
    const matchesSearch = getCattleName(event.cattleId)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || event.eventType === typeFilter;
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "severe":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "moderate":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "mild":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "resolved":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "chronic":
        return <Clock className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "illness":
        return <Stethoscope className="w-4 h-4" />;
      case "vaccination":
        return <Syringe className="w-4 h-4" />;
      case "deworming":
        return <Pill className="w-4 h-4" />;
      default:
        return <Stethoscope className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health Management</h1>
          <p className="text-muted-foreground">Track health events and treatments</p>
        </div>
        <div className="flex gap-2">
          <Link href="/health/vaccination">
            <Button variant="outline" className="gap-2" data-testid="button-vaccination">
              <Syringe className="w-4 h-4" />
              Vaccination
            </Button>
          </Link>
          <Link href="/health/new">
            <Button className="gap-2" data-testid="button-report-illness">
              <Plus className="w-4 h-4" />
              Report Issue
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Issues</p>
                <p className="text-2xl font-bold text-foreground">
                  {healthEvents?.filter((e) => e.status === "active").length || 0}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Under Treatment</p>
                <p className="text-2xl font-bold text-foreground">
                  {healthEvents?.filter((e) => e.eventType === "illness" && e.status === "active").length || 0}
                </p>
              </div>
              <Pill className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due Vaccinations</p>
                <p className="text-2xl font-bold text-foreground">5</p>
              </div>
              <Syringe className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved (30d)</p>
                <p className="text-2xl font-bold text-foreground">
                  {healthEvents?.filter((e) => e.status === "resolved").length || 0}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by cow..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-health"
          />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
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
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
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

      {/* Health Events List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredEvents && filteredEvents.length > 0 ? (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="hover-elevate cursor-pointer" data-testid={`health-event-${event.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    event.status === "active" ? "bg-red-100 dark:bg-red-900/30" :
                    event.status === "resolved" ? "bg-green-100 dark:bg-green-900/30" :
                    "bg-muted"
                  }`}>
                    {getEventTypeIcon(event.eventType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {getCattleName(event.cattleId)}
                        </h3>
                        <p className="text-sm text-muted-foreground capitalize">
                          {event.eventType} - {event.diagnosis || event.description || "No details"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(event.severity || "moderate")}>
                          {event.severity}
                        </Badge>
                        {getStatusIcon(event.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(event.date), "dd MMM yyyy")}</span>
                      {event.symptoms && <span>Symptoms: {event.symptoms}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              All healthy!
            </h3>
            <p className="text-muted-foreground mb-4">
              No health issues to report. Keep up the good work!
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
