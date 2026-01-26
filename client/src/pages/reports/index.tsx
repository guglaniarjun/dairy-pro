import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Download,
  TrendingUp,
  Milk,
  Heart,
  Wallet,
  Calendar,
  FileText,
  ChevronRight,
} from "lucide-react";

const reportCategories = [
  {
    title: "Production Reports",
    icon: Milk,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    reports: [
      { name: "Daily Milk Summary", description: "Cow-wise milk production for selected date" },
      { name: "Weekly Production", description: "7-day milk trends and averages" },
      { name: "Monthly Production", description: "Monthly milk statistics and comparisons" },
      { name: "Lactation Analysis", description: "Performance by lactation number" },
    ],
  },
  {
    title: "Cattle Reports",
    icon: Heart,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    reports: [
      { name: "Herd Summary", description: "Overview of all cattle by status and stage" },
      { name: "Breeding Status", description: "Pregnancy and breeding cycle status" },
      { name: "Health Summary", description: "Active health issues and treatments" },
      { name: "Age Distribution", description: "Cattle distribution by age groups" },
    ],
  },
  {
    title: "Financial Reports",
    icon: Wallet,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    reports: [
      { name: "Income Statement", description: "Revenue and expense summary" },
      { name: "Milk Sales Report", description: "Detailed milk sales records" },
      { name: "Expense Analysis", description: "Category-wise expense breakdown" },
      { name: "Cost per Liter", description: "Production cost analysis" },
    ],
  },
  {
    title: "Inventory Reports",
    icon: BarChart3,
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    reports: [
      { name: "Stock Status", description: "Current inventory levels" },
      { name: "Low Stock Alert", description: "Items below minimum quantity" },
      { name: "Expiry Report", description: "Items approaching expiry" },
      { name: "Consumption Report", description: "Usage patterns and trends" },
    ],
  },
];

export default function ReportsPage() {
  const [periodFilter, setPeriodFilter] = useState<string>("month");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Generate and export farm reports</p>
        </div>
        <div className="flex gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-period">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Milk className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Daily Milk</p>
                <p className="text-2xl font-bold text-foreground">248.5 L</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg per Cow</p>
                <p className="text-2xl font-bold text-foreground">12.8 L</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month Revenue</p>
                <p className="text-2xl font-bold text-foreground">₹1,24,500</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Heart className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conception Rate</p>
                <p className="text-2xl font-bold text-foreground">68%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Categories */}
      <div className="grid lg:grid-cols-2 gap-6">
        {reportCategories.map((category) => (
          <Card key={category.title}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${category.color.split(" ")[0]}`}>
                  <category.icon className="w-5 h-5" />
                </div>
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {category.reports.map((report) => (
                  <div
                    key={report.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                    data-testid={`report-${report.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{report.name}</p>
                        <p className="text-xs text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom Report Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom Report Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-lg bg-muted/30 border border-dashed">
            <div>
              <h3 className="font-medium text-foreground mb-1">Need a custom report?</h3>
              <p className="text-sm text-muted-foreground">
                Build custom reports with the data you need
              </p>
            </div>
            <Button className="gap-2" data-testid="button-custom-report">
              <BarChart3 className="w-4 h-4" />
              Create Custom Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
