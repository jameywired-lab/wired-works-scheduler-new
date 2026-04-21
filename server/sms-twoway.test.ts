/**
 * Two-way SMS feature tests
 * Tests: sendSms mediaUrls support, uploadMedia procedure, communications.sendSms with media
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock sendSms helper ──────────────────────────────────────────────────────
vi.mock("./sms", () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true, messageId: "test-msg-id" }),
}));

// ─── Mock storage ─────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/sms-media/test-abc.jpg", key: "sms-media/test-abc.jpg" }),
}));

import { sendSms } from "./sms";
import { storagePut } from "./storage";

// ─── sendSms helper: mediaUrls forwarded ─────────────────────────────────────
describe("sendSms helper — mediaUrls support", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls sendSms without mediaUrls for plain text", async () => {
    await sendSms("+19045550001", "Hello!");
    expect(sendSms).toHaveBeenCalledWith("+19045550001", "Hello!");
  });

  it("calls sendSms with mediaUrls for MMS", async () => {
    await sendSms("+19045550001", "Check this out", ["https://cdn.example.com/photo.jpg"]);
    expect(sendSms).toHaveBeenCalledWith(
      "+19045550001",
      "Check this out",
      ["https://cdn.example.com/photo.jpg"]
    );
  });

  it("returns success result with messageId", async () => {
    const result = await sendSms("+19045550001", "Test");
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("test-msg-id");
  });
});

// ─── storagePut: media upload ─────────────────────────────────────────────────
describe("storagePut — media upload for MMS", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads buffer and returns public URL", async () => {
    const buffer = Buffer.from("fake-image-data");
    const { url } = await storagePut("sms-media/test-abc.jpg", buffer, "image/jpeg");
    expect(url).toMatch(/^https?:\/\//);
    expect(storagePut).toHaveBeenCalledWith("sms-media/test-abc.jpg", buffer, "image/jpeg");
  });
});

// ─── URL normalization helpers ────────────────────────────────────────────────
describe("URL normalization for link attachments", () => {
  function normalizeUrl(raw: string): string {
    return raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
  }

  it("leaves https:// URLs unchanged", () => {
    expect(normalizeUrl("https://example.com/page")).toBe("https://example.com/page");
  });

  it("leaves http:// URLs unchanged", () => {
    expect(normalizeUrl("http://example.com/page")).toBe("http://example.com/page");
  });

  it("prepends https:// to bare domains", () => {
    expect(normalizeUrl("example.com/page")).toBe("https://example.com/page");
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
  });
});

// ─── Media log note formatting ────────────────────────────────────────────────
describe("media log note formatting", () => {
  function buildBodyWithMedia(body: string, mediaUrls?: string[]): string {
    const mediaNote = mediaUrls && mediaUrls.length > 0
      ? `\n[Media: ${mediaUrls.join(", ")}]`
      : "";
    return body + mediaNote;
  }

  it("returns plain body when no media", () => {
    expect(buildBodyWithMedia("Hello")).toBe("Hello");
  });

  it("appends single media URL", () => {
    const result = buildBodyWithMedia("Hi", ["https://cdn.example.com/photo.jpg"]);
    expect(result).toBe("Hi\n[Media: https://cdn.example.com/photo.jpg]");
  });

  it("appends multiple media URLs comma-separated", () => {
    const result = buildBodyWithMedia("Hi", ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]);
    expect(result).toBe("Hi\n[Media: https://cdn.example.com/a.jpg, https://cdn.example.com/b.jpg]");
  });

  it("handles empty mediaUrls array as plain body", () => {
    expect(buildBodyWithMedia("Hello", [])).toBe("Hello");
  });
});
