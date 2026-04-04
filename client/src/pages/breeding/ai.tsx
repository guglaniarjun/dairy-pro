import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Syringe, Loader2 } from "lucide-react";

const schema = z.object({
  cattleId: z.string().min(1, "Required"),
  heatId: z.string().optional(),
  date: z.string().min(1, "Required"),
  method: z.string().default("ai"),
  bullId: z.string().optional(),
  semenBatchId: z.string().optional(),
  technicianId: z.string().optional(),
  cost: z.string().optional(),
  notes: z.string().optional(),
});

export default function RecordAIPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const { data: heats = [] } = useQuery<any[]>({ queryKey: ["/api/breeding/heats"] });
  const femaleCattle = cattle.filter((c: any) => c.gender === "female" && c.status === "active");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      cattleId: params.get("cattleId") || "",
      heatId: "",
      date: new Date().toISOString().split("T")[0],
      method: "ai",
      bullId: "",
      semenBatchId: "",
      technicianId: "",
      cost: "",
      notes: "",
    },
  });

  const selectedCattleId = form.watch("cattleId");
  const cattleHeats = heats.filter((h: any) => String(h.cattleId) === String(selectedCattleId));

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/breeding/inseminations", {
      cattleId: data.cattleId,
      heatId: data.heatId || null,
      date: data.date,
      method: data.method,
      bullId: data.bullId || null,
      semenBatchId: data.semenBatchId || null,
      technicianId: data.technicianId || null,
      cost: data.cost ? parseFloat(data.cost) : null,
      notes: data.notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breeding/inseminations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "AI record saved" });
      navigate("/breeding");
    },
    onError: () => toast({ title: "Failed to save AI record", variant: "destructive" }),
  });

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/breeding")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Record AI / Insemination</h1>
          <p className="text-sm text-muted-foreground">Record artificial insemination event</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="cattleId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cattle *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-cattle"><SelectValue placeholder="Select cattle" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {femaleCattle.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name ? `${c.name} (${c.tagNumber})` : c.tagNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="heatId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Heat Record</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger data-testid="select-heat"><SelectValue placeholder="Select heat (optional)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">No linked heat</SelectItem>
                      {cattleHeats.map((h: any) => (
                        <SelectItem key={h.id} value={String(h.id)}>
                          Heat on {new Date(h.detectedAt).toLocaleDateString("en-IN")} ({h.intensity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="method" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-method"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ai">Artificial Insemination (AI)</SelectItem>
                        <SelectItem value="natural">Natural Mating</SelectItem>
                        <SelectItem value="embryo">Embryo Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="bullId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bull / Semen Name</FormLabel>
                    <FormControl><Input placeholder="e.g. HF Premium" {...field} data-testid="input-bull" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="semenBatchId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semen Batch / Straw ID</FormLabel>
                    <FormControl><Input placeholder="e.g. STR-2024-001" {...field} data-testid="input-semen" /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="technicianId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician / Vet</FormLabel>
                    <FormControl><Input placeholder="Name or ID (optional)" {...field} data-testid="input-technician" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" placeholder="e.g. 500" {...field} data-testid="input-cost" /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Any observations..." {...field} data-testid="input-notes" /></FormControl>
                </FormItem>
              )} />

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/breeding")} className="flex-1" data-testid="button-cancel">Cancel</Button>
                <Button type="submit" className="flex-1 gap-2" disabled={mutation.isPending} data-testid="button-submit">
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Syringe className="w-4 h-4" />}
                  Save AI Record
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
