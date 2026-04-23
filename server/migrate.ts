import { readFileSync } from "fs";
import { resolve } from "path";
import { createPool, Pool } from "mysql2/promise";

/**
 * runMigrations — reads railway-db-schema.sql and executes each statement
 * against the DATABASE_URL. Safe to run on every startup:
 *
 *   - CREATE TABLE uses IF NOT EXISTS  → always safe
 *   - ALTER TABLE ADD COLUMN           → guarded by columnExists() check
 *   - ALTER TABLE MODIFY COLUMN        → always attempted, ER_DUP_FIELDNAME ignored
 *   - ADD CONSTRAINT / FK errors       → caught and ignored (already applied)
 *
 * NOTE: "ALTER TABLE ... ADD IF NOT EXISTS" requires MySQL 8.0.3+.
 * Railway runs an older MySQL version that does NOT support that syntax.
 * We therefore NEVER use ADD IF NOT EXISTS — instead we check
 * INFORMATION_SCHEMA.COLUMNS before every ADD COLUMN statement.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDbName(pool: Pool, dbUrl: string): Promise<string> {
  // Extract DB name from the URL (works for mysql:// and mysql2:// schemes)
  try {
    const url = new URL(dbUrl.replace(/^mysql2?:\/\//, "http://"));
    const name = url.pathname.slice(1).split("?")[0];
    if (name) return name;
  } catch {
    // fallback: ask the server
  }
  const [rows] = await pool.query("SELECT DATABASE() AS db") as [Record<string, unknown>[], unknown];
  return String((rows as Record<string, unknown>[])[0]?.db ?? "");
}

async function columnExists(pool: Pool, dbName: string, table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query(
    "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [dbName, table, column]
  ) as [Record<string, unknown>[], unknown];
  return (rows as Record<string, unknown>[]).length > 0;
}

/**
 * Parse an ALTER TABLE ADD COLUMN statement and return { table, column }.
 * Returns null if the statement is not an ADD COLUMN.
 */
