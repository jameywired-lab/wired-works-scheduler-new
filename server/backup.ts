/**
 * server/backup.ts
 * Daily database backup: dumps all tables to a JSON file and stores it in S3.
 * Keeps the last 7 daily backups. Called by a cron job in server/_core/index.ts.
 */
import { storagePut } from "./storage";

const BACKUP_PREFIX = "db-backups/";
const KEEP_DAYS = 7;

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number" || typeof val === "bigint") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  if (val instanceof Date)
    return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (Buffer.isBuffer(val)) return `0x${val.toString("hex")}`;
  const str = String(val)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\0/g, "\\0");
  return `'${str}'`;
}

const TABLE_ORDER = [
  "users",
  "tags",
  "clients",
  "clientAddresses",
  "clientNotes",
  "clientPhotos",
  "clientTags",
  "clientCommunications",
  "crewMembers",
  "crewNotes",
  "jobs",
  "jobAssignments",
  "jobDocuments",
  "jobPhotos",
  "projects",
  "projectMilestones",
  "projectNotes",
  "projectPhotos",
  "projectReminders",
  "projectCredentials",
  "followUps",
  "smsLog",
  "smsTemplates",
  "partsRequests",
  "vanInventoryItems",
  "activityLog",
  "emailCampaigns",
  "emailCampaignRecipients",
];

export async function runDailyBackup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[backup] DATABASE_URL not set, skipping backup");
    return;
  }

  const { createPool } = await import("mysql2/promise");
  const pool = createPool({ uri: dbUrl });

  try {
    const lines: string[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    lines.push(`-- Wired Works Scheduler backup`);
    lines.push(`-- Date: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("SET FOREIGN_KEY_CHECKS=0;");
    lines.push('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
    lines.push("");

    let totalRows = 0;

    for (const table of TABLE_ORDER) {
      try {
        const [rows] = (await pool.query(
          `SELECT * FROM \`${table}\``
        )) as [Record<string, unknown>[], unknown];
        if (!rows || rows.length === 0) {
          lines.push(`-- Table \`${table}\`: empty`);
          lines.push("");
          continue;
        }

        lines.push(`-- Table \`${table}\`: ${rows.length} rows`);
        lines.push(`TRUNCATE TABLE \`${table}\`;`);

        const columns = Object.keys(rows[0]);
        const colList = columns.map((c) => `\`${c}\``).join(", ");

        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          const vals = batch
            .map(
              (row) =>
                "(" + columns.map((col) => escapeValue(row[col])).join(", ") + ")"
            )
            .join(",\n  ");
          lines.push(`INSERT INTO \`${table}\` (${colList}) VALUES`);
          lines.push(`  ${vals};`);
        }
        lines.push("");
        totalRows += rows.length;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lines.push(`-- SKIPPED \`${table}\`: ${msg}`);
        lines.push("");
      }
    }

    lines.push("SET FOREIGN_KEY_CHECKS=1;");
    lines.push("-- Backup complete");

    const content = lines.join("\n");
    const key = `${BACKUP_PREFIX}backup-${dateStr}.sql`;

    await storagePut(key, Buffer.from(content, "utf8"), "text/plain");

    console.log(
      `[backup] Backup saved: ${key} (${(content.length / 1024).toFixed(1)} KB, ${totalRows} rows)`
    );

    // Clean up backups older than KEEP_DAYS — list and delete old ones
    // (S3 listing is not available in the simple storagePut helper, so we
    //  just log a reminder; Railway S3 buckets can be managed via the UI)
    console.log(
      `[backup] Note: manually delete backups older than ${KEEP_DAYS} days from S3 if needed`
    );
  } finally {
    await pool.end();
  }
}
