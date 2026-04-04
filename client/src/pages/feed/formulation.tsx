import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calculator, Leaf, Info } from "lucide-react";
import type { FeedItem, FeedInventory } from "@shared/schema";

interface FeedRequirement {
  name: string;
  category: string;
  amount: number;
  unit: string;
  purpose: string;
}

function calculateFeedRequirements(
  milkYield: number,
  bodyWeight: number,
  stage: string
): FeedRequirement[] {
  const maintenance = bodyWeight * 0.065;
  const production = milkYield * 0.45;
  const totalDM = maintenance + production;

  const roughagePC = stage === "dry" ? 0.75 : 0.6;
  const concentratePC = stage === "dry" ? 0.25 : 0.4;

  const roughage = totalDM * roughagePC * 3.5;
  const concentrate = totalDM * concentratePC;
  const mineralMix = bodyWeight * 0.001 * 100;
  const salt = bodyWeight * 0.0005 * 100;

  return [
    { name: "Green Fodder / Silage", category: "roughage", amount: Math.round(roughage * 0.6), unit: "kg", purpose: "Main energy source, fiber" },
    { name: "Hay / Dry Fodder", category: "roughage", amount: Math.round(roughage * 0.4), unit: "kg", purpose: "Rumen health, fiber" },
    { name: "Cattle Feed Concentrate", category: "concentrate", amount: Math.round(concentrate * 0.5), unit: "kg", purpose: "Protein, energy for milk" },
    { name: "Oil Cake (Cotton/Mustard)", category: "concentrate", amount: Math.round(concentrate * 0.35), unit: "kg", purpose: "High protein supplement" },
    { name: "Grain (Maize / Wheat Bran)", category: "concentrate", amount: Math.round(concentrate * 0.15), unit: "kg", purpose: "Energy supplement" },
    { name: "Mineral Mixture", category: "supplement", amount: parseFloat(mineralMix.toFixed(0)), unit: "g", purpose: "Calcium, phosphorus, trace minerals" },
    { name: "Common Salt", category: "supplement", amount: parseFloat(salt.toFixed(0)), unit: "g", purpose: "Sodium balance" },
  ];
}

const CATEGORY_COLORS: Record<string, string> = {
  roughage: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  concentrate: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  supplement: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function FeedFormulationPage() {
  const [, setLocation] = useLocation();
  const [milkYield, setMilkYield] = useState("15");
  const [bodyWeight, setBodyWeight] = useState("450");
  const [stage, setStage] = useState("lactating");
  const [calculated, setCalculated] = useState(false);

  const { data: feedItems } = useQuery<FeedItem[]>({ queryKey: ["/api/feed/items"] });
  const { data: feedInventory } = useQuery<FeedInventory[]>({ queryKey: ["/api/feed/inventory"] });

  const requirements = calculated
    ? calculateFeedRequirements(
        parseFloat(milkYield) || 0,
        parseFloat(bodyWeight) || 450,
        stage
      )
    : [];

  const roughageTotal = requirements.filter((r) => r.category === "roughage").reduce((s, r) => s + r.amount, 0);
  const concentrateTotal = requirements.filter((r) => r.category === "concentrate").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/feed")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diet Formulation</h1>
          <p className="text-muted-foreground">Calculate daily feed requirements for your cattle</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4" />
            Feed Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="milk-yield">Daily Milk Yield (L)</Label>
              <Input
                id="milk-yield"
                type="number"
                min="0"
                step="0.5"
                value={milkYield}
                onChange={(e) => setMilkYield(e.target.value)}
                data-testid="input-milk-yield"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body-weight">Body Weight (kg)</Label>
              <Input
                id="body-weight"
                type="number"
                min="100"
                step="10"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                data-testid="input-body-weight"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage">Lactation Stage</Label>
              <select
                id="stage"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                data-testid="select-stage"
              >
                <option value="lactating">Lactating</option>
                <option value="dry">Dry</option>
                <option value="heifer">Heifer / Pregnant</option>
              </select>
            </div>
          </div>
          <Button
            onClick={() => setCalculated(true)}
            className="w-full gap-2"
            data-testid="button-calculate"
          >
            <Calculator className="w-4 h-4" />
            Calculate Feed Requirements
          </Button>
        </CardContent>
      </Card>

      {calculated && requirements.length > 0 && (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Roughage</p>
                <p className="text-2xl font-bold text-foreground">{roughageTotal} kg/day</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Concentrate</p>
                <p className="text-2xl font-bold text-foreground">{concentrateTotal} kg/day</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">For Milk Yield</p>
                <p className="text-2xl font-bold text-foreground">{milkYield} L/day</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-500" />
                Recommended Daily Diet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requirements.map((req, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{req.name}</span>
                        <Badge variant="outline" className={CATEGORY_COLORS[req.category]}>
                          {req.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{req.purpose}</p>
                    </div>
                    <div className="text-right font-bold text-foreground">
                      {req.amount} {req.unit}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  These are estimates based on standard Indian dairy farming guidelines. Actual requirements may vary by breed, health status, and season. Consult a vet or nutritionist for precision rations.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available in Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {feedItems && feedItems.length > 0 ? (
                <div className="space-y-2">
                  {feedItems.slice(0, 6).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.name}</span>
                      <Badge variant="outline" className="capitalize">{item.category}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No feed items configured in inventory.</p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/feed/new")} className="flex-1 gap-2">
              <Leaf className="w-4 h-4" />
              Record Actual Feeding
            </Button>
            <Button variant="outline" onClick={() => setCalculated(false)} className="flex-1">
              Recalculate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