function parseAddColumn(stmt: string): { table: string; column: string } | null {
  // Match: ALTER TABLE `foo` ADD `bar` ...  OR  ALTER TABLE `foo` ADD COLUMN `bar` ...
  const m = stmt.match(/ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+(?:COLUMN\s+)?`?(\w+)`?/i);
  if (!m) return null;
  return { table: m[1], column: m[2] };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[migrate] DATABASE_URL not set — skipping migration");
    return;
  }

  // Locate the SQL file relative to this module's compiled output.
  let sqlPath: string;
  try {
    const dir = (import.meta as { dirname?: string }).dirname;
    sqlPath = dir
      ? resolve(dir, "..", "railway-db-schema.sql")
      : resolve(process.cwd(), "railway-db-schema.sql");
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

  const statements = sql
    .replace(/--> statement-breakpoint/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const pool = createPool({ uri: dbUrl, multipleStatements: false });
  const dbName = await getDbName(pool, dbUrl);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      // ── Guard ADD COLUMN with an INFORMATION_SCHEMA check ──────────────────
      const addCol = parseAddColumn(stmt);
      if (addCol && stmt.match(/\bADD\b/i) && !stmt.match(/\bMODIFY\b/i) && !stmt.match(/\bCONSTRAINT\b/i)) {
        const exists = await columnExists(pool, dbName, addCol.table, addCol.column);
        if (exists) {
          skipped++;
          continue;
        }
      }

      await pool.query(stmt);
      ok++;
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const ignorable = [
        "ER_TABLE_EXISTS_ERROR",   // CREATE TABLE IF NOT EXISTS (already there)
        "ER_DUP_FIELDNAME",        // column already exists
        "ER_DUP_KEYNAME",          // index/constraint already exists
        "ER_CANT_DROP_FIELD_OR_KEY", // DROP COLUMN/KEY that doesn't exist
        "ER_FK_DUP_NAME",          // foreign key already exists
        "ER_DUP_ENTRY",            // unique constraint violation on seed data
        "ER_KEY_COLUMN_DOES_NOT_EXIST", // FK references column not yet added (ordering)
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

  // ── Critical patches ────────────────────────────────────────────────────────
  // These ensure columns added after initial deploy always exist.
  // Each patch is guarded by columnExists() — no ADD IF NOT EXISTS needed.
  const columnPatches: Array<{ table: string; column: string; sql: string }> = [
    { table: "users",     column: "passwordHash",  sql: "ALTER TABLE `users` ADD `passwordHash` varchar(255)" },
    { table: "users",     column: "phone",         sql: "ALTER TABLE `users` ADD `phone` varchar(32)" },
    { table: "followUps", column: "nextStepsNote", sql: "ALTER TABLE `followUps` ADD `nextStepsNote` text" },
    { table: "followUps", column: "linkedJobId",   sql: "ALTER TABLE `followUps` ADD `linkedJobId` int" },
    { table: "followUps", column: "clientId",      sql: "ALTER TABLE `followUps` ADD `clientId` int" },
    { table: "followUps", column: "proposalStatus",sql: "ALTER TABLE `followUps` ADD `proposalStatus` enum('none','pending','accepted','declined','not_ready') DEFAULT 'none' NOT NULL" },
    { table: "followUps", column: "proposalSentAt",sql: "ALTER TABLE `followUps` ADD `proposalSentAt` bigint" },
    { table: "followUps", column: "isUrgent",      sql: "ALTER TABLE `followUps` ADD `isUrgent` boolean DEFAULT false NOT NULL" },
    { table: "followUps", column: "urgentAt",      sql: "ALTER TABLE `followUps` ADD `urgentAt` bigint" },
    { table: "followUps", column: "remindAt",      sql: "ALTER TABLE `followUps` ADD `remindAt` bigint" },
    { table: "followUps", column: "clientContacted",sql:"ALTER TABLE `followUps` ADD `clientContacted` boolean DEFAULT false NOT NULL" },
    { table: "followUps", column: "messageCount",  sql: "ALTER TABLE `followUps` ADD `messageCount` int DEFAULT 1 NOT NULL" },
    { table: "followUps", column: "messages",      sql: "ALTER TABLE `followUps` ADD `messages` text" },
    { table: "jobs",      column: "googleCalendarEventId", sql: "ALTER TABLE `jobs` ADD `googleCalendarEventId` varchar(255)" },
    { table: "jobs",      column: "jobType",        sql: "ALTER TABLE `jobs` ADD `jobType` enum('service_call','project_job','sales_call') DEFAULT 'service_call' NOT NULL" },
    { table: "jobs",      column: "closeoutNotes",  sql: "ALTER TABLE `jobs` ADD `closeoutNotes` text" },
    { table: "jobs",      column: "closeoutOutcome",sql: "ALTER TABLE `jobs` ADD `closeoutOutcome` enum('client_happy_bill','client_issue_urgent','proposal_needed','bill_service_call')" },
    { table: "jobs",      column: "closedAt",       sql: "ALTER TABLE `jobs` ADD `closedAt` bigint" },
    { table: "projects",  column: "projectType",    sql: "ALTER TABLE `projects` ADD `projectType` enum('new_construction','commercial','retrofit')" },
    { table: "projects",  column: "projectValue",   sql: "ALTER TABLE `projects` ADD `projectValue` decimal(12,2)" },
    { table: "projects",  column: "completedAt",    sql: "ALTER TABLE `projects` ADD `completedAt` bigint" },
    { table: "projects",  column: "jobTotal",       sql: "ALTER TABLE `projects` ADD `jobTotal` decimal(12,2)" },
    { table: "projects",  column: "leadSource",     sql: "ALTER TABLE `projects` ADD `leadSource` varchar(64)" },
    { table: "projects",  column: "referralName",   sql: "ALTER TABLE `projects` ADD `referralName` varchar(255)" },
    { table: "projects",  column: "leadSourceOther",sql: "ALTER TABLE `projects` ADD `leadSourceOther` varchar(255)" },
    { table: "jobPhotos", column: "annotatedS3Key", sql: "ALTER TABLE `jobPhotos` ADD `annotatedS3Key` varchar(512)" },
    { table: "jobPhotos", column: "annotatedS3Url", sql: "ALTER TABLE `jobPhotos` ADD `annotatedS3Url` text" },
    { table: "projectMilestones", column: "weight", sql: "ALTER TABLE `projectMilestones` ADD `weight` int DEFAULT 0 NOT NULL" },
    { table: "projectCredentials", column: "clientId", sql: "ALTER TABLE `projectCredentials` ADD `clientId` int" },
    // Visit tracking (crew time on-site)
    { table: "jobAssignments", column: "visitStartedAt",   sql: "ALTER TABLE `jobAssignments` ADD `visitStartedAt` bigint" },
    { table: "jobAssignments", column: "visitCompletedAt", sql: "ALTER TABLE `jobAssignments` ADD `visitCompletedAt` bigint" },
    { table: "jobAssignments", column: "visitNotes",       sql: "ALTER TABLE `jobAssignments` ADD `visitNotes` text" },
    // callLog columns (table created without these in early deploys)
    { table: "callLog",       column: "clientId",     sql: "ALTER TABLE `callLog` ADD `clientId` int" },
    { table: "callLog",       column: "contactName",  sql: "ALTER TABLE `callLog` ADD `contactName` varchar(255)" },
    { table: "callLog",       column: "openPhoneCallId", sql: "ALTER TABLE `callLog` ADD `openPhoneCallId` varchar(255)" },
    // inboundSmsLog columns
    { table: "inboundSmsLog", column: "clientId",     sql: "ALTER TABLE `inboundSmsLog` ADD `clientId` int" },
    { table: "inboundSmsLog", column: "contactName",  sql: "ALTER TABLE `inboundSmsLog` ADD `contactName` varchar(255)" },
    { table: "inboundSmsLog", column: "openPhoneMessageId", sql: "ALTER TABLE `inboundSmsLog` ADD `openPhoneMessageId` varchar(255)" },
    // jobs billing columns
    { table: "jobs",          column: "invoicedAt",   sql: "ALTER TABLE `jobs` ADD `invoicedAt` bigint" },
    { table: "jobs",          column: "paidAt",       sql: "ALTER TABLE `jobs` ADD `paidAt` bigint" },
    { table: "jobs",          column: "invoiceAmount",sql: "ALTER TABLE `jobs` ADD `invoiceAmount` int" },
    { table: "jobs",          column: "invoiceNotes", sql: "ALTER TABLE `jobs` ADD `invoiceNotes` text" },
    // followUps email column
    { table: "followUps",     column: "email",        sql: "ALTER TABLE `followUps` ADD `email` varchar(320)" },
  ];

  // Ensure callLog table exists (was missing from initial schema)
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS \`callLog\` (
      \`id\` int AUTO_INCREMENT PRIMARY KEY,
      \`openPhoneCallId\` varchar(255),
      \`from\` varchar(50) NOT NULL,
      \`to\` varchar(50) NOT NULL,
      \`direction\` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
      \`status\` enum('completed','missed','voicemail','no-answer','busy','failed') NOT NULL DEFAULT 'completed',
      \`duration\` int,
      \`recordingUrl\` text,
      \`transcription\` text,
      \`clientId\` int,
      \`contactName\` varchar(255),
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code !== 'ER_TABLE_EXISTS_ERROR') {
      console.warn(`[migrate] callLog table patch failed: ${e.message}`);
    }
  }

  // Always run MODIFY COLUMN (role enum) — safe to run repeatedly
  const modifyPatches = [
    "ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','crew') NOT NULL DEFAULT 'user'",
    "ALTER TABLE `followUps` MODIFY COLUMN `type` enum('call','text','manual','closeout','proposal','inventory') NOT NULL DEFAULT 'manual'",
  ];

  for (const patch of columnPatches) {
    try {
      const exists = await columnExists(pool, dbName, patch.table, patch.column);
      if (exists) {
        // already there — skip silently
        continue;
      }
      await pool.query(patch.sql);
      console.log(`[migrate] Patch applied: ${patch.table}.${patch.column}`);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "ER_DUP_FIELDNAME") {
        // race condition — column appeared between check and add, fine
      } else {
        console.warn(`[migrate] Patch failed (${e.code ?? "unknown"}): ${patch.table}.${patch.column} — ${e.message}`);
      }
    }
  }

  for (const patch of modifyPatches) {
    try {
      await pool.query(patch);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      // WARN_DATA_TRUNCATED is acceptable (existing rows have valid values)
      if (e.code !== "WARN_DATA_TRUNCATED") {
        console.warn(`[migrate] Modify patch failed (${e.code ?? "unknown"}): ${e.message}`);
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── Backfill: ensure every crew-role user has a crewMember record ──────────
  // This fixes the case where users were created with role=crew before the
  // auto-create logic was added to createManualUser.
  try {
    const [crewUsers] = await pool.query(
      "SELECT id, name, email, phone FROM `users` WHERE role = 'crew'"
    ) as [Record<string, unknown>[], unknown];
    for (const u of crewUsers as { id: number; name: string; email: string | null; phone: string | null }[]) {
      const [existing] = await pool.query(
        "SELECT id FROM `crewMembers` WHERE userId = ? LIMIT 1",
        [u.id]
      ) as [Record<string, unknown>[], unknown];
      if ((existing as Record<string, unknown>[]).length === 0) {
        await pool.query(
          "INSERT INTO `crewMembers` (userId, name, email, phone, role, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'Technician', 1, NOW(), NOW())",
          [u.id, u.name, u.email ?? null, u.phone ?? null]
        );
        console.log(`[migrate] Backfilled crewMember for user: ${u.name} (id=${u.id})`);
      }
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.warn(`[migrate] Crew backfill failed: ${e.message}`);
  }
  // ────────────────────────────────────────────────────────────────────────────

  await pool.end();

  console.log(
    `[migrate] Done — ${ok} applied, ${skipped} already-existed (skipped), ${failed} failed`
  );
}
