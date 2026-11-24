import { reportFixture } from "./report-fixture";
import { addDays } from "../shared/care";

export function printableFixture(period: "morning" | "evening", count = 19) {
  const r: any = reportFixture(count);
  r.briefing = { period, coveredDate: r.date, date: period === "morning" ? addDays(r.date, 1) : r.date,
    actionDate: period === "morning" ? addDays(r.date, 1) : r.date };
  r.generatedAt = period === "morning" ? "2026-11-13T02:00:00Z" : "2026-11-12T14:00:00Z";
  r.tasks = [{ id: "urgent", cattleId: "cow-0", title: "Check the animal and the zero entry", dueDate: r.briefing.date,
    dueTime: "08:30", priority: "urgent", status: "pending", assignedToName: "Farm team" }];
  r.reminders = [];
  r.dairySales.entries = r.dairySales.entries.slice(0, 3);
  r.dairySales.customers = r.dairySales.customers.slice(0, 3);
  r.customerActivities = [{ id: "customer-task", customerId: "customer-0", customerName: "Customer 1", title: "Confirm next delivery quantity",
    dueDate: r.briefing.date, dueTime: "10:00", priority: "high", status: "pending", source: "manual", assignedToName: "Farm team" }];
  r.milk.history = r.animals.flatMap((a: any) => Array.from({ length: 7 }, (_, i) => [
    { cattleId: a.id, date: addDays(r.date, -i - 1), session: "morning", quantity: 8.5 },
    { cattleId: a.id, date: addDays(r.date, -i - 1), session: "evening", quantity: 6.5 },
  ]).flat());
  r.milk.comparisonRules = { lookbackDays: 7, minRecords: 5, dropPercent: 20, minDropLitres: 1 };
  return r;
}
