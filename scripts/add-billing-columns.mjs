import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await createConnection(url);

const stmts = [
  "ALTER TABLE `jobs` ADD COLUMN `invoicedAt` bigint",
  "ALTER TABLE `jobs` ADD COLUMN `paidAt` bigint",
  "ALTER TABLE `jobs` ADD COLUMN `invoiceAmount` int",
  "ALTER TABLE `jobs` ADD COLUMN `invoiceNotes` text",
];

for (const sql of stmts) {
  try {
    await conn.execute(sql);
    console.log("✓", sql.slice(0, 70));
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("⏭  Already exists:", sql.slice(30, 70));
    } else {
      console.error("✗", e.message);
    }
  }
}

await conn.end();
console.log("Done.");
