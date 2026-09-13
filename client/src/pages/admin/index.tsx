import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Beef, Building2, CreditCard, ExternalLink, Loader2, Search, ShieldCheck, Users } from "lucide-react";

type Plan = {
  id: string; name: string; code: string; maxCattle: number; maxUsers: number;
  priceMonthly: string; priceYearly: string | null; features: string[]; isActive: boolean; sortOrder: number | null;
};

type TenantRow = {
  id: string; name: string; slug: string; plan: string; maxCattle: number; isActive: boolean;
  createdAt: string | null; planExpiresAt: string | null; cattleCount: number; activeCattleCount: number;
  memberCount: number; subscriptionStatus: string | null;
  owner: { email: string | null; firstName: string | null; lastName: string | null } | null;
};

type Overview = {
  summary: { totalTenants: number; activeTenants: number; totalCattle: number; paidTenants: number };
  tenants: TenantRow[];
};

const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function MetricCard({ title, value, subtitle, icon: Icon, tone }: any) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return <Card><CardContent className="p-5 flex items-start justify-between gap-3">
    <div><p className="text-sm text-muted-foreground">{title}</p><p className="text-3xl font-bold mt-1">{value}</p><p className="text-xs text-muted-foreground mt-1">{subtitle}</p></div>
    <div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="w-5 h-5" /></div>
  </CardContent></Card>;
}

