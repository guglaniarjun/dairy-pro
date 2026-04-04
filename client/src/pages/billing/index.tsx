import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Check, Zap, Crown, Building2, Star, AlertCircle, RefreshCw } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Link } from "wouter";

const PLAN_ICONS: Record<string, any> = {
  free: Star, starter: Zap, basic: Zap, pro: Crown, enterprise: Building2,
};
const PLAN_COLORS: Record<string, string> = {
  free: "border-gray-200", starter: "border-blue-300", basic: "border-blue-400", pro: "border-purple-400", enterprise: "border-amber-400",
};
const PLAN_BADGE_COLOR: Record<string, string> = {
  starter: "bg-blue-100 text-blue-800", basic: "bg-blue-100 text-blue-800",
  pro: "bg-purple-100 text-purple-800", enterprise: "bg-amber-100 text-amber-800",
};

export default function BillingPage() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/billing/subscription"],
    queryFn: () => fetch("/api/billing/subscription").then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  const { plans = [], subscription, tenant, cattleCount = 0 } = data || {};
  const currentPlanCode = tenant?.plan || "free";
  const currentPlan = plans.find((p: any) => p.code === currentPlanCode) || plans[0];
  const maxCattle = currentPlan?.maxCattle || tenant?.maxCattle || 5;
  const usagePercent = maxCattle > 0 ? Math.min(Math.round((cattleCount / maxCattle) * 100), 100) : 0;

  const daysRemaining = subscription?.endDate ? differenceInDays(parseISO(subscription.endDate), new Date()) : null;
  const isExpiring = daysRemaining != null && daysRemaining <= 7 && daysRemaining >= 0;
  const isExpired = daysRemaining != null && daysRemaining < 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Subscription & Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your DairyFlow plan and usage</p>
      </div>

      {/* Current Plan Card */}
      <Card className={`border-2 ${PLAN_COLORS[currentPlanCode] || ""}`}>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3">
              {(() => { const Icon = PLAN_ICONS[currentPlanCode] || Star; return <Icon className="w-8 h-8 text-primary" />; })()}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{currentPlan?.name || "Free"} Plan</h2>
                  <Badge variant="outline" className="text-xs">Current</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlanCode === "free" ? "Free forever" :
                   subscription?.endDate ? `Renews ${format(parseISO(subscription.endDate), "dd MMM yyyy")}` : "Active"}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold">
                {currentPlanCode === "free" ? "Free" : `₹${Number(currentPlan?.priceMonthly || 0).toLocaleString("en-IN")}`}
                {currentPlanCode !== "free" && <span className="text-sm font-normal text-muted-foreground">/month</span>}
              </div>
              {currentPlan?.priceYearly && currentPlanCode !== "free" && (
                <div className="text-xs text-green-600">₹{Number(currentPlan.priceYearly).toLocaleString("en-IN")}/year</div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cattle Usage</span>
              <span className={usagePercent >= 80 ? "text-amber-600 font-medium" : ""}>
                {cattleCount} / {maxCattle} cattle
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
            {usagePercent >= 90 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {usagePercent >= 100 ? "Cattle limit reached! Upgrade to add more." : "Approaching cattle limit. Consider upgrading."}
              </p>
            )}
          </div>

          {isExpiring && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Plan expires in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}. Renew to avoid interruption.
            </div>
          )}
          {isExpired && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Subscription expired. Renew now to restore full access.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan: any) => {
            const Icon = PLAN_ICONS[plan.code] || Star;
            const isCurrent = plan.code === currentPlanCode;
            const isPopular = plan.code === "basic";
            const features: string[] = Array.isArray(plan.features) ? plan.features : [];
            const savings = plan.priceMonthly && plan.priceYearly && plan.code !== "free"
              ? Math.round((1 - Number(plan.priceYearly) / (Number(plan.priceMonthly) * 12)) * 100)
              : 0;

            return (
              <Card key={plan.code} className={`relative flex flex-col ${isCurrent ? "border-2 border-primary" : ""}`}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="text-xs shadow-sm">Current Plan</Badge>
                  </div>
                )}
                {isPopular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="text-xs bg-purple-600 shadow-sm">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">
                      {plan.code === "free" ? "Free" : `₹${Number(plan.priceMonthly).toLocaleString("en-IN")}`}
                    </span>
                    {plan.code !== "free" && <span className="text-sm text-muted-foreground">/month</span>}
                    {savings > 0 && (
                      <div className="text-xs text-green-600 mt-0.5">
                        ₹{Number(plan.priceYearly).toLocaleString("en-IN")}/year · save {savings}%
                      </div>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    Up to {plan.maxCattle} cattle · {plan.maxUsers} users
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 flex-1 mb-4">
                    {features.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent}
                    onClick={() => { if (!isCurrent) alert("Razorpay payment integration coming soon! Contact support to upgrade your plan."); }}
                    data-testid={`button-select-plan-${plan.code}`}
                  >
                    {isCurrent ? "Current Plan" : plan.code === "free" ? "Downgrade" : "Upgrade · Razorpay"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Info Box */}
      <Card className="bg-muted/40 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Razorpay billing is coming soon.</strong> To upgrade your plan, contact support. All plans include a 7-day grace period after expiry. Yearly plans offer up to 20% savings.
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Link href="/settings">
          <Button variant="outline">Settings</Button>
        </Link>
      </div>
    </div>
  );
}
