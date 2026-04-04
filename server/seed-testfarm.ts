/**
 * Test Farm Seed Script
 * Seeds comprehensive realistic data for "Test Farm" (ACzzTe owner tenant)
 * Run: npx tsx server/seed-testfarm.ts
 */

import { db } from "./db";
import {
  tenants, cattle, milkEntries, heats, inseminations, pregnancyTests, calvings,
  healthEvents, vaccinations, feedingRecords, inventoryItems, inventoryTransactions,
  expenses, incomes, expenseHeads, incomeHeads, feedItems, breeds, inventoryCategories,
  alerts, tasks, tenantSettings,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const TENANT_ID = "24ab37d2-7f36-4909-a978-a43ae16523cc";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function monthsAgo(n: number): string { return daysAgo(n * 30); }

async function main() {
  console.log("🌱 Starting Test Farm seed...\n");

  // 1. Upgrade tenant to Test Farm / Pro plan
  await db.update(tenants).set({
    name: "Test Farm",
    plan: "paid",
    maxCattle: 250,
    address: "Village Dairy Road, Anand, Gujarat - 388001",
    phone: "+91 98765 43210",
    updatedAt: new Date(),
  }).where(eq(tenants.id, TENANT_ID));
  console.log("✓ Tenant → Test Farm (Pro, 250 cattle)");

  // 2. Tenant settings (upsert)
  await db.insert(tenantSettings).values({
    tenantId: TENANT_ID,
    accountingMode: "full",
    byproductInventoryEnabled: true,
  }).onConflictDoNothing();
  console.log("✓ Tenant settings saved");

  // 3. Load master IDs
  const allBreeds   = await db.select({ id: breeds.id, code: breeds.code }).from(breeds);
  const allFeed     = await db.select({ id: feedItems.id, code: feedItems.code }).from(feedItems);
  const allExpH     = await db.select({ id: expenseHeads.id, code: expenseHeads.code }).from(expenseHeads);
  const allIncH     = await db.select({ id: incomeHeads.id, code: incomeHeads.code }).from(incomeHeads);
  const allInvCat   = await db.select({ id: inventoryCategories.id, code: inventoryCategories.code }).from(inventoryCategories);

  const B: Record<string,string> = {}; for (const x of allBreeds) B[x.code] = x.id;
  const F: Record<string,string> = {}; for (const x of allFeed)   F[x.code] = x.id;
  const EH: Record<string,string>= {}; for (const x of allExpH)   EH[x.code] = x.id;
  const IH: Record<string,string>= {}; for (const x of allIncH)   IH[x.code] = x.id;
  const IC: Record<string,string>= {}; for (const x of allInvCat) IC[x.code] = x.id;

  // ── 4. CATTLE (20 animals) ─────────────────────────────────────────────────
  const cattleRows = [
    // 10 milking cows
    { tag:"TF-001", name:"Lakshmi",    gender:"female", stage:"milking",  status:"active", breed:"holstein",  dob:monthsAgo(60), doe:monthsAgo(48), lac:4, price:"62000" },
    { tag:"TF-002", name:"Ganga",      gender:"female", stage:"milking",  status:"active", breed:"jersey",    dob:monthsAgo(48), doe:monthsAgo(36), lac:3, price:"44000" },
    { tag:"TF-003", name:"Kaveri",     gender:"female", stage:"milking",  status:"active", breed:"crossbred", dob:monthsAgo(42), doe:monthsAgo(30), lac:2, price:"38000" },
    { tag:"TF-004", name:"Yamuna",     gender:"female", stage:"milking",  status:"active", breed:"holstein",  dob:monthsAgo(36), doe:monthsAgo(24), lac:2, price:"55000" },
    { tag:"TF-005", name:"Saraswati",  gender:"female", stage:"milking",  status:"active", breed:"jersey",    dob:monthsAgo(54), doe:monthsAgo(48), lac:3, price:"42000" },
    { tag:"TF-006", name:"Narmada",    gender:"female", stage:"milking",  status:"active", breed:"crossbred", dob:monthsAgo(40), doe:monthsAgo(30), lac:2, price:"36000" },
    { tag:"TF-007", name:"Godavari",   gender:"female", stage:"milking",  status:"active", breed:"gir",       dob:monthsAgo(55), doe:monthsAgo(40), lac:3, price:"35000" },
    { tag:"TF-008", name:"Krishna",    gender:"female", stage:"milking",  status:"active", breed:"sahiwal",   dob:monthsAgo(38), doe:monthsAgo(28), lac:2, price:"32000" },
    { tag:"TF-019", name:"Annapurna", gender:"female", stage:"milking",  status:"active", breed:"crossbred", dob:monthsAgo(32), doe:monthsAgo(20), lac:1, price:"34000" },
    { tag:"TF-020", name:"Bhavani",   gender:"female", stage:"milking",  status:"active", breed:"gir",       dob:monthsAgo(45), doe:monthsAgo(36), lac:3, price:"33000" },
    // 2 pregnant
    { tag:"TF-009", name:"Rukmini",   gender:"female", stage:"pregnant", status:"active", breed:"holstein",  dob:monthsAgo(44), doe:monthsAgo(36), lac:2, price:"58000" },
    { tag:"TF-010", name:"Radha",     gender:"female", stage:"pregnant", status:"active", breed:"crossbred", dob:monthsAgo(50), doe:monthsAgo(42), lac:3, price:"40000" },
    // 2 dry
    { tag:"TF-011", name:"Meera",     gender:"female", stage:"dry",      status:"active", breed:"jersey",    dob:monthsAgo(58), doe:monthsAgo(50), lac:4, price:"38000" },
    { tag:"TF-012", name:"Tulsi",     gender:"female", stage:"dry",      status:"active", breed:"holstein",  dob:monthsAgo(46), doe:monthsAgo(38), lac:3, price:"52000" },
    // 2 heifers
    { tag:"TF-013", name:"Pari",      gender:"female", stage:"heifer",   status:"active", breed:"crossbred", dob:monthsAgo(20), doe:monthsAgo(12), lac:0, price:null },
    { tag:"TF-014", name:"Rani",      gender:"female", stage:"heifer",   status:"active", breed:"jersey",    dob:monthsAgo(18), doe:monthsAgo(10), lac:0, price:null },
    // 2 calves
    { tag:"TF-015", name:"Chhotu",    gender:"male",   stage:"calf",     status:"active", breed:"crossbred", dob:daysAgo(90),   doe:daysAgo(90),   lac:0, price:null },
    { tag:"TF-016", name:"Nandini",   gender:"female", stage:"calf",     status:"active", breed:"holstein",  dob:daysAgo(60),   doe:daysAgo(60),   lac:0, price:null },
    // 1 bull
    { tag:"TF-017", name:"Nandi",     gender:"male",   stage:"heifer",   status:"active", breed:"sahiwal",   dob:monthsAgo(30), doe:monthsAgo(20), lac:0, price:"28000" },
    // 1 sold
    { tag:"TF-018", name:"Sudha",     gender:"female", stage:"milking",  status:"sold",   breed:"jersey",    dob:monthsAgo(72), doe:monthsAgo(60), lac:5, price:"36000" },
  ];

  const CID: Record<string,string> = {};
  for (const c of cattleRows) {
    const [ins] = await db.insert(cattle).values({
      tenantId: TENANT_ID,
      tagNumber: c.tag, name: c.name, gender: c.gender as any,
      stage: c.stage as any, status: c.status as any,
      breedId: B[c.breed] || null,
      dateOfBirth: c.dob, dateOfEntry: c.doe,
      source: c.price ? "purchased" : "born",
      purchasePrice: c.price,
      lactationNumber: c.lac,
    }).returning({ id: cattle.id });
    CID[c.tag] = ins.id;
  }
  console.log(`✓ Seeded ${cattleRows.length} cattle`);

  // ── 5. MILK ENTRIES (90 days × 10 cows × 2 sessions) ─────────────────────
  const milkCows: Record<string,number> = {
    "TF-001":18.5,"TF-002":12.0,"TF-003":14.5,"TF-004":16.0,
    "TF-005":11.5,"TF-006":13.5,"TF-007":8.5,"TF-008":7.5,
    "TF-019":15.0,"TF-020":9.0,
  };
  const milkBatch: typeof milkEntries.$inferInsert[] = [];
  for (let day = 90; day >= 0; day--) {
    const date = daysAgo(day);
    for (const [tag, base] of Object.entries(milkCows)) {
      const cattleId = CID[tag]; if (!cattleId) continue;
      const v = base + (Math.random()-0.5)*2;
      milkBatch.push(
        { tenantId:TENANT_ID, cattleId, date, session:"morning",
          quantity: String((v*0.60).toFixed(2)), fat: String((3.5+Math.random()*1.5).toFixed(1)), snf: String((8.0+Math.random()*0.8).toFixed(1)), recordedBy:"Ramu Kaka" },
        { tenantId:TENANT_ID, cattleId, date, session:"evening",
          quantity: String((v*0.40).toFixed(2)), fat: String((3.5+Math.random()*1.5).toFixed(1)), snf: String((8.0+Math.random()*0.8).toFixed(1)), recordedBy:"Ramu Kaka" },
      );
    }
  }
  for (let i=0; i<milkBatch.length; i+=500) await db.insert(milkEntries).values(milkBatch.slice(i,i+500));
  console.log(`✓ Seeded ${milkBatch.length} milk entries`);

  // ── 6. BREEDING RECORDS ───────────────────────────────────────────────────
  const breedingTags = ["TF-001","TF-002","TF-003","TF-004","TF-009","TF-010"];
  for (const tag of breedingTags) {
    const cattleId = CID[tag]; if (!cattleId) continue;
    const [heat] = await db.insert(heats).values({
      tenantId:TENANT_ID, cattleId,
      detectedAt: new Date(monthsAgo(3)),
      intensity:"normal", detectedBy:"Farm Manager",
      notes:"Standing heat, mucus discharge",
    }).returning({ id: heats.id });

    const [ai] = await db.insert(inseminations).values({
      tenantId:TENANT_ID, cattleId, heatId: heat.id,
      date: daysAgo(89), method:"ai",
      bullId:"HF-Premium-001", semenBatchId:"STR-2024-HF-087",
      technicianId:"Dr. Ramesh Patel", cost:"650",
      notes:"Good quality semen used",
    }).returning({ id: inseminations.id });

    const pregnant = ["TF-009","TF-010"].includes(tag);
    await db.insert(pregnancyTests).values({
      tenantId:TENANT_ID, cattleId, inseminationId: ai.id,
      testDate: daysAgo(60), result: pregnant ? "positive" : "negative",
      method:"rectal", testedBy:"Dr. Ramesh Patel",
      expectedCalvingDate: pregnant ? daysAgo(-190) : null,
      notes: pregnant ? "Pregnancy confirmed, good fetal size" : "Not pregnant, re-schedule AI",
    });
  }
  // Historic calving for TF-001
  await db.insert(calvings).values({
    tenantId:TENANT_ID, cattleId: CID["TF-001"],
    date: monthsAgo(3), outcome:"live", calvingEase:"normal",
    calfGender:"female", calfWeight:"31.5",
    notes:"Normal delivery. Heifer calf. Tag: TF-016",
  });
  console.log("✓ Seeded breeding records (6 heats, 6 AI, 6 PT, 1 calving)");

  // ── 7. HEALTH EVENTS ──────────────────────────────────────────────────────
  const healthRows = [
    { tag:"TF-003", type:"illness",  date:daysAgo(30), sev:"moderate", desc:"Mastitis - right front quarter", symp:"Swelling, clots in milk, pain", diag:"Subclinical mastitis", vet:"Dr. Sunita Sharma",  status:"resolved", notes:"Intracept infusion 5 days" },
    { tag:"TF-007", type:"injury",   date:daysAgo(20), sev:"mild",     desc:"Wire cut on left hind leg",     symp:"Small wound, slight limp",      diag:"Laceration",          vet:"Farm Worker",         status:"resolved", notes:"Cleaned, bandaged, healed in 7 days" },
    { tag:"TF-001", type:"illness",  date:daysAgo(10), sev:"mild",     desc:"Viral fever",                   symp:"Temp 103.5°F, off feed",        diag:"Viral pyrexia",       vet:"Dr. Ramesh Patel",    status:"active",   notes:"Paracetamol, monitoring" },
    { tag:"TF-009", type:"checkup",  date:daysAgo(7),  sev:"mild",     desc:"Pregnancy checkup - 7th month", symp:"None",                          diag:"Healthy, 7th month",  vet:"Dr. Ramesh Patel",    status:"resolved", notes:"All vitals normal" },
    { tag:"TF-010", type:"checkup",  date:daysAgo(14), sev:"mild",     desc:"Pregnancy checkup - 6th month", symp:"None",                          diag:"Healthy, 6th month",  vet:"Dr. Ramesh Patel",    status:"resolved", notes:"BCS 3.5" },
    { tag:"TF-015", type:"deworming",date:daysAgo(5),  sev:"mild",     desc:"Routine calf deworming",        symp:"None",                          diag:"Preventive treatment", vet:"Farm Worker",        status:"resolved", notes:"Albendazole 5%" },
    { tag:"TF-004", type:"illness",  date:daysAgo(45), sev:"moderate", desc:"Bloat episode",                 symp:"Distension, discomfort",        diag:"Frothy bloat",        vet:"Dr. Sunita Sharma",   status:"resolved", notes:"Anti-bloat + walk treatment" },
    { tag:"TF-005", type:"checkup",  date:daysAgo(60), sev:"mild",     desc:"Routine health check",          symp:"None",                          diag:"Healthy",             vet:"Dr. Ramesh Patel",    status:"resolved", notes:"BCS 3.0, good condition" },
  ];
  for (const h of healthRows) {
    await db.insert(healthEvents).values({
      tenantId:TENANT_ID, cattleId: CID[h.tag],
      eventType: h.type as any, date: h.date, severity: h.sev as any,
      description: h.desc, symptoms: h.symp, diagnosis: h.diag,
      vetId: h.vet, status: h.status as any, notes: h.notes,
    });
  }
  console.log(`✓ Seeded ${healthRows.length} health events`);

  // ── 8. VACCINATIONS ───────────────────────────────────────────────────────
  const vacRows = [
    { tag:"TF-001", name:"Foot and Mouth Disease (FMD)", date:daysAgo(120), batch:"FMD-2024-A01", next:daysAgo(-60),  by:"Dr. Ramesh Patel" },
    { tag:"TF-002", name:"Foot and Mouth Disease (FMD)", date:daysAgo(118), batch:"FMD-2024-A01", next:daysAgo(-62),  by:"Dr. Ramesh Patel" },
    { tag:"TF-003", name:"Foot and Mouth Disease (FMD)", date:daysAgo(116), batch:"FMD-2024-A01", next:daysAgo(-64),  by:"Dr. Ramesh Patel" },
    { tag:"TF-001", name:"Hemorrhagic Septicemia (HS)",  date:daysAgo(200), batch:"HS-2023-C12",  next:daysAgo(-165), by:"Dr. Sunita Sharma" },
    { tag:"TF-004", name:"Black Quarter (BQ)",           date:daysAgo(300), batch:"BQ-2023-B05",  next:daysAgo(-65),  by:"Dr. Sunita Sharma" },
    { tag:"TF-013", name:"Brucellosis (S19)",            date:daysAgo(60),  batch:"BRU-2024-H01", next:null,          by:"Dr. Ramesh Patel" },
    { tag:"TF-014", name:"Brucellosis (S19)",            date:daysAgo(55),  batch:"BRU-2024-H01", next:null,          by:"Dr. Ramesh Patel" },
    { tag:"TF-007", name:"Deworming",                    date:daysAgo(85),  batch:"DWORM-Q3-24",  next:daysAgo(5),    by:"Farm Worker" },
    { tag:"TF-008", name:"Deworming",                    date:daysAgo(82),  batch:"DWORM-Q3-24",  next:daysAgo(8),    by:"Farm Worker" },
    { tag:"TF-015", name:"Deworming",                    date:daysAgo(5),   batch:"DWORM-Q4-24",  next:daysAgo(-85),  by:"Farm Worker" },
    { tag:"TF-005", name:"Foot and Mouth Disease (FMD)", date:daysAgo(115), batch:"FMD-2024-A01", next:daysAgo(-65),  by:"Dr. Ramesh Patel" },
  ];
  for (const v of vacRows) {
    await db.insert(vaccinations).values({
      tenantId:TENANT_ID, cattleId: CID[v.tag],
      vaccineName: v.name, date: v.date,
      batchNumber: v.batch, nextDueDate: v.next,
      administeredBy: v.by,
    });
  }
  console.log(`✓ Seeded ${vacRows.length} vaccination records`);

  // ── 9. FEEDING RECORDS (30 days, herd-level) ──────────────────────────────
  const feedBatch: typeof feedingRecords.$inferInsert[] = [];
  for (let day=30; day>=0; day--) {
    const date = daysAgo(day);
    if (F["green-fodder"]) {
      feedBatch.push({ tenantId:TENANT_ID, feedItemId:F["green-fodder"], date, session:"morning", plannedQuantity:"200", actualQuantity: String(193+Math.floor(Math.random()*10)), recordedBy:"Ramu Kaka" });
      feedBatch.push({ tenantId:TENANT_ID, feedItemId:F["green-fodder"], date, session:"evening", plannedQuantity:"150", actualQuantity: String(145+Math.floor(Math.random()*10)), recordedBy:"Ramu Kaka" });
    }
    if (F["concentrate"]) {
      feedBatch.push({ tenantId:TENANT_ID, feedItemId:F["concentrate"], date, session:"morning", plannedQuantity:"60", actualQuantity: String(58+Math.floor(Math.random()*4)), recordedBy:"Ramu Kaka" });
      feedBatch.push({ tenantId:TENANT_ID, feedItemId:F["concentrate"], date, session:"evening", plannedQuantity:"40", actualQuantity: String(38+Math.floor(Math.random()*4)), recordedBy:"Ramu Kaka" });
    }
    if (F["straw"]) {
      feedBatch.push({ tenantId:TENANT_ID, feedItemId:F["straw"], date, session:"morning", plannedQuantity:"80", actualQuantity: String(75+Math.floor(Math.random()*8)), recordedBy:"Ramu Kaka" });
    }
  }
  for (let i=0; i<feedBatch.length; i+=200) await db.insert(feedingRecords).values(feedBatch.slice(i,i+200));
  console.log(`✓ Seeded ${feedBatch.length} feeding records`);

  // ── 10. INVENTORY ─────────────────────────────────────────────────────────
  const invData = [
    { name:"Oxytetracycline Injection 100ml", unit:"bottles", cat:"medicine", stock:"18", min:"5",  avg:"280", last:"285" },
    { name:"Intracept Intramammary Ointment", unit:"tubes",   cat:"medicine", stock:"25", min:"10", avg:"95",  last:"98" },
    { name:"Paracetamol Bolus 10-strip",      unit:"strips",  cat:"medicine", stock:"12", min:"5",  avg:"45",  last:"48" },
    { name:"Mineral Mixture 5kg Bag",         unit:"bags",    cat:"supplement",stock:"8", min:"3",  avg:"320", last:"325" },
    { name:"Calcium Borogluconate 450ml",     unit:"bottles", cat:"medicine", stock:"15", min:"6",  avg:"180", last:"185" },
    { name:"Teat Dip Solution 5L",            unit:"cans",    cat:"medicine", stock:"4",  min:"2",  avg:"450", last:"460" },
    { name:"Milking Cluster Liner Set",       unit:"sets",    cat:"equipment",stock:"6",  min:"2",  avg:"1800",last:"1850" },
    { name:"Milk Can 40L Stainless",         unit:"units",   cat:"equipment",stock:"12", min:"6",  avg:"1200",last:"1200" },
    { name:"Udder Wash Solution 5L",          unit:"cans",    cat:"medicine", stock:"3",  min:"2",  avg:"380", last:"390" },
    { name:"Cattle Feed Concentrate 50kg",    unit:"bags",    cat:"feed",     stock:"22", min:"10", avg:"1450",last:"1480" },
  ];
  for (const item of invData) {
    const [ins] = await db.insert(inventoryItems).values({
      tenantId:TENANT_ID, name:item.name, unit:item.unit,
      categoryId: IC[item.cat] || null,
      currentStock: item.stock, minStock: item.min,
      avgCost: item.avg, lastPurchasePrice: item.last, isActive: true,
    }).returning({ id: inventoryItems.id });
    // Opening purchase transaction
    await db.insert(inventoryTransactions).values({
      tenantId:TENANT_ID, itemId:ins.id, type:"purchase",
      quantity: item.stock, unitCost: item.last,
      totalCost: String((parseFloat(item.stock)*parseFloat(item.last)).toFixed(2)),
      batchNumber:"BATCH-2024-OPENING", recordedBy:"Store Manager",
      notes:"Opening stock",
    });
  }
  console.log(`✓ Seeded ${invData.length} inventory items`);

  // ── 11. EXPENSES (3 months) ────────────────────────────────────────────────
  const expData = [
    { code:"feed",        amt:"32500", date:monthsAgo(3), desc:"Cattle concentrate 1 ton + hay",     vendor:"Amul Feed Depot",         inv:"AFD/2024/001", pm:"bank_transfer" },
    { code:"feed",        amt:"8400",  date:monthsAgo(3), desc:"Green fodder 7 tons",                vendor:"Kisaan Fodder Farm",       inv:"KFF/2024/034", pm:"cash" },
    { code:"feed",        amt:"33200", date:monthsAgo(2), desc:"Cattle concentrate 1 ton",           vendor:"Amul Feed Depot",         inv:"AFD/2024/041", pm:"bank_transfer" },
    { code:"feed",        amt:"9100",  date:monthsAgo(2), desc:"Green fodder 7.5 tons + hay 200kg", vendor:"Kisaan Fodder Farm",       inv:"KFF/2024/058", pm:"cash" },
    { code:"feed",        amt:"34000", date:monthsAgo(1), desc:"Concentrate 1 ton + supplements",   vendor:"Amul Feed Depot",         inv:"AFD/2024/089", pm:"bank_transfer" },
    { code:"feed",        amt:"8750",  date:monthsAgo(1), desc:"Green fodder + straw",              vendor:"Kisaan Fodder Farm",       inv:"KFF/2024/102", pm:"cash" },
    { code:"veterinary",  amt:"4200",  date:daysAgo(120), desc:"FMD + HS vaccines 20 doses",        vendor:"Veterinary Supplies Pvt",  inv:"VSP/2024/2201",pm:"cash" },
    { code:"veterinary",  amt:"1850",  date:daysAgo(30),  desc:"Mastitis treatment medicines",      vendor:"Pet Medica Store",         inv:"PMS/2024/0831",pm:"cash" },
    { code:"veterinary",  amt:"2500",  date:daysAgo(14),  desc:"Pregnancy checkup + AI service",    vendor:"Dr. Ramesh Patel Clinic",  inv:"RPC/2024/114", pm:"cash" },
    { code:"veterinary",  amt:"800",   date:daysAgo(10),  desc:"Fever treatment - TF-001",          vendor:"Dr. Ramesh Patel Clinic",  inv:"RPC/2024/138", pm:"cash" },
    { code:"labor",       amt:"15000", date:monthsAgo(3), desc:"Monthly wages - 2 farm workers",    vendor:null, inv:null, pm:"cash" },
    { code:"labor",       amt:"15000", date:monthsAgo(2), desc:"Monthly wages - 2 farm workers",    vendor:null, inv:null, pm:"cash" },
    { code:"labor",       amt:"15500", date:monthsAgo(1), desc:"Monthly wages + festival bonus",    vendor:null, inv:null, pm:"cash" },
    { code:"utilities",   amt:"3200",  date:monthsAgo(3), desc:"Electricity - milking machine",     vendor:"PGVCL",                    inv:"PGV/24Q3/0082",pm:"upi" },
    { code:"utilities",   amt:"2950",  date:monthsAgo(2), desc:"Electricity bill",                  vendor:"PGVCL",                    inv:"PGV/24Q2/0047",pm:"upi" },
    { code:"utilities",   amt:"3100",  date:monthsAgo(1), desc:"Electricity bill",                  vendor:"PGVCL",                    inv:"PGV/24Q1/0031",pm:"upi" },
    { code:"maintenance", amt:"5500",  date:daysAgo(45),  desc:"Milking machine service",           vendor:"Dairy Equip Services",     inv:"DES/2024/0412",pm:"cash" },
    { code:"maintenance", amt:"2800",  date:daysAgo(20),  desc:"Shed roof repair",                  vendor:"Local Contractor",         inv:null,           pm:"cash" },
    { code:"breeding",    amt:"3900",  date:daysAgo(89),  desc:"AI charges 6 cows × ₹650",          vendor:"Dr. Ramesh Patel Clinic",  inv:"RPC/2024/090", pm:"cash" },
  ];
  let expCnt = 0;
  for (const e of expData) {
    const headId = EH[e.code]; if (!headId) { console.log("  skip exp head", e.code); continue; }
    await db.insert(expenses).values({
      tenantId:TENANT_ID, headId, date: e.date, amount: e.amt,
      description: e.desc, vendorName: e.vendor ?? null,
      invoiceNumber: e.inv ?? null, paymentMethod: e.pm as any,
      recordedBy:"Farm Owner",
    });
    expCnt++;
  }
  console.log(`✓ Seeded ${expCnt} expense records`);

  // ── 12. INCOMES (3 months) ────────────────────────────────────────────────
  const incData = [
    { code:"milk-sale",   amt:"98500",  date:monthsAgo(3), desc:"Milk sale 985L × ₹100",    cust:"Amul Dairy Co-op",           inv:"TF/2024/MS001", pm:"bank_transfer" },
    { code:"milk-sale",   amt:"102000", date:monthsAgo(2), desc:"Milk sale 1020L × ₹100",   cust:"Amul Dairy Co-op",           inv:"TF/2024/MS002", pm:"bank_transfer" },
    { code:"milk-sale",   amt:"105500", date:monthsAgo(1), desc:"Milk sale 1055L × ₹100",   cust:"Amul Dairy Co-op",           inv:"TF/2024/MS003", pm:"bank_transfer" },
    { code:"manure",      amt:"4500",   date:monthsAgo(2), desc:"Dung cake + FYM sale",      cust:"Local Farmer Group",         inv:null,            pm:"cash" },
    { code:"manure",      amt:"5200",   date:monthsAgo(1), desc:"Vermicompost + slurry",     cust:"Organic Farm Supply",        inv:null,            pm:"cash" },
    { code:"cattle-sale", amt:"68000",  date:daysAgo(45),  desc:"Sale of Sudha (TF-018)",    cust:"Sharma Dairy, Mehsana",      inv:"TF/2024/CS001", pm:"bank_transfer" },
    { code:"calf-sale",   amt:"8500",   date:daysAgo(30),  desc:"Bull calf sale (2 months)", cust:"Local Buyer",                inv:null,            pm:"cash" },
    { code:"milk-sale",   amt:"32000",  date:daysAgo(7),   desc:"Milk sale this week 320L",  cust:"Amul Dairy Co-op",           inv:"TF/2024/MS004", pm:"bank_transfer" },
  ];
  let incCnt = 0;
  for (const i of incData) {
    const headId = IH[i.code]; if (!headId) { console.log("  skip inc head", i.code); continue; }
    await db.insert(incomes).values({
      tenantId:TENANT_ID, headId, date: i.date, amount: i.amt,
      description: i.desc, customerName: i.cust ?? null,
      invoiceNumber: i.inv ?? null, paymentMethod: i.pm as any,
      recordedBy:"Farm Owner",
    });
    incCnt++;
  }
  console.log(`✓ Seeded ${incCnt} income records`);

  // ── 13. TASKS ─────────────────────────────────────────────────────────────
  await db.insert(tasks).values([
    { tenantId:TENANT_ID, title:"FMD Booster - 15 remaining cattle",  type:"health",       priority:"high",   status:"pending",   dueDate:daysAgo(-3),  assignedTo:"Dr. Ramesh Patel", description:"Schedule and complete FMD booster for cattle not yet vaccinated" },
    { tenantId:TENANT_ID, title:"Deworming - TF-007, TF-008",         type:"health",       priority:"medium", status:"pending",   dueDate:daysAgo(5),   assignedTo:"Farm Worker",      description:"Quarterly deworming overdue by 5 days" },
    { tenantId:TENANT_ID, title:"AI for TF-002 Ganga - Heat Expected", type:"breeding",    priority:"high",   status:"pending",   dueDate:daysAgo(-3),  description:"Heat expected in 3 days based on 21-day cycle" },
    { tenantId:TENANT_ID, title:"Pregnancy Check - TF-009, TF-010",    type:"breeding",    priority:"medium", status:"pending",   dueDate:daysAgo(-7),  assignedTo:"Dr. Ramesh Patel", description:"Monthly pregnancy check for Rukmini and Radha" },
    { tenantId:TENANT_ID, title:"Monthly Milk Report to Co-op",         type:"milking",     priority:"medium", status:"pending",   dueDate:daysAgo(-1),  assignedTo:"Farm Owner",       description:"Submit production & quality data to Amul Co-op" },
    { tenantId:TENANT_ID, title:"Order Feed - Stock Running Low",        type:"feeding",     priority:"urgent", status:"pending",   dueDate:daysAgo(-2),  assignedTo:"Farm Owner",       description:"Concentrate stock at 22 bags. Order 1 ton from Amul Feed Depot" },
    { tenantId:TENANT_ID, title:"Morning Milking",                       type:"milking",     priority:"high",   status:"completed", dueDate:daysAgo(0),   isRecurring:true, recurringPattern:"daily", description:"Complete morning milking for all 10 cows" },
    { tenantId:TENANT_ID, title:"Clean & Sanitize Milking Equipment",    type:"maintenance", priority:"medium", status:"pending",   dueDate:daysAgo(0),   isRecurring:true, recurringPattern:"daily", description:"Sanitize all milking equipment after evening session" },
    { tenantId:TENANT_ID, title:"Calving Prep - Rukmini (TF-009)",       type:"breeding",    priority:"high",   status:"pending",   dueDate:daysAgo(-60), assignedTo:"Farm Manager",     description:"Rukmini expected to calve in ~60 days. Prepare calving area and colostrum plan." },
  ]);
  console.log("✓ Seeded 9 tasks");

  // ── 14. ALERTS ────────────────────────────────────────────────────────────
  await db.insert(alerts).values([
    { tenantId:TENANT_ID, type:"breeding",  severity:"warning",  title:"Heat Due - Ganga (TF-002)",         message:"Based on 21-day cycle, Ganga (TF-002) is expected in heat in 3 days. Prepare for AI.",        cattleId:CID["TF-002"], isRead:false },
    { tenantId:TENANT_ID, type:"health",    severity:"critical", title:"FMD Booster Overdue - 15 Cattle",   message:"FMD vaccination booster overdue for 15 cattle. Contact veterinarian immediately.",              isRead:false },
    { tenantId:TENANT_ID, type:"breeding",  severity:"warning",  title:"Pregnancy Test Due - Narmada",      message:"Narmada (TF-006) was inseminated 89 days ago. Pregnancy result: check needed.",                  cattleId:CID["TF-006"], isRead:false },
    { tenantId:TENANT_ID, type:"inventory", severity:"warning",  title:"Low Stock: Teat Dip Solution",      message:"Only 4 cans remaining (min: 2). Reorder before stock runs out.",                                isRead:false },
    { tenantId:TENANT_ID, type:"breeding",  severity:"info",     title:"Expected Calving - Rukmini in 60d", message:"Rukmini (TF-009) expected to calve ~60 days from now. Prepare calving pen and dry feed.",       cattleId:CID["TF-009"], isRead:false },
    { tenantId:TENANT_ID, type:"health",    severity:"warning",  title:"Deworming Overdue - TF-007, TF-008",message:"Godavari and Krishna are 5 days overdue for quarterly deworming.",                              isRead:false },
    { tenantId:TENANT_ID, type:"breeding",  severity:"info",     title:"Expected Dry-Off - Meera (TF-011)", message:"Meera (TF-011) is in dry stage. Monitor body condition for upcoming calving.",                  cattleId:CID["TF-011"], isRead:false },
    { tenantId:TENANT_ID, type:"health",    severity:"info",     title:"Active Health Case - Lakshmi Fever",message:"TF-001 Lakshmi has active viral fever case. Follow up with Dr. Patel today.",                   cattleId:CID["TF-001"], isRead:false },
  ]);
  console.log("✓ Seeded 8 alerts");

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log(`
${"=".repeat(60)}
✅  TEST FARM SEED COMPLETE
${"=".repeat(60)}
Farm Name  : Test Farm  (Plan: Pro — 250 cattle)
Address    : Village Dairy Road, Anand, Gujarat
─────────────────────────────────────────────────────
Cattle     : 20  (10 milking, 2 pregnant, 2 dry,
                   2 heifer, 2 calf, 1 bull, 1 sold)
Milk       : ${milkBatch.length} entries (90 days × 10 cows × 2 sessions)
Breeding   : 6 heats | 6 AI | 6 PT | 1 calving
Health     : ${healthRows.length} events + ${vacRows.length} vaccinations
Feeding    : ${feedBatch.length} records (30 days)
Inventory  : ${invData.length} items
Expenses   : ${expCnt} records (3 months)
Incomes    : ${incCnt} records (3 months)
Tasks      : 9 tasks
Alerts     : 8 active alerts
─────────────────────────────────────────────────────
🔑  ACCESS
  Auth method : Log in with Replit (your account)
  After login : Test Farm data loads automatically
${"=".repeat(60)}
`);
}

main().catch(console.error).finally(() => process.exit(0));
