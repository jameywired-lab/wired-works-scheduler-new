/**
 * sync-openphone-contacts.mjs
 * 
 * Fetches all contacts from the OpenPhone (Quo) phonebook,
 * then matches them against clients in the DB who are missing
 * phone numbers, and updates those clients with the found numbers.
 * 
 * Saves contacts to a cache file so it can resume if interrupted.
 * 
 * Run: node scripts/sync-openphone-contacts.mjs
 * Set DRY_RUN=1 to preview matches without writing to DB.
 * Set FETCH_ONLY=1 to only fetch and cache contacts (no DB update).
 * Set MATCH_ONLY=1 to skip fetching and use cached contacts file.
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, 'openphone-contacts-cache.json');

const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';
const FETCH_ONLY = process.env.FETCH_ONLY === '1';
const MATCH_ONLY = process.env.MATCH_ONLY === '1';

if (!OPENPHONE_API_KEY) {
  console.error('ERROR: OPENPHONE_API_KEY environment variable is not set.');
  process.exit(1);
}

// ─── 1. Fetch all OpenPhone contacts (paginated, with retry) ──────────────────

async function fetchPage(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: OPENPHONE_API_KEY },
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`OpenPhone API error (${res.status}):`, body);
        if (res.status === 429) {
          console.log('Rate limited, waiting 2 seconds...');
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        process.exit(1);
      }
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        console.log(`  Network error (attempt ${attempt}/${retries}), retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw err;
      }
    }
  }
}

async function fetchAllOpenPhoneContacts() {
  // Check if we have a cache file
  if (MATCH_ONLY && fs.existsSync(CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`Using cached contacts: ${cached.length} contacts from ${CACHE_FILE}`);
    return cached;
  }

  const contacts = [];
  let pageToken = null;
  let page = 1;

  // Load partial cache if it exists (for resuming)
  let startPageToken = null;
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (cached.partial && cached.contacts && cached.nextPageToken) {
        contacts.push(...cached.contacts);
        startPageToken = cached.nextPageToken;
        page = cached.page || 1;
        console.log(`Resuming from page ${page} with ${contacts.length} contacts already fetched...`);
      }
    } catch (e) {
      // ignore bad cache
    }
  }

  pageToken = startPageToken;

  console.log('Fetching OpenPhone contacts...');
  do {
    const url = new URL('https://api.openphone.com/v1/contacts');
    url.searchParams.set('maxResults', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const json = await fetchPage(url.toString());
    const batch = json.data || [];
    contacts.push(...batch);
    pageToken = json.nextPageToken || null;
    console.log(`  Page ${page}: fetched ${batch.length} contacts (total: ${contacts.length})`);
    page++;

    // Save partial progress every 10 pages
    if (page % 10 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify({
        partial: true,
        contacts,
        nextPageToken: pageToken,
        page,
        savedAt: new Date().toISOString(),
      }));
    }

    // Small delay to avoid rate limiting
    if (pageToken) await new Promise(r => setTimeout(r, 100));
  } while (pageToken);

  // Save final complete cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(contacts));
  console.log(`Total OpenPhone contacts fetched: ${contacts.length}`);
  console.log(`Saved to cache: ${CACHE_FILE}\n`);
  return contacts;
}

// ─── 2. Normalize helpers ─────────────────────────────────────────────────────

function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return phone;
}

// ─── 3. Build OpenPhone contact lookup map ────────────────────────────────────

function buildOpenPhoneMap(contacts) {
  const map = new Map();

  for (const contact of contacts) {
    const f = contact.defaultFields || {};
    const phones = (f.phoneNumbers || []).map(p => normalizePhone(p.value)).filter(Boolean);
    if (phones.length === 0) continue;

    const firstName = (f.firstName || '').trim();
    const lastName = (f.lastName || '').trim();
    const fullName = normalizeName(`${firstName} ${lastName}`);
    const lastFirst = normalizeName(`${lastName} ${firstName}`);

    if (fullName && !map.has(fullName)) {
      map.set(fullName, { phones, contact });
    }
    if (lastFirst && lastFirst !== fullName && !map.has(lastFirst)) {
      map.set(lastFirst, { phones, contact });
    }
  }

  return map;
}

// ─── 4. Main ──────────────────────────────────────────────────────────────────

if (FETCH_ONLY) {
  await fetchAllOpenPhoneContacts();
  console.log('FETCH_ONLY mode — done.');
  process.exit(0);
}

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Get all clients missing phone numbers
const [missingPhoneClients] = await db.execute(
  `SELECT id, name, email, addressLine1, city FROM clients 
   WHERE (phone IS NULL OR phone = '' OR phone = 'N/A')
   ORDER BY name`
);

console.log(`Clients missing phone numbers: ${missingPhoneClients.length}\n`);

// Fetch OpenPhone contacts
const openPhoneContacts = await fetchAllOpenPhoneContacts();
const opMap = buildOpenPhoneMap(openPhoneContacts);

console.log(`OpenPhone contacts with phone numbers: ${opMap.size}\n`);

// Match and update
const matches = [];
const noMatch = [];

for (const client of missingPhoneClients) {
  const normalizedClientName = normalizeName(client.name);
  
  let found = opMap.get(normalizedClientName);
  
  if (!found) {
    const parts = normalizedClientName.split(' ');
    if (parts.length >= 2) {
      const reversed = normalizeName(parts.slice(1).join(' ') + ' ' + parts[0]);
      found = opMap.get(reversed);
    }
  }

  if (found) {
    matches.push({
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientAddress: client.addressLine1,
      phone: found.phones[0],
      allPhones: found.phones,
    });
    console.log(`✓ MATCH: "${client.name}" → ${found.phones[0]}`);
    if (found.phones.length > 1) {
      console.log(`  (additional phones: ${found.phones.slice(1).join(', ')})`);
    }
  } else {
    noMatch.push(client);
  }
}

console.log(`\n─────────────────────────────────────────`);
console.log(`Matched: ${matches.length} clients`);
console.log(`No match: ${noMatch.length} clients`);
console.log(`─────────────────────────────────────────\n`);

if (DRY_RUN) {
  console.log('DRY RUN mode — no changes written to database.');
} else if (matches.length > 0) {
  console.log('Writing phone numbers to database...');
  let updated = 0;
  for (const m of matches) {
    await db.execute(
      'UPDATE clients SET phone = ? WHERE id = ?',
      [m.phone, m.clientId]
    );
    updated++;
  }
  console.log(`Done! Updated ${updated} clients with phone numbers from OpenPhone.`);
} else {
  console.log('No matches found — nothing to update.');
}

if (noMatch.length > 0) {
  console.log('\nClients still missing phone numbers (no OpenPhone match):');
  for (const c of noMatch) {
    console.log(`  - ${c.name}${c.email ? ' <' + c.email + '>' : ''}${c.addressLine1 ? ' | ' + c.addressLine1 : ''}`);
  }
}

await db.end();
