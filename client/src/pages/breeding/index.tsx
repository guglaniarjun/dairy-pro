import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Heart,
  Syringe,
  Baby,
  Calendar,
  AlertCircle,
} from "lucide-react";
import type { Cattle, Heat, Insemination, PregnancyTest } from "@shared/schema";

export default function BreedingPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: cattle } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const { data: heats, isLoading: heatsLoading } = useQuery<Heat[]>({
    queryKey: ["/api/breeding/heats"],
  });

  const { data: inseminations } = useQuery<Insemination[]>({
    queryKey: ["/api/breeding/inseminations"],
  });

  const { data: pregnancyTests } = useQuery<PregnancyTest[]>({
    queryKey: ["/api/breeding/pregnancy-tests"],
  });

  const getCattleName = (cattleId: string) => {
    const cow = cattle?.find((c) => c.id === cattleId);
    return cow?.name || cow?.tagNumber || "Unknown";
  };

  const breedableCattle = cattle?.filter(
    (c) => c.gender === "female" && c.status === "active" && c.stage !== "calf"
  );

  const pregnantCount = cattle?.filter((c) => c.stage === "pregnant").length || 0;
  const heatAlerts = heats?.filter((h) => {
    const heatDate = new Date(h.detectedAt);
    const daysSince = Math.floor((Date.now() - heatDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince <= 2;
  }).length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Breeding & Reproduction</h1>
          <p className="text-muted-foreground">Track heats, AI, and pregnancies</p>
        </div>
        <div className="flex gap-2">
          <Link href="/breeding/heat">
            <Button variant="outline" className="gap-2" data-testid="button-record-heat">
              <Heart className="w-4 h-4" />
              Record Heat
            </Button>
          </Link>
          <Link href="/breeding/ai">
            <Button className="gap-2" data-testid="button-record-ai">
              <Syringe className="w-4 h-4" />
              Record AI
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-pink-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Breedable Cattle</p>
                <p className="text-3xl font-bold text-foreground">
                  {breedableCattle?.length || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Heat Alerts</p>
                <p className="text-3xl font-bold text-red-600">{heatAlerts}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pregnant</p>
                <p className="text-3xl font-bold text-foreground">{pregnantCount}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Baby className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due This Month</p>
                <p className="text-3xl font-bold text-foreground">2</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="heats" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="heats" data-testid="tab-heats">Heats</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">AI Records</TabsTrigger>
          <TabsTrigger value="pregnancy" data-testid="tab-pregnancy">Pregnancy</TabsTrigger>
          <TabsTrigger value="calving" data-testid="tab-calving">Calving</TabsTrigger>
        </TabsList>

        <TabsContent value="heats" className="mt-6">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by cow..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-heats"
              />
            </div>
          </div>

          {heatsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : heats && heats.length > 0 ? (
            <div className="space-y-4">
              {heats.map((heat) => (
                <Card key={heat.id} className="hover-elevate cursor-pointer" data-testid={`heat-${heat.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                        <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {getCattleName(heat.cattleId)}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Detected: {format(new Date(heat.detectedAt), "dd MMM yyyy, h:mm a")}
                            </p>
                          </div>
                          <Badge className="capitalize bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400">
                            {heat.intensity}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                  <Heart className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No heat records
                </h3>
                <p className="text-muted-foreground mb-4">
                  Start recording heat observations
                </p>
                <Link href="/breeding/heat">
                  <Button className="gap-2" data-testid="button-add-first-heat">
                    <Plus className="w-4 h-4" />
                    Record Heat
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <Card className="p-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <Syringe className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No AI records
              </h3>
              <p className="text-muted-foreground mb-4">
                Record artificial insemination events
              </p>
              <Link href="/breeding/ai">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Record AI
                </Button>
              </Link>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pregnancy" className="mt-6">
          <Card className="p-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <Baby className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No pregnancy tests
              </h3>
              <p className="text-muted-foreground mb-4">
                Record pregnancy test results
              </p>
              <Link href="/breeding/pregnancy-test">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Test Result
                </Button>
              </Link>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="calving" className="mt-6">
          <Card className="p-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No calving records
              </h3>
              <p className="text-muted-foreground mb-4">
                Record calving events
              </p>
              <Link href="/breeding/calving">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Record Calving
                </Button>
              </Link>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
