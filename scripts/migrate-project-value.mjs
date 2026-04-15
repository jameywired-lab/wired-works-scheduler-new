import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute("ALTER TABLE `projects` ADD COLUMN IF NOT EXISTS `projectValue` decimal(12,2)");
await conn.execute("ALTER TABLE `projects` ADD COLUMN IF NOT EXISTS `completedAt` bigint");
console.log("✅ projectValue and completedAt columns added to projects table");
await conn.end();
