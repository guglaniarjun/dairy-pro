import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";

interface Cattle {
  id: string;
  tagNumber: string;
  name: string | null;
  status: string;
}

interface CattlePL {
  purchaseCost: string | null;
  totalCosts: string | null;
  milkRevenue: string | null;
}

const saleSchema = z.object({
  cattleId: z.string().min(1, "Select a cattle to sell"),
  saleDate: z.string().min(1, "Sale date is required"),
  amount: z.string().min(1, "Amount is required"),
  partyName: z.string().optional(),
  partyPhone: z.string().optional(),
  partyAddress: z.string().optional(),
  paymentMethod: z.enum(["cash", "bank", "upi", "cheque"]),
  isFullPayment: z.boolean(),
  initialPaymentAmount: z.string().optional(),
  notes: z.string().optional(),
});

type SaleFormValues = z.infer<typeof saleSchema>;

export default function CattleSalePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createdTransactionId, setCreatedTransactionId] = useState<string | null>(null);

  const { data: cattleList, isLoading: cattleLoading } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const activeCattle = cattleList?.filter(c => c.status === "active") || [];

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      cattleId: "",
      saleDate: new Date().toISOString().split("T")[0],
      amount: "",
      partyName: "",
      partyPhone: "",
      partyAddress: "",
      paymentMethod: "cash",
      isFullPayment: true,
      initialPaymentAmount: "",
      notes: "",
    },
  });

  const selectedCattleId = form.watch("cattleId");
  const isFullPayment = form.watch("isFullPayment");
  const saleAmount = form.watch("amount");

  const { data: cattlePL, isLoading: plLoading } = useQuery<CattlePL>({
    queryKey: ["/api/cattle", selectedCattleId, "pl-summary"],
    enabled: !!selectedCattleId,
  });

  const purchaseCost = Number(cattlePL?.purchaseCost || 0);
  const totalCosts = Number(cattlePL?.totalCosts || 0);
  const milkRevenue = Number(cattlePL?.milkRevenue || 0);
  const netSaleAmount = Number(saleAmount || 0);
  const profitLoss = netSaleAmount + milkRevenue - purchaseCost - totalCosts;

  const createMutation = useMutation({
    mutationFn: async (data: SaleFormValues) => {
      const paymentAmount = data.isFullPayment ? data.amount : (data.initialPaymentAmount || "0");
      const paymentStatus = data.isFullPayment ? "paid" : (Number(paymentAmount) > 0 ? "partial" : "pending");
      
      const transactionRes = await apiRequest("POST", "/api/cattle-transactions", {
        cattleId: data.cattleId,
        type: "sale",
        date: data.saleDate,
        amount: data.amount,
        partyName: data.partyName || null,
        partyPhone: data.partyPhone || null,
        partyAddress: data.partyAddress || null,
        paymentMethod: data.paymentMethod,
        paymentStatus: paymentStatus,
        paidAmount: paymentAmount,
        purchaseCostAtSale: purchaseCost.toString(),
        totalCostsAtSale: totalCosts.toString(),
        milkRevenueAtSale: milkRevenue.toString(),
        profitLoss: profitLoss.toString(),
        notes: data.notes || null,
      });
      const transaction = await transactionRes.json();
      
      if (Number(paymentAmount) > 0) {
        await apiRequest("POST", `/api/cattle-transactions/${transaction.id}/payments`, {
          date: data.saleDate,
          amount: paymentAmount,
          paymentMethod: data.paymentMethod,
          notes: "Payment at sale",
        });
      }
      
      await apiRequest("PATCH", `/api/cattle/${data.cattleId}`, {
        status: "sold",
      });
      
      return transaction;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cattle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cattle-transactions"] });
      setCreatedTransactionId(result.id);
      toast({ title: "Sale recorded", description: "Cattle marked as sold" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record sale", variant: "destructive" });
    },
  });

  const onSubmit = (data: SaleFormValues) => {
    createMutation.mutate(data);
  };

  const selectedCattle = activeCattle.find(c => c.id === selectedCattleId);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cattle")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record Cattle Sale</h1>
          <p className="text-muted-foreground">Sell a cattle and calculate profit/loss</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="cattle" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cattle" data-testid="tab-select-cattle">
                Select Cattle
              </TabsTrigger>
              <TabsTrigger value="sale" data-testid="tab-sale-info">
                Sale Info
              </TabsTrigger>
              <TabsTrigger value="payment" data-testid="tab-payment">
                Payment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cattle" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Cattle to Sell</CardTitle>
                  <CardDescription>Choose the cattle you want to sell</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cattleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cattle *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-cattle">
                              <SelectValue placeholder="Select cattle to sell" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cattleLoading && (
                              <SelectItem value="loading" disabled>Loading...</SelectItem>
                            )}
                            {activeCattle.map((cattle) => (
                              <SelectItem key={cattle.id} value={cattle.id}>
                                {cattle.tagNumber} {cattle.name ? `- ${cattle.name}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedCattleId && (
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Profit/Loss Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {plLoading ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Calculating...
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Purchase Cost:</span>
                                <span className="font-medium">₹{purchaseCost.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Other Costs:</span>
                                <span className="font-medium">₹{totalCosts.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Milk Revenue:</span>
                                <span className="font-medium text-green-600">+₹{milkRevenue.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Investment:</span>
                                <span className="font-medium">₹{(purchaseCost + totalCosts - milkRevenue).toLocaleString()}</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Enter the sale amount below to see projected profit/loss
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sale" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sale Details</CardTitle>
                  <CardDescription>Information about the sale and buyer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="saleDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-sale-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Amount (₹) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="60000" 
                              {...field} 
                              data-testid="input-amount" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {netSaleAmount > 0 && selectedCattleId && (
                    <Card className={`${profitLoss >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {profitLoss >= 0 ? (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                            <span className="font-medium">
                              {profitLoss >= 0 ? "Projected Profit" : "Projected Loss"}
                            </span>
                          </div>
                          <span className={`text-xl font-bold ${profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {profitLoss >= 0 ? "+" : ""}₹{profitLoss.toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="partyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buyer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Buyer's name" {...field} data-testid="input-party-name" />
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
                          <FormLabel>Buyer Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="9876543210" {...field} data-testid="input-party-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="partyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Buyer Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Village, District, State" {...field} data-testid="input-party-address" />
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
                          <Textarea placeholder="Any additional notes about this sale" {...field} data-testid="input-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Details</CardTitle>
                  <CardDescription>How the payment is being received</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isFullPayment"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Full Payment Received</FormLabel>
                          <FormDescription>
                            Turn off if only receiving partial payment now
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-full-payment"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank">Bank Transfer</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!isFullPayment && (
                    <FormField
                      control={form.control}
                      name="initialPaymentAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Payment Amount (₹)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="e.g., 30000" 
                              {...field} 
                              data-testid="input-initial-payment"
                            />
                          </FormControl>
                          <FormDescription>
                            {saleAmount && field.value ? 
                              `Balance receivable: ₹${(Number(saleAmount) - Number(field.value)).toLocaleString()}` :
                              "Enter the amount received now"
                            }
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {isFullPayment && saleAmount && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4" />
                        <span>Full payment of <strong>₹{Number(saleAmount).toLocaleString()}</strong> will be recorded</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {createdTransactionId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Attachments</CardTitle>
                    <CardDescription>Upload sale documents, receipts, photos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AttachmentUploader 
                      entityType="cattle_transaction" 
                      entityId={createdTransactionId} 
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-4">
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="flex-1"
              data-testid="button-save-sale"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Record Sale
                </>
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate("/cattle")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
