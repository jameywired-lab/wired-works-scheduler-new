import { describe, expect, it } from "vitest";

/**
 * Tests for the CSV import helpers.
 * We test the row-mapping logic and column detection patterns
 * without requiring a live database connection.
 */

// ── Replicate the helpers from import.ts for unit testing ──────────────────

function normalizePhone(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k]?.trim();
    if (val) return val;
  }
  return "";
}

function autoDetectClientMapping(headers: string[]): Record<string, string> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx !== -1) return headers[idx];
    }
    return "";
  };
  return {
    name: find("full name", "name", "client name", "customer name", "contact name"),
    phone: find("phone", "mobile", "cell", "telephone"),
    email: find("email", "e-mail", "mail"),
    addressLine1: find("address 1", "address1", "street", "address line 1", "billing street"),
    city: find("city", "billing city"),
    state: find("state", "province", "billing state"),
    zip: find("zip", "postal", "billing zip"),
  };
}

// ──────────────────────────────────────────────────────────────────────────

describe("normalizePhone", () => {
  it("strips formatting characters", () => {
    expect(normalizePhone("(904) 555-0101")).toBe("9045550101");
  });

  it("strips country code 1", () => {
    expect(normalizePhone("+19045550101")).toBe("9045550101");
  });

  it("returns empty string for undefined", () => {
    expect(normalizePhone(undefined)).toBe("");
  });

  it("handles already-clean numbers", () => {
    expect(normalizePhone("9045550101")).toBe("9045550101");
  });
});

describe("pick", () => {
  const row = { Name: "Jane", Phone: "555-1234", "Customer Name": "Bob" };

  it("picks the first matching key", () => {
    expect(pick(row, "Name")).toBe("Jane");
  });

  it("falls through to the next key when first is missing", () => {
    expect(pick(row, "Missing", "Phone")).toBe("555-1234");
  });

  it("returns empty string when no key matches", () => {
    expect(pick(row, "Email", "Address")).toBe("");
  });
});

describe("autoDetectClientMapping", () => {
  it("detects Jobber-style headers", () => {
    const headers = [
      "Name",
      "Phone",
      "Email",
      "Billing Street",
      "Billing City",
      "Billing State",
      "Billing Zip",
    ];
    const mapping = autoDetectClientMapping(headers);
    expect(mapping.name).toBe("Name");
    expect(mapping.phone).toBe("Phone");
    expect(mapping.email).toBe("Email");
    expect(mapping.addressLine1).toBe("Billing Street");
    expect(mapping.city).toBe("Billing City");
    expect(mapping.state).toBe("Billing State");
    expect(mapping.zip).toBe("Billing Zip");
  });

  it("detects QuickBooks-style headers", () => {
    const headers = [
      "Customer Name",
      "Phone",
      "Email",
      "Billing Street",
      "Billing City",
      "Billing State",
      "Billing Zip",
    ];
    const mapping = autoDetectClientMapping(headers);
    expect(mapping.name).toBe("Customer Name");
  });

  it("detects generic CSV headers", () => {
    const headers = ["Full Name", "Mobile", "E-mail", "Address Line 1", "City", "State", "ZIP"];
    const mapping = autoDetectClientMapping(headers);
    expect(mapping.name).toBe("Full Name");
    expect(mapping.phone).toBe("Mobile");
    expect(mapping.email).toBe("E-mail");
    expect(mapping.addressLine1).toBe("Address Line 1");
  });

  it("returns empty string for unrecognized headers", () => {
    const mapping = autoDetectClientMapping(["Col1", "Col2", "Col3"]);
    expect(mapping.name).toBe("");
    expect(mapping.phone).toBe("");
  });
});

describe("CSV row filtering", () => {
  it("filters out rows with empty name", () => {
    const rows = [
      { name: "Jane Smith", phone: "9045550101" },
      { name: "", phone: "9045550202" },
      { name: "  ", phone: "9045550303" },
    ];
    const valid = rows.filter((r) => r.name.trim().length > 0);
    expect(valid).toHaveLength(1);
    expect(valid[0].name).toBe("Jane Smith");
  });
});
