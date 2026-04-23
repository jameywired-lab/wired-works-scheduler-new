import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const conn = await createConnection(process.env.DATABASE_URL);

// Create parts table
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`parts\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`description\` text,
    \`unitPrice\` decimal(10,2) NOT NULL DEFAULT '0.00',
    \`isActive\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`parts_id\` PRIMARY KEY(\`id\`)
  )
`);
console.log("✓ parts table created");

// Create jobParts table
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`jobParts\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`jobId\` int NOT NULL,
    \`partId\` int NOT NULL,
    \`crewMemberId\` int,
    \`quantity\` int NOT NULL DEFAULT 1,
    \`unitPrice\` decimal(10,2) NOT NULL,
    \`totalPrice\` decimal(10,2) NOT NULL,
    \`soldAt\` timestamp NOT NULL DEFAULT (now()),
    \`notes\` text,
    CONSTRAINT \`jobParts_id\` PRIMARY KEY(\`id\`)
  )
`);
console.log("✓ jobParts table created");

// Add foreign keys (ignore if already exist)
try {
  await conn.execute(`ALTER TABLE \`jobParts\` ADD CONSTRAINT \`jobParts_jobId_jobs_id_fk\` FOREIGN KEY (\`jobId\`) REFERENCES \`jobs\`(\`id\`)`);
} catch (e) { /* already exists */ }
try {
  await conn.execute(`ALTER TABLE \`jobParts\` ADD CONSTRAINT \`jobParts_partId_parts_id_fk\` FOREIGN KEY (\`partId\`) REFERENCES \`parts\`(\`id\`)`);
} catch (e) { /* already exists */ }
try {
  await conn.execute(`ALTER TABLE \`jobParts\` ADD CONSTRAINT \`jobParts_crewMemberId_users_id_fk\` FOREIGN KEY (\`crewMemberId\`) REFERENCES \`users\`(\`id\`)`);
} catch (e) { /* already exists */ }
console.log("✓ foreign keys added");

// Seed example parts catalog
const exampleParts = [
  { name: "Large Flat Mount", description: "Heavy-duty flat wall mount for large TVs (65\"+)", unitPrice: "49.99" },
  { name: "Sonos Amp", description: "Sonos Amp for powering passive speakers", unitPrice: "699.00" },
  { name: "Flat Surge Protector", description: "Low-profile surge protector, mounts behind TV", unitPrice: "39.99" },
  { name: "Extra TV Install", description: "Additional TV installation charge", unitPrice: "150.00" },
  { name: "Power Bridge Kit", description: "In-wall power bridge kit for clean cable management", unitPrice: "59.99" },
];

for (const part of exampleParts) {
  const [rows] = await conn.execute("SELECT id FROM parts WHERE name = ?", [part.name]);
  if (rows.length === 0) {
    await conn.execute(
      "INSERT INTO parts (name, description, unitPrice) VALUES (?, ?, ?)",
      [part.name, part.description, part.unitPrice]
    );
    console.log(`✓ Seeded part: ${part.name}`);
  } else {
    console.log(`  Skipped (exists): ${part.name}`);
  }
}

await conn.end();
console.log("Migration complete.");
