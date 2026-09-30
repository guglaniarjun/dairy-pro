import fs from "node:fs/promises";
import pg from "pg";
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(hashtext('dairyflow-schema'))");
    const result = await client.query(
      "select to_regclass('public.cattle') as table_name",
    );
    const file = result.rows[0].table_name
      ? "migrations/upgrade-existing.sql"
      : "migrations/0000_round_morph.sql";
    await client.query(await fs.readFile(file, "utf8"));
    console.log(`Applied ${file}`);
  } finally {
    await client.query(
      "select pg_advisory_unlock(hashtext('dairyflow-schema'))",
    );
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
