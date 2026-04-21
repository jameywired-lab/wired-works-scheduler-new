import { readFileSync } from "fs";
import { resolve } from "path";
import { createPool } from "mysql2/promise";

/**
 * runMigrations — reads railway-db-schema.sql and executes each statement
 * against the DATABASE_URL. Safe to run on every startup:
 *   - CREATE TABLE uses IF NOT EXISTS
 *   - ALTER TABLE ADD COLUMN uses IF NOT EXISTS (MySQL 8.0+)
 *   - ADD CONSTRAINT / MODIFY COLUMN errors are caught and ignored (already applied)
 */
export async function runMigrations(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[migrate] DATABASE_URL not set — skipping migration");
    return;
  }

  // Locate the SQL file relative to this module's compiled output.
  // In production: dist/index.js lives in /app/dist, so we go up one level.
  // In development: tsx runs from the project root, so we use process.cwd().
  let sqlPath: string;
  try {
    // import.meta.dirname is available in ESM (esbuild --format=esm)
    const dir = (import.meta as { dirname?: string }).dirname;
    if (dir) {
      // production: dist/index.js → /app/dist → go up to /app
      sqlPath = resolve(dir, "..", "railway-db-schema.sql");
    } else {
      sqlPath = resolve(process.cwd(), "railway-db-schema.sql");
    }
  } catch {
    sqlPath = resolve(process.cwd(), "railway-db-schema.sql");
  }

  let sql: string;
  try {
    sql = readFileSync(sqlPath, "utf-8");
  } catch (err) {
    console.warn(`[migrate] Could not read migration file at ${sqlPath}:`, err);
    return;
  }

  console.log("[migrate] Starting database migration…");

  // Split on semicolons. Each Drizzle migration file uses "--> statement-breakpoint"
  // as a separator but also terminates every statement with ";".
  // We strip the breakpoint markers and split on ";" to get individual statements.
  const raw = sql
    .replace(/--> statement-breakpoint/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const pool = createPool({ uri: dbUrl, multipleStatements: false });

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of raw) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      // These error codes mean the object already exists — safe to ignore:
      //   ER_TABLE_EXISTS_ERROR   (1050) — CREATE TABLE already exists
      //   ER_DUP_FIELDNAME        (1060) — ADD COLUMN already exists
      //   ER_DUP_KEYNAME          (1061) — ADD CONSTRAINT / index already exists
      //   ER_CANT_DROP_FIELD_OR_KEY (1091) — DROP COLUMN/KEY that doesn't exist
      //   ER_FK_DUP_NAME          (1826) — duplicate foreign key name
      const ignorable = [
        "ER_TABLE_EXISTS_ERROR",
        "ER_DUP_FIELDNAME",
        "ER_DUP_KEYNAME",
        "ER_CANT_DROP_FIELD_OR_KEY",
        "ER_FK_DUP_NAME",
      ];
      if (e.code && ignorable.includes(e.code)) {
        skipped++;
      } else {
        failed++;
        console.warn(`[migrate] Statement failed (${e.code ?? "unknown"}): ${e.message}`);
        console.warn(`[migrate] Statement was: ${stmt.slice(0, 120)}…`);
      }
    }
  }

  await pool.end();

  console.log(
    `[migrate] Done — ${ok} applied, ${skipped} already-existed (skipped), ${failed} failed`
  );
}
