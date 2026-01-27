import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, CreditCard, User, Calendar } from "lucide-react";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";

interface Cattle {
  id: string;
  tagNumber: string;
  name: string | null;
}

interface Breed {
  id: string;
  name: string;
}

const purchaseSchema = z.object({
  tagNumber: z.string().min(1, "Tag number is required"),
  name: z.string().optional(),
  breedId: z.string().min(1, "Breed is required"),
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().optional(),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  amount: z.string().min(1, "Amount is required"),
  partyName: z.string().optional(),
  partyPhone: z.string().optional(),
  partyAddress: z.string().optional(),
  paymentMethod: z.enum(["cash", "bank", "upi", "cheque"]),
  isFullPayment: z.boolean(),
  initialPaymentAmount: z.string().optional(),
  notes: z.string().optional(),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

export default function CattlePurchasePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createdTransactionId, setCreatedTransactionId] = useState<string | null>(null);
  const [createdCattleId, setCreatedCattleId] = useState<string | null>(null);

  const { data: breeds } = useQuery<Breed[]>({
    queryKey: ["/api/breeds"],
  });

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      tagNumber: "",
      name: "",
      breedId: "",
      gender: "female",
      dateOfBirth: "",
      purchaseDate: new Date().toISOString().split("T")[0],
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

  const isFullPayment = form.watch("isFullPayment");
  const amount = form.watch("amount");

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseFormValues) => {
      const cattleRes = await apiRequest("POST", "/api/cattle", {
        tagNumber: data.tagNumber,
        name: data.name || null,
        breedId: data.breedId,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth || null,
        dateOfEntry: data.purchaseDate,
        status: "active",
        source: "purchased",
      });
      const cattle = await cattleRes.json();
      
      const paymentAmount = data.isFullPayment ? data.amount : (data.initialPaymentAmount || "0");
      const paymentStatus = data.isFullPayment ? "paid" : (Number(paymentAmount) > 0 ? "partial" : "pending");
      
      const transactionRes = await apiRequest("POST", "/api/cattle-transactions", {
        cattleId: cattle.id,
        type: "purchase",
        date: data.purchaseDate,
        amount: data.amount,
        partyName: data.partyName || null,
        partyPhone: data.partyPhone || null,
        partyAddress: data.partyAddress || null,
        paymentMethod: data.paymentMethod,
        paymentStatus: paymentStatus,
        paidAmount: paymentAmount,
        notes: data.notes || null,
      });
      const transaction = await transactionRes.json();
      
      if (Number(paymentAmount) > 0) {
        await apiRequest("POST", `/api/cattle-transactions/${transaction.id}/payments`, {
          date: data.purchaseDate,
          amount: paymentAmount,
          paymentMethod: data.paymentMethod,
          notes: "Initial payment at purchase",
        });
      }
      
      return { cattle, transaction };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cattle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cattle-transactions"] });
      setCreatedTransactionId(result.transaction.id);
      setCreatedCattleId(result.cattle.id);
      toast({ title: "Purchase recorded", description: `${result.cattle.tagNumber} added successfully` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record purchase", variant: "destructive" });
    },
  });

  const onSubmit = (data: PurchaseFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cattle")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record Cattle Purchase</h1>
          <p className="text-muted-foreground">Add a new cattle to your herd via purchase</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="cattle" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cattle" data-testid="tab-cattle-details">
                Cattle Details
              </TabsTrigger>
              <TabsTrigger value="purchase" data-testid="tab-purchase-info">
                Purchase Info
              </TabsTrigger>
              <TabsTrigger value="payment" data-testid="tab-payment">
                Payment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cattle" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cattle Information</CardTitle>
                  <CardDescription>Enter the details of the cattle being purchased</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tagNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tag Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., COW-001" {...field} data-testid="input-tag-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Lakshmi" {...field} data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="breedId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Breed *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-breed">
                                <SelectValue placeholder="Select breed" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {breeds?.map((breed) => (
                                <SelectItem key={breed.id} value={breed.id}>
                                  {breed.name}
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
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-gender">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="female">Female (Cow)</SelectItem>
                              <SelectItem value="male">Male (Bull)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth (Approximate)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-dob" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchase" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Purchase Details</CardTitle>
                  <CardDescription>Information about the purchase and seller</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-purchase-date" />
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
                          <FormLabel>Purchase Amount (₹) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="50000" 
                              {...field} 
                              data-testid="input-amount" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="partyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seller Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Seller's name" {...field} data-testid="input-party-name" />
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
                          <FormLabel>Seller Phone</FormLabel>
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
                        <FormLabel>Seller Address</FormLabel>
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
                          <Textarea placeholder="Any additional notes about this purchase" {...field} data-testid="input-notes" />
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
                  <CardDescription>How the payment is being made</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isFullPayment"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Full Payment</FormLabel>
                          <FormDescription>
                            Turn off if only making partial payment now
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
                              placeholder="e.g., 25000" 
                              {...field} 
                              data-testid="input-initial-payment"
                            />
                          </FormControl>
                          <FormDescription>
                            {amount && field.value ? 
                              `Balance: ₹${(Number(amount) - Number(field.value)).toLocaleString()}` :
                              "Enter the amount being paid now"
                            }
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {isFullPayment && amount && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="w-4 h-4" />
                        <span>Full payment of <strong>₹{Number(amount).toLocaleString()}</strong> will be recorded</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {createdTransactionId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Attachments</CardTitle>
                    <CardDescription>Upload purchase documents, photos, invoices</CardDescription>
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
              data-testid="button-save-purchase"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Record Purchase
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
