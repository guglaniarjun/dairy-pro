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
  inseminationId: z.string().optional(),
  testDate: z.string().min(1, "Required"),
  result: z.enum(["positive", "negative", "inconclusive"]),
  method: z.string().optional(),
  testedBy: z.string().optional(),
  expectedCalvingDate: z.string().optional(),
  notes: z.string().optional(),
});

export default function RecordPregnancyTestPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const { data: inseminations = [] } = useQuery<any[]>({ queryKey: ["/api/breeding/inseminations"] });
  const femaleCattle = cattle.filter((c: any) => c.gender === "female" && c.status === "active");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      cattleId: params.get("cattleId") || "",
      inseminationId: "",
      testDate: new Date().toISOString().split("T")[0],
      result: "positive" as const,
      method: "rectal",
      testedBy: "",
      expectedCalvingDate: "",
      notes: "",
    },
  });

  const selectedCattleId = form.watch("cattleId");
  const watchResult = form.watch("result");
  const cattleInseminations = inseminations.filter((i: any) => String(i.cattleId) === String(selectedCattleId));

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/breeding/pregnancy-tests", {
      cattleId: data.cattleId,
      inseminationId: data.inseminationId || null,
      testDate: data.testDate,
      result: data.result,
      method: data.method || null,
      testedBy: data.testedBy || null,
      expectedCalvingDate: data.expectedCalvingDate || null,
      notes: data.notes || null,
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/breeding")} data-testid="button-back">
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

              <FormField control={form.control} name="inseminationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked AI / Insemination Record</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger data-testid="select-insemination"><SelectValue placeholder="Select AI record (optional)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {cattleInseminations.map((ins: any) => (
                        <SelectItem key={ins.id} value={String(ins.id)}>
                          AI on {new Date(ins.date).toLocaleDateString("en-IN")} ({ins.method})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="testDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Date *</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="result" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Result *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-result"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="positive">✅ Positive (Pregnant)</SelectItem>
                        <SelectItem value="negative">❌ Negative (Not Pregnant)</SelectItem>
                        <SelectItem value="inconclusive">❓ Inconclusive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="method" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "rectal"}>
                      <FormControl><SelectTrigger data-testid="select-method"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="rectal">Rectal Palpation</SelectItem>
                        <SelectItem value="ultrasound">Ultrasound</SelectItem>
                        <SelectItem value="blood">Blood Test</SelectItem>
                        <SelectItem value="milk">Milk Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="testedBy" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tested By (Vet)</FormLabel>
                    <FormControl><Input placeholder="Vet / technician name" {...field} data-testid="input-tested-by" /></FormControl>
                  </FormItem>
                )} />
              </div>

              {watchResult === "positive" && (
                <FormField control={form.control} name="expectedCalvingDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Calving Date</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-calving-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Observations, findings..." {...field} data-testid="input-notes" /></FormControl>
                </FormItem>
              )} />

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/breeding")} className="flex-1" data-testid="button-cancel">Cancel</Button>
                <Button type="submit" className="flex-1 gap-2" disabled={mutation.isPending} data-testid="button-submit">
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                  Save Test Result
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
