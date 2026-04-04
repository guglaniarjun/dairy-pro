import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";
import type { Breed, Cattle } from "@shared/schema";

const cattleFormSchema = z.object({
  tagNumber: z.string().min(1, "Tag number is required"),
  name: z.string().optional(),
  breedId: z.string().optional(),
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().optional(),
  dateOfEntry: z.string().min(1, "Date of entry is required"),
  source: z.enum(["born", "purchased"]),
  purchasePrice: z.string().optional(),
  status: z.enum(["active", "sold", "dead", "culled"]),
  stage: z.enum(["calf", "heifer", "milking", "dry", "pregnant"]),
  lactationNumber: z.string().optional(),
  motherId: z.string().optional(),
  fatherId: z.string().optional(),
  notes: z.string().optional(),
});

type CattleFormData = z.infer<typeof cattleFormSchema>;

export default function AddCattlePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createdCattleId, setCreatedCattleId] = useState<string | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);

  const { data: breeds } = useQuery<Breed[]>({ queryKey: ["/api/breeds"] });
  const { data: allCattle } = useQuery<Cattle[]>({ queryKey: ["/api/cattle"] });
  const femaleCattle = allCattle?.filter((c) => c.gender === "female" && c.status === "active");

  const form = useForm<CattleFormData>({
    resolver: zodResolver(cattleFormSchema),
    defaultValues: {
      tagNumber: "",
      name: "",
      gender: "female",
      dateOfEntry: new Date().toISOString().split("T")[0],
      source: "born",
      status: "active",
      stage: "heifer",
      lactationNumber: "",
      motherId: "",
      fatherId: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CattleFormData) => {
      const response = await apiRequest("POST", "/api/cattle", {
        ...data,
        purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice) : undefined,
        lactationNumber: data.lactationNumber ? parseInt(data.lactationNumber) : undefined,
        motherId: data.motherId || undefined,
        fatherId: data.fatherId || undefined,
        breedId: data.breedId || undefined,
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cattle"] });
      setCreatedCattleId(result.id);
      setShowAttachments(true);
      toast({
        title: "Cattle added",
        description: "The cattle has been successfully registered. You can add attachments.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add cattle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CattleFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="gap-2 mb-4"
          onClick={() => navigate("/cattle")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cattle
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Add New Cattle</h1>
        <p className="text-muted-foreground">Register a new cow or calf in your herd</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tagNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tag Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 001" {...field} data-testid="input-tag-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Lakshmi" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="breedId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breed</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-breed">
                            <SelectValue placeholder="Select breed" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {breeds?.map((breed) => (
                            <SelectItem key={breed.id} value={breed.id}>
                              {breed.name}
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
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-dob" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfEntry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Entry *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-entry-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="born">Born on Farm</SelectItem>
                          <SelectItem value="purchased">Purchased</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stage *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-stage">
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="calf">Calf</SelectItem>
                          <SelectItem value="heifer">Heifer</SelectItem>
                          <SelectItem value="milking">Milking</SelectItem>
                          <SelectItem value="dry">Dry</SelectItem>
                          <SelectItem value="pregnant">Pregnant</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("source") === "purchased" && (
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          {...field}
                          data-testid="input-purchase-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                          <SelectItem value="dead">Dead</SelectItem>
                          <SelectItem value="culled">Culled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lactationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lactation Number</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g. 3 (0 for heifer)" {...field} data-testid="input-lactation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="motherId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dam (Mother)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-mother">
                            <SelectValue placeholder="Select dam (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {femaleCattle?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name ? `${c.name} (${c.tagNumber})` : c.tagNumber}
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
                  name="fatherId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sire (Father / Bull ID)</FormLabel>
                      <FormControl>
                        <Input placeholder="Bull tag or semen ID (optional)" {...field} data-testid="input-father" />
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
                        placeholder="Any additional notes..."
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
                    onClick={() => navigate("/cattle")}
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
                    Add Cattle
                  </Button>
                </div>
              )}
            </form>
          </Form>

          {showAttachments && createdCattleId && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Paperclip className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold">Add Attachments (Optional)</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Upload photos, health certificates, or other documents for this cattle
              </p>
              <AttachmentUploader 
                entityType="cattle" 
                entityId={createdCattleId} 
              />
              <div className="flex gap-4 mt-6">
                <Button
                  onClick={() => navigate("/cattle")}
                  data-testid="button-done"
                >
                  Done
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/cattle")}
                  data-testid="button-skip-attachments"
                >
                  Skip & Go Back
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
