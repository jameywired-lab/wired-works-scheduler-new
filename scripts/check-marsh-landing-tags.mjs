import mysql from 'mysql2/promise';

const db = await mysql.createConnection(process.env.DATABASE_URL);

const streets = [
  'arbor drive', 'arbor lake lane', 'arbor view court', 'bent pine court', 'cypress lagoon court',
  'deer trace drive', 'greencrest drive', 'heron lake way', 'indian midden way', 'lagoon forest drive',
  'marsh creek drive', 'misty lake drive', 'moss creek lane', 'old still court', 'royal lagoon court',
  'alice way', 'bentgrass circle', 'cypress hollow court', 'fairway oaks court', 'founders way',
  'highlands court', 'linkside circle', 'marsh hawk court', 'merganser drive', 'oakbrook court',
  'oakmont court', 'palm forest place', 'st. andrews court', 'st andrews court', 'troon point lane',
  'turnberry pointe way', 'antler point court', 'deer haven drive', 'harbour view drive',
  'hidden cove lane', 'indian cove lane', 'indian hammock lane', 'marsh reed lane', 'three island court',
  'deer cove drive', 'deer lake drive', 'green heron way', 'osprey cove lane', 'osprey nest court',
  'bridle way', 'carriage lamp way', 'club forest lane', 'coach lamp way', 'lamplighter lane',
  'lantern wick place', 'marsh view court', 'north wind court', 'teal nest court', 'teal pointe lane',
  'kingfisher drive', 'osprey lookout court', 'royal tern court', 'royal tern road', 'royal tern road n',
  'royal tern road s', 'snowy egret court', 'great egret way', 'hawks nest court', 'ibis cove place',
  'admirals way s', 'admirals way', 'annapolis lane', 'bristol place', 'cutter court',
  'harbour island court', 'harbourmaster court', 'newport lane', 'clearlake drive', 'keelers court',
  'turtle run court', 'marsh landing pkwy', 'marsh landing parkway', 'marsh landing',
];

// Get the Marsh Landing tag ID
const [tags] = await db.execute('SELECT id FROM tags WHERE name = ? LIMIT 1', ['Marsh Landing']);
const tagId = tags[0].id;
console.log('Tag ID:', tagId);

// Get all clients currently tagged with Marsh Landing
const [tagged] = await db.execute(
  'SELECT c.id, c.name, c.addressLine1, c.city, c.zip FROM clients c JOIN clientTags ct ON c.id = ct.clientId WHERE ct.tagId = ?',
  [tagId]
);

// Word-boundary match: street name must appear as a standalone word sequence in address
function matchesWordBoundary(addr, street) {
  const escaped = street.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match street name preceded by start/space/digit and followed by end/space/comma
  const re = new RegExp('(^|\\s|\\d)' + escaped + '(\\s|$|,)', 'i');
  return re.test(addr);
}

console.log('\nChecking all tagged clients for false positives:');
const falsePositives = [];
for (const client of tagged) {
  const addr = (client.addressLine1 || '').toLowerCase().trim();
  const simpleMatches = streets.filter(s => addr.includes(s));
  const wbMatches = streets.filter(s => matchesWordBoundary(addr, s));
  
  if (wbMatches.length === 0) {
    falsePositives.push(client);
    console.log('FALSE POSITIVE:', client.name, '-', client.addressLine1);
    console.log('  Simple match:', simpleMatches);
    console.log('  WB match: none');
  } else if (simpleMatches.length !== wbMatches.length) {
    console.log('NOTE (still valid):', client.name, '-', client.addressLine1);
    console.log('  Simple match:', simpleMatches);
    console.log('  WB match:', wbMatches);
  }
}

if (falsePositives.length === 0) {
  console.log('\nNo false positives found. All tags look correct!');
} else {
  console.log(`\nFound ${falsePositives.length} false positive(s). Removing...`);
  for (const client of falsePositives) {
    await db.execute(
      'DELETE FROM clientTags WHERE clientId = ? AND tagId = ?',
      [client.id, tagId]
    );
    console.log(`  Removed tag from: ${client.name} (${client.addressLine1})`);
  }
  console.log('Done removing false positives.');
}

await db.end();
