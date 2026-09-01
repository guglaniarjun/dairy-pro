import crypto from "crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const email = (process.env.SUPER_ADMIN_EMAIL || "admin@dairyflow.com").trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!password || password.length < 10) throw new Error("A Super Admin password of at least 10 characters is required");

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
    [email],
  );

  if (existing.rowCount) {
    await client.query(
      "UPDATE users SET email = $1, password_hash = $2, updated_at = NOW() WHERE id = $3",
      [email, passwordHash, existing.rows[0].id],
    );
  } else {
    await client.query(
      "INSERT INTO users (id, email, first_name, last_name, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
      [crypto.randomUUID(), email, "DairyFlow", "Administrator", passwordHash],
    );
  }

  const verified = await client.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE lower(email) = $1 LIMIT 1",
    [email],
  );
  if (!verified.rowCount || !(await bcrypt.compare(password, verified.rows[0].password_hash))) {
    throw new Error("Super Admin password verification failed");
  }
  console.log(`Super Admin credentials verified for ${email}`);
} finally {
  await client.end();
}
