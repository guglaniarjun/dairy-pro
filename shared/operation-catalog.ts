/** Review templates: clinical doses and schedules remain approved farm configuration. */
export const operationCatalog = [
  {
    key: "breeding",
    title: "Breeding, heat, pregnancy recheck and repeat-breeder review",
    type: "breeding",
    triggers: ["heat", "insemination", "expected_calving"],
  },
  {
    key: "vaccination",
    title: "Vaccination first doses, boosters and overdue coverage",
    type: "health",
    triggers: ["age"],
  },
  {
    key: "deworming",
    title: "Deworming and parasite-control plan",
    type: "health",
    triggers: ["age"],
  },
  {
    key: "calf",
    title: "Newborn assessment, colostrum, calf feeding and growth review",
    type: "health",
    triggers: ["birth", "age", "weaning"],
  },
  {
    key: "treatment",
    title: "Treatment courses, re-examination and withdrawal release",
    type: "health",
    triggers: ["treatment", "pregnancy_loss"],
  },
  {
    key: "biosecurity",
    title: "Purchase quarantine, testing, isolation and release",
    type: "health",
    triggers: [],
  },
  {
    key: "nutrition",
    title: "Ration, body condition, supplements and water review",
    type: "feeding",
    triggers: ["dry_off", "expected_calving", "calving"],
  },
  {
    key: "milking_hygiene",
    title: "Milking hygiene, cleaning and disinfection",
    type: "maintenance",
    triggers: [],
  },
  {
    key: "milk_quality",
    title: "Milk quality, cooling and storage checks",
    type: "milking",
    triggers: [],
  },
  {
    key: "equipment",
    title: "Equipment inspection and preventive maintenance",
    type: "maintenance",
    triggers: [],
  },
  {
    key: "welfare",
    title: "Heat stress, housing, hoof care and animal welfare",
    type: "health",
    triggers: [],
  },
  {
    key: "environment",
    title: "Manure, drainage and waste management",
    type: "maintenance",
    triggers: [],
  },
  {
    key: "stock",
    title: "Feed and medicine expiry, purchasing and reorder review",
    type: "other",
    triggers: [],
  },
  {
    key: "accounts",
    title: "Customer dues, payments and staff allocation review",
    type: "other",
    triggers: [],
  },
] as const;
