import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Upload, FileSpreadsheet, FileText, Filter,
  CheckCircle2, XCircle, AlertCircle, Milk, Heart, Stethoscope,
  Wallet, Leaf, Baby, ChevronRight, FileDown, FileUp,
  Info,
} from "lucide-react";

type ImportResult = { imported: number; failed: number; total: number; errors: { row: number; message: string }[] };

const MODULES = [
  { id: "cattle",   label: "Cattle",   icon: Heart,       color: "text-red-500",    desc: "Herd master records" },
  { id: "milk",     label: "Milk",     icon: Milk,        color: "text-sky-500",    desc: "Daily milk entries" },
  { id: "health",   label: "Health",   icon: Stethoscope, color: "text-emerald-500",desc: "Health events & treatments" },
  { id: "breeding", label: "Breeding", icon: Baby,        color: "text-pink-500",   desc: "AI & calving records" },
  { id: "feeding",  label: "Feeding",  icon: Leaf,        color: "text-lime-600",   desc: "Feed consumption records" },
  { id: "expenses", label: "Expenses", icon: Wallet,      color: "text-orange-500", desc: "Farm expenditure" },
  { id: "incomes",  label: "Incomes",  icon: Wallet,      color: "text-yellow-600", desc: "Revenue & income" },
] as const;

type ModuleId = typeof MODULES[number]["id"];

export default function ImportExportPage() {
  const [activeModule, setActiveModule] = useState<ModuleId>("cattle");
  const mod = MODULES.find(m => m.id === activeModule)!;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import & Export</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Bulk data management — import from spreadsheets or export with filters</p>
        </div>
        <Badge variant="secondary" className="gap-1.5 hidden sm:flex">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          CSV & Excel
        </Badge>
      </div>

      {/* Module Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {MODULES.map((m) => {
          const active = activeModule === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              data-testid={`module-tab-${m.id}`}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center cursor-pointer ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-accent/40"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "text-primary" : m.color}`} />
              <span className={`text-xs font-semibold ${active ? "text-primary" : "text-foreground"}`}>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content per module */}
      <div className="grid md:grid-cols-2 gap-5">
        <ExportSection module={activeModule} />
        <ImportSection module={activeModule} />
      </div>
    </div>
  );
}

// ---- EXPORT SECTION ----

