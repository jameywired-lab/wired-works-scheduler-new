/**
 * Tag all clients in the Nocatee area with "Nocatee"
 *
 * Nocatee is a master-planned community straddling St. Johns and Duval counties.
 * Matching rules:
 * - City name is "nocatee" (or "ponte vedra" with zip 32081)
 * - OR zip code is 32081 (the primary Nocatee zip)
 *
 * Note: Some Nocatee addresses use "Ponte Vedra" as the city with zip 32081.
 * We intentionally keep Nocatee as a separate tag from Ponte Vedra Beach (32082).
 */

import mysql from 'mysql2/promise';

const DRY_RUN = process.env.DRY_RUN === '1';

const NOCATEE_CITIES = ['nocatee'];
const NOCATEE_ZIPS = ['32081'];

function isNocatee(client) {
  const city = (client.city || '').toLowerCase().trim();
  const zip = (client.zip || '').trim().substring(0, 5);
  return NOCATEE_CITIES.includes(city) || NOCATEE_ZIPS.includes(zip);
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  // Get or create the Nocatee tag
  let [tagRows] = await db.execute("SELECT id FROM tags WHERE name = 'Nocatee' LIMIT 1");
  let tagId;

  if (tagRows.length === 0) {
    if (DRY_RUN) {
      console.log('[DRY RUN] Would create tag: Nocatee (color: #0891b2)');
      tagId = -1;
    } else {
      const [result] = await db.execute(
        "INSERT INTO tags (name, color, createdAt) VALUES ('Nocatee', '#0891b2', NOW())"
      );
      tagId = result.insertId;
      console.log(`Created tag "Nocatee" with id=${tagId}`);
    }
  } else {
    tagId = tagRows[0].id;
    console.log(`Found existing tag "Nocatee" with id=${tagId}`);
  }

  // Get all clients
  const [clients] = await db.execute(
    'SELECT id, name, addressLine1, city, zip FROM clients ORDER BY city, name'
  );

  const matches = clients.filter(isNocatee);
  console.log(`\nFound ${matches.length} Nocatee area clients:`);
  matches.forEach(c => console.log(`  ${c.name} | ${c.addressLine1}, ${c.city} ${c.zip}`));

  if (DRY_RUN) {
    await db.end();
    return;
  }

  // Get already-tagged client IDs
  const [already] = await db.execute(
    'SELECT clientId FROM clientTags WHERE tagId = ?', [tagId]
  );
  const alreadyTagged = new Set(already.map(r => r.clientId));

  let added = 0;
  for (const c of matches) {
    if (!alreadyTagged.has(c.id)) {
      await db.execute(
        'INSERT INTO clientTags (clientId, tagId, createdAt) VALUES (?, ?, NOW())',
        [c.id, tagId]
      );
      added++;
    }
  }

  const [total] = await db.execute(
    'SELECT COUNT(*) as cnt FROM clientTags WHERE tagId = ?', [tagId]
  );
  console.log(`\nDone. Added ${added} new tags. Total Nocatee clients: ${total[0].cnt}`);

  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });
