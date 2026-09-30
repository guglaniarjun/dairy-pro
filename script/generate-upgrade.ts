import fs from "node:fs";
const full = fs.readFileSync("migrations/0000_round_morph.sql", "utf8");
const columns: Record<string, string[]> = {
  milk_entries: ["destination"],
  cattle: [
    "species",
    "life_stage",
    "production_status",
    "reproductive_status",
    "health_status",
    "pen",
    "weight_kg",
    "expected_calving_date",
    "breeding_cycle_id",
    "milk_withhold_until",
    "meat_withhold_until",
    "merged_into_id",
    "revision",
  ],
  tasks: [
    "batch_id",
    "source_key",
    "trigger",
    "cycle_id",
    "protocol_id",
    "protocol_version",
    "supplies",
    "clinical",
    "evidence_required",
    "evidence",
    "reason",
    "original_due_date",
    "revision",
  ],
};
const newTables = [
  "animal_groups",
  "care_protocols",
  "daily_reports",
  "diet_plans",
  "farm_events",
  "operation_receipts",
  "report_schedules",
  "stock_ledger",
  "stock_lots",
  "work_batches",
];
let output =
  "-- Additive upgrade for an existing DairyFlow installation. Back up before applying.\nBEGIN;\n";
for (const [table, names] of Object.entries(columns)) {
  const block = full.match(
    new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`),
  )?.[1];
  if (!block) throw new Error(`Missing table ${table}`);
  for (const name of names) {
    const definition = block
      .split("\n")
      .find((l) => l.trim().startsWith(`"${name}" `));
    if (!definition) throw new Error(`Missing column ${name}`);
    output += `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${definition.trim().replace(/,$/, "")};\n`;
  }
}
for (const statement of full.split("--> statement-breakpoint")) {
  const table = /CREATE TABLE "([^"]+)"/.exec(statement)?.[1];
  const indexTable = / ON "([^"]+)"/.exec(statement)?.[1];
  if (table && newTables.includes(table))
    output +=
      statement.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ") + "\n";
  else if (
    indexTable &&
    (newTables.includes(indexTable) ||
      statement.includes('"tasks_source_key_idx"'))
  )
    output +=
      statement.replace(
        /CREATE (UNIQUE )?INDEX /,
        (_, unique) => `CREATE ${unique || ""}INDEX IF NOT EXISTS `,
      ) + "\n";
}
output += `ALTER TABLE inventory_items ALTER COLUMN current_stock TYPE numeric(14,3);
UPDATE cattle SET life_stage=CASE WHEN stage IN ('calf','heifer') THEN stage ELSE 'adult' END WHERE life_stage IS NULL;
UPDATE cattle SET production_status=CASE stage WHEN 'milking' THEN 'lactating' WHEN 'dry' THEN 'dry' WHEN 'pregnant' THEN NULL ELSE 'not_lactating' END WHERE production_status IS NULL;
UPDATE cattle SET reproductive_status=CASE WHEN stage='pregnant' THEN 'pregnant' ELSE 'unserved' END WHERE reproductive_status IS NULL;
UPDATE cattle c SET expected_calving_date=p.expected_calving_date,breeding_cycle_id=COALESCE(p.insemination_id,p.id)
FROM pregnancy_tests p WHERE c.id=p.cattle_id AND c.tenant_id=p.tenant_id AND c.reproductive_status='pregnant' AND c.expected_calving_date IS NULL
AND p.result='positive' AND p.expected_calving_date IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM pregnancy_tests newer WHERE newer.cattle_id=c.id AND newer.test_date>p.test_date)
AND NOT EXISTS(SELECT 1 FROM calvings b WHERE b.cattle_id=c.id AND b.date>=p.test_date);
COMMIT;
`;
fs.writeFileSync("migrations/upgrade-existing.sql", output);
console.log("Created additive upgrade-existing.sql");
