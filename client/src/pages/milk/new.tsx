import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Milk, Copy, Paperclip } from "lucide-react";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";
import type { Cattle } from "@shared/schema";

const milkFormSchema = z.object({
  cattleId: z.string().min(1, "Please select a cow"),
  date: z.string().min(1, "Date is required"),
  session: z.enum(["morning", "evening", "night"]),
  quantity: z.string().min(1, "Quantity is required"),
  fat: z.string().optional(),
  snf: z.string().optional(),
  notes: z.string().optional(),
});

type MilkFormData = z.infer<typeof milkFormSchema>;

export default function AddMilkEntryPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [quickEntry, setQuickEntry] = useState<boolean>(false);
  const [createdEntryId, setCreatedEntryId] = useState<string | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);

  const { data: cattle } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const milkingCattle = cattle?.filter((c) => c.stage === "milking" && c.status === "active");

  const form = useForm<MilkFormData>({
    resolver: zodResolver(milkFormSchema),
    defaultValues: {
      cattleId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      session: new Date().getHours() < 12 ? "morning" : "evening",
      quantity: "",
      fat: "",
      snf: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MilkFormData) => {
      const response = await apiRequest("POST", "/api/milk", {
        ...data,
        quantity: parseFloat(data.quantity),
        fat: data.fat ? parseFloat(data.fat) : undefined,
        snf: data.snf ? parseFloat(data.snf) : undefined,
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/milk"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCreatedEntryId(result.id);
      setShowAttachments(true);
      toast({
        title: "Milk recorded",
        description: "The milk entry has been saved. You can now add attachments.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save milk entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MilkFormData) => {
    createMutation.mutate(data);
  };

  const copyYesterday = async () => {
    toast({
      title: "Same as yesterday",
      description: "Yesterday's entries have been copied. Review and save.",
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="gap-2 mb-4"
          onClick={() => navigate("/milk")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Records
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Record Milk</h1>
        <p className="text-muted-foreground">Add milk production entry</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-6">
        <Button
          variant="outline"
          className="gap-2"
          onClick={copyYesterday}
          data-testid="button-copy-yesterday"
        >
          <Copy className="w-4 h-4" />
          Same as Yesterday
        </Button>
        <Button
          variant={quickEntry ? "secondary" : "outline"}
          onClick={() => setQuickEntry(!quickEntry)}
          data-testid="button-quick-entry"
        >
          Quick Entry Mode {quickEntry ? "ON" : "OFF"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="cattleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Cow *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cattle">
                          <SelectValue placeholder="Select a milking cow" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {milkingCattle?.map((cow) => (
                          <SelectItem key={cow.id} value={cow.id}>
                            {cow.name || cow.tagNumber} ({cow.tagNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
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

                <FormField
                  control={form.control}
                  name="session"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-session">
                            <SelectValue placeholder="Select session" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="evening">Evening</SelectItem>
                          <SelectItem value="night">Night</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (Liters) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Milk className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Enter quantity"
                          className="pl-10"
                          {...field}
                          data-testid="input-quantity"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FAT %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 4.5"
                          {...field}
                          data-testid="input-fat"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="snf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SNF %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 8.5"
                          {...field}
                          data-testid="input-snf"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any observations..."
                        className="resize-none"
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!showAttachments && (
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/milk")}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex-1"
                    data-testid="button-submit"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {quickEntry ? "Save & Add Another" : "Save Entry"}
                  </Button>
                </div>
              )}
            </form>
          </Form>

          {showAttachments && createdEntryId && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Paperclip className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold">Add Attachments (Optional)</h3>
              </div>
              <AttachmentUploader 
                entityType="milk_entry" 
                entityId={createdEntryId} 
              />
              <div className="flex gap-4 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (quickEntry) {
                      setShowAttachments(false);
                      setCreatedEntryId(null);
                      form.reset({
                        ...form.getValues(),
                        cattleId: "",
                        quantity: "",
                        fat: "",
                        snf: "",
                        notes: "",
                      });
                    } else {
                      navigate("/milk");
                    }
                  }}
                  data-testid="button-done"
                >
                  {quickEntry ? "Add Another Entry" : "Done"}
                </Button>
                {!quickEntry && (
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/milk")}
                    data-testid="button-skip-attachments"
                  >
                    Skip & Go Back
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