function PlanEditor({ plan }: { plan: Plan }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({ ...plan, featuresText: (plan.features || []).join("\n") });
  const save = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/subscription-plans/${plan.id}`, {
      name: draft.name,
      maxCattle: Number(draft.maxCattle),
      maxUsers: Number(draft.maxUsers),
      priceMonthly: draft.priceMonthly,
      priceYearly: draft.priceYearly || null,
      features: draft.featuresText.split("\n").map(item => item.trim()).filter(Boolean),
      isActive: draft.isActive,
      sortOrder: Number(draft.sortOrder || 0),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({ title: "Plan saved", description: `${draft.name} is now updated.` });
    },
    onError: (error: Error) => toast({ title: "Plan update failed", description: error.message, variant: "destructive" }),
  });

  return <Card className={!draft.isActive ? "opacity-70" : ""}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-3">
        <div><CardTitle className="text-base">{plan.name}</CardTitle><CardDescription>{plan.code}</CardDescription></div>
        <div className="flex items-center gap-2"><Label htmlFor={`active-${plan.id}`} className="text-xs">Available</Label><Switch id={`active-${plan.id}`} checked={draft.isActive} onCheckedChange={value => setDraft(current => ({ ...current, isActive: value }))} /></div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name</Label><Input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></div>
        <div><Label>Code</Label><Input value={draft.code} disabled title="Plan codes are stable identifiers" /></div>
        <div><Label>Monthly price (₹)</Label><Input type="number" min="0" value={draft.priceMonthly} onChange={event => setDraft(current => ({ ...current, priceMonthly: event.target.value }))} /></div>
        <div><Label>Yearly price (₹)</Label><Input type="number" min="0" value={draft.priceYearly || ""} onChange={event => setDraft(current => ({ ...current, priceYearly: event.target.value }))} /></div>
        <div><Label>Cattle limit</Label><Input type="number" min="0" value={draft.maxCattle} onChange={event => setDraft(current => ({ ...current, maxCattle: Number(event.target.value) }))} /></div>
        <div><Label>User limit</Label><Input type="number" min="0" value={draft.maxUsers} onChange={event => setDraft(current => ({ ...current, maxUsers: Number(event.target.value) }))} /></div>
      </div>
      <div><Label>Features (one per line)</Label><Textarea rows={5} value={draft.featuresText} onChange={event => setDraft(current => ({ ...current, featuresText: event.target.value }))} /></div>
      <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save plan</Button>
    </CardContent>
  </Card>;
}

export default function SuperAdminPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<Overview>({ queryKey: ["/api/admin/overview"], staleTime: 30_000 });
  const { data: plans = [] } = useQuery<Plan[]>({ queryKey: ["/api/admin/subscription-plans"] });

  const updateTenant = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest("PATCH", `/api/admin/tenants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
      toast({ title: "Tenant updated" });
    },
    onError: (error: Error) => toast({ title: "Tenant update failed", description: error.message, variant: "destructive" }),
  });

  const accessTenant = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/tenants/${id}/access`),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      navigate("/");
      window.location.reload();
    },
    onError: (error: Error) => toast({ title: "Could not open farm", description: error.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data?.tenants || [];
    return (data?.tenants || []).filter(tenant => [tenant.name, tenant.slug, tenant.owner?.email, tenant.plan].some(value => value?.toLowerCase().includes(needle)));
  }, [data?.tenants, search]);

  return <div className="p-4 md:p-6 max-w-[1500px] mx-auto space-y-6">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-primary" /><h1 className="text-2xl font-bold">Super Admin</h1></div><p className="text-sm text-muted-foreground mt-1">Monitor tenants, control access, manage limits, and maintain subscription plans.</p></div>
      <Badge variant="outline" className="self-start md:self-auto border-primary/30 text-primary gap-1.5"><Activity className="w-3.5 h-3.5" />Platform control centre</Badge>
    </div>

    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard title="All farms" value={isLoading ? "—" : data?.summary.totalTenants || 0} subtitle={`${data?.summary.activeTenants || 0} currently active`} icon={Building2} tone="green" />
      <MetricCard title="Active farms" value={isLoading ? "—" : data?.summary.activeTenants || 0} subtitle="Allowed to use DairyFlow" icon={Users} tone="blue" />
      <MetricCard title="Cattle managed" value={isLoading ? "—" : data?.summary.totalCattle || 0} subtitle="Across every tenant" icon={Beef} tone="amber" />
      <MetricCard title="Paid farms" value={isLoading ? "—" : data?.summary.paidTenants || 0} subtitle="Non-free subscriptions" icon={CreditCard} tone="purple" />
    </div>

    <Tabs defaultValue="tenants">
      <TabsList><TabsTrigger value="tenants">Tenant control</TabsTrigger><TabsTrigger value="plans">Plans</TabsTrigger></TabsList>
      <TabsContent value="tenants" className="mt-4">
        <Card>
          <CardHeader><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><CardTitle>All tenants</CardTitle><CardDescription>Plan changes and access controls take effect immediately.</CardDescription></div><div className="relative w-full sm:w-80"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search farm, owner, or plan" /></div></div></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Farm / owner</TableHead><TableHead>Usage</TableHead><TableHead>Plan</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Control</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading tenants…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No matching tenants.</TableCell></TableRow>}
                {filtered.map(tenant => <TableRow key={tenant.id}>
                  <TableCell><div className="font-semibold">{tenant.name}</div><div className="text-xs text-muted-foreground">{tenant.owner?.email || "No owner email"} · {tenant.slug}</div></TableCell>
                  <TableCell><div className="font-medium">{tenant.activeCattleCount} / {tenant.maxCattle} cattle</div><div className="text-xs text-muted-foreground">{tenant.memberCount} active user{tenant.memberCount === 1 ? "" : "s"}</div></TableCell>
                  <TableCell className="min-w-40"><Select value={tenant.plan} onValueChange={plan => updateTenant.mutate({ id: tenant.id, data: { plan } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{plans.filter(plan => plan.isActive || plan.code === tenant.plan).map(plan => <SelectItem value={plan.code} key={plan.id}>{plan.name}</SelectItem>)}</SelectContent></Select><div className="text-xs text-muted-foreground mt-1">Expiry: {formatDate(tenant.planExpiresAt)}</div></TableCell>
                  <TableCell className="text-sm">{formatDate(tenant.createdAt)}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><Switch checked={tenant.isActive} onCheckedChange={isActive => updateTenant.mutate({ id: tenant.id, data: { isActive } })} /><Badge variant={tenant.isActive ? "default" : "secondary"}>{tenant.isActive ? "Active" : "Suspended"}</Badge></div></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" disabled={accessTenant.isPending} onClick={() => accessTenant.mutate(tenant.id)}><ExternalLink className="w-3.5 h-3.5 mr-1.5" />Open farm</Button></TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="plans" className="mt-4 space-y-4">
        <div><h2 className="font-semibold text-lg">Subscription plans</h2><p className="text-sm text-muted-foreground">Edit pricing, capacity, features, and availability. Existing tenants keep their assigned plan until you change it.</p></div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{plans.map(plan => <PlanEditor key={plan.id} plan={plan} />)}</div>
      </TabsContent>
    </Tabs>
  </div>;
}
