import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import fs from "node:fs/promises";
import * as schema from "../shared/schema";
import { useIsolatedDatabase } from "../server/db";
export async function isolatedDatabase(dataDir?: string) {
  const engine = new PGlite(dataDir);
  await engine.exec("SET TIME ZONE 'UTC'");
  const existing = await engine.query(
    "select to_regclass('public.cattle') as table_name",
  );
  if (!(existing.rows[0] as any).table_name)
    await engine.exec(
      await fs.readFile("migrations/0000_round_morph.sql", "utf8"),
    );
  const database = drizzle(engine, { schema });
  useIsolatedDatabase(database);
  return { engine, database };
}
