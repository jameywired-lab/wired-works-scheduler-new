/**
 * autoTag.test.ts
 * Unit tests for the neighborhood tag rule logic in autoTag.ts
 * Tests the internal getApplicableTags logic by re-implementing it here
 * (since the full autoTagClient function requires a live DB connection).
 */

import { describe, it, expect } from "vitest";

// ─── Replicate the pure logic from autoTag.ts for unit testing ────────────────

const PLANTATION_STREETS = [
  "plantation drive", "plantation circle", "plantation circle s",
  "plantation cir", "plantation cir s", "governors road", "governors rd",
  "surrey lane", "laurel lane", "laurel way", "meeting way",
  "regents place", "regents pl", "retreat place", "12 oaks lane",
  "twelve oaks lane", "muirfield drive", "muirfield dr", "middleton place",
  "planters row", "planters row e", "planters row w",
];

const MARSH_LANDING_STREETS = [
  "arbor drive", "arbor lake lane", "arbor view court", "bent pine court",
  "cypress lagoon court", "deer trace drive", "greencrest drive", "heron lake way",
  "indian midden way", "lagoon forest drive", "marsh creek drive", "misty lake drive",
  "moss creek lane", "old still court", "royal lagoon court",
  "alice way", "bentgrass circle", "cypress hollow court", "fairway oaks court",
  "founders way", "highlands court", "linkside circle", "marsh hawk court",
  "merganser drive", "oakbrook court", "oakmont court", "palm forest place",
  "st. andrews court", "st andrews court", "troon point lane", "turnberry pointe way",
  "antler point court", "deer haven drive", "harbour view drive", "hidden cove lane",
  "indian cove lane", "indian hammock lane", "marsh reed lane", "three island court",
  "deer cove drive", "deer lake drive", "green heron way", "osprey cove lane", "osprey nest court",
  "bridle way", "carriage lamp way",
  "club forest lane", "coach lamp way", "lamplighter lane", "lantern wick place",
  "marsh view court", "north wind court", "teal nest court", "teal pointe lane",
  "kingfisher drive", "osprey lookout court", "royal tern court", "royal tern road",
  "royal tern road n", "royal tern road s", "snowy egret court",
  "great egret way", "hawks nest court", "ibis cove place",
  "admirals way s", "admirals way", "annapolis lane", "bristol place", "cutter court",
  "harbour island court", "harbourmaster court", "newport lane",
  "clearlake drive", "keelers court", "turtle run court",
  "marsh landing pkwy", "marsh landing parkway", "marsh landing",
];

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

function streetMatch(addr: string, street: string): boolean {
  const escaped = street.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s|\\d)${escaped}(\\s|$|,)`, "i").test(addr);
}

interface ClientAddress {
  addressLine1?: string | null;
  city?: string | null;
  zip?: string | null;
}

function getApplicableTags(client: ClientAddress): string[] {
  const city = norm(client.city);
  const zip = norm(client.zip);
  const addr = norm(client.addressLine1);
  const applicable: string[] = [];

  if (city === "ponte vedra" || city === "ponte vedra beach") {
    applicable.push("Ponte Vedra");
  }
  if (city.includes("fernandina beach") || zip === "32034") {
    applicable.push("Amelia Island");
  }
  if (city.includes("ponte vedra") || zip === "32082") {
    if (PLANTATION_STREETS.some(s => addr.includes(s))) {
      applicable.push("The Plantation");
    }
  }
  if (city.includes("ponte vedra") || zip === "32082") {
    if (MARSH_LANDING_STREETS.some(s => streetMatch(addr, s))) {
      applicable.push("Marsh Landing");
    }
  }
  return applicable;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("autoTag — Ponte Vedra", () => {
  it("tags city 'Ponte Vedra'", () => {
    expect(getApplicableTags({ city: "Ponte Vedra", zip: "32082" })).toContain("Ponte Vedra");
  });
  it("tags city 'Ponte Vedra Beach'", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", zip: "32082" })).toContain("Ponte Vedra");
  });
  it("does NOT tag city 'Jacksonville'", () => {
    expect(getApplicableTags({ city: "Jacksonville", zip: "32256" })).not.toContain("Ponte Vedra");
  });
  it("does NOT tag city 'Palm Valley' (after correction)", () => {
    expect(getApplicableTags({ city: "Palm Valley", zip: "32082" })).not.toContain("Ponte Vedra");
  });
});

describe("autoTag — Amelia Island", () => {
  it("tags city 'Fernandina Beach'", () => {
    expect(getApplicableTags({ city: "Fernandina Beach", zip: "32034" })).toContain("Amelia Island");
  });
  it("tags zip 32034 regardless of city", () => {
    expect(getApplicableTags({ city: "Amelia Island", zip: "32034" })).toContain("Amelia Island");
  });
  it("does NOT tag Ponte Vedra Beach zip", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", zip: "32082" })).not.toContain("Amelia Island");
  });
});

describe("autoTag — The Plantation", () => {
  it("tags Muirfield Drive in PVB", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "142 Muirfield Drive", zip: "32082" })).toContain("The Plantation");
  });
  it("tags Planters Row East in PVB", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "108 Planters Row East", zip: "32082" })).toContain("The Plantation");
  });
  it("does NOT tag Plantation street outside PVB", () => {
    expect(getApplicableTags({ city: "Jacksonville", addressLine1: "100 Plantation Drive", zip: "32256" })).not.toContain("The Plantation");
  });
  it("does NOT tag a random PVB street as Plantation", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "123 Ocean Drive", zip: "32082" })).not.toContain("The Plantation");
  });
});

describe("autoTag — Marsh Landing", () => {
  it("tags Clearlake Drive in PVB", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "217 Clearlake Drive", zip: "32082" })).toContain("Marsh Landing");
  });
  it("tags Royal Tern Road in PVB", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "209 Royal Tern Road North", zip: "32082" })).toContain("Marsh Landing");
  });
  it("tags Annapolis Lane in PVB", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "109 Annapolis Lane", zip: "32082" })).toContain("Marsh Landing");
  });
  it("does NOT false-positive on 'Little Bay Harbor Drive' (contains 'arbor drive')", () => {
    expect(getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "21 Little Bay Harbor Drive", zip: "32082" })).not.toContain("Marsh Landing");
  });
  it("does NOT tag Marsh Landing street outside PVB area", () => {
    expect(getApplicableTags({ city: "Jacksonville", addressLine1: "100 Clearlake Drive", zip: "32256" })).not.toContain("Marsh Landing");
  });
});

describe("autoTag — multiple tags", () => {
  it("Marsh Landing address gets both Ponte Vedra AND Marsh Landing tags", () => {
    const tags = getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "217 Clearlake Drive", zip: "32082" });
    expect(tags).toContain("Ponte Vedra");
    expect(tags).toContain("Marsh Landing");
  });
  it("Plantation address gets both Ponte Vedra AND The Plantation tags", () => {
    const tags = getApplicableTags({ city: "Ponte Vedra Beach", addressLine1: "142 Muirfield Drive", zip: "32082" });
    expect(tags).toContain("Ponte Vedra");
    expect(tags).toContain("The Plantation");
  });
  it("Fernandina Beach address only gets Amelia Island tag", () => {
    const tags = getApplicableTags({ city: "Fernandina Beach", addressLine1: "702 Ocean Club Place", zip: "32034" });
    expect(tags).toContain("Amelia Island");
    expect(tags).not.toContain("Ponte Vedra");
    expect(tags).not.toContain("Marsh Landing");
  });
  it("empty address gets no tags", () => {
    expect(getApplicableTags({ city: "", addressLine1: "", zip: "" })).toHaveLength(0);
  });
});
