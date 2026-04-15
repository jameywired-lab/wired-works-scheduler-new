import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB and notification helpers ─────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null → DB unavailable path
  seedProjectCredentials: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("../drizzle/schema", () => ({
  clients: {},
  projects: {},
  followUps: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  or: vi.fn(),
}));

// ── Minimal Express mock ──────────────────────────────────────────────────────
function makeReqRes(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const req = { body, headers } as any;
  let statusCode = 200;
  let responseBody: unknown;
  const res = {
    status: (code: number) => { statusCode = code; return res; },
    json: (data: unknown) => { responseBody = data; return res; },
    getStatus: () => statusCode,
    getBody: () => responseBody,
  } as any;
  return { req, res };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("handleProposalAcceptedWebhook", () => {
  beforeEach(() => {
    // Remove WEBHOOK_SECRET so secret validation is skipped (no env set in test)
    delete process.env.WEBHOOK_SECRET;
  });

  it("returns 400 when clientName is missing", async () => {
    const { handleProposalAcceptedWebhook } = await import("./proposalAcceptedWebhook");
    const { req, res } = makeReqRes({});
    await handleProposalAcceptedWebhook(req, res);
    expect(res.getStatus()).toBe(400);
    expect((res.getBody() as any).error).toMatch(/clientName/i);
  });

  it("returns 503 when DB is unavailable", async () => {
    const { handleProposalAcceptedWebhook } = await import("./proposalAcceptedWebhook");
    const { req, res } = makeReqRes({ clientName: "Test Client" });
    await handleProposalAcceptedWebhook(req, res);
    expect(res.getStatus()).toBe(503);
    expect((res.getBody() as any).error).toMatch(/database/i);
  });

  it("returns 401 when WEBHOOK_SECRET is set and secret is wrong", async () => {
    process.env.WEBHOOK_SECRET = "correct-secret";
    const { handleProposalAcceptedWebhook } = await import("./proposalAcceptedWebhook");
    const { req, res } = makeReqRes({ clientName: "Test", secret: "wrong-secret" });
    await handleProposalAcceptedWebhook(req, res);
    expect(res.getStatus()).toBe(401);
    expect((res.getBody() as any).error).toMatch(/invalid/i);
    delete process.env.WEBHOOK_SECRET;
  });

  it("passes secret validation when correct secret is in header", async () => {
    process.env.WEBHOOK_SECRET = "my-secret";
    const { handleProposalAcceptedWebhook } = await import("./proposalAcceptedWebhook");
    const { req, res } = makeReqRes(
      { clientName: "Test" },
      { "x-webhook-secret": "my-secret" }
    );
    await handleProposalAcceptedWebhook(req, res);
    // Should not be 401 (will be 503 due to no DB in test, but secret passed)
    expect(res.getStatus()).not.toBe(401);
    delete process.env.WEBHOOK_SECRET;
  });
});
