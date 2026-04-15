import mysql from "mysql2/promise";

const sql = `
CREATE TABLE IF NOT EXISTS \`smsTemplates\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`key\` varchar(64) NOT NULL,
  \`body\` text NOT NULL,
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`smsTemplates_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`smsTemplates_key_unique\` UNIQUE(\`key\`)
);
`;

const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute(sql);
console.log("✅ smsTemplates table created (or already exists)");
await conn.end();
