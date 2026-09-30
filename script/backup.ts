import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
const mode = process.argv[2] || "backup";
function databaseEnv(connection: string) {
  const u = new URL(connection);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.slice(1),
    ...(u.searchParams.get("sslmode")
      ? { PGSSLMODE: u.searchParams.get("sslmode")! }
      : {}),
  };
}
const run = (command: string, args: string[], env: any) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "inherit", "pipe"],
      windowsHide: true,
    });
    let errors = "";
    child.stderr.on("data", (v) => (errors += v));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} failed (${code}): ${errors}`)),
    );
  });
async function main() {
  if (mode === "backup") {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    const directory = path.resolve(process.env.BACKUP_DIR || ".backups");
    await mkdir(directory, { recursive: true });
    const file = path.join(
      directory,
      `dairyflow-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`,
    );
    await run(
      "pg_dump",
      ["--format=custom", "--no-owner", `--file=${file}`],
      databaseEnv(process.env.DATABASE_URL),
    );
    const hash = crypto
      .createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
    await writeFile(
      file + ".json",
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          sha256: hash,
          format: "pg_dump-custom",
          file: path.basename(file),
        },
        null,
        2,
      ),
    );
    console.log(`Backup and checksum saved: ${file}`);
  } else if (mode === "restore-check") {
    const file = process.argv[3],
      target = process.env.RESTORE_DATABASE_URL;
    if (!file || !target)
      throw new Error(
        "Provide a backup file and RESTORE_DATABASE_URL for an empty isolated database",
      );
    if (target === process.env.DATABASE_URL)
      throw new Error("Restore target must differ from production");
    if (process.env.DATABASE_URL) {
      const a = new URL(target),
        b = new URL(process.env.DATABASE_URL);
      if (
        a.hostname === b.hostname &&
        a.port === b.port &&
        a.pathname === b.pathname
      )
        throw new Error("Restore target identifies the production database");
    }
    const manifest = JSON.parse(await readFile(file + ".json", "utf8"));
    if (
      crypto
        .createHash("sha256")
        .update(await readFile(file))
        .digest("hex") !== manifest.sha256
    )
      throw new Error("Backup checksum mismatch");
    const pool = new pg.Pool({ connectionString: target });
    try {
      const existing = await pool.query(
        "select count(*)::int as count from information_schema.tables where table_schema='public'",
      );
      if (existing.rows[0].count)
        throw new Error("Restore check requires an empty database");
      await run(
        "pg_restore",
        [
          "--no-owner",
          "--exit-on-error",
          "--dbname",
          new URL(target).pathname.slice(1),
          path.resolve(file),
        ],
        databaseEnv(target),
      );
      for (const table of [
        "tenants",
        "cattle",
        "tasks",
        "farm_events",
        "stock_lots",
        "daily_reports",
      ]) {
        const result = await pool.query(
          `select count(*)::int as count from ${table}`,
        );
        console.log(`${table}: ${result.rows[0].count}`);
      }
      console.log(
        "Restore completed and core tables readable. Compare expected record counts and application checks before disaster recovery.",
      );
    } finally {
      await pool.end();
    }
  } else throw new Error("Use backup or restore-check");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
