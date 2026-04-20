import mysql from 'mysql2/promise';

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Comprehensive list of streets within Marsh Landing Country Club gated community
// Source: https://www.marshlandinghoa.com/info.php?pnum=46194190748e6c (official HOA "Which is my HOA?" page)
// All 10 sub-associations + Harbour Island + Clearlake Association
const MARSH_LANDING_STREETS = [
  // HOA I
  'arbor drive',
  'arbor lake lane',
  'arbor view court',
  'bent pine court',
  'cypress lagoon court',
  'deer trace drive',
  'greencrest drive',
  'heron lake way',
  'indian midden way',
  'lagoon forest drive',
  'marsh creek drive',
  'misty lake drive',
  'moss creek lane',
  'old still court',
  'royal lagoon court',

  // HOA II
  'alice way',
  'bentgrass circle',
  'cypress hollow court',
  'fairway oaks court',
  'founders way',
  'highlands court',
  'linkside circle',
  'marsh hawk court',
  'merganser drive',
  'oakbrook court',
  'oakmont court',
  'palm forest place',
  'st. andrews court',
  'st andrews court',
  'troon point lane',
  'turnberry pointe way',

  // HOA III
  'antler point court',
  'deer haven drive',
  'harbour view drive',
  'hidden cove lane',
  'indian cove lane',
  'indian hammock lane',
  'marsh reed lane',
  'three island court',

  // HOA IV
  'deer cove drive',
  'deer lake drive',
  'green heron way',
  'osprey cove lane',
  'osprey nest court',

  // HOA V (Marsh Pointe)
  'bridle way',
  'carriage lamp way',

  // HOA VI
  'club forest lane',
  'coach lamp way',
  'lamplighter lane',
  'lantern wick place',
  'marsh view court',
  'north wind court',
  'teal nest court',
  'teal pointe lane',

  // HOA VII
  'kingfisher drive',
  'osprey lookout court',
  'royal tern court',
  'royal tern road',
  'royal tern road n',
  'royal tern road s',
  'snowy egret court',

  // HOA VIII (North Island)
  'great egret way',
  'hawks nest court',
  'ibis cove place',

  // Harbour Island
  'admirals way s',
  'admirals way',
  'annapolis lane',
  'bristol place',
  'cutter court',
  'harbour island court',
  'harbourmaster court',
  'newport lane',

  // Clearlake Association
  'clearlake drive',
  'keelers court',
  'turtle run court',

  // Main road (appears in all HOAs)
  'marsh landing pkwy',
  'marsh landing parkway',
  'marsh landing',
];

// Word-boundary match: street name must appear as a standalone word sequence in address
// Prevents "arbor drive" from matching "harbor drive"
function matchesWordBoundary(addr, street) {
  const escaped = street.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|\\s|\\d)' + escaped + '(\\s|$|,)', 'i');
  return re.test(addr);
}

// 1. Create or find the "Marsh Landing" tag
const tagName = 'Marsh Landing';
const tagColor = '#2e7d32'; // deep green (marsh/nature theme)

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

// 2. Find all clients whose addressLine1 matches any Marsh Landing street
const [allClients] = await db.execute(
  'SELECT id, name, addressLine1, city, state, zip FROM clients WHERE addressLine1 IS NOT NULL AND addressLine1 != ""'
);

const matchingClients = [];
for (const client of allClients) {
  const addr = (client.addressLine1 || '').toLowerCase().trim();
  const city = (client.city || '').toLowerCase().trim();
  const zip = (client.zip || '').trim();

  // Must be in Ponte Vedra Beach area (city or zip)
  const isPVB = city.includes('ponte vedra') || zip === '32082';
  if (!isPVB) continue;

  const isMarshLanding = MARSH_LANDING_STREETS.some(street => matchesWordBoundary(addr, street));
  if (isMarshLanding) {
    matchingClients.push(client);
    console.log(`  Match: ${client.name} — ${client.addressLine1}, ${client.city} ${client.zip}`);
  }
}

console.log(`\nFound ${matchingClients.length} clients in Marsh Landing`);

// 3. Insert clientTags rows (skip duplicates)
let added = 0;
let skipped = 0;
for (const client of matchingClients) {
  const [existing] = await db.execute(
    'SELECT id FROM clientTags WHERE clientId = ? AND tagId = ? LIMIT 1',
    [client.id, tagId]
  );
  if (existing.length > 0) {
    skipped++;
    continue;
  }
  await db.execute(
    'INSERT INTO clientTags (clientId, tagId, createdAt) VALUES (?, ?, NOW())',
    [client.id, tagId]
  );
  added++;
}

console.log(`\nDone! Added ${added} new tags, skipped ${skipped} already tagged.`);
await db.end();
