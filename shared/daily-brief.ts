import { isLactating, finishedTask } from "./care";
import { countdown } from "./farm-overview";

const sum = (rows: any[], key: string) =>
  Math.round(rows.reduce((n, r) => n + Number(r[key] || 0), 0) * 1000) / 1000;
const words = (v: any) => String(v || "").replaceAll("_", " ");
export function dailyBrief(report: any) {
  const animals = report.animals || [],
    entries = report.entries || [],
    events = report.events || [];
  const tag = (id: string) =>
    animals.find((a: any) => a.id === id)?.tagNumber ||
    (id ? "Unknown animal" : "Farm");
  const milk = report.milk?.entries || [];
  const sessions = [
    "morning",
    "evening",
    ...new Set<string>(
      [
        ...(report.milk?.sessions || []),
        ...milk.map((m: any) => m.session),
      ].filter((s: string) => !["morning", "evening"].includes(s)),
    ),
  ];
  const milkIds = new Set([
    ...animals.filter(isLactating).map((a: any) => a.id),
    ...milk.map((m: any) => m.cattleId),
    ...(report.milk?.missing || []).map((m: any) => m.id),
  ]);
  const milkRows = [...milkIds]
    .map((id) => {
      const animal = animals.find((a: any) => a.id === id);
      const own = milk.filter((m: any) => m.cattleId === id);
      return {
        cattleId: id,
        tag: animal?.tagNumber || tag(id as string),
        name: animal?.name || "",
        sessions: Object.fromEntries(
          sessions.map((s) => [
            s,
            own.some((m: any) => m.session === s)
              ? sum(
                  own.filter((m: any) => m.session === s),
                  "quantity",
                )
              : null,
          ]),
        ),
        total: own.length ? sum(own, "quantity") : null,
        discarded: sum(
          own.filter((m: any) => m.destination === "discarded"),
          "quantity",
        ),
      };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  const dairy = report.dairySales || {};
  const saleRows = [
    ...(dairy.entries || []).map((s: any) => ({
      ...s,
      customer: s.customerName,
      product: s.productName,
    })),
    ...(report.milk?.sales || [])
      .filter(
        (s: any) =>
          !(dairy.entries || []).some((d: any) => d.milkSaleId === s.id),
      )
      .map((s: any) => ({
        ...s,
        customer: s.buyerName || "Milk buyer",
        product: "Milk",
        unit: "L",
        rate: s.pricePerLiter,
      })),
  ];
  const customers = (dairy.customers || [])
    .map((c: any) => {
      const own = (dairy.entries || []).filter(
        (s: any) => s.customerId === c.id,
      );
      const receipts = (dairy.payments || []).filter(
        (p: any) => p.customerId === c.id,
      );
      return {
        id: c.id,
        name: c.name,
        sales: sum(own, "totalAmount"),
        received: sum(receipts, "amount"),
        debit: Number(c.outstanding || 0),
        credit: Number(c.advance || 0),
      };
    })
    .filter((c: any) => c.sales || c.received || c.debit || c.credit);
  const allocations = new Map<string, number>();
  for (const e of report.milk?.dispositions || []) {
    if (e.payload?.milkEntryId) continue; // Already included in discarded-at-milking.
    const kind = words(e.payload?.kind);
    allocations.set(
      kind,
      (allocations.get(kind) || 0) + Number(e.payload?.quantity || 0),
    );
  }
  const health = [
    ...(report.activeHealth || []).map((h: any) => ({
      id: h.id,
      cattleId: h.cattleId,
      text: `${tag(h.cattleId)}: ${h.diagnosis || h.description || words(h.eventType)}; ${h.severity || ""} ${h.status}`,
      date: h.date,
    })),
    ...entries
      .filter(
        (e: any) =>
          ["health", "treatment", "vaccination"].includes(e.type) &&
          !(report.activeHealth || []).some((h: any) => h.id === e.id),
      )
      .map((e: any) => ({
        id: e.id,
        cattleId: e.cattleId,
        date: e.date,
        text: `${tag(e.cattleId)}: ${e.type === "treatment" ? [e.medicineName || "Treatment", e.dosage, e.route, e.notes, e.withdrawalEndsAt ? `Milk withdrawal through ${e.withdrawalEndsAt}` : ""].filter(Boolean).join("; ") : [e.diagnosis || e.description || e.vaccineName || words(e.eventType), e.status, e.notes].filter(Boolean).join("; ")}`,
      })),
    ...events
      .filter((e: any) =>
        ["treatment", "vaccination", "deworming", "pregnancy_loss"].includes(
          e.type,
        ),
      )
      .map((e: any) => ({
        id: e.id,
        cattleId: e.cattleId,
        date: e.date,
        text: `${tag(e.cattleId)}: ${words(e.type)}; ${[e.payload?.instructions, e.payload?.notes, e.payload?.medicineName, ...(e.payload?.supplies || []).map((s: any) => `${s.name || s.itemName || "Supply"} ${s.quantity} ${s.unit || ""}`)].filter(Boolean).join("; ")}`,
      })),
    ...animals
      .filter(
        (a: any) =>
          a.milkWithholdUntil &&
          String(a.milkWithholdUntil).slice(0, 10) >= report.date,
      )
      .map((a: any) => ({
        id: `withdrawal-${a.id}`,
        cattleId: a.id,
        date: report.date,
        text: `${a.tagNumber}: Withhold milk through ${String(a.milkWithholdUntil).slice(0, 10)}`,
      })),
  ];
  const actions = [
    ...(report.reminders || []),
    ...(report.tasks || [])
      .filter((t: any) => !finishedTask(t.status) || t.status === "completed")
      .map((t: any) => ({
        id: t.id,
        cattleId: t.cattleId,
        title: t.title,
        dueDate: t.dueDate,
        status: t.status,
        assignedTo: t.assignedToName || t.assignedTo || "Unassigned",
        instructions: [
          t.description,
          t.reason,
          ...(t.supplies || []).map(
            (s: any) =>
              `${s.name || s.itemName || "Supply"} ${s.quantity} ${s.unit || ""}`,
          ),
        ]
          .filter(Boolean)
          .join("; "),
        href: t.sourceKey?.endsWith(":calving")
          ? `/breeding/calving?cattleId=${t.cattleId}`
          : `/care?tab=work&taskId=${t.id}${t.cattleId ? `&cattleId=${t.cattleId}` : ""}`,
      })),
  ]
    .map((a: any) => ({
      ...a,
      tag: tag(a.cattleId),
      countdown:
        a.status === "completed"
          ? "Completed"
          : countdown(a.dueDate, report.date),
    }))
    .sort(
      (a: any, b: any) =>
        Number(a.status === "completed") - Number(b.status === "completed") ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        a.tag.localeCompare(b.tag),
    );
  const activity = [
    ...entries.filter(
      (e: any) => !["health", "treatment", "vaccination"].includes(e.type),
    ),
    ...events.filter(
      (e: any) =>
        ![
          "entry_created",
          "entry_updated",
          "task_completed",
          "milk_disposition",
          "treatment",
          "vaccination",
          "deworming",
          "pregnancy_loss",
        ].includes(e.type),
    ),
  ].map((e: any) => ({
    id: e.id,
    cattleId: e.cattleId,
    text: `${tag(e.cattleId)}: ${words(e.type)} - ${[e.description, e.notes || e.payload?.notes, e.result, e.outcome, e.actualQuantity ? `${e.actualQuantity} kg` : "", e.payload?.instructions, e.payload?.reason, e.payload?.item ? `${e.payload.item}: ${e.payload.quantity} ${e.payload.unit || ""}` : "", e.type === "milk_corrected" ? `${e.payload?.before?.quantity} to ${e.payload?.entry?.quantity} L` : ""].filter(Boolean).join("; ") || "Recorded"}`,
    date: e.date || e.testDate,
  }));
  const changes = new Map<string, { created: number; updated: number }>();
  for (const e of events.filter((e: any) =>
    ["entry_created", "entry_updated"].includes(e.type),
  )) {
    const module = e.payload?.module || "";
    const label = module.startsWith("/api/milk")
      ? "Milk records"
      : module.startsWith("/api/breeding")
        ? "Breeding records"
        : module.startsWith("/api/cattle")
          ? "Cattle records"
          : module.startsWith("/api/health")
            ? "Health records"
            : module.startsWith("/api/tasks")
              ? "Tasks"
              : module.startsWith("/api/feed")
                ? "Feeding records"
                : module.startsWith("/api/vaccinations")
                  ? "Vaccinations"
                  : "Farm records";
    const count = changes.get(label) || { created: 0, updated: 0 };
    if (e.type === "entry_created") count.created++;
    else count.updated++;
    changes.set(label, count);
  }
  for (const [label, counts] of changes)
    activity.push({
      id: `changes:${label}`,
      cattleId: null,
      date: report.date,
      text: `${label}: ${counts.created} added, ${counts.updated} updated. Details in the relevant sections / full Excel record.`,
    });
  return {
    sessions,
    milkRows,
    saleRows,
    customers,
    allocations: [...allocations].map(([kind, quantity]) => ({
      kind,
      quantity,
    })),
    health,
    actions,
    activity,
    totals: {
      sales: sum(saleRows, "totalAmount"),
      received: sum(dairy.payments || [], "amount"),
      expenses: sum(report.finance?.expenses || [], "amount"),
      income: sum(report.finance?.income || [], "amount"),
    },
  };
}
