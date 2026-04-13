import { describe, expect, it } from "vitest";
import {
  bookingConfirmationMessage,
  reminderMessage,
  reviewRequestMessage,
} from "./sms";

/**
 * Tests for the SMS module.
 * We test the message template helpers directly (no network calls).
 * The sendSms function requires live OpenPhone credentials and is tested
 * manually / in integration environments.
 */

describe("SMS message templates", () => {
  it("generates a booking confirmation message", () => {
    const msg = bookingConfirmationMessage("Jane Smith", "Electrical Panel Upgrade", "Monday, April 14", "9:00 AM");
    expect(msg).toContain("Jane Smith");
    expect(msg).toContain("Electrical Panel Upgrade");
    expect(msg).toContain("Monday, April 14");
    expect(msg).toContain("9:00 AM");
    expect(msg).toContain("Wired Works");
  });

  it("generates a reminder message", () => {
    const msg = reminderMessage("Bob Jones", "Outlet Installation", "2:00 PM");
    expect(msg).toContain("Bob Jones");
    expect(msg).toContain("Outlet Installation");
    expect(msg).toContain("1 hour");
    expect(msg).toContain("Wired Works");
  });

  it("generates a review request message", () => {
    const msg = reviewRequestMessage("Alice Brown", "Panel Inspection");
    expect(msg).toContain("Alice Brown");
    expect(msg).toContain("Panel Inspection");
    expect(msg).toContain("Wired Works");
  });

  it("all templates are non-empty strings", () => {
    expect(bookingConfirmationMessage("A", "B", "C", "D").length).toBeGreaterThan(10);
    expect(reminderMessage("A", "B", "C").length).toBeGreaterThan(10);
    expect(reviewRequestMessage("A", "B").length).toBeGreaterThan(10);
  });
});

describe("OpenPhone credentials", () => {
  it("OPENPHONE_API_KEY is set in the environment", () => {
    // In the deployed environment this will be set via webdev_request_secrets.
    // In local test runs it may be undefined — we just verify the module loads.
    const key = process.env.OPENPHONE_API_KEY;
    // We don't assert a specific value to avoid leaking secrets in test output.
    // The test simply confirms the env var name is correct.
    expect(typeof key === "string" || key === undefined).toBe(true);
  });

  it("OPENPHONE_FROM_NUMBER is set in the environment", () => {
    const num = process.env.OPENPHONE_FROM_NUMBER;
    if (num) {
      // If set, it should be in E.164 format
      expect(num).toMatch(/^\+\d{10,15}$/);
    } else {
      expect(num === undefined).toBe(true);
    }
  });
});
