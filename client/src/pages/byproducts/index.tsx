import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShoppingCart, DollarSign, Package, TrendingUp, TrendingDown, Loader2, Recycle } from "lucide-react";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";

interface ByproductType {
  id: string;
  name: string;
  unit: string;
  description: string | null;
}

interface ByproductTransaction {
  id: string;
  tenantId: string;
  byproductTypeId: string;
  type: string;
  date: string;
  quantity: string;
  pricePerUnit: string;
  totalAmount: string;
  partyName: string | null;
  partyPhone: string | null;
  notes: string | null;
  createdAt: string;
}

interface ByproductInventory {
  id: string;
  byproductTypeId: string;
  currentStock: string;
  unit: string;
}

interface TenantSettings {
  byproductInventoryEnabled: boolean;
  accountingMode: string;
}

const transactionSchema = z.object({
  type: z.enum(["purchase", "sale"]),
  byproductTypeId: z.string().min(1, "Select a byproduct type"),
  date: z.string().min(1, "Date is required"),
  quantity: z.string().min(1, "Quantity is required"),
  pricePerUnit: z.string().min(1, "Unit price is required"),
  partyName: z.string().optional(),
  partyPhone: z.string().optional(),
  notes: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function ByproductsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [createdTransactionId, setCreatedTransactionId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("transactions");

  const { data: byproductTypes, isLoading: typesLoading } = useQuery<ByproductType[]>({
    queryKey: ["/api/byproduct-types"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<ByproductTransaction[]>({
    queryKey: ["/api/byproduct-transactions"],
  });

  const { data: inventory, isLoading: inventoryLoading } = useQuery<ByproductInventory[]>({
    queryKey: ["/api/byproduct-inventory"],
  });

  const { data: tenantSettings } = useQuery<TenantSettings>({
    queryKey: ["/api/tenant-settings"],
  });

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "sale",
      byproductTypeId: "",
      date: new Date().toISOString().split("T")[0],
      quantity: "",
      pricePerUnit: "",
      partyName: "",
      partyPhone: "",
      notes: "",
    },
  });

  const quantity = form.watch("quantity");
  const pricePerUnit = form.watch("pricePerUnit");
  const totalAmount = Number(quantity || 0) * Number(pricePerUnit || 0);

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormValues) => {
      const res = await apiRequest("POST", "/api/byproduct-transactions", {
        ...data,
        totalAmount: totalAmount.toString(),
        updateInventory: tenantSettings?.byproductInventoryEnabled ?? false,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/byproduct-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/byproduct-inventory"] });
      setCreatedTransactionId(result.id);
      toast({ title: "Transaction recorded", description: "Byproduct transaction saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record transaction", variant: "destructive" });
    },
  });

  const onSubmit = (data: TransactionFormValues) => {
    createMutation.mutate(data);
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getTypeName = (typeId: string) => {
    return byproductTypes?.find(t => t.id === typeId)?.name || "Unknown";
  };

  const getTypeUnit = (typeId: string) => {
    return byproductTypes?.find(t => t.id === typeId)?.unit || "units";
  };

  const totalSales = transactions?.filter(t => t.type === "sale").reduce((sum, t) => sum + Number(t.totalAmount || 0), 0) || 0;
  const totalPurchases = transactions?.filter(t => t.type === "purchase").reduce((sum, t) => sum + Number(t.totalAmount || 0), 0) || 0;
  const netRevenue = totalSales - totalPurchases;

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setCreatedTransactionId(null);
    form.reset();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Byproducts Management</h1>
          <p className="text-muted-foreground">
            Track sales and purchases of cow dung, manure, biogas, and other byproducts
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-transaction">
              <Plus className="w-4 h-4" />
              Record Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Byproduct Transaction</DialogTitle>
              <DialogDescription>
                Record a purchase or sale of farm byproducts
              </DialogDescription>
            </DialogHeader>
            {!createdTransactionId ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sale">Sale (Income)</SelectItem>
                            <SelectItem value="purchase">Purchase (Expense)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="byproductTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Byproduct Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-byproduct-type">
                              <SelectValue placeholder="Select byproduct" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {byproductTypes?.map(type => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name} ({type.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity *</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} data-testid="input-quantity" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pricePerUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price (₹) *</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} data-testid="input-unit-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {totalAmount > 0 && (
                    <Card className="bg-muted/50">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Amount</span>
                          <span className="font-bold text-lg" data-testid="text-total-amount">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <FormField
                    control={form.control}
                    name="partyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Party Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Buyer/Seller name" {...field} data-testid="input-party-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="partyPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Party Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="Phone number" {...field} data-testid="input-party-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any additional notes..." {...field} data-testid="input-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-transaction">
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Transaction
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-center">
                  Transaction recorded successfully!
                </div>
                <AttachmentUploader
                  entityType="byproduct_transaction"
                  entityId={createdTransactionId}
                />
                <div className="flex justify-end">
                  <Button onClick={handleCloseDialog} data-testid="button-done">
                    Done
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-total-sales">
                  {formatCurrency(totalSales)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <ShoppingCart className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Purchases</p>
                <p className="text-lg font-bold" data-testid="text-total-purchases">
                  {formatCurrency(totalPurchases)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${netRevenue >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {netRevenue >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Revenue</p>
                <p className={`text-lg font-bold ${netRevenue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`} data-testid="text-net-revenue">
                  {netRevenue >= 0 ? '+' : ''}{formatCurrency(netRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Recycle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-lg font-bold" data-testid="text-transaction-count">
                  {transactions?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
          {tenantSettings?.byproductInventoryEnabled && (
            <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>All byproduct sales and purchases</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading || typesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Byproduct</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Party</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map(tx => (
                        <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                          <TableCell>{new Date(tx.date).toLocaleDateString("en-IN")}</TableCell>
                          <TableCell>
                            <Badge variant={tx.type === "sale" ? "default" : "secondary"}>
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{getTypeName(tx.byproductTypeId)}</TableCell>
                          <TableCell className="text-right">
                            {tx.quantity} {getTypeUnit(tx.byproductTypeId)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.pricePerUnit)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(tx.totalAmount)}
                          </TableCell>
                          <TableCell>{tx.partyName || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start tracking your byproduct sales and purchases
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)} data-testid="button-first-transaction">
                    <Plus className="w-4 h-4 mr-2" />
                    Record First Transaction
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {tenantSettings?.byproductInventoryEnabled && (
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle>Current Inventory</CardTitle>
                <CardDescription>Stock levels of byproducts</CardDescription>
              </CardHeader>
              <CardContent>
                {inventoryLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : inventory && inventory.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inventory.map(inv => (
                      <Card key={inv.id} data-testid={`card-inventory-${inv.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{getTypeName(inv.byproductTypeId)}</p>
                              <p className="text-xs text-muted-foreground">Current Stock</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold">{inv.currentStock}</p>
                              <p className="text-xs text-muted-foreground">{inv.unit}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No inventory data</h3>
                    <p className="text-muted-foreground">
                      Inventory will be updated automatically when you record transactions
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
