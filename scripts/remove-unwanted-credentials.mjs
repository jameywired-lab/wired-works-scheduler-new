import { createConnection } from "mysql2/promise";

const urlObj = new URL(process.env.DATABASE_URL);
urlObj.searchParams.delete("ssl");
const cleanUrl = urlObj.toString();

const conn = await createConnection({ uri: cleanUrl, ssl: { rejectUnauthorized: false } });

// Delete Smart Hub / Controller PIN and Alarm Code credentials from ALL clients and projects
const [result1] = await conn.execute(
  "DELETE FROM `projectCredentials` WHERE `key` IN ('smart_hub_pin', 'alarm_code')"
);
console.log(`Deleted ${result1.affectedRows} credential rows (smart_hub_pin, alarm_code)`);

await conn.end();
console.log("Done.");