function ExportSection({ module }: { module: ModuleId }) {
  const { data: cattle } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cattleId, setCattleId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [filterSession, setFilterSession] = useState("all");
  const [filterEventType, setFilterEventType] = useState("all");
  const [loading, setLoading] = useState<"csv"|"xlsx"|null>(null);
  const { toast } = useToast();

  const hasCattleFilter  = ["milk","health","breeding","feeding"].includes(module);
  const hasDateFilter    = ["milk","health","breeding","feeding","expenses","incomes"].includes(module);
  const hasStatusFilter  = module === "cattle";
  const hasGenderFilter  = module === "cattle";
  const hasSessionFilter = module === "milk";
  const hasTypeFilter    = module === "health";

  const buildParams = (format: string) => {
    const p: Record<string, string> = { format };
    if (startDate) p.startDate = startDate;
    if (endDate)   p.endDate = endDate;
    if (hasCattleFilter && cattleId !== "all") p.cattleId = cattleId;
    if (hasStatusFilter && filterStatus !== "all") p.status = filterStatus;
    if (hasGenderFilter && filterGender !== "all") p.gender = filterGender;
    if (hasSessionFilter && filterSession !== "all") p.session = filterSession;
    if (hasTypeFilter && filterEventType !== "all") p.eventType = filterEventType;
    return new URLSearchParams(p).toString();
  };

  const handleExport = async (format: "csv"|"xlsx") => {
    setLoading(format);
    try {
      const params = buildParams(format);
      const resp = await fetch(`/api/export/${module}?${params}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${module}-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export successful", description: `Downloaded ${module} data as .${format}` });
    } catch {
      toast({ title: "Export failed", description: "Please try again", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileDown className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Export Data</CardTitle>
            <CardDescription className="text-xs">Filter then download</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        {hasDateFilter && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs" data-testid="input-export-start-date" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs" data-testid="input-export-end-date" />
            </div>
          </div>
        )}

        {hasCattleFilter && cattle && cattle.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cattle</Label>
            <Select value={cattleId} onValueChange={setCattleId}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-export-cattle">
                <SelectValue placeholder="All Cattle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cattle</SelectItem>
                {cattle.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tagNumber}{c.name ? ` — ${c.name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {hasStatusFilter && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-export-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
                <SelectItem value="culled">Culled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {hasGenderFilter && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gender</Label>
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-export-gender">
                <SelectValue placeholder="All Genders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {hasSessionFilter && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Session</Label>
            <Select value={filterSession} onValueChange={setFilterSession}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-export-session">
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
                <SelectItem value="night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {hasTypeFilter && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Event Type</Label>
            <Select value={filterEventType} onValueChange={setFilterEventType}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-export-event-type">
                <SelectValue placeholder="All Types" />
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
          </div>
        )}

        {/* No filters for breeding incomes - just info */}
        {!hasDateFilter && !hasStatusFilter && (
          <p className="text-xs text-muted-foreground py-1">All records will be exported.</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 text-xs"
            onClick={() => handleExport("csv")}
            disabled={loading !== null}
            data-testid="button-export-csv"
          >
            <FileText className="w-3.5 h-3.5" />
            {loading === "csv" ? "Exporting…" : "Export CSV"}
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2 text-xs"
            onClick={() => handleExport("xlsx")}
            disabled={loading !== null}
            data-testid="button-export-xlsx"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {loading === "xlsx" ? "Exporting…" : "Export Excel"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- IMPORT SECTION ----

function ImportSection({ module }: { module: ModuleId }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const canImport = !["breeding", "feeding"].includes(module);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  };

  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/import/${module}`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      if (data.imported > 0) {
        toast({ title: "Import complete", description: `${data.imported} records imported successfully` });
      }
    } catch (e: any) {
      setError(e.message || "Import failed");
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async (format: "csv" | "xlsx") => {
    const resp = await fetch(`/api/import/template/${module}?format=${format}`, { credentials: "include" });
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${module}-import-template.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canImport) {
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Import Data</CardTitle>
              <CardDescription className="text-xs">Upload from spreadsheet</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed p-6 text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Import not available</p>
            <p className="text-xs text-muted-foreground">
              {module === "breeding" ? "Breeding records are complex — please use the breeding form to add records manually." : "Feed records must be entered via the feeding form."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Import Data</CardTitle>
            <CardDescription className="text-xs">Upload CSV or Excel file</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Template download */}
        <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Download our template first — it has the correct column headers and sample rows.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={() => handleDownloadTemplate("csv")}
              data-testid="button-download-template-csv"
            >
              <Download className="w-3 h-3" />CSV Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={() => handleDownloadTemplate("xlsx")}
              data-testid="button-download-template-xlsx"
            >
              <Download className="w-3 h-3" />Excel Template
            </Button>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`relative rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
            file ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-accent/30"
          }`}
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          data-testid="dropzone-import"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-import-file"
          />
          {file ? (
            <div className="space-y-1">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-primary" />
              <p className="text-sm font-semibold text-primary truncate px-4">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB — click to change</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports CSV, XLS, XLSX</p>
            </div>
          )}
        </div>

        {/* Import button */}
        <Button
          className="w-full gap-2 text-sm"
          disabled={!file || uploading}
          onClick={handleImport}
          data-testid="button-import-submit"
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Importing…" : "Import Records"}
        </Button>

        {uploading && <Progress value={undefined} className="h-1.5 animate-pulse" />}

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.imported}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Imported</p>
              </div>
              <div className={`rounded-lg p-2 text-center border ${result.failed > 0 ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-muted border-border"}`}>
                <p className={`text-lg font-bold ${result.failed > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{result.failed}</p>
                <p className={`text-[10px] font-medium ${result.failed > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Failed</p>
              </div>
              <div className="rounded-lg bg-muted border border-border p-2 text-center">
                <p className="text-lg font-bold text-foreground">{result.total}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Total Rows</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />Row Errors
                </p>
                {result.errors.slice(0, 20).map((e, i) => (
                  <div key={i} className="text-xs text-red-600 dark:text-red-400 flex gap-2">
                    <span className="font-mono font-semibold flex-shrink-0">Row {e.row}:</span>
                    <span>{e.message}</span>
                  </div>
                ))}
                {result.errors.length > 20 && (
                  <p className="text-xs text-red-500">… and {result.errors.length - 20} more errors</p>
                )}
              </div>
            )}

            {result.imported === result.total && (
              <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-400">
                  All {result.total} records imported successfully!
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
