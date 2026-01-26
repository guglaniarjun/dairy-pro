import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  Milk,
  Heart,
  Stethoscope,
  ChevronRight,
} from "lucide-react";
import type { Cattle, Breed } from "@shared/schema";

export default function CattleListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: cattle, isLoading } = useQuery<Cattle[]>({
    queryKey: ["/api/cattle"],
  });

  const { data: breeds } = useQuery<Breed[]>({
    queryKey: ["/api/breeds"],
  });

  const filteredCattle = cattle?.filter((cow) => {
    const matchesSearch =
      cow.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cow.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === "all" || cow.stage === stageFilter;
    const matchesStatus = statusFilter === "all" || cow.status === statusFilter;
    return matchesSearch && matchesStage && matchesStatus;
  });

  const getBreedName = (breedId: string | null) => {
    if (!breedId) return "Unknown";
    return breeds?.find((b) => b.id === breedId)?.name || "Unknown";
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "milking":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "dry":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "pregnant":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "heifer":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "calf":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "sold":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      case "dead":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cattle Management</h1>
          <p className="text-muted-foreground">
            {cattle?.length || 0} total cattle registered
          </p>
        </div>
        <Link href="/cattle/new">
          <Button className="gap-2" data-testid="button-add-cattle">
            <Plus className="w-4 h-4" />
            Add Cattle
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by tag or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-cattle"
          />
        </div>
        <div className="flex gap-2">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-stage-filter">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="calf">Calf</SelectItem>
              <SelectItem value="heifer">Heifer</SelectItem>
              <SelectItem value="milking">Milking</SelectItem>
              <SelectItem value="dry">Dry</SelectItem>
              <SelectItem value="pregnant">Pregnant</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="dead">Dead</SelectItem>
              <SelectItem value="culled">Culled</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Milking", count: cattle?.filter(c => c.stage === "milking").length || 0, color: "text-blue-600" },
          { label: "Dry", count: cattle?.filter(c => c.stage === "dry").length || 0, color: "text-amber-600" },
          { label: "Pregnant", count: cattle?.filter(c => c.stage === "pregnant").length || 0, color: "text-purple-600" },
          { label: "Heifers", count: cattle?.filter(c => c.stage === "heifer").length || 0, color: "text-green-600" },
          { label: "Calves", count: cattle?.filter(c => c.stage === "calf").length || 0, color: "text-pink-600" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Cattle Grid/List */}
      {isLoading ? (
        <div className={viewMode === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filteredCattle && filteredCattle.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCattle.map((cow) => (
              <Link key={cow.id} href={`/cattle/${cow.id}`}>
                <Card className="cursor-pointer hover-elevate transition-all h-full" data-testid={`cattle-card-${cow.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 rounded-lg">
                        <AvatarImage src={cow.photoUrl || ""} alt={cow.name || cow.tagNumber} />
                        <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-lg">
                          {cow.tagNumber.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {cow.name || `#${cow.tagNumber}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Tag: {cow.tagNumber}
                            </p>
                          </div>
                          <Badge className={getStageColor(cow.stage)}>
                            {cow.stage}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getBreedName(cow.breedId)}
                        </p>
                        {cow.lactationNumber && cow.lactationNumber > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Lactation {cow.lactationNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Milk className="w-4 h-4" />
                        <span>12.5 L/day</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Heart className="w-4 h-4" />
                        <span>Healthy</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCattle.map((cow) => (
              <Link key={cow.id} href={`/cattle/${cow.id}`}>
                <Card className="cursor-pointer hover-elevate transition-all" data-testid={`cattle-row-${cow.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage src={cow.photoUrl || ""} alt={cow.name || cow.tagNumber} />
                        <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                          {cow.tagNumber.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {cow.name || `#${cow.tagNumber}`}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Tag: {cow.tagNumber}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Breed</p>
                          <p className="text-sm font-medium">{getBreedName(cow.breedId)}</p>
                        </div>
                        <div>
                          <Badge className={getStageColor(cow.stage)}>
                            {cow.stage}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-end">
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No cattle found
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || stageFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by adding your first cow"}
            </p>
            {!searchQuery && stageFilter === "all" && statusFilter === "active" && (
              <Link href="/cattle/new">
                <Button className="gap-2" data-testid="button-add-first-cattle">
                  <Plus className="w-4 h-4" />
                  Add Your First Cow
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
