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
import { ArrowLeft, CheckSquare, Loader2 } from "lucide-react";

const schema = z.object({
  cattleId: z.string().min(1, "Required"),
  testDate: z.string().min(1, "Required"),
  result: z.enum(["positive", "negative", "inconclusive"]),
  method: z.string().optional(),
  daysPregnant: z.string().optional(),
  notes: z.string().optional(),
});

export default function RecordPregnancyTestPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const femaleCattle = cattle.filter((c: any) => c.gender === "female" && c.status === "active");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      cattleId: params.get("cattleId") || "",
      testDate: new Date().toISOString().split("T")[0],
      result: "positive" as const,
      method: "rectal",
      daysPregnant: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/breeding/pregnancy-tests", {
      ...data,
      cattleId: parseInt(data.cattleId),
      daysPregnant: data.daysPregnant ? parseInt(data.daysPregnant) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breeding/pregnancy-tests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Pregnancy test recorded" });
      navigate("/breeding");
    },
    onError: () => toast({ title: "Failed to record test", variant: "destructive" }),
  });

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/breeding")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Record Pregnancy Test</h1>
          <p className="text-sm text-muted-foreground">Record pregnancy test result</p>
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

              <FormField control={form.control} name="testDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="result" render={({ field }) => (
                <FormItem>
                  <FormLabel>Result *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="positive">✅ Positive (Pregnant)</SelectItem>
                      <SelectItem value="negative">❌ Negative (Not Pregnant)</SelectItem>
                      <SelectItem value="inconclusive">❓ Inconclusive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="method" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="rectal">Rectal Palpation</SelectItem>
                        <SelectItem value="ultrasound">Ultrasound</SelectItem>
                        <SelectItem value="blood">Blood Test</SelectItem>
                        <SelectItem value="milk">Milk Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="daysPregnant" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days Pregnant</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 45" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Vet name, observations..." {...field} /></FormControl>
                </FormItem>
              )} />

              <Button type="submit" className="w-full gap-2" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                Save Test Result
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
