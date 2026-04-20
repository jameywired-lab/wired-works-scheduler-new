/**
 * Tag all clients in the St. Augustine area with "St. Augustine"
 *
 * Matching rules:
 * - City name contains "st. augustine", "st augustine", "saint augustine",
 *   "st. johns", "st johns", "nocatee", "hastings", "elkton"
 * - OR zip code is a St. Augustine area zip (excluding 32082 = Ponte Vedra Beach)
 */

import mysql from 'mysql2/promise';

const DRY_RUN = process.env.DRY_RUN === '1';

const ST_AUG_CITIES = [
  'st. augustine',
  'st augustine',
  'saint augustine',
  'st. augustine beach',
  'st augustine beach',
  'saint augustine beach',
  'st. augustine shores',
  'st augustine shores',
  'saint augustine shores',
  'st. johns',
  'st johns',
  'saint johns',
  'hastings',
  'elkton',
  'nocatee',
];

// St. Augustine / St. Johns County zips (excluding 32082 = Ponte Vedra Beach which has its own tag)
const ST_AUG_ZIPS = ['32080', '32084', '32085', '32086', '32092', '32095', '32033', '32043', '32068'];

function isStAugustine(client) {
  const city = (client.city || '').toLowerCase().trim();
  const zip = (client.zip || '').trim().substring(0, 5);
  const cityMatch = ST_AUG_CITIES.some(s => city === s || city.startsWith(s + ' '));
  const zipMatch = ST_AUG_ZIPS.includes(zip);
  return cityMatch || zipMatch;
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  // Get or create the St. Augustine tag
  let [tagRows] = await db.execute("SELECT id FROM tags WHERE name = 'St. Augustine' LIMIT 1");
  let tagId;

  if (tagRows.length === 0) {
    if (DRY_RUN) {
      console.log('[DRY RUN] Would create tag: St. Augustine (color: #b45309)');
      tagId = -1;
    } else {
      const [result] = await db.execute(
        "INSERT INTO tags (name, color, createdAt) VALUES ('St. Augustine', '#b45309', NOW())"
      );
      tagId = result.insertId;
      console.log(`Created tag "St. Augustine" with id=${tagId}`);
    }
  } else {
    tagId = tagRows[0].id;
    console.log(`Found existing tag "St. Augustine" with id=${tagId}`);
  }

  // Get all clients
  const [clients] = await db.execute(
    'SELECT id, name, addressLine1, city, zip FROM clients ORDER BY city, name'
  );

  const matches = clients.filter(isStAugustine);
  console.log(`\nFound ${matches.length} St. Augustine area clients:`);
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
  console.log(`\nDone. Added ${added} new tags. Total St. Augustine clients: ${total[0].cnt}`);

  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });
