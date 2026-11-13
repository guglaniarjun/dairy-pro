import { farmDay } from "@shared/care";
import { inStage } from "@shared/care";
import { useCattleContext } from "@/hooks/use-cattle-context";
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
import { ArrowLeft, Baby, Loader2 } from "lucide-react";

const schema = z.object({
  cattleId: z.string().min(1, "Required"),
  date: z.string().min(1, "Required"),
  outcome: z.enum(["live", "stillborn", "abortion"]),
  calvingEase: z.enum(["easy", "normal", "difficult", "assisted"]),
  calfGender: z.string().optional(),
  calfWeight: z.string().optional(),
  calfTagNumber: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.outcome === "live" && !data.calfTagNumber?.trim()) ctx.addIssue({ code: "custom", path: ["calfTagNumber"], message: "Enter a unique tag to register the live calf." });
  if (data.outcome === "live" && !["male", "female"].includes(data.calfGender || "")) ctx.addIssue({ code: "custom", path: ["calfGender"], message: "Select the calf's sex." });
});

export default function RecordCalvingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const pregnantCattle = cattle.filter((c: any) => inStage(c, "pregnant") && c.status === "active" && !c.mergedIntoId);
  const femaleCattle = cattle.filter((c: any) => c.gender === "female" && c.status === "active");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      cattleId: params.get("cattleId") || "",
      date: farmDay(),
      outcome: "live" as const,
      calvingEase: "normal" as const,
      calfGender: "",
      calfWeight: "",
      calfTagNumber: "",
      notes: "",
    },
  });
  useCattleContext(form);


  const watchOutcome = form.watch("outcome");

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/breeding/calvings", {
      cattleId: data.cattleId,
      date: data.date,
      outcome: data.outcome,
      calvingEase: data.calvingEase,
      calfGender: data.calfGender || null,
      calves: data.outcome === "live" ? [{ tagNumber: data.calfTagNumber, gender: data.calfGender, weight: data.calfWeight ? Number(data.calfWeight) : undefined }] : [],
      calfWeight: data.calfWeight ? parseFloat(data.calfWeight) : null,
      notes: data.notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breeding/calvings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cattle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Calving recorded successfully" });
      navigate("/breeding");
    },
    onError: (error: Error) => toast({ title: "Calving could not be saved", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/breeding")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Record Calving</h1>
          <p className="text-sm text-muted-foreground">Record calving / delivery event</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="cattleId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dam (Mother Cattle) *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-cattle"><SelectValue placeholder="Select pregnant cattle" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {femaleCattle.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name ? `${c.name} (${c.tagNumber})` : c.tagNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Calving Date *</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="outcome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcome *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-outcome"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="live">Live Birth</SelectItem>
                        <SelectItem value="stillborn">Stillborn</SelectItem>
                        <SelectItem value="abortion">Abortion</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="calvingEase" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calving Ease *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-calving-ease"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="easy">Easy (Unassisted)</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="difficult">Difficult</SelectItem>
                        <SelectItem value="assisted">Assisted (Vet)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchOutcome === "live" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="calfGender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calf Gender *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-calf-gender"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male (Bull Calf)</SelectItem>
                            <SelectItem value="female">Female (Heifer Calf)</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="calfWeight" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calf Birth Weight (kg)</FormLabel>
                        <FormControl><Input type="number" step="0.1" placeholder="e.g. 30.5" {...field} data-testid="input-calf-weight" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="calfTagNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calf Tag Number * (creates the calf record automatically)</FormLabel>
                      <FormControl><Input placeholder="e.g. C-001" {...field} data-testid="input-calf-tag" /></FormControl><FormMessage />
                    </FormItem>
                  )} />
                </>
              )}

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Complications, observations, vet name..." {...field} data-testid="input-notes" /></FormControl>
                </FormItem>
              )} />

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/breeding")} className="flex-1" data-testid="button-cancel">Cancel</Button>
                <Button type="submit" className="flex-1 gap-2" disabled={mutation.isPending} data-testid="button-submit">
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Baby className="w-4 h-4" />}
                  Record Calving
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
