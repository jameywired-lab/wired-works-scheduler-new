/**
 * activityLog.test.ts
 * Unit tests for the activity log helper functions.
 * These tests mock the DB layer and verify the logic of logActivity,
 * listActivityLog, and undoActivity without requiring a live database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ───────────────────────────────────────────────────────
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
const mockSelect = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  activityLog: { id: "id", action: "action", entityType: "entityType", entityId: "entityId", entityLabel: "entityLabel", snapshotJson: "snapshotJson", performedAt: "performedAt", undoneAt: "undoneAt" },
  clients: {},
  jobs: {},
  followUps: {},
  crewMembers: {},
  tags: {},
  clientTags: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  desc: vi.fn((a) => ({ desc: a })),
  isNull: vi.fn((a) => ({ isNull: a })),
  and: vi.fn((...args) => ({ and: args })),
  gte: vi.fn((a, b) => ({ gte: [a, b] })),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("activityLog helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logActivity", () => {
    it("should call db.insert with correct values", async () => {
      const insertValues = vi.fn().mockResolvedValue([]);
      mockInsert.mockReturnValue({ values: insertValues });

      const { logActivity } = await import("./activityLog");
      await logActivity({
        action: "delete",
        entityType: "client",
        entityId: 42,
        entityLabel: "John Doe",
        snapshot: { id: 42, name: "John Doe" },
      });

      expect(mockInsert).toHaveBeenCalledOnce();
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "delete",
          entityType: "client",
          entityId: 42,
          entityLabel: "John Doe",
          snapshotJson: JSON.stringify({ id: 42, name: "John Doe" }),
        })
      );
    });

    it("should not throw when db is unavailable", async () => {
      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValueOnce(null);

      const { logActivity } = await import("./activityLog");
      await expect(
        logActivity({ action: "delete", entityType: "client", entityId: 1, entityLabel: "Test", snapshot: {} })
      ).resolves.not.toThrow();
    });
  });

  describe("listActivityLog", () => {
    it("should return empty array when db is unavailable", async () => {
      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValueOnce(null);

      const { listActivityLog } = await import("./activityLog");
      const result = await listActivityLog();
      expect(result).toEqual([]);
    });

    it("should query with 30-day cutoff and no undoneAt filter", async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockSelect.mockReturnValue(mockChain);

      const { listActivityLog } = await import("./activityLog");
      const result = await listActivityLog();

      expect(mockSelect).toHaveBeenCalled();
      expect(mockChain.from).toHaveBeenCalled();
      expect(mockChain.where).toHaveBeenCalled();
      expect(mockChain.orderBy).toHaveBeenCalled();
      expect(mockChain.limit).toHaveBeenCalledWith(200);
      expect(result).toEqual([]);
    });
  });

  describe("undoActivity", () => {
    it("should return error when db is unavailable", async () => {
      const { getDb } = await import("./db");
      vi.mocked(getDb).mockResolvedValueOnce(null);

      const { undoActivity } = await import("./activityLog");
      const result = await undoActivity(1);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Database unavailable");
    });

    it("should return error when log entry not found", async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockSelect.mockReturnValue(mockChain);

      const { undoActivity } = await import("./activityLog");
      const result = await undoActivity(999);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Log entry not found");
    });

    it("should return error when entry already undone", async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{
          id: 1,
          action: "delete",
          entityType: "client",
          entityId: 42,
          entityLabel: "John Doe",
          snapshotJson: JSON.stringify({ id: 42, name: "John Doe" }),
          performedAt: new Date(),
          undoneAt: new Date(), // already undone
        }]),
      };
      mockSelect.mockReturnValue(mockChain);

      const { undoActivity } = await import("./activityLog");
      const result = await undoActivity(1);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Already undone");
    });

    it("should return error for invalid snapshot JSON", async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{
          id: 1,
          action: "delete",
          entityType: "client",
          entityId: 42,
          entityLabel: "John Doe",
          snapshotJson: "not-valid-json{{{",
          performedAt: new Date(),
          undoneAt: null,
        }]),
      };
      mockSelect.mockReturnValue(mockChain);

      const { undoActivity } = await import("./activityLog");
      const result = await undoActivity(1);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid snapshot data");
    });
  });
});
