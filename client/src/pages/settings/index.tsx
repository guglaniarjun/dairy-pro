import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTheme, COLOR_THEMES } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import {
  Loader2, Cloud, Building2, Milk, Stethoscope,
  Bell, MessageCircle, Save, Send, Palette, Sun, Moon, Monitor, Check,
  Plus, Trash2, RefreshCw, LogOut,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = !!(user as any)?.isSuperAdmin;
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Configure your farm and system preferences</p>
      </div>
      <Tabs defaultValue="appearance">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4 p-1">
          <TabsTrigger value="appearance" className="text-xs gap-1.5" data-testid="tab-appearance-settings">
            <Palette className="w-3 h-3" />Appearance
          </TabsTrigger>
          <TabsTrigger value="farm" className="text-xs gap-1.5" data-testid="tab-farm-settings">
            <Building2 className="w-3 h-3" />Farm
          </TabsTrigger>
          <TabsTrigger value="milk" className="text-xs gap-1.5">
            <Milk className="w-3 h-3" />Milking
          </TabsTrigger>
          <TabsTrigger value="breeding" className="text-xs gap-1.5">
            <Stethoscope className="w-3 h-3" />Breeding
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5">
            <Bell className="w-3 h-3" />Notifications
          </TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
            <MessageCircle className="w-3 h-3" />WhatsApp
          </TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="storage" className="text-xs gap-1.5" data-testid="tab-storage-settings">
            <Cloud className="w-3 h-3" />Storage
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        <TabsContent value="farm"><FarmTab /></TabsContent>
        <TabsContent value="milk"><MilkingTab /></TabsContent>
        <TabsContent value="breeding"><BreedingTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab isSuperAdmin={isSuperAdmin} /></TabsContent>
        {isSuperAdmin && <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>}
        {isSuperAdmin && <TabsContent value="storage"><StorageTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();

  const modeOptions = [
    { value: "light",  label: "Light",  icon: Sun,     desc: "Bright and clean" },
    { value: "dark",   label: "Dark",   icon: Moon,    desc: "Easy on the eyes" },
    { value: "system", label: "System", icon: Monitor, desc: "Follows device" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Display Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="w-4 h-4 text-primary" />
            Display Mode
          </CardTitle>
          <CardDescription>Choose how DairyFlow looks on your device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {modeOptions.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  data-testid={`button-theme-${opt.value}`}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center cursor-pointer ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  }`}
                >
                  {active && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Color Themes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Colour Theme
          </CardTitle>
          <CardDescription>Pick an accent colour that suits your style</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COLOR_THEMES.map((ct) => {
              const active = colorTheme === ct.id;
              const hslColor = `hsl(${ct.hsl})`;
              return (
                <button
                  key={ct.id}
                  onClick={() => setColorTheme(ct.id)}
                  data-testid={`button-color-theme-${ct.id}`}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-accent/40"
                  }`}
                >
                  {active && (
                    <div
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: hslColor }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <div
                    className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${hslColor}, hsl(${ct.hsl} / 0.7))` }}
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${active ? "text-primary" : ""}`}>{ct.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{ct.name}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live preview swatch */}
          <div className="mt-4 p-4 rounded-xl border bg-card flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl shadow-md flex-shrink-0"
              style={{ background: `hsl(var(--primary))` }}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold">Current theme preview</p>
              <p className="text-xs text-muted-foreground">
                {COLOR_THEMES.find(c => c.id === colorTheme)?.name} · {theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"} mode
              </p>
            </div>
            <div className="flex gap-1.5">
              {["bg-primary", "bg-accent", "bg-secondary"].map((cls) => (
                <div key={cls} className={`w-6 h-6 rounded-md ${cls} border border-border/50`} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography & Density (future) */}
      <Card className="opacity-60 select-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Font & Density</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
          </div>
          <CardDescription>Adjust text size and interface density</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function FarmTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<any>({ queryKey: ["/api/settings"] });
  const { data: farmSettings } = useQuery<any>({ queryKey: ["/api/farm-settings"] });

  const [form, setForm] = useState<any>({});
  const [farmForm, setFarmForm] = useState<any>({});

  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);
  useEffect(() => { if (farmSettings) setFarmForm({ ...farmSettings }); }, [farmSettings]);

  const saveTenant = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/settings", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Farm settings saved" }); },
  });

  const saveFarm = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/farm-settings", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm-settings"] }); },
  });

  const handleSave = () => {
    saveTenant.mutate(form);
    saveFarm.mutate(farmForm);
  };

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Farm Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Farm Name">
              <Input value={farmForm.farmName || ""} onChange={e => setFarmForm((p: any) => ({ ...p, farmName: e.target.value }))} placeholder="My Dairy Farm" />
            </Field>
            <Field label="Phone Number">
              <Input value={farmForm.phone || ""} onChange={e => setFarmForm((p: any) => ({ ...p, phone: e.target.value }))} placeholder="+91 9876543210" />
            </Field>
            <Field label="Currency">
              <Select value={farmForm.currency || "INR"} onValueChange={v => setFarmForm((p: any) => ({ ...p, currency: v, currencySymbol: v === "INR" ? "₹" : "$" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                  <SelectItem value="USD">US Dollar ($)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Timezone">
              <Select value={farmForm.timezone || "Asia/Kolkata"} onValueChange={v => setFarmForm((p: any) => ({ ...p, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={farmForm.address || ""} onChange={e => setFarmForm((p: any) => ({ ...p, address: e.target.value }))} placeholder="Village, District, State" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Accounting Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Accounting Mode">
            <Select value={form.accountingMode || "simple"} onValueChange={v => setForm((p: any) => ({ ...p, accountingMode: v }))}>
              <SelectTrigger className="max-w-xs" data-testid="select-accounting-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple (Revenue & Expense)</SelectItem>
                <SelectItem value="full">Full (Double-entry Accounting)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Simple mode is recommended for most farms</p>
          </Field>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Byproduct Inventory Tracking</p>
              <p className="text-xs text-muted-foreground">Track stock levels for cow dung, manure, etc.</p>
            </div>
            <Switch
              checked={!!form.byproductInventoryEnabled}
              onCheckedChange={v => setForm((p: any) => ({ ...p, byproductInventoryEnabled: v }))}
              data-testid="switch-byproduct-inventory"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveTenant.isPending || saveFarm.isPending} data-testid="button-save-farm-settings">
        {saveTenant.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Farm Settings
      </Button>
    </div>
  );
}

function MilkingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: farmSettings } = useQuery<any>({ queryKey: ["/api/farm-settings"] });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (farmSettings) setForm({ ...farmSettings }); }, [farmSettings]);

  const save = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/farm-settings", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm-settings"] }); toast({ title: "Milking settings saved" }); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Milking Sessions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Sessions per Day">
              <Select value={String(form.milkingSessions || 2)} onValueChange={v => setForm((p: any) => ({ ...p, milkingSessions: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 Sessions</SelectItem>
                  <SelectItem value="3">3 Sessions</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Session 1 Name">
              <Input value={form.session1Name || "Morning"} onChange={e => setForm((p: any) => ({ ...p, session1Name: e.target.value }))} />
            </Field>
            <Field label="Session 2 Name">
              <Input value={form.session2Name || "Evening"} onChange={e => setForm((p: any) => ({ ...p, session2Name: e.target.value }))} />
            </Field>
            {Number(form.milkingSessions || 2) === 3 && (
              <Field label="Session 3 Name">
                <Input value={form.session3Name || "Night"} onChange={e => setForm((p: any) => ({ ...p, session3Name: e.target.value }))} />
              </Field>
            )}
            <Field label="Milk Drop Alert Threshold (%)">
              <Input type="number" value={form.milkDropAlertPercent || 20} onChange={e => setForm((p: any) => ({ ...p, milkDropAlertPercent: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Alert when daily milk drops by this %</p>
            </Field>
          </div>
          <div className="space-y-3">
            <ToggleRow label="FAT% Mandatory" desc="Require FAT reading on every entry" checked={!!form.fatMandatory} onChange={v => setForm((p: any) => ({ ...p, fatMandatory: v }))} />
            <ToggleRow label="SNF% Mandatory" desc="Require SNF reading on every entry" checked={!!form.snfMandatory} onChange={v => setForm((p: any) => ({ ...p, snfMandatory: v }))} />
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Milking Settings
      </Button>
    </div>
  );
}

function BreedingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: farmSettings } = useQuery<any>({ queryKey: ["/api/farm-settings"] });
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (farmSettings) setForm({ ...farmSettings }); }, [farmSettings]);

  const save = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/farm-settings", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/farm-settings"] }); toast({ title: "Breeding settings saved" }); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reproduction Rules</CardTitle>
          <CardDescription>Configures expected event calculations for all cattle</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Heat Cycle Interval (days)">
              <Input type="number" value={form.heatIntervalDays || 21} onChange={e => setForm((p: any) => ({ ...p, heatIntervalDays: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Default: 21 days</p>
            </Field>
            <Field label="Gestation Period (days)">
              <Input type="number" value={form.gestationDays || 280} onChange={e => setForm((p: any) => ({ ...p, gestationDays: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Default: 280 days</p>
            </Field>
            <Field label="Dry Period Before Calving (days)">
              <Input type="number" value={form.dryPeriodDays || 60} onChange={e => setForm((p: any) => ({ ...p, dryPeriodDays: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Default: 60 days (stop milking 60d before calving)</p>
            </Field>
            <Field label="Pregnancy Test After AI (days)">
              <Input type="number" value={form.pregnancyTestDays || 30} onChange={e => setForm((p: any) => ({ ...p, pregnancyTestDays: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Default: 30 days after insemination</p>
            </Field>
            <Field label="Heifer First AI Age (months)">
              <Input type="number" value={form.heiferInseminationAgeMonths || 18} onChange={e => setForm((p: any) => ({ ...p, heiferInseminationAgeMonths: Number(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">Minimum age for first insemination</p>
            </Field>
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Breeding Settings
      </Button>
    </div>
  );
}

const RULE_TYPES = [
  ["birth_followup", "Birth & calf follow-up"], ["death", "Death recorded"],
  ["milk_drop", "Milk production drop"], ["heat_due", "Heat due"],
  ["pregnancy_test_due", "Pregnancy test due"], ["vaccination_due", "Vaccination due"],
  ["low_stock", "Low inventory"], ["cattle_parameter", "Cattle parameter"],
] as const;

const newRule = () => ({
  name: "New calf follow-ups", ruleType: "birth_followup", isEnabled: true,
  offsetsDays: [0, 10, 20, 30], cattleId: null, cattleStage: null,
  conditions: { operator: "lt", value: 20, lookbackDays: 7 }, severity: "warning",
  channels: ["app", "whatsapp"], recipientScope: "tenant_owner", customRecipients: [], messageTemplate: "",
});

function NotificationsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/notification-rules"] });
  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const [draft, setDraft] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (rule: any) => apiRequest(rule.id ? "PUT" : "POST", rule.id ? `/api/notification-rules/${rule.id}` : "/api/notification-rules", rule),
    onSuccess: () => { setDraft(null); queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] }); toast({ title: "Alert rule saved" }); },
    onError: (error: Error) => toast({ title: "Could not save rule", description: error.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notification-rules/${id}`),
    onSuccess: () => { setDraft(null); queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] }); toast({ title: "Alert rule deleted" }); },
  });
  const run = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notification-rules/run"),
    onSuccess: () => toast({ title: "Rules evaluated", description: "New matching alerts and WhatsApp messages were queued." }),
  });

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-8" />;
  return <div className="space-y-4">
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><CardTitle className="text-base">Custom Alert Rules</CardTitle><CardDescription>Create several rules for the same event, animal, stage, timing, and recipient.</CardDescription></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}><RefreshCw className={`w-4 h-4 mr-1 ${run.isPending ? "animate-spin" : ""}`} />Run now</Button><Button size="sm" onClick={() => setDraft(newRule())}><Plus className="w-4 h-4 mr-1" />Add rule</Button></div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!rules.length && !draft && <p className="text-sm text-muted-foreground text-center py-6">No custom rules yet. Built-in app alerts continue until you add your first custom rule.</p>}
        {rules.map(rule => <button key={rule.id} className="w-full text-left rounded-lg border p-3 hover:bg-muted/40" onClick={() => setDraft({ ...rule })}>
          <div className="flex items-center gap-2"><span className="font-medium text-sm flex-1">{rule.name}</span><Badge variant={rule.isEnabled ? "default" : "secondary"}>{rule.isEnabled ? "Active" : "Paused"}</Badge></div>
          <p className="text-xs text-muted-foreground mt-1">{RULE_TYPES.find(([value]) => value === rule.ruleType)?.[1]} · days {(rule.offsetsDays || [0]).join(", ")} · {(rule.channels || ["app"]).join(" + ")}</p>
        </button>)}
      </CardContent>
    </Card>
    {draft && <RuleEditor rule={draft} setRule={setDraft} cattle={cattle} isSuperAdmin={isSuperAdmin} saving={save.isPending} onSave={() => save.mutate(draft)} onDelete={draft.id ? () => remove.mutate(draft.id) : undefined} />}
  </div>;
}

function RuleEditor({ rule, setRule, cattle, isSuperAdmin, saving, onSave, onDelete }: any) {
  const set = (key: string, value: any) => setRule((current: any) => ({ ...current, [key]: value }));
  const channel = (name: string, enabled: boolean) => set("channels", enabled ? Array.from(new Set([...(rule.channels || []), name])) : (rule.channels || []).filter((x: string) => x !== name));
  const conditions = rule.conditions || {};
  return <Card>
    <CardHeader><CardTitle className="text-base">{rule.id ? "Edit alert rule" : "Create alert rule"}</CardTitle><CardDescription>Phone numbers must include the country code, for example 919876543210.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Rule name"><Input value={rule.name || ""} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Event"><Select value={rule.ruleType} onValueChange={v => set("ruleType", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RULE_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Alert on day(s)"><Input value={(rule.offsetsDays || []).join(", ")} onChange={e => set("offsetsDays", e.target.value.split(",").map(v => Number(v.trim())).filter(Number.isFinite))} placeholder="0, 10, 20, 30" /><p className="text-xs text-muted-foreground">0 means event day; use comma-separated days.</p></Field>
        <Field label="Specific cattle"><Select value={rule.cattleId || "all"} onValueChange={v => set("cattleId", v === "all" ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All cattle</SelectItem>{cattle.map((cow: any) => <SelectItem key={cow.id} value={cow.id}>{cow.name || cow.tagNumber} ({cow.tagNumber})</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Cattle stage"><Select value={rule.cattleStage || "all"} onValueChange={v => set("cattleStage", v === "all" ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{["calf", "heifer", "milking", "dry", "bull"].map(stage => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Severity"><Select value={rule.severity || "warning"} onValueChange={v => set("severity", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></Field>
        {(rule.ruleType === "milk_drop" || rule.ruleType === "low_stock") && <Field label={rule.ruleType === "milk_drop" ? "Drop threshold (%)" : "Quantity threshold"}><Input type="number" value={conditions.value ?? 20} onChange={e => set("conditions", { ...conditions, value: Number(e.target.value) })} /></Field>}
        {rule.ruleType === "milk_drop" && <Field label="Comparison period (days)"><Input type="number" min="1" value={conditions.lookbackDays ?? 7} onChange={e => set("conditions", { ...conditions, lookbackDays: Number(e.target.value) })} /></Field>}
        {rule.ruleType === "cattle_parameter" && <><Field label="Parameter"><Input value={conditions.parameter || "ageDays"} onChange={e => set("conditions", { ...conditions, parameter: e.target.value })} placeholder="ageDays or lactationNumber" /></Field><Field label="Condition"><div className="flex gap-2"><Select value={conditions.operator || "lt"} onValueChange={v => set("conditions", { ...conditions, operator: v })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{["lt", "lte", "eq", "gte", "gt"].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Input type="number" value={conditions.value ?? 0} onChange={e => set("conditions", { ...conditions, value: Number(e.target.value) })} /></div></Field></>}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <ToggleRow label="In-app alert" desc="Show in DairyFlow" checked={(rule.channels || []).includes("app")} onChange={(v) => channel("app", v)} />
        <ToggleRow label="WhatsApp" desc="Send from Super Admin session" checked={(rule.channels || []).includes("whatsapp")} onChange={(v) => channel("whatsapp", v)} />
      </div>
      {(rule.channels || []).includes("whatsapp") && <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Recipients"><Select value={rule.recipientScope || "tenant_owner"} onValueChange={v => set("recipientScope", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tenant_owner">This farm owner</SelectItem><SelectItem value="custom">Custom numbers</SelectItem>{isSuperAdmin && <SelectItem value="all_tenant_owners">All tenant owners</SelectItem>}</SelectContent></Select></Field>
        {rule.recipientScope === "custom" && <Field label="Custom phone numbers"><Input value={(rule.customRecipients || []).join(", ")} onChange={e => set("customRecipients", e.target.value.split(",").map(v => v.trim()).filter(Boolean))} placeholder="919876543210, 919812345678" /></Field>}
      </div>}
      <Field label="WhatsApp message template (optional)"><Textarea value={rule.messageTemplate || ""} onChange={e => set("messageTemplate", e.target.value)} placeholder={'{{farm}}: {{title}}\n{{message}}'} /><p className="text-xs text-muted-foreground">Available variables: {'{{farm}}'}, {'{{title}}'}, {'{{message}}'}, {'{{cattle}}'}.</p></Field>
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Switch checked={rule.isEnabled !== false} onCheckedChange={v => set("isEnabled", v)} /><Label>Rule active</Label></div><div className="flex gap-2">{onDelete && <Button variant="destructive" onClick={onDelete}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>}<Button onClick={onSave} disabled={saving || !rule.name}><Save className="w-4 h-4 mr-1" />Save rule</Button></div></div>
    </CardContent>
  </Card>;
}

function WhatsAppTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: status } = useQuery<any>({ queryKey: ["/api/admin/whatsapp-web/status"], refetchInterval: 3000 });
  const { data: logs = [] } = useQuery<any[]>({ queryKey: ["/api/admin/whatsapp-web/logs"], refetchInterval: 5000 });
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Hello from DairyFlow! This is a test message.");
  const [broadcast, setBroadcast] = useState("");
  const action = useMutation({
    mutationFn: ({ url, data }: any) => apiRequest("POST", url, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp-web/status"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp-web/logs"] }); toast({ title: "Request accepted" }); },
    onError: (error: Error) => toast({ title: "WhatsApp action failed", description: error.message, variant: "destructive" }),
  });
  const connected = status?.state === "connected";
  return <div className="space-y-4">
    <Card><CardHeader><CardTitle className="text-base">Super Admin WhatsApp Web</CardTitle><CardDescription>One persistent session sends messages for every DairyFlow tenant. This is an unofficial WhatsApp Web integration; WhatsApp can log out or restrict automated accounts.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><Badge variant={connected ? "default" : status?.state === "error" ? "destructive" : "secondary"}>{status?.state || "loading"}</Badge>{status?.phoneNumber && <span className="text-sm">Connected number: +{status.phoneNumber}</span>}{status?.lastConnectedAt && <span className="text-xs text-muted-foreground">Since {new Date(status.lastConnectedAt).toLocaleString("en-IN")}</span>}</div>
      {status?.lastError && <p className="text-sm text-destructive">{status.lastError}</p>}
      {status?.qrDataUrl && <div className="space-y-2"><img src={status.qrDataUrl} alt="WhatsApp Web QR code" className="w-64 h-64 border rounded-lg" /><p className="text-sm text-muted-foreground">On the Super Admin phone: WhatsApp → Linked devices → Link a device, then scan this QR.</p></div>}
      <div className="flex gap-2">{!connected && <Button onClick={() => action.mutate({ url: "/api/admin/whatsapp-web/connect" })} disabled={action.isPending}><RefreshCw className="w-4 h-4 mr-1" />Connect / show QR</Button>}{connected && <Button variant="outline" onClick={() => action.mutate({ url: "/api/admin/whatsapp-web/logout" })} disabled={action.isPending}><LogOut className="w-4 h-4 mr-1" />Disconnect</Button>}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Test delivery</CardTitle></CardHeader><CardContent className="space-y-3"><Field label="Destination phone"><Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="919876543210" /></Field><Field label="Message"><Textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} /></Field><Button disabled={!connected || !testPhone || action.isPending} onClick={() => action.mutate({ url: "/api/admin/whatsapp-web/test", data: { phone: testPhone, message: testMsg } })}><Send className="w-4 h-4 mr-1" />Send test</Button></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Broadcast to all tenant owners</CardTitle><CardDescription>Queues one message for every active farm with a configured phone number.</CardDescription></CardHeader><CardContent className="space-y-3"><Textarea value={broadcast} onChange={e => setBroadcast(e.target.value)} placeholder="Message for all farm owners" /><Button variant="destructive" disabled={!connected || !broadcast.trim() || action.isPending} onClick={() => action.mutate({ url: "/api/admin/whatsapp-web/broadcast", data: { message: broadcast } })}><Send className="w-4 h-4 mr-1" />Queue broadcast</Button></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Recent deliveries</CardTitle></CardHeader><CardContent>{!logs.length ? <p className="text-sm text-muted-foreground text-center py-4">No messages queued yet</p> : <div className="space-y-2">{logs.slice(0, 30).map((log: any) => <div key={log.id} className="flex gap-3 p-2.5 rounded-lg bg-muted/30 text-sm"><div className={`w-2 h-2 rounded-full mt-1.5 ${log.status === "sent" ? "bg-green-500" : log.status.startsWith("failed") ? "bg-red-500" : "bg-amber-500"}`} /><div className="min-w-0 flex-1"><div className="font-medium">To: {log.toPhone}</div><div className="text-xs text-muted-foreground truncate">{log.message}</div><Badge variant="outline" className="mt-1 text-xs">{log.status} · attempt {log.attempts || 0}</Badge></div></div>)}</div>}</CardContent></Card>
  </div>;
}

function StorageTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/system-settings"] });

  const [provider, setProvider] = useState("none");
  const [endpoint, setEndpoint] = useState("");
  const [bucket, setBucket] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const get = (k: string) => settings.find(s => s.key === k)?.value || "";
      setProvider(get("storage_provider") || "none");
      setEndpoint(get("storage_endpoint"));
      setBucket(get("storage_bucket"));
      setRegion(get("storage_region"));
      setAccessKey(get("storage_access_key"));
      setSecretKey(get("storage_secret_key"));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (d: { key: string; value: string; isSecret?: boolean }) => apiRequest("POST", "/api/admin/system-settings", d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] }),
  });

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ key: "storage_provider", value: provider });
      await saveMutation.mutateAsync({ key: "storage_endpoint", value: endpoint });
      await saveMutation.mutateAsync({ key: "storage_bucket", value: bucket });
      await saveMutation.mutateAsync({ key: "storage_region", value: region });
      if (accessKey && !accessKey.includes("*")) await saveMutation.mutateAsync({ key: "storage_access_key", value: accessKey, isSecret: true });
      if (secretKey && !secretKey.includes("*")) await saveMutation.mutateAsync({ key: "storage_secret_key", value: secretKey, isSecret: true });
      toast({ title: "Storage settings saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save storage settings.", variant: "destructive" });
    }
  };

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Cloud className="w-4 h-4" />File Storage Configuration</CardTitle>
          <CardDescription>Configure S3-compatible or Supabase storage for file attachments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Storage Provider">
            <Select value={provider} onValueChange={setProvider} data-testid="select-storage-provider">
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Attachments disabled)</SelectItem>
                <SelectItem value="s3">Amazon S3 / S3-Compatible</SelectItem>
                <SelectItem value="supabase">Supabase Storage</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {provider !== "none" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={provider === "supabase" ? "Supabase URL" : "S3 Endpoint"}>
                <Input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://..." data-testid="input-storage-endpoint" />
              </Field>
              <Field label="Bucket Name">
                <Input value={bucket} onChange={e => setBucket(e.target.value)} placeholder="my-dairy-bucket" data-testid="input-storage-bucket" />
              </Field>
              {provider === "s3" && (
                <Field label="Region">
                  <Input value={region} onChange={e => setRegion(e.target.value)} placeholder="ap-south-1" data-testid="input-storage-region" />
                </Field>
              )}
              <Field label={provider === "supabase" ? "Anon Key" : "Access Key ID"}>
                <Input type="password" value={accessKey} onChange={e => setAccessKey(e.target.value)} data-testid="input-storage-access-key" />
              </Field>
              <Field label={provider === "supabase" ? "Service Role Key" : "Secret Access Key"}>
                <Input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} data-testid="input-storage-secret-key" />
              </Field>
            </div>
          )}
          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            Max file size: 10 MB. Supported: JPG, PNG, WebP, PDF, DOC, MP3, WAV, WebM
          </div>
        </CardContent>
      </Card>
      <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-storage-settings">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Storage Settings
      </Button>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: any; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
