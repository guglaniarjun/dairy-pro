import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Bell,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  ExternalLink,
} from "lucide-react";
import type { Alert, Cattle } from "@shared/schema";

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: cattle } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("PATCH", `/api/alerts/${alertId}`, {
        isDismissed: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert dismissed",
        description: "The alert has been dismissed.",
      });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("PATCH", `/api/alerts/${alertId}`, {
        isRead: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = alerts?.filter(a => !a.isRead && !a.isDismissed) || [];
      await Promise.all(unread.map(a => apiRequest("PATCH", `/api/alerts/${a.id}`, { isRead: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "All alerts marked as read" });
    },
  });

  const getActionLink = (alert: Alert) => {
    if (alert.referenceType === "vaccination" || alert.type === "health") {
      return alert.cattleId ? `/health?cattleId=${alert.cattleId}&tab=vaccination` : "/health?tab=vaccination";
    }
    if (alert.referenceType === "heat_due" || alert.referenceType === "pt_due" || alert.type === "breeding") {
      return alert.cattleId ? `/breeding?cattleId=${alert.cattleId}` : "/breeding";
    }
    if (alert.referenceType === "inventory_item" || alert.type === "inventory") {
      return "/inventory";
    }
    if (alert.cattleId) return `/cattle/${alert.cattleId}`;
    return null;
  };

  const getCattleName = (cattleId: string | null) => {
    if (!cattleId) return null;
    const cow = cattle?.find((c) => c.id === cattleId);
    return cow?.name || cow?.tagNumber || null;
  };

  const filteredAlerts = alerts?.filter((alert) => {
    if (alert.isDismissed) return false;
    const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
    const matchesType = typeFilter === "all" || alert.type === typeFilter;
    return matchesSeverity && matchesType;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
      case "info":
      default:
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    }
  };

  const criticalCount = alerts?.filter((a) => !a.isDismissed && a.severity === "critical").length || 0;
  const warningCount = alerts?.filter((a) => !a.isDismissed && a.severity === "warning").length || 0;
  const infoCount = alerts?.filter((a) => !a.isDismissed && a.severity === "info").length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-muted-foreground">System notifications and important reminders</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          data-testid="button-mark-all-read"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          <CheckCircle2 className="w-4 h-4" />
          Mark All Read
        </Button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-amber-600">{warningCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-600">{infoCount}</p>
              </div>
              <Info className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-severity">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="health">Health</SelectItem>
            <SelectItem value="breeding">Breeding</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredAlerts && filteredAlerts.length > 0 ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`border ${getSeverityBg(alert.severity)} ${!alert.isRead ? "ring-2 ring-primary/20" : ""}`}
              data-testid={`alert-${alert.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{alert.title}</h3>
                          {!alert.isRead && (
                            <Badge className="bg-primary text-primary-foreground text-xs">New</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <Badge variant="outline" className="capitalize text-xs">
                            {alert.type}
                          </Badge>
                          {alert.cattleId && (
                            <Link href={`/cattle/${alert.cattleId}`}>
                              <span className="text-xs text-primary hover:underline cursor-pointer">
                                {getCattleName(alert.cattleId) || "View Cattle"}
                              </span>
                            </Link>
                          )}
                          {getActionLink(alert) && (
                            <Link href={getActionLink(alert)!}>
                              <span className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
                                <ExternalLink className="w-3 h-3" /> Take Action
                              </span>
                            </Link>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.createdAt!).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!alert.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markReadMutation.mutate(alert.id)}
                            className="h-8 w-8"
                            data-testid={`button-mark-read-${alert.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => dismissMutation.mutate(alert.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          data-testid={`button-dismiss-${alert.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
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
              <Bell className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              All caught up!
            </h3>
            <p className="text-muted-foreground">
              No alerts to show. Everything is running smoothly.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
