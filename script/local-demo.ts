import crypto from "node:crypto";
import { isolatedDatabase } from "../tests/database";
import {
  users,
  tenants,
  cattle,
  inventoryItems,
  farmSettings,
} from "../shared/schema";
import bcrypt from "bcryptjs";
async function main() {
  if (process.env.DATABASE_URL)
    throw new Error("Unset DATABASE_URL before starting an isolated demo");
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.PORT = process.env.PORT || "5179";
  const { database } = await isolatedDatabase();
  const password = crypto.randomBytes(12).toString("base64url");
  const [user] = await database
    .insert(users)
    .values({
      email: "demo@dairyflow.local",
      firstName: "Demo",
      lastName: "Farmer",
      passwordHash: await bcrypt.hash(password, 12),
    })
    .returning();
  const [farm] = await database
    .insert(tenants)
    .values({
      name: "DairyFlow Test Farm",
      slug: "isolated-demo",
      ownerId: user.id,
      maxCattle: 1000,
    })
    .returning();
  await database.insert(farmSettings).values({ tenantId: farm.id });
  await database.insert(cattle).values([
    {
      tenantId: farm.id,
      tagNumber: "C-101",
      name: "Gauri",
      dateOfEntry: "2026-01-01",
      dateOfBirth: "2022-01-01",
      stage: "milking",
      lifeStage: "adult",
      productionStatus: "lactating",
      reproductiveStatus: "pregnant",
      expectedCalvingDate: "2026-11-15",
      breedingCycleId: crypto.randomUUID(),
    },
    {
      tenantId: farm.id,
      tagNumber: "K-201",
      name: "Calf",
      dateOfEntry: "2026-09-01",
      dateOfBirth: "2026-09-01",
      stage: "calf",
      lifeStage: "calf",
      productionStatus: "not_lactating",
      reproductiveStatus: "unserved",
    },
  ]);
  await database.insert(inventoryItems).values([
    {
      tenantId: farm.id,
      name: "Veterinary supply (test)",
      unit: "ml",
      minStock: "20",
    },
    {
      tenantId: farm.id,
      name: "Reviewed feed mix (test)",
      unit: "kg",
      minStock: "50",
    },
  ]);
  console.log(`Isolated demo login: demo@dairyflow.local / ${password}`);
  await import("../server/index");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
