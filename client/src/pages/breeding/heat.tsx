import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Cattle } from "@shared/schema";

const heatFormSchema = z.object({
  cattleId: z.string().min(1, "Please select a cow"),
  detectedAt: z.string().min(1, "Detection time is required"),
  intensity: z.enum(["weak", "normal", "strong"]),
  notes: z.string().optional(),
});

type HeatFormData = z.infer<typeof heatFormSchema>;

export default function RecordHeatPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: cattle, isLoading: cattleLoading } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const femaleCattle = cattle?.filter((c) => c.gender === "female" && c.status === "active");

  const form = useForm<HeatFormData>({
    resolver: zodResolver(heatFormSchema),
    defaultValues: {
      cattleId: "",
      detectedAt: new Date().toISOString().slice(0, 16),
      intensity: "normal",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: HeatFormData) => {
      const response = await apiRequest("POST", "/api/breeding/heats", {
        ...data,
        detectedAt: new Date(data.detectedAt).toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breeding/heats"] });
      toast({
        title: "Heat recorded",
        description: "The heat observation has been saved.",
      });
      navigate("/breeding");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record heat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: HeatFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="gap-2 mb-4"
          onClick={() => navigate("/breeding")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Breeding
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Record Heat</h1>
        <p className="text-muted-foreground">Record heat observation for a cow</p>
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
                          <SelectValue placeholder={cattleLoading ? "Loading..." : "Select a cow"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {femaleCattle && femaleCattle.length > 0 ? (
                          femaleCattle.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.tagNumber} {c.name ? `- ${c.name}` : ""}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No female cattle available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="detectedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detection Time *</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-detected-at"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intensity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heat Intensity *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-intensity">
                          <SelectValue placeholder="Select intensity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weak">Weak</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="strong">Strong</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <Textarea
                        placeholder="Any observations about the heat signs..."
                        className="resize-none"
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/breeding")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !femaleCattle?.length}
                  className="flex-1"
                  data-testid="button-submit"
                >
                  {createMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Record Heat
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
