import mysql from 'mysql2/promise';

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Comprehensive list of streets within The Plantation at Ponte Vedra Beach
// Sources: Compass, Florida Coastal Team, MLS listings, geographic.org
const PLANTATION_STREETS = [
  'plantation drive',
  'plantation circle',
  'plantation circle s',
  'plantation cir',
  'plantation cir s',
  'governors road',
  'governors rd',
  'surrey lane',
  'laurel lane',
  'laurel way',
  'meeting way',
  'regents place',
  'regents pl',
  'retreat place',
  '12 oaks lane',
  'twelve oaks lane',
  'muirfield drive',
  'muirfield dr',
  'middleton place',
  'planters row',
  'planters row e',
  'planters row w',
];

// 1. Create or find the "The Plantation" tag
const tagName = 'The Plantation';
const tagColor = '#1a5276'; // deep navy blue

let tagId;
const [existingTags] = await db.execute(
  'SELECT id FROM tags WHERE name = ? LIMIT 1',
  [tagName]
);

if (existingTags.length > 0) {
  tagId = existingTags[0].id;
  console.log(`Found existing tag: "${tagName}" (id=${tagId})`);
} else {
  const [result] = await db.execute(
    'INSERT INTO tags (name, color, createdAt) VALUES (?, ?, NOW())',
    [tagName, tagColor]
  );
  tagId = result.insertId;
  console.log(`Created tag: "${tagName}" (id=${tagId})`);
}

// 2. Find all clients whose addressLine1 matches any Plantation street
const [allClients] = await db.execute(
  'SELECT id, name, addressLine1, city FROM clients WHERE addressLine1 IS NOT NULL AND addressLine1 != ""'
);

const matchingClientIds = [];
for (const client of allClients) {
  const addr = (client.addressLine1 || '').toLowerCase().trim();
  const city = (client.city || '').toLowerCase().trim();
  
  // Must be in Ponte Vedra Beach (or Ponte Vedra) zip 32082
  if (!city.includes('ponte vedra')) continue;
  
  const isPlantation = PLANTATION_STREETS.some(street => addr.includes(street));
  if (isPlantation) {
    matchingClientIds.push(client.id);
    console.log(`  Match: ${client.name} — ${client.addressLine1}, ${client.city}`);
  }
}

console.log(`\nFound ${matchingClientIds.length} clients in The Plantation`);

// 3. Insert clientTags rows (skip duplicates)
let added = 0;
let skipped = 0;
for (const clientId of matchingClientIds) {
  const [existing] = await db.execute(
    'SELECT id FROM clientTags WHERE clientId = ? AND tagId = ? LIMIT 1',
    [clientId, tagId]
  );
  if (existing.length > 0) {
    skipped++;
    continue;
  }
  await db.execute(
    'INSERT INTO clientTags (clientId, tagId, createdAt) VALUES (?, ?, NOW())',
    [clientId, tagId]
  );
  added++;
}

console.log(`\nDone! Added ${added} new tags, skipped ${skipped} already tagged.`);
await db.end();
