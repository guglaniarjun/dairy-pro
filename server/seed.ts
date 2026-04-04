import { db } from "./db";
import { breeds, vaccines, feedItems, expenseHeads, incomeHeads, inventoryCategories, byproductTypes, subscriptionPlans } from "@shared/schema";

async function seed() {
  console.log("Seeding master data...");

  // Seed breeds
  const breedsData = [
    { code: "holstein", name: "Holstein Friesian", type: "dairy", origin: "Netherlands/Germany", avgMilkYield: "7500.00" },
    { code: "jersey", name: "Jersey", type: "dairy", origin: "Jersey Island", avgMilkYield: "5500.00" },
    { code: "guernsey", name: "Guernsey", type: "dairy", origin: "Guernsey Island", avgMilkYield: "5000.00" },
    { code: "ayrshire", name: "Ayrshire", type: "dairy", origin: "Scotland", avgMilkYield: "5500.00" },
    { code: "brown-swiss", name: "Brown Swiss", type: "dual", origin: "Switzerland", avgMilkYield: "6000.00" },
    { code: "montbeliarde", name: "Montbéliarde", type: "dual", origin: "France", avgMilkYield: "5800.00" },
    { code: "simmental", name: "Simmental", type: "dual", origin: "Switzerland", avgMilkYield: "5200.00" },
    { code: "sahiwal", name: "Sahiwal", type: "dairy", origin: "Pakistan/India", avgMilkYield: "2200.00" },
    { code: "gir", name: "Gir", type: "dairy", origin: "India", avgMilkYield: "2500.00" },
    { code: "crossbred", name: "Crossbred", type: "dairy", origin: "Various", avgMilkYield: "4500.00" },
  ];

  for (const breed of breedsData) {
    await db.insert(breeds).values(breed).onConflictDoNothing({ target: breeds.code });
  }
  console.log(`✓ Seeded ${breedsData.length} breeds`);

  // Seed vaccines
  const vaccinesData = [
    { code: "fmd", name: "Foot and Mouth Disease (FMD)", category: "viral", dosesMl: "2.00", intervalDays: 180, notes: "Twice yearly vaccination required" },
    { code: "hs", name: "Hemorrhagic Septicemia (HS)", category: "bacterial", dosesMl: "3.00", intervalDays: 365, notes: "Annual vaccination before monsoon" },
    { code: "bq", name: "Black Quarter (BQ)", category: "bacterial", dosesMl: "2.00", intervalDays: 365, notes: "Annual vaccination" },
    { code: "brucellosis", name: "Brucellosis (S19)", category: "bacterial", dosesMl: "2.00", intervalDays: null, notes: "One-time vaccination for heifers 3-8 months" },
    { code: "anthrax", name: "Anthrax", category: "bacterial", dosesMl: "1.00", intervalDays: 365, notes: "Annual vaccination in endemic areas" },
    { code: "rabies", name: "Rabies", category: "viral", dosesMl: "2.00", intervalDays: 365, notes: "Annual vaccination if risk of exposure" },
    { code: "ibrv", name: "Infectious Bovine Rhinotracheitis", category: "viral", dosesMl: "2.00", intervalDays: 365, notes: "Annual vaccination for respiratory protection" },
    { code: "bvd", name: "Bovine Viral Diarrhea", category: "viral", dosesMl: "2.00", intervalDays: 365, notes: "Annual vaccination recommended" },
    { code: "tb", name: "Theileriosis", category: "parasitic", dosesMl: "3.00", intervalDays: 365, notes: "In endemic areas" },
    { code: "deworm", name: "Deworming", category: "parasitic", dosesMl: "10.00", intervalDays: 90, notes: "Quarterly treatment based on body weight" },
  ];

  for (const vaccine of vaccinesData) {
    await db.insert(vaccines).values(vaccine).onConflictDoNothing({ target: vaccines.code });
  }
  console.log(`✓ Seeded ${vaccinesData.length} vaccines`);

  // Seed feed items
  const feedItemsData = [
    { code: "green-fodder", name: "Green Fodder (Mixed Grass)", category: "roughage", unit: "kg", proteinPercent: "2.50", tdn: "55.00", costPerUnit: "3.00" },
    { code: "hay", name: "Hay (Dried Grass)", category: "roughage", unit: "kg", proteinPercent: "6.00", tdn: "45.00", costPerUnit: "8.00" },
    { code: "straw", name: "Wheat/Rice Straw", category: "roughage", unit: "kg", proteinPercent: "3.50", tdn: "40.00", costPerUnit: "4.00" },
    { code: "silage-maize", name: "Maize Silage", category: "roughage", unit: "kg", proteinPercent: "8.00", tdn: "65.00", costPerUnit: "6.00" },
    { code: "concentrate", name: "Cattle Feed Concentrate", category: "concentrate", unit: "kg", proteinPercent: "18.00", tdn: "72.00", costPerUnit: "35.00" },
    { code: "cotton-seed", name: "Cotton Seed Cake", category: "concentrate", unit: "kg", proteinPercent: "22.00", tdn: "70.00", costPerUnit: "28.00" },
    { code: "mustard-cake", name: "Mustard Oil Cake", category: "concentrate", unit: "kg", proteinPercent: "35.00", tdn: "75.00", costPerUnit: "32.00" },
    { code: "soybean-meal", name: "Soybean Meal", category: "concentrate", unit: "kg", proteinPercent: "44.00", tdn: "82.00", costPerUnit: "45.00" },
    { code: "maize-grain", name: "Maize Grain", category: "grain", unit: "kg", proteinPercent: "9.00", tdn: "85.00", costPerUnit: "22.00" },
    { code: "wheat-bran", name: "Wheat Bran (Chokar)", category: "byproduct", unit: "kg", proteinPercent: "15.00", tdn: "65.00", costPerUnit: "18.00" },
    { code: "rice-bran", name: "Rice Bran", category: "byproduct", unit: "kg", proteinPercent: "12.00", tdn: "60.00", costPerUnit: "15.00" },
    { code: "mineral-mix", name: "Mineral Mixture", category: "supplement", unit: "kg", proteinPercent: "0.00", tdn: "0.00", costPerUnit: "80.00" },
    { code: "salt", name: "Common Salt", category: "supplement", unit: "kg", proteinPercent: "0.00", tdn: "0.00", costPerUnit: "12.00" },
    { code: "molasses", name: "Molasses", category: "supplement", unit: "kg", proteinPercent: "3.00", tdn: "75.00", costPerUnit: "18.00" },
  ];

  for (const item of feedItemsData) {
    await db.insert(feedItems).values(item).onConflictDoNothing({ target: feedItems.code });
  }
  console.log(`✓ Seeded ${feedItemsData.length} feed items`);

  // Seed expense heads
  const expenseHeadsData = [
    { code: "feed", name: "Feed & Fodder", category: "feed" },
    { code: "veterinary", name: "Veterinary Care", category: "medicine" },
    { code: "labor", name: "Labor & Wages", category: "labor" },
    { code: "equipment", name: "Equipment & Machinery", category: "maintenance" },
    { code: "breeding", name: "Breeding Services", category: "other" },
    { code: "utilities", name: "Utilities", category: "utilities" },
    { code: "maintenance", name: "Maintenance", category: "maintenance" },
    { code: "transport", name: "Transport", category: "other" },
    { code: "insurance", name: "Insurance", category: "other" },
    { code: "other", name: "Other Expenses", category: "other" },
  ];

  for (const head of expenseHeadsData) {
    await db.insert(expenseHeads).values(head).onConflictDoNothing({ target: expenseHeads.code });
  }
  console.log(`✓ Seeded ${expenseHeadsData.length} expense heads`);

  // Seed income heads
  const incomeHeadsData = [
    { code: "milk-sale", name: "Milk Sales", category: "milk_sale" },
    { code: "cattle-sale", name: "Cattle Sales", category: "cattle_sale" },
    { code: "calf-sale", name: "Calf Sales", category: "cattle_sale" },
    { code: "manure", name: "Manure Sales", category: "manure" },
    { code: "breeding", name: "Breeding Services", category: "other" },
    { code: "subsidy", name: "Government Subsidy", category: "other" },
    { code: "other", name: "Other Income", category: "other" },
  ];

  for (const head of incomeHeadsData) {
    await db.insert(incomeHeads).values(head).onConflictDoNothing({ target: incomeHeads.code });
  }
  console.log(`✓ Seeded ${incomeHeadsData.length} income heads`);

  // Seed inventory categories
  const inventoryCategoriesData = [
    { code: "medicine", name: "Medicines & Vaccines", type: "medicine" },
    { code: "feed", name: "Feed & Supplements", type: "feed" },
    { code: "equipment", name: "Equipment & Tools", type: "equipment" },
    { code: "packaging", name: "Packaging Materials", type: "packaging" },
    { code: "supplement", name: "Mineral Supplements", type: "supplement" },
  ];

  for (const cat of inventoryCategoriesData) {
    await db.insert(inventoryCategories).values(cat).onConflictDoNothing({ target: inventoryCategories.code });
  }
  console.log(`✓ Seeded ${inventoryCategoriesData.length} inventory categories`);

  // Seed byproduct types
  const byproductTypesData = [
    { code: "cow-dung", name: "Cow Dung (Fresh)", unit: "kg", description: "Fresh cow dung for direct sale or composting" },
    { code: "dry-dung", name: "Dry Cow Dung", unit: "kg", description: "Dried cow dung cakes/patties" },
    { code: "cow-urine", name: "Cow Urine (Gomutra)", unit: "liters", description: "Fresh cow urine for medicinal/agricultural use" },
    { code: "vermicompost", name: "Vermicompost", unit: "kg", description: "Organic fertilizer produced using earthworms" },
    { code: "compost-manure", name: "Compost Manure", unit: "kg", description: "Decomposed organic matter for soil enrichment" },
    { code: "biogas-slurry", name: "Biogas Slurry", unit: "kg", description: "Nutrient-rich byproduct from biogas production" },
    { code: "biogas", name: "Biogas", unit: "cubic_meters", description: "Methane-rich gas produced from dung" },
    { code: "dung-cakes", name: "Dung Cakes (Upla)", unit: "units", description: "Dried cow dung cakes for fuel" },
    { code: "organic-fertilizer", name: "Organic Fertilizer Mix", unit: "kg", description: "Mixed organic fertilizer from farm waste" },
    { code: "panchgavya", name: "Panchgavya", unit: "liters", description: "Traditional preparation from cow products" },
  ];

  for (const type of byproductTypesData) {
    await db.insert(byproductTypes).values(type).onConflictDoNothing({ target: byproductTypes.code });
  }
  console.log(`✓ Seeded ${byproductTypesData.length} byproduct types`);

  // Seed subscription plans
  const plansData = [
    { code: "free", name: "Free", maxCattle: 5, maxUsers: 2, priceMonthly: "0.00", priceYearly: "0.00", sortOrder: 0, features: ["5 cattle", "2 users", "Basic milk tracking", "Health records"] },
    { code: "starter", name: "Starter", maxCattle: 25, maxUsers: 5, priceMonthly: "499.00", priceYearly: "4999.00", sortOrder: 1, features: ["25 cattle", "5 users", "All basic features", "Breeding tracking", "Reports"] },
    { code: "basic", name: "Basic", maxCattle: 100, maxUsers: 10, priceMonthly: "999.00", priceYearly: "9999.00", sortOrder: 2, features: ["100 cattle", "10 users", "All Starter features", "Finance module", "Byproducts", "WhatsApp"] },
    { code: "pro", name: "Pro", maxCattle: 250, maxUsers: 25, priceMonthly: "2499.00", priceYearly: "24999.00", sortOrder: 3, features: ["250 cattle", "25 users", "All Basic features", "Advanced analytics", "P&L dashboard", "Priority support"] },
    { code: "enterprise", name: "Enterprise", maxCattle: 500, maxUsers: 100, priceMonthly: "4999.00", priceYearly: "49999.00", sortOrder: 4, features: ["500 cattle", "Unlimited users", "All Pro features", "Custom integrations", "Dedicated support"] },
  ];
  for (const plan of plansData) {
    await db.insert(subscriptionPlans).values(plan as any).onConflictDoNothing({ target: subscriptionPlans.code });
  }
  console.log(`✓ Seeded ${plansData.length} subscription plans`);

  console.log("\n✅ Seeding completed successfully!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
