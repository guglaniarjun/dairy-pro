import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Cloud, Settings, Building2 } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("farm");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your farm and system settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="farm" data-testid="tab-farm-settings">
            <Building2 className="w-4 h-4 mr-2" />
            Farm Settings
          </TabsTrigger>
          <TabsTrigger value="storage" data-testid="tab-storage-settings">
            <Cloud className="w-4 h-4 mr-2" />
            Storage Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="farm">
          <FarmSettingsTab />
        </TabsContent>

        <TabsContent value="storage">
          <StorageSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FarmSettingsTab() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<{ accountingMode?: string; byproductInventoryEnabled?: boolean }>({
    queryKey: ["/api/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "Your farm settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const [accountingMode, setAccountingMode] = useState("simple");
  const [byproductInventory, setByproductInventory] = useState(false);

  useEffect(() => {
    if (settings) {
      setAccountingMode(settings.accountingMode || "simple");
      setByproductInventory(settings.byproductInventoryEnabled || false);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({
      accountingMode,
      byproductInventoryEnabled: byproductInventory,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Accounting Settings
          </CardTitle>
          <CardDescription>Configure how financial records are tracked</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accounting-mode">Accounting Mode</Label>
            <Select value={accountingMode} onValueChange={setAccountingMode} data-testid="select-accounting-mode">
              <SelectTrigger id="accounting-mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple (Revenue/Expense tracking)</SelectItem>
                <SelectItem value="full">Full (Double-entry with depreciation)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Simple mode tracks basic income and expenses. Full mode enables advanced features like asset depreciation and double-entry bookkeeping.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Byproduct Settings</CardTitle>
          <CardDescription>Configure how byproducts are managed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="byproduct-inventory">Enable Inventory Tracking</Label>
              <p className="text-sm text-muted-foreground">
                Track stock levels for byproducts (cow dung, manure, etc.)
              </p>
            </div>
            <Switch
              id="byproduct-inventory"
              checked={byproductInventory}
              onCheckedChange={setByproductInventory}
              data-testid="switch-byproduct-inventory"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-farm-settings">
          {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

function StorageSettingsTab() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<Array<{ key: string; value: string | null; isSecret: boolean }>>({
    queryKey: ["/api/admin/system-settings"],
  });

  const [provider, setProvider] = useState("none");
  const [endpoint, setEndpoint] = useState("");
  const [bucket, setBucket] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const getValue = (key: string) => settings.find(s => s.key === key)?.value || "";
      setProvider(getValue("storage_provider") || "none");
      setEndpoint(getValue("storage_endpoint"));
      setBucket(getValue("storage_bucket"));
      setRegion(getValue("storage_region"));
      const accessKeyVal = getValue("storage_access_key");
      const secretKeyVal = getValue("storage_secret_key");
      if (accessKeyVal) setAccessKey(accessKeyVal);
      if (secretKeyVal) setSecretKey(secretKeyVal);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; isSecret?: boolean }) => {
      return apiRequest("POST", "/api/admin/system-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
    },
  });

  const handleSaveAll = async () => {
    try {
      await saveMutation.mutateAsync({ key: "storage_provider", value: provider });
      await saveMutation.mutateAsync({ key: "storage_endpoint", value: endpoint });
      await saveMutation.mutateAsync({ key: "storage_bucket", value: bucket });
      await saveMutation.mutateAsync({ key: "storage_region", value: region });
      if (accessKey && accessKey !== "********") {
        await saveMutation.mutateAsync({ key: "storage_access_key", value: accessKey, isSecret: true });
      }
      if (secretKey && secretKey !== "********") {
        await saveMutation.mutateAsync({ key: "storage_secret_key", value: secretKey, isSecret: true });
      }
      toast({ title: "Storage settings saved", description: "Your storage configuration has been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save storage settings.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            File Storage Configuration
          </CardTitle>
          <CardDescription>
            Configure S3-compatible or Supabase storage for file attachments (images, documents, audio recordings)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storage-provider">Storage Provider</Label>
            <Select value={provider} onValueChange={setProvider} data-testid="select-storage-provider">
              <SelectTrigger id="storage-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Attachments disabled)</SelectItem>
                <SelectItem value="s3">Amazon S3 / S3-Compatible</SelectItem>
                <SelectItem value="supabase">Supabase Storage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider !== "none" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storage-endpoint">
                    {provider === "supabase" ? "Supabase URL" : "S3 Endpoint"}
                  </Label>
                  <Input
                    id="storage-endpoint"
                    placeholder={provider === "supabase" ? "https://xxx.supabase.co" : "https://s3.amazonaws.com"}
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    data-testid="input-storage-endpoint"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage-bucket">Bucket Name</Label>
                  <Input
                    id="storage-bucket"
                    placeholder="my-dairy-bucket"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    data-testid="input-storage-bucket"
                  />
                </div>
              </div>

              {provider === "s3" && (
                <div className="space-y-2">
                  <Label htmlFor="storage-region">Region</Label>
                  <Input
                    id="storage-region"
                    placeholder="us-east-1"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    data-testid="input-storage-region"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="storage-access-key">
                    {provider === "supabase" ? "Anon Key" : "Access Key ID"}
                  </Label>
                  <Input
                    id="storage-access-key"
                    type="password"
                    placeholder="Enter access key"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    data-testid="input-storage-access-key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage-secret-key">
                    {provider === "supabase" ? "Service Role Key" : "Secret Access Key"}
                  </Label>
                  <Input
                    id="storage-secret-key"
                    type="password"
                    placeholder="Enter secret key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    data-testid="input-storage-secret-key"
                  />
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Maximum file size is 10 MB. Supported file types include images (JPG, PNG, WebP), 
                  documents (PDF, DOC), and audio recordings (MP3, WAV, WebM).
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveAll} disabled={saveMutation.isPending} data-testid="button-save-storage-settings">
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Storage Settings
        </Button>
      </div>
    </div>
  );
}
