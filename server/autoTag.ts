/**
 * autoTag.ts
 *
 * Automatically assigns neighborhood tags to a client based on their address.
 * Called after client create or update.
 *
 * Rules:
 *  - "Ponte Vedra"    → city is "ponte vedra" or "ponte vedra beach"
 *  - "Amelia Island"  → city is "fernandina beach" OR zip is "32034"
 *  - "The Plantation" → city contains "ponte vedra" AND street matches Plantation streets
 *  - "Marsh Landing"  → city contains "ponte vedra" OR zip is "32082", AND street matches ML streets
 */

import { getDb } from "./db";
import { clientTags, tags } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Street lists ─────────────────────────────────────────────────────────────

const PLANTATION_STREETS = [
  "plantation drive",
  "plantation circle",
  "plantation circle s",
  "plantation cir",
  "plantation cir s",
  "governors road",
  "governors rd",
  "surrey lane",
  "laurel lane",
  "laurel way",
  "meeting way",
  "regents place",
  "regents pl",
  "retreat place",
  "12 oaks lane",
  "twelve oaks lane",
  "muirfield drive",
  "muirfield dr",
  "middleton place",
  "planters row",
  "planters row e",
  "planters row w",
  "laurel court",
  "surrey ln",
  "laurel ln",
  "retreat pl",
  "middleton pl",
  "regents pl",
  "12 oaks ln",
  "plantation circle south",
];

const SAWGRASS_CC_STREETS = [
  // Main roads
  "golf club drive",
  "golf club dr",
  "country club boulevard",
  "sawgrass island drive",
  "sawgrass corners drive",
  "sawgrass drive s",
  "sawgrass drive e",
  "sawgrass drive w",
  // Single-family neighborhoods
  "lake kathryn drive",
  "lighthouse bend drive",
  "lighthouse cove place",
  "ocean ridge court",
  "old barn road",
  "old barn court",
  "osprey pt",
  "osprey point",
  "osprey court",
  "osprey cove lane",
  "osprey nest court",
  "osprey lookout court",
  "osprey ridge way",
  "preston trl e",
  "preston trl w",
  "preston trail e",
  "preston trail w",
  "nine drive south",
  "south nine drive",
  "s nine drive",
  "nine lake circle",
  // Zero lot line neighborhoods
  "lake julia drive",
  "northgate drive",
  "sandpiper cove",
  "sandpiper court",
  "spy glass lane",
  "spyglass lane",
  "village walk circle",
  "village walk court",
  "village walk drive",
  "village walk lane",
  "walkers ridge drive",
  "walkers ridge court",
  "harbour club drive",
  // Condo neighborhoods
  "deer run drive",
  "deer run lane",
  "fishermans cove road",
  "little bay harbor drive",
  "little bay harbour drive",
  "quail pointe drive",
  "quail pointe court",
  "quail pointe lane",
  "quail cove",
  "tifton way",
  "willow pond lane",
  // Beach Club
  "spinnakers reach drive",
];

