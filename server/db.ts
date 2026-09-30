import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { AsyncLocalStorage } from "node:async_hooks";

const { Pool } = pg;

if (
  !process.env.DATABASE_URL &&
  process.env.NODE_ENV !== "test" &&
  process.env.LOCAL_DEMO !== "true"
) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: "-c timezone=UTC",
});
let baseDb = drizzle(pool, { schema });
export const transactionContext = new AsyncLocalStorage<any>();
export const db: typeof baseDb = new Proxy({} as typeof baseDb, {
  get(_target, key) {
    const source = transactionContext.getStore() || baseDb;
    const value = source[key];
    return typeof value === "function" ? value.bind(source) : value;
  },
});
export function useIsolatedDatabase(database: any) {
  if (process.env.NODE_ENV !== "test" && process.env.LOCAL_DEMO !== "true")
    throw new Error("An isolated database is only allowed in test/demo mode");
  if (process.env.DATABASE_URL)
    throw new Error("Do not mix an isolated database with DATABASE_URL");
  baseDb = database;
}
