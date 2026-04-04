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
import { ArrowLeft, Loader2, Syringe } from "lucide-react";
import type { Cattle } from "@shared/schema";

interface Vaccine {
  id: string;
  name: string;
  code: string;
  intervalDays: number;
}

const vaccinationFormSchema = z.object({
  cattleId: z.string().min(1, "Please select a cattle"),
  vaccineId: z.string().optional(),
  vaccineName: z.string().min(1, "Vaccine name is required"),
  date: z.string().min(1, "Date is required"),
  batchNumber: z.string().optional(),
  nextDueDate: z.string().optional(),
  administeredBy: z.string().optional(),
  notes: z.string().optional(),
});

type VaccinationFormValues = z.infer<typeof vaccinationFormSchema>;

export default function VaccinationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: cattle } = useQuery<Cattle[]>({ queryKey: ["/api/cattle"] });
  const { data: vaccines } = useQuery<Vaccine[]>({ queryKey: ["/api/vaccines"] });

  const form = useForm<VaccinationFormValues>({
    resolver: zodResolver(vaccinationFormSchema),
    defaultValues: {
      cattleId: "",
      vaccineId: "",
      vaccineName: "",
      date: format(new Date(), "yyyy-MM-dd"),
      batchNumber: "",
      nextDueDate: "",
      administeredBy: "",
      notes: "",
    },
  });

  const handleVaccineChange = (vaccineId: string) => {
    const vaccine = vaccines?.find((v) => v.id === vaccineId);
    if (vaccine) {
      form.setValue("vaccineName", vaccine.name);
      if (vaccine.intervalDays) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + vaccine.intervalDays);
        form.setValue("nextDueDate", format(dueDate, "yyyy-MM-dd"));
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: VaccinationFormValues) => {
      const res = await apiRequest("POST", "/api/vaccinations", {
        ...data,
        vaccineId: data.vaccineId || null,
        batchNumber: data.batchNumber || null,
        nextDueDate: data.nextDueDate || null,
        administeredBy: data.administeredBy || null,
        notes: data.notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vaccinations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vaccinations/due"] });
      toast({ title: "Vaccination recorded", description: "Vaccination record saved successfully." });
      setLocation("/health");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/health")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Record Vaccination</h1>
          <p className="text-muted-foreground">Log a vaccination administered to cattle</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
              <FormField
                control={form.control}
                name="cattleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cattle *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cattle">
                          <SelectValue placeholder="Select cattle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cattle?.map((cow) => (
                          <SelectItem key={cow.id} value={cow.id}>
                            {cow.name || cow.tagNumber} (Tag: {cow.tagNumber})
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
                  name="vaccineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vaccine Type</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          handleVaccineChange(val);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-vaccine">
                            <SelectValue placeholder="Select vaccine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vaccines?.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
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
                  name="vaccineName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vaccine Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. FMD Vaccine" {...field} data-testid="input-vaccine-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Administered *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nextDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-next-due" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batchNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Vaccine batch no." {...field} data-testid="input-batch" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="administeredBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Administered By</FormLabel>
                      <FormControl>
                        <Input placeholder="Name of vet / worker" {...field} data-testid="input-admin-by" />
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
                      <Textarea placeholder="Any observations or remarks..." rows={3} {...field} data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/health")}
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
                    <Syringe className="w-4 h-4" />
                  )}
                  Save Vaccination
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
