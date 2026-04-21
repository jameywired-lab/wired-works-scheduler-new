import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "./_core/localAuth";

describe("localAuth", () => {
  it("hashes and verifies a password correctly", async () => {
    const hash = await hashPassword("MySecurePass123!");
    expect(hash).not.toBe("MySecurePass123!");
    expect(await verifyPassword("MySecurePass123!", hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });

  it("creates and verifies a session token", async () => {
    const token = await createSessionToken("user-abc-123", "Jane Doe");
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // JWT has 3 parts

    const result = await verifySessionToken(token);
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("user-abc-123");
    expect(result?.name).toBe("Jane Doe");
  });

  it("returns null for an invalid token", async () => {
    const result = await verifySessionToken("not.a.valid.jwt");
    expect(result).toBeNull();
  });

  it("returns null for a null/undefined token", async () => {
    expect(await verifySessionToken(null)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });
});
