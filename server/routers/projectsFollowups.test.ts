import { describe, expect, it } from "vitest";
import { projectsRouter, followUpsRouter } from "./projectsFollowups";
import type { TrpcContext } from "../_core/context";

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("projectsRouter", () => {
  it("list returns an array", async () => {
    const caller = projectsRouter.createCaller(makeCtx());
    const result = await caller.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getDueReminders returns an array", async () => {
    const caller = projectsRouter.createCaller(makeCtx());
    const result = await caller.getDueReminders();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getById throws NOT_FOUND for non-existent project", async () => {
    const caller = projectsRouter.createCaller(makeCtx());
    await expect(caller.getById({ id: 999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("followUpsRouter", () => {
  it("list returns an array", async () => {
    const caller = followUpsRouter.createCaller(makeCtx());
    const result = await caller.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("list with date range returns an array", async () => {
    const caller = followUpsRouter.createCaller(makeCtx());
    const now = Date.now();
    const result = await caller.list({ startMs: now - 86400000, endMs: now });
    expect(Array.isArray(result)).toBe(true);
  });
});
