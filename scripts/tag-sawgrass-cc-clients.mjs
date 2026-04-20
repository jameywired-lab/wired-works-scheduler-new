/**
 * Tag all clients in Sawgrass Country Club (Ponte Vedra Beach) with "Sawgrass CC"
 *
 * Sawgrass Country Club sub-neighborhoods and their streets (from sawgrasscommunity.com
 * and geographic.org/streetview for Ponte Vedra Beach 32082):
 *
 * Single-family:
 *   Kathryn Oaks / Lake Kathryn → Lake Kathryn Drive
 *   Lighthouse Bend             → Lighthouse Bend Drive, Lighthouse Cove Place
 *   Long Cove                   → Long Pond Place (Long Cove area)
 *   Ocean Ridge                 → Ocean Ridge Court
 *   Old Barn Island             → Old Barn Road, Old Barn Road E/W, Old Barn Court
 *   Osprey Point                → Osprey Pt, Osprey Court, Osprey Cove Lane, Osprey Nest Court
 *   Preston Trail               → Preston Trl E, Preston Trl W
 *   The Preserve                → (uses Golf Club Drive area)
 *   Sawgrass Drive South        → Sawgrass Drive S, Sawgrass Drive E, Sawgrass Drive W
 *   South Nine Drive            → Nine Drive South, South Nine Drive
 *
 * Zero lot line:
 *   Club Cove                   → (Golf Club Drive area)
 *   Lake Julia Drive            → Lake Julia Drive N, Lake Julia Drive S
 *   Northgate                   → Northgate Drive
 *   Sandpiper Cove              → Sandpiper Cove, Sandpiper Court
 *   Spyglass Point              → Spy Glass Lane
 *   Village Walk                → Village Walk Circle, Village Walk Court, Village Walk Drive, Village Walk Lane
 *   Walkers Ridge               → Walkers Ridge Drive, Walkers Ridge Court
 *   Harbour Club                → Harbour Club Drive
 *
 * Condominiums:
 *   Deer Run                    → Deer Run Drive, Deer Run Drive S, Deer Run Lane
 *   Fisherman's Cove            → Fishermans Cove Road
 *   Little Bay Harbour          → Little Bay Harbor Drive
 *   Quail Point                 → Quail Pointe Drive, Quail Pointe Court, Quail Pointe Lane, Quail Cove
 *   Rough Creek Villas          → (Golf Club Drive area)
 *   Tifton Cove                 → Tifton Way N, Tifton Way S
 *   Willow Pond                 → Willow Pond Lane
 *
 * Beach Club (east of Ponte Vedra Blvd):
 *   Spinnakers Reach            → Spinnakers Reach Drive
 *
 * Main entrance / internal roads:
 *   Golf Club Drive             → Golf Club Drive
 *   Country Club Boulevard      → Country Club Boulevard
 *   Sawgrass Island Drive       → Sawgrass Island Drive
 *   Sawgrass Corners Drive      → Sawgrass Corners Drive
 */

import mysql from 'mysql2/promise';

const DRY_RUN = process.env.DRY_RUN === '1';

// All streets that are exclusively or predominantly within Sawgrass Country Club
// Using word-boundary safe matching (full street name substrings)
const SAWGRASS_CC_STREETS = [
  // Main roads
  'golf club drive',
  'golf club dr',
  'country club boulevard',
  'country club blvd',
  'sawgrass island drive',
  'sawgrass corners drive',
  'sawgrass drive s',
  'sawgrass drive e',
  'sawgrass drive w',

  // Single-family neighborhoods
  'lake kathryn drive',
  'lighthouse bend drive',
  'lighthouse cove place',
  'ocean ridge court',
  'old barn road',
  'old barn court',
  'osprey pt',
  'osprey point',
  'osprey court',
  'osprey cove lane',
  'osprey nest court',
  'osprey lookout court',
  'osprey ridge way',
  'preston trl e',
  'preston trl w',
  'preston trail e',
  'preston trail w',
  'nine drive south',
  'south nine drive',
  's nine drive',
  'nine lake circle',
  's nine lake circle',

  // Zero lot line neighborhoods
  'lake julia drive',
  'northgate drive',
  'sandpiper cove',
  'sandpiper court',
  'spy glass lane',
  'spyglass lane',
  'village walk circle',
  'village walk court',
  'village walk drive',
  'village walk lane',
  'walkers ridge drive',
  'walkers ridge court',
  'harbour club drive',

  // Condo neighborhoods
  'deer run drive',
  'deer run lane',
  'fishermans cove road',
  "fisherman's cove road",
  'little bay harbor drive',
  'little bay harbour drive',
  'quail pointe drive',
  'quail pointe court',
  'quail pointe lane',
  'quail cove',
  'tifton way',
  'willow pond lane',

  // Beach Club
  'spinnakers reach drive',
];

// City/zip qualifiers for Sawgrass CC (all in 32082)
const SAWGRASS_CITIES = ['ponte vedra beach', 'ponte vedra'];
const SAWGRASS_ZIP = '32082';

function normalizeStreet(s) {
  return (s || '').toLowerCase().replace(/[.,]/g, '').trim();
}

function isInSawgrassCC(client) {
  const city = (client.city || '').toLowerCase().trim();
  const zip = (client.zip || '').trim();
  const addr = normalizeStreet(client.addressLine1);

  // Must be in PVB area
  const inArea = SAWGRASS_CITIES.includes(city) || zip === SAWGRASS_ZIP;
  if (!inArea) return false;

  // Check street match using word-boundary approach
  return SAWGRASS_CC_STREETS.some(street => {
    const escaped = street.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|\\d)${escaped}(?:\\s|$|,)`, 'i');
    return regex.test(addr) || addr.includes(street);
  });
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  // Get or create the Sawgrass CC tag
  let [tagRows] = await db.execute("SELECT id FROM tags WHERE name = 'Sawgrass CC' LIMIT 1");
  let tagId;

  if (tagRows.length === 0) {
    if (DRY_RUN) {
      console.log('[DRY RUN] Would create tag: Sawgrass CC (color: #1565c0)');
      tagId = -1;
    } else {
      const [result] = await db.execute(
        "INSERT INTO tags (name, color, createdAt) VALUES ('Sawgrass CC', '#1565c0', NOW())"
      );
      tagId = result.insertId;
      console.log(`Created tag "Sawgrass CC" with id=${tagId}`);
    }
  } else {
    tagId = tagRows[0].id;
    console.log(`Found existing tag "Sawgrass CC" with id=${tagId}`);
  }

  // Get all PVB-area clients
  const [clients] = await db.execute(
    `SELECT id, name, addressLine1, city, zip FROM clients
     WHERE (LOWER(TRIM(city)) IN ('ponte vedra', 'ponte vedra beach') OR zip = '32082')
       AND addressLine1 IS NOT NULL AND addressLine1 != ''`
  );

  console.log(`Checking ${clients.length} PVB-area clients...`);

  const matches = clients.filter(isInSawgrassCC);
  console.log(`Found ${matches.length} Sawgrass CC matches`);

  if (DRY_RUN) {
    matches.forEach(c => console.log(`  [MATCH] ${c.name} | ${c.addressLine1}, ${c.city}`));
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
      console.log(`  Tagged: ${c.name} | ${c.addressLine1}`);
    }
  }

  const [total] = await db.execute(
    'SELECT COUNT(*) as cnt FROM clientTags WHERE tagId = ?', [tagId]
  );
  console.log(`\nDone. Added ${added} new tags. Total Sawgrass CC clients: ${total[0].cnt}`);

  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });
