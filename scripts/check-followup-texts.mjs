import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT id, contactName, phone, type, note, isFollowedUp FROM followUps WHERE type='text' ORDER BY id DESC LIMIT 15"
);
console.log("Recent text follow-ups:");
console.table(rows);
await conn.end();