const MARSH_LANDING_STREETS = [
  // HOA I
  "arbor drive", "arbor lake lane", "arbor view court", "bent pine court",
  "cypress lagoon court", "deer trace drive", "greencrest drive", "heron lake way",
  "indian midden way", "lagoon forest drive", "marsh creek drive", "misty lake drive",
  "moss creek lane", "old still court", "royal lagoon court",
  // HOA II
  "alice way", "bentgrass circle", "cypress hollow court", "fairway oaks court",
  "founders way", "highlands court", "linkside circle", "marsh hawk court",
  "merganser drive", "oakbrook court", "oakmont court", "palm forest place",
  "st. andrews court", "st andrews court", "troon point lane", "turnberry pointe way",
  // HOA III
  "antler point court", "deer haven drive", "harbour view drive", "hidden cove lane",
  "indian cove lane", "indian hammock lane", "marsh reed lane", "three island court",
  // HOA IV
  "deer cove drive", "deer lake drive", "green heron way", "osprey cove lane", "osprey nest court",
  // HOA V
  "bridle way", "carriage lamp way",
  // HOA VI
  "club forest lane", "coach lamp way", "lamplighter lane", "lantern wick place",
  "marsh view court", "north wind court", "teal nest court", "teal pointe lane",
  // HOA VII
  "kingfisher drive", "osprey lookout court", "royal tern court", "royal tern road",
  "royal tern road n", "royal tern road s", "snowy egret court",
  // HOA VIII
  "great egret way", "hawks nest court", "ibis cove place",
  // Harbour Island
  "admirals way s", "admirals way", "annapolis lane", "bristol place", "cutter court",
  "harbour island court", "harbourmaster court", "newport lane",
  // Clearlake
  "clearlake drive", "keelers court", "turtle run court",
  // Main road
  "marsh landing pkwy", "marsh landing parkway", "marsh landing",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

/** Word-boundary street match — prevents "arbor drive" matching "harbor drive" */
function streetMatch(addr: string, street: string): boolean {
  const escaped = street.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s|\\d)${escaped}(\\s|$|,)`, "i").test(addr);
}

// ─── Tag rule evaluation ──────────────────────────────────────────────────────

interface ClientAddress {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

function getApplicableTags(client: ClientAddress): string[] {
  const city = norm(client.city);
  const zip = norm(client.zip);
  const addr = norm(client.addressLine1);
  const applicable: string[] = [];

  // Ponte Vedra
  if (city === "ponte vedra" || city === "ponte vedra beach") {
    applicable.push("Ponte Vedra");
  }

  // Amelia Island
  if (city.includes("fernandina beach") || zip === "32034") {
    applicable.push("Amelia Island");
  }

  // The Plantation (must be in PVB area + street match)
  if (city.includes("ponte vedra") || zip === "32082") {
    if (PLANTATION_STREETS.some(s => addr.includes(s))) {
      applicable.push("The Plantation");
    }
  }

  // Marsh Landing (must be in PVB area + word-boundary street match)
  if (city.includes("ponte vedra") || zip === "32082") {
    if (MARSH_LANDING_STREETS.some(s => streetMatch(addr, s))) {
      applicable.push("Marsh Landing");
    }
  }

  // Sawgrass CC (must be in PVB area + street match)
  if (city.includes("ponte vedra") || zip === "32082") {
    if (SAWGRASS_CC_STREETS.some(s => addr.includes(s))) {
      applicable.push("Sawgrass CC");
    }
  }

  // St. Augustine area
  const ST_AUG_CITIES = [
    "st. augustine", "st augustine", "saint augustine",
    "st. augustine beach", "st augustine beach", "saint augustine beach",
    "st. augustine shores", "st augustine shores",
    "st. johns", "st johns", "saint johns",
    "hastings", "elkton", "nocatee",
  ];
  const ST_AUG_ZIPS = ["32080", "32084", "32085", "32086", "32092", "32095", "32033", "32043", "32068"];
  const zipShort = zip.substring(0, 5);
  if (ST_AUG_CITIES.some(s => city === s || city.startsWith(s + " ")) || ST_AUG_ZIPS.includes(zipShort)) {
    applicable.push("St. Augustine");
  }

  return applicable;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Evaluates neighborhood tag rules for the given client address fields
 * and inserts any missing tag assignments. Safe to call on create or update.
 *
 * On update, also removes neighborhood tags that no longer apply
 * (e.g., if the address was changed to a different city).
 */
export async function autoTagClient(
  clientId: number,
  client: ClientAddress,
  isUpdate = false
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // All neighborhood tag names we manage
  const NEIGHBORHOOD_TAG_NAMES = ["Ponte Vedra", "Amelia Island", "The Plantation", "Marsh Landing", "Sawgrass CC", "St. Augustine"];

  // Fetch tag IDs for all neighborhood tags (create if missing)
  const tagIds: Record<string, number> = {};
  const tagColors: Record<string, string> = {
    "Ponte Vedra": "#6366f1",
    "Amelia Island": "#14b8a6",
    "The Plantation": "#1a5276",
    "Marsh Landing": "#2e7d32",
    "Sawgrass CC": "#1565c0",
    "St. Augustine": "#b45309",
  };

  for (const tagName of NEIGHBORHOOD_TAG_NAMES) {
    const existing = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, tagName))
      .limit(1);

    if (existing.length > 0) {
      tagIds[tagName] = existing[0].id;
    } else {
      const result = await db
        .insert(tags)
        .values({ name: tagName, color: tagColors[tagName] ?? "#6366f1" });
      tagIds[tagName] = (result[0] as any).insertId;
    }
  }

  const applicable = getApplicableTags(client);

  // On update: remove neighborhood tags that no longer apply
  if (isUpdate) {
    for (const tagName of NEIGHBORHOOD_TAG_NAMES) {
      if (!applicable.includes(tagName)) {
        const tagId = tagIds[tagName];
        if (tagId) {
          await db
            .delete(clientTags)
            .where(and(eq(clientTags.clientId, clientId), eq(clientTags.tagId, tagId)));
        }
      }
    }
  }

  // Add tags that apply and aren't already assigned
  for (const tagName of applicable) {
    const tagId = tagIds[tagName];
    if (!tagId) continue;

    const existing = await db
      .select({ id: clientTags.id })
      .from(clientTags)
      .where(and(eq(clientTags.clientId, clientId), eq(clientTags.tagId, tagId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(clientTags).values({ clientId, tagId });
    }
  }
}
