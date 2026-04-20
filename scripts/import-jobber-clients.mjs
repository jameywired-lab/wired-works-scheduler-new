import fs from "fs";
import path from "path";
import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read DATABASE_URL from .env or environment
const envPath = path.join(__dirname, "../.env");
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  const match = env.match(/DATABASE_URL=(.+)/);
  if (match) dbUrl = match[1].trim().replace(/^"|"$/g, "");
}
if (!dbUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

// Parse CSV properly handling quoted fields
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanPhone(raw) {
  if (!raw) return "";
  // Take first phone if multiple separated by comma
  const first = raw.split(",")[0].trim();
  // Strip non-digits except leading +
  return first.replace(/[^\d+]/g, "").replace(/^\+1/, "") || "";
}

function normalizePhone(p) {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

const csvPath = "/home/ubuntu/upload/JobberClients1of1.csv";
const raw = fs.readFileSync(csvPath, "utf8");
const lines = raw.split(/\r?\n/).filter(l => l.trim());
const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());

console.log(`Total rows (including header): ${lines.length}`);
console.log(`Headers found: ${headers.length}`);

// Column indices
const idx = (name) => headers.indexOf(name);
const COL = {
  displayName: idx("display name"),
  firstName: idx("first name"),
  lastName: idx("last name"),
  mainPhone: idx("main phone #s"),
  mobilePhone: idx("mobile phone #s"),
  workPhone: idx("work phone #s"),
  homePhone: idx("home phone #s"),
  email: idx("e-mails"),
  street1: idx("billing street 1"),
  street2: idx("billing street 2"),
  city: idx("billing city"),
  state: idx("billing state"),
  zip: idx("billing zip code"),
  archived: idx("archived"),
  referredBy: idx("cft[referred by]"),
};

const rows = lines.slice(1).map(line => {
  const cols = parseCsvLine(line);
  const get = (i) => (i >= 0 && i < cols.length ? cols[i] : "");
  
  const archived = get(COL.archived).toLowerCase() === "true";
  if (archived) return null;

  // Build name
  const displayName = get(COL.displayName).trim();
  const firstName = get(COL.firstName).trim();
  const lastName = get(COL.lastName).trim();
  const name = displayName || [firstName, lastName].filter(Boolean).join(" ") || "";
  if (!name) return null;

  // Best phone: main > mobile > work > home
  const rawPhone = get(COL.mainPhone) || get(COL.mobilePhone) || get(COL.workPhone) || get(COL.homePhone);
  const phone = cleanPhone(rawPhone);

  // Email: take first
  const rawEmail = get(COL.email);
  const email = rawEmail ? rawEmail.split(",")[0].trim() : "";

  const addressLine1 = get(COL.street1).trim();
  const addressLine2 = get(COL.street2).trim();
  const city = get(COL.city).trim();
  let state = get(COL.state).trim();
  // Normalize "Florida" -> "FL" etc
  const stateMap = { "florida": "FL", "georgia": "GA", "south carolina": "SC", "north carolina": "NC", "alabama": "AL", "tennessee": "TN", "texas": "TX", "california": "CA", "new york": "NY" };
  if (state.length > 2) state = stateMap[state.toLowerCase()] || state;
  const zip = get(COL.zip).trim();
  const notes = get(COL.referredBy) ? `Referred by: ${get(COL.referredBy)}` : "";

  return { name, phone, email, addressLine1, addressLine2, city, state, zip, notes };
}).filter(Boolean);

console.log(`\nParsed ${rows.length} non-archived clients`);

// Detect duplicates by name (case-insensitive)
const nameMap = new Map();
for (const row of rows) {
  const key = row.name.toLowerCase().trim();
  if (!nameMap.has(key)) nameMap.set(key, []);
  nameMap.get(key).push(row);
}
const duplicates = [...nameMap.entries()].filter(([, v]) => v.length > 1);
console.log(`\nDuplicates by name: ${duplicates.length} groups`);
for (const [name, group] of duplicates) {
  console.log(`  "${name}" appears ${group.length} times`);
}

// Merge duplicates: keep the one with the most data
const deduped = [...nameMap.values()].map(group => {
  if (group.length === 1) return group[0];
  // Score each by filled fields
  const scored = group.map(r => ({
    ...r,
    score: [r.phone, r.email, r.addressLine1, r.city].filter(Boolean).length,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
});

console.log(`\nAfter deduplication: ${deduped.length} unique clients`);

// Missing phones
const missingPhone = deduped.filter(r => !r.phone);
console.log(`\nClients missing phone numbers: ${missingPhone.length}`);
missingPhone.forEach(r => console.log(`  - ${r.name}${r.email ? ` (${r.email})` : ""}${r.city ? ` — ${r.city}` : ""}`));

// Write missing phone list to file
fs.writeFileSync(
  "/home/ubuntu/wired-works-scheduler/scripts/missing-phones.json",
  JSON.stringify(missingPhone.map(r => ({ name: r.name, email: r.email, city: r.city, addressLine1: r.addressLine1 })), null, 2)
);

// Now import into DB
const conn = await createConnection(dbUrl);

// Get existing clients to avoid re-importing
const [existing] = await conn.execute("SELECT name FROM project_credentials LIMIT 1").catch(() => [[]]);
const [existingClients] = await conn.execute("SELECT id, name FROM clients");
const existingNames = new Set(existingClients.map(r => r.name.toLowerCase().trim()));

let imported = 0;
let skipped = 0;

for (const row of deduped) {
  const key = row.name.toLowerCase().trim();
  if (existingNames.has(key)) {
    skipped++;
    continue;
  }
  await conn.execute(
    `INSERT INTO clients (name, phone, email, addressLine1, addressLine2, city, state, zip, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [row.name, row.phone || null, row.email || null, row.addressLine1 || null, row.addressLine2 || null, row.city || null, row.state || null, row.zip || null, row.notes || null]
  );
  imported++;
}

await conn.end();

console.log(`\n✅ Import complete: ${imported} imported, ${skipped} skipped (already exist)`);
console.log(`Missing phones list saved to scripts/missing-phones.json`);
