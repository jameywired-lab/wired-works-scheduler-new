import mysql from "mysql2/promise";
import * as fs from "fs";

// Read DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(DATABASE_URL);

try {
  // 1. Find or create the "Ponte Vedra" tag
  const tagName = "Ponte Vedra";
  const tagColor = "#3b82f6"; // blue

  const [existingTags] = await conn.execute(
    "SELECT id FROM tags WHERE name = ? LIMIT 1",
    [tagName]
  );

  let tagId;
  if (existingTags.length > 0) {
    tagId = existingTags[0].id;
    console.log(`✓ Tag "${tagName}" already exists (id=${tagId})`);
  } else {
    const now = Date.now();
    const [result] = await conn.execute(
      "INSERT INTO tags (name, color, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      [tagName, tagColor, now, now]
    );
    tagId = result.insertId;
    console.log(`✓ Created tag "${tagName}" (id=${tagId})`);
  }

  // 2. Find all clients with Ponte Vedra or Ponte Vedra Beach city
  const [clients] = await conn.execute(
    `SELECT id, name, city FROM clients 
     WHERE LOWER(TRIM(city)) IN ('ponte vedra', 'ponte vedra beach')`,
    []
  );
  console.log(`Found ${clients.length} clients with Ponte Vedra address`);

  // 3. Check which already have the tag
  const [existingTagged] = await conn.execute(
    "SELECT clientId FROM clientTags WHERE tagId = ?",
    [tagId]
  );
  const alreadyTagged = new Set(existingTagged.map(r => r.clientId));

  // 4. Insert missing tag assignments
  let added = 0;
  let skipped = 0;
  const now = Date.now();

  for (const client of clients) {
    if (alreadyTagged.has(client.id)) {
      skipped++;
      continue;
    }
    await conn.execute(
      "INSERT INTO clientTags (clientId, tagId) VALUES (?, ?)",
      [client.id, tagId]
    );
    added++;
  }

  console.log(`\n✅ Done!`);
  console.log(`   Tagged: ${added} clients`);
  console.log(`   Already had tag: ${skipped} clients`);
  console.log(`   Total Ponte Vedra clients: ${clients.length}`);

} finally {
  await conn.end();
}
