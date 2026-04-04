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
  outcome: z.string().default("normal"),
  calfGender: z.string().optional(),
  calfTagNumber: z.string().optional(),
  birthWeight: z.string().optional(),
  complications: z.string().optional(),
  notes: z.string().optional(),
});

export default function RecordCalvingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);

  const { data: cattle = [] } = useQuery<any[]>({ queryKey: ["/api/cattle"] });
  const pregnantCattle = cattle.filter((c: any) => c.stage === "pregnant" && c.status === "active");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      cattleId: params.get("cattleId") || "",
      date: new Date().toISOString().split("T")[0],
      outcome: "normal",
      calfGender: "",
      calfTagNumber: "",
      birthWeight: "",
      complications: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/breeding/calvings", {
      ...data,
      cattleId: parseInt(data.cattleId),
      birthWeight: data.birthWeight ? parseFloat(data.birthWeight) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breeding/calvings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cattle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Calving recorded successfully" });
      navigate("/breeding");
    },
    onError: () => toast({ title: "Failed to record calving", variant: "destructive" }),
  });

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/breeding")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Record Calving</h1>
          <p className="text-sm text-muted-foreground">Record calving/delivery event</p>
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
                    <FormControl><SelectTrigger><SelectValue placeholder="Select pregnant cattle" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {(pregnantCattle.length > 0 ? pregnantCattle : cattle.filter((c: any) => c.gender === "female")).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name || c.tagNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Calving Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="outcome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Outcome</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal Birth</SelectItem>
                      <SelectItem value="assisted">Assisted Delivery</SelectItem>
                      <SelectItem value="caesarean">Caesarean</SelectItem>
                      <SelectItem value="stillbirth">Stillbirth</SelectItem>
                      <SelectItem value="abortion">Abortion</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="calfGender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calf Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male (Bull Calf)</SelectItem>
                        <SelectItem value="female">Female (Heifer Calf)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="birthWeight" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Weight (kg)</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="e.g. 30.5" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="calfTagNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Calf Tag Number</FormLabel>
                  <FormControl><Input placeholder="e.g. C-001" {...field} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="complications" render={({ field }) => (
                <FormItem>
                  <FormLabel>Complications</FormLabel>
                  <FormControl><Input placeholder="Any complications..." {...field} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Additional notes..." {...field} /></FormControl>
                </FormItem>
              )} />

              <Button type="submit" className="w-full gap-2" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Baby className="w-4 h-4" />}
                Record Calving
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
