import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  date: z.string().min(1, "Required"),
  method: z.string().default("ai"),
  bullName: z.string().optional(),
  semenId: z.string().optional(),
  technicianName: z.string().optional(),
  notes: z.string().optional(),
});

export default function RecordAIPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const femaleCattle = cattle.filter((c: any) => c.gender === "female" && c.status === "active");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      cattleId: params.get("cattleId") || "",
      date: new Date().toISOString().split("T")[0],
      method: "ai",
      bullName: "",
      semenId: "",
      technicianName: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/breeding/inseminations", {
      ...data,
      cattleId: parseInt(data.cattleId),
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/breeding")}>
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
                    <FormControl><SelectTrigger><SelectValue placeholder="Select cattle" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {femaleCattle.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name || c.tagNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="ai">Artificial Insemination (AI)</SelectItem>
                      <SelectItem value="natural">Natural Mating</SelectItem>
                      <SelectItem value="embryo">Embryo Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="bullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bull / Semen Name</FormLabel>
                    <FormControl><Input placeholder="e.g. HF Premium" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="semenId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semen ID / Straw ID</FormLabel>
                    <FormControl><Input placeholder="e.g. STR-2024-001" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="technicianName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Technician / Vet Name</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Any observations..." {...field} /></FormControl>
                </FormItem>
              )} />

              <Button type="submit" className="w-full gap-2" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Syringe className="w-4 h-4" />}
                Save AI Record
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
