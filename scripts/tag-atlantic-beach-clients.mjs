/**
 * Tag all clients in Atlantic Beach with "Atlantic Beach"
 * Matches by city name "atlantic beach" or zip 32233.
 * Note: 32081 is Nocatee — some addresses in the dry run showed "Atlantic Beach 32081"
 * which are likely data entry errors; we include them since city explicitly says Atlantic Beach.
 */

import mysql from 'mysql2/promise';

const DRY_RUN = process.env.DRY_RUN === '1';

function isAtlanticBeach(client) {
  const city = (client.city || '').toLowerCase().trim();
  const zip = (client.zip || '').trim().substring(0, 5);
  return city === 'atlantic beach' || zip === '32233';
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  // Get or create the Atlantic Beach tag
  let [tagRows] = await db.execute("SELECT id FROM tags WHERE name = 'Atlantic Beach' LIMIT 1");
  let tagId;

  if (tagRows.length === 0) {
    if (DRY_RUN) {
      console.log('[DRY RUN] Would create tag: Atlantic Beach (color: #0369a1)');
      tagId = -1;
    } else {
      const [result] = await db.execute(
        "INSERT INTO tags (name, color, createdAt) VALUES ('Atlantic Beach', '#0369a1', NOW())"
      );
      tagId = result.insertId;
      console.log(`Created tag "Atlantic Beach" with id=${tagId}`);
    }
  } else {
    tagId = tagRows[0].id;
    console.log(`Found existing tag "Atlantic Beach" with id=${tagId}`);
  }

  // Get all clients
  const [clients] = await db.execute(
    'SELECT id, name, addressLine1, city, zip FROM clients ORDER BY name'
  );

  const matches = clients.filter(isAtlanticBeach);
  console.log(`\nFound ${matches.length} Atlantic Beach clients:`);
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
  console.log(`\nDone. Added ${added} new tags. Total Atlantic Beach clients: ${total[0].cnt}`);

  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });
