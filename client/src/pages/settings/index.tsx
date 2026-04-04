import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTheme, COLOR_THEMES } from "@/components/theme-provider";
import {
  Loader2, Cloud, Building2, Milk, Stethoscope,
  Bell, MessageCircle, Save, Send, Eye, EyeOff,
  Palette, Sun, Moon, Monitor, Check,
} from "lucide-react";

export default function SettingsPage() {
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
          <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
            <MessageCircle className="w-3 h-3" />WhatsApp
          </TabsTrigger>
          <TabsTrigger value="storage" className="text-xs gap-1.5" data-testid="tab-storage-settings">
            <Cloud className="w-3 h-3" />Storage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        <TabsContent value="farm"><FarmTab /></TabsContent>
        <TabsContent value="milk"><MilkingTab /></TabsContent>
        <TabsContent value="breeding"><BreedingTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>
        <TabsContent value="storage"><StorageTab /></TabsContent>
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

function NotificationsTab() {
  const queryClient = useQueryClient();
  const { data: rules = [] } = useQuery<any[]>({ queryKey: ["/api/notification-rules"] });

  const notifTypes = [
    { type: "heat_due", label: "Heat Due Reminder", desc: "Alert when a cow is expected to come into heat" },
    { type: "pregnancy_test_due", label: "Pregnancy Test Due", desc: "Alert after insemination when pregnancy test is due" },
    { type: "calving_due", label: "Calving Due", desc: "Alert when calving is approaching (within 14 days)" },
    { type: "dry_due", label: "Dry Period Due", desc: "Alert when cow should be dried off" },
    { type: "vaccination_due", label: "Vaccination Due", desc: "Alert for upcoming vaccine schedules" },
    { type: "low_stock", label: "Low Stock Alert", desc: "Alert when inventory is below minimum level" },
    { type: "milk_drop", label: "Milk Drop Alert", desc: "Alert when daily milk production drops significantly" },
    { type: "payment_reminder", label: "Payment Reminder", desc: "Alert for pending receivables and payables" },
  ];

  const toggle = async (type: string, enabled: boolean) => {
    await apiRequest("PUT", `/api/notification-rules/${type}`, { isEnabled: enabled, channels: ["app"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notification-rules"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification Rules</CardTitle>
        <CardDescription>Configure which events trigger alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {notifTypes.map(rule => {
          const existing = rules.find((r: any) => r.ruleType === rule.type);
          return (
            <div key={rule.type} className="flex items-center justify-between py-3 border-b last:border-0">
              <div className="flex-1 mr-4">
                <p className="text-sm font-medium">{rule.label}</p>
                <p className="text-xs text-muted-foreground">{rule.desc}</p>
              </div>
              <Switch
                checked={existing?.isEnabled !== false}
                onCheckedChange={v => toggle(rule.type, v)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function WhatsAppTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: config } = useQuery<any>({ queryKey: ["/api/whatsapp/config"] });
  const { data: logs = [] } = useQuery<any[]>({ queryKey: ["/api/whatsapp/logs"] });
  const [form, setForm] = useState<any>({});
  const [showKey, setShowKey] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Hello from DairyFlow! This is a test message.");
  const [sending, setSending] = useState(false);

  useEffect(() => { if (config) setForm({ ...config }); }, [config]);

  const save = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/whatsapp/config", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] }); toast({ title: "WhatsApp settings saved" }); },
  });

  const sendTest = async () => {
    if (!testPhone || !testMsg) return;
    setSending(true);
    try {
      await apiRequest("POST", "/api/whatsapp/test", { phone: testPhone, message: testMsg });
      toast({ title: "Test message queued!", description: "Check the log below." });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/logs"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const mode = form.mode || "disabled";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp Configuration</CardTitle>
          <CardDescription>Configure WhatsApp notifications for farm events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="WhatsApp Mode">
            <Select value={mode} onValueChange={v => setForm((p: any) => ({ ...p, mode: v }))} data-testid="select-whatsapp-mode">
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="web">WhatsApp Web (QR Scan)</SelectItem>
                <SelectItem value="api">WhatsApp Business API</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {mode === "web" && (
            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <h3 className="font-medium text-sm">WhatsApp Web Mode</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${form.webSessionStatus === "connected" ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="text-sm">Status: {form.webSessionStatus || "Disconnected"}</span>
              </div>
              <div className="w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground text-xs text-center p-2">
                QR Code will appear here when WhatsApp Web library is connected
              </div>
              <Field label="From Phone Number">
                <Input value={form.fromPhoneNumber || ""} onChange={e => setForm((p: any) => ({ ...p, fromPhoneNumber: e.target.value }))} placeholder="+91 9876543210" />
              </Field>
            </div>
          )}

          {mode === "api" && (
            <div className="p-4 bg-muted/40 rounded-lg space-y-3">
              <h3 className="font-medium text-sm">WhatsApp Business API</h3>
              <Field label="API Provider">
                <Select value={form.apiProvider || "meta"} onValueChange={v => setForm((p: any) => ({ ...p, apiProvider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta (Official)</SelectItem>
                    <SelectItem value="360dialog">360dialog</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="wati">WATI</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="API Key">
                <div className="flex gap-2">
                  <Input type={showKey ? "text" : "password"} value={form.apiKey || ""} onChange={e => setForm((p: any) => ({ ...p, apiKey: e.target.value }))} placeholder="Enter API key" />
                  <Button variant="outline" size="icon" onClick={() => setShowKey(p => !p)}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </Field>
              <Field label="Phone Number ID">
                <Input value={form.apiPhoneNumberId || ""} onChange={e => setForm((p: any) => ({ ...p, apiPhoneNumberId: e.target.value }))} placeholder="Meta Phone Number ID" />
              </Field>
              <Field label="From Number">
                <Input value={form.fromPhoneNumber || ""} onChange={e => setForm((p: any) => ({ ...p, fromPhoneNumber: e.target.value }))} placeholder="+91 9876543210" />
              </Field>
            </div>
          )}

          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save WhatsApp Settings
          </Button>
        </CardContent>
      </Card>

      {mode !== "disabled" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Send Test Message</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Phone Number">
              <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+91 9876543210" data-testid="input-test-phone" />
            </Field>
            <Field label="Message">
              <Input value={testMsg} onChange={e => setTestMsg(e.target.value)} data-testid="input-test-message" />
            </Field>
            <Button onClick={sendTest} disabled={sending || !testPhone} data-testid="button-send-test">
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending..." : "Send Test Message"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Message Log</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No messages sent yet</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 20).map((log: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    log.status === "delivered" ? "bg-green-500" :
                    log.status === "sent" ? "bg-blue-500" :
                    log.status === "failed" ? "bg-red-500" : "bg-gray-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">To: {log.toPhone}</div>
                    <div className="text-muted-foreground truncate text-xs">{log.message}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{log.status}</Badge>
                      <span className="text-xs text-muted-foreground">{log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : ""}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
