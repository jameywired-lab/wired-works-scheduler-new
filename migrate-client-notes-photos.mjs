import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

const stmts = [
  `CREATE TABLE IF NOT EXISTS \`clientNotes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`clientId\` int NOT NULL,
    \`authorName\` varchar(255) NOT NULL DEFAULT 'Admin',
    \`body\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`clientNotes_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`clientNotes_clientId_clients_id_fk\` FOREIGN KEY (\`clientId\`) REFERENCES \`clients\`(\`id\`) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS \`clientPhotos\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`clientId\` int NOT NULL,
    \`s3Key\` varchar(512) NOT NULL,
    \`s3Url\` text NOT NULL,
    \`filename\` varchar(255),
    \`mimeType\` varchar(64),
    \`sizeBytes\` int,
    \`uploadedBy\` varchar(255) NOT NULL DEFAULT 'Admin',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`clientPhotos_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`clientPhotos_clientId_clients_id_fk\` FOREIGN KEY (\`clientId\`) REFERENCES \`clients\`(\`id\`) ON DELETE CASCADE
  )`,
];

for (const stmt of stmts) {
  await conn.execute(stmt);
  console.log("OK:", stmt.trim().split("\n")[0]);
}

await conn.end();
console.log("Migration complete.");
