import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
// Strip any existing ssl param and parse
const urlObj = new URL(dbUrl);
urlObj.searchParams.delete("ssl");
const cleanUrl = urlObj.toString();

const conn = await createConnection({ uri: cleanUrl, ssl: { rejectUnauthorized: false } });

const statements = [
  `CREATE TABLE IF NOT EXISTS \`projectNotes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`authorName\` varchar(255) DEFAULT 'Admin',
    \`body\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`projectNotes_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`projectPhotos\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`s3Key\` varchar(512) NOT NULL,
    \`s3Url\` text NOT NULL,
    \`filename\` varchar(255),
    \`mimeType\` varchar(64),
    \`sizeBytes\` int,
    \`uploadedBy\` varchar(255),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`projectPhotos_id\` PRIMARY KEY(\`id\`)
  )`,
];

for (const sql of statements) {
  await conn.execute(sql);
  console.log("OK:", sql.trim().split("\n")[0]);
}

// Add FK constraints (ignore if already exist)
const fks = [
  "ALTER TABLE `projectNotes` ADD CONSTRAINT `projectNotes_projectId_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)",
  "ALTER TABLE `projectPhotos` ADD CONSTRAINT `projectPhotos_projectId_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)",
];
for (const fk of fks) {
  try {
    await conn.execute(fk);
    console.log("FK added:", fk.substring(0, 60));
  } catch (e) {
    if (e.code === "ER_DUP_KEYNAME" || e.message.includes("Duplicate key name") || e.message.includes("already exists")) {
      console.log("FK already exists, skipping");
    } else {
      throw e;
    }
  }
}

await conn.end();
console.log("Migration complete.");
