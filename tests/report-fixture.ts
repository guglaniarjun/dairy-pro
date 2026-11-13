export function reportFixture(count = 30) {
  const animals = Array.from({ length: count }, (_, i) => ({
    id: `cow-${i}`,
    tagNumber: `C-${101 + i}`,
    name: i === 0 ? "Gauri" : "",
    gender: "female",
    status: "active",
    stage: "milking",
    productionStatus: "lactating",
  }));
  const entries = animals.flatMap((a, i) => [
    {
      id: `am-${i}`,
      cattleId: a.id,
      date: "2026-11-12",
      session: "morning",
      quantity: i === 0 ? "0" : "8.5",
    },
    ...(i === 1
      ? []
      : [
          {
            id: `pm-${i}`,
            cattleId: a.id,
            date: "2026-11-12",
            session: "evening",
            quantity: "6.5",
          },
        ]),
  ]);
  return {
    date: "2026-11-12",
    timezone: "Asia/Kolkata",
    generatedAt: "2026-11-13T04:00:00Z",
    farmName: "DairyFlow - SAMPLE FARM",
    animals,
    milk: {
      produced: entries.reduce((n, e) => n + Number(e.quantity), 0),
      sold: 160,
      used: 6,
      opening: 0,
      discardedAtMilking: 0,
      unallocated: 269,
      entries,
      sales: [
        {
          id: "linked",
          buyerName: "Morning Dairy",
          quantity: "20",
          pricePerLiter: "50",
          totalAmount: "1000",
          paymentStatus: "paid",
        },
      ],
      missing: [{ id: "cow-1", tag: "C-102", missingSessions: 1 }],
      dispositions: [{ payload: { kind: "calf_feed", quantity: 6 } }],
    },
    dairySales: {
      entries: Array.from({ length: 8 }, (_, i) => ({
        id: `sale-${i}`,
        customerId: `customer-${i}`,
        customerName: `Customer ${i + 1}`,
        productName: "Milk",
        quantity: "20",
        rate: "50",
        totalAmount: "1000",
        unit: "L",
        milkSaleId: i === 0 ? "linked" : null,
      })),
      customers: Array.from({ length: 8 }, (_, i) => ({
        id: `customer-${i}`,
        name: `Customer ${i + 1}`,
        outstanding: i % 2 ? "500" : "0",
        advance: i % 2 ? "0" : "250",
      })),
      payments: [{ customerId: "customer-0", amount: "1250" }],
      products: [],
      stockMovements: [],
    },
    activeHealth: [
      {
        id: "health-1",
        cattleId: "cow-0",
        date: "2026-11-12",
        diagnosis: "Reduced appetite; veterinary review requested",
        severity: "mild",
        status: "active",
      },
    ],
    entries: [
      {
        id: "treatment-1",
        type: "treatment",
        cattleId: "cow-0",
        date: "2026-11-12",
        medicineName: "Recorded treatment",
        dosage: "As prescribed",
        route: "oral",
        notes: "Follow the saved veterinary instructions",
      },
    ],
    tasks: Array.from({ length: 12 }, (_, i) => ({
      id: `task-${i}`,
      cattleId: `cow-${i}`,
      dueDate: i < 2 ? "2026-11-12" : "2026-11-13",
      title: i === 0 ? "Planned culling review" : "Daily animal check",
      assignedToName: "Farm team",
      status: "pending",
      description: "Observe, record findings and confirm completion.",
    })),
    reminders: [
      {
        id: "dry-1",
        cattleId: "cow-2",
        title: "Planned dry-off",
        dueDate: "2026-11-13",
        status: "pending",
      },
      {
        id: "diet-1",
        cattleId: "cow-3",
        title: "Pre-calving diet and supplements",
        dueDate: "2026-11-20",
        instructions:
          "Follow approved transition ration REF-21; record feed and supplements given.",
        status: "pending",
      },
    ],
    events: entries.map((entry) => ({
      id: `audit-${entry.id}`,
      type: "entry_created",
      cattleId: entry.cattleId,
      date: "2026-11-12",
      payload: { module: "/api/milk", entry },
    })),
    stock: [],
    stockMovements: [],
    finance: {
      expenses: [{ description: "Feed purchase", amount: "1500" }],
      income: [{ amount: "8000" }],
      costs: [],
    },
    batches: [],
    audit: [],
  };
}
