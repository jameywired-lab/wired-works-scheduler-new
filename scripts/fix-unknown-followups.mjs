import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .env file if present, otherwise rely on process.env
try {
  const envPath = join(__dirname, "../.env");
  const envContent = readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  });
} catch {}

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

// Show all follow-ups with null/empty/unknown contact name
const [rows] = await conn.execute(
  "SELECT id, contactName, isFollowedUp, type, note FROM followUps WHERE contactName IS NULL OR contactName = '' OR contactName = 'Unknown'"
);
console.log("Found unknown follow-ups:", rows);

if (rows.length > 0) {
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const [result] = await conn.execute(`DELETE FROM followUps WHERE id IN (${placeholders})`, ids);
  console.log(`Deleted ${result.affectedRows} rows`);
} else {
  // Also show all followed-up items to find the crossed-out ones
  const [all] = await conn.execute(
    "SELECT id, contactName, isFollowedUp, type, note FROM followUps WHERE isFollowedUp = 1 ORDER BY id DESC LIMIT 10"
  );
  console.log("Recent completed follow-ups:", all);
}

await conn.end();
