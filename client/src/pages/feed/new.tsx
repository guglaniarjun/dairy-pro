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
import { ArrowLeft, Loader2, Leaf } from "lucide-react";
import type { Cattle, FeedItem } from "@shared/schema";

const feedFormSchema = z.object({
  cattleId: z.string().optional(),
  feedItemId: z.string().min(1, "Please select a feed item"),
  date: z.string().min(1, "Date is required"),
  session: z.enum(["morning", "evening", "night"]),
  plannedQuantity: z.string().optional(),
  actualQuantity: z.string().min(1, "Actual quantity is required"),
  notes: z.string().optional(),
});

type FeedFormValues = z.infer<typeof feedFormSchema>;

export default function RecordFeedingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: cattle } = useQuery<Cattle[]>({ queryKey: ["/api/cattle"] });
  const { data: feedItems } = useQuery<FeedItem[]>({ queryKey: ["/api/feed/items"] });

  const form = useForm<FeedFormValues>({
    resolver: zodResolver(feedFormSchema),
    defaultValues: {
      cattleId: "",
      feedItemId: "",
      date: format(new Date(), "yyyy-MM-dd"),
      session: "morning",
      plannedQuantity: "",
      actualQuantity: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FeedFormValues) => {
      const payload: Record<string, unknown> = {
        feedItemId: data.feedItemId,
        date: data.date,
        session: data.session,
        actualQuantity: data.actualQuantity,
        notes: data.notes || null,
      };
      if (data.cattleId && data.cattleId !== "") payload.cattleId = data.cattleId;
      if (data.plannedQuantity && data.plannedQuantity !== "") payload.plannedQuantity = data.plannedQuantity;

      const res = await apiRequest("POST", "/api/feed/records", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed/records"] });
      toast({ title: "Feeding recorded", description: "Feed record saved successfully." });
      setLocation("/feed");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FeedFormValues) => {
    createMutation.mutate(data);
  };

  const feedByCategory = feedItems?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, FeedItem[]>);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/feed")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Record Feeding</h1>
          <p className="text-muted-foreground">Log feed consumption for cattle</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                name="cattleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cattle (leave blank for all/herd)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cattle">
                          <SelectValue placeholder="All Cattle / Herd" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All Cattle / Herd</SelectItem>
                        {cattle?.map((cow) => (
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

              <FormField
                control={form.control}
                name="feedItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feed Item *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-feed-item">
                          <SelectValue placeholder="Select feed item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {feedByCategory && Object.entries(feedByCategory).map(([category, items]) => (
                          <div key={category}>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              {category}
                            </div>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </SelectItem>
                            ))}
                          </div>
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
                  name="plannedQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned Quantity (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          {...field}
                          data-testid="input-planned-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actualQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Quantity (kg) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          {...field}
                          data-testid="input-actual-quantity"
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
                        rows={3}
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/feed")}
                  className="flex-1"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 gap-2"
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Leaf className="w-4 h-4" />
                  )}
                  Save Feed Record
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
