import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("../db", () => ({
  createJobPhoto: vi.fn().mockResolvedValue(undefined),
  deleteJobPhoto: vi.fn().mockResolvedValue(undefined),
  getJobPhotos: vi.fn().mockResolvedValue([
    {
      id: 1,
      jobId: 10,
      s3Key: "job-photos/10/test.jpg",
      s3Url: "https://s3.example.com/job-photos/10/test.jpg",
      filename: "test.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      uploadedByUserId: null,
      createdAt: new Date(),
    },
  ]),
  createSmsLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("../storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "job-photos/10/test.jpg",
    url: "https://s3.example.com/job-photos/10/test.jpg",
  }),
}));

// Mock SMS
vi.mock("../sms", () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true, messageId: "mock-id" }),
}));

import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function makeCtx(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("jobPhotos router", () => {
  it("getByJob returns photos for a job", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const photos = await caller.jobPhotos.getByJob({ jobId: 10 });
    expect(Array.isArray(photos)).toBe(true);
    expect(photos[0]?.jobId).toBe(10);
  });

  it("upload calls storagePut and createJobPhoto", async () => {
    const { storagePut } = await import("../storage");
    const { createJobPhoto } = await import("../db");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.jobPhotos.upload({
      jobId: 10,
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      base64Data: Buffer.from("fake image data").toString("base64"),
      sizeBytes: 15,
    });

    expect(result.success).toBe(true);
    expect(result.url).toContain("s3.example.com");
    expect(storagePut).toHaveBeenCalledOnce();
    expect(createJobPhoto).toHaveBeenCalledOnce();
  });

  it("delete calls deleteJobPhoto", async () => {
    const { deleteJobPhoto } = await import("../db");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.jobPhotos.delete({ id: 1 });
    expect(result.success).toBe(true);
    expect(deleteJobPhoto).toHaveBeenCalledWith(1);
  });
});

describe("messaging router", () => {
  it("sendToClient calls sendSms and returns success", async () => {
    const { sendSms } = await import("../sms");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.messaging.sendToClient({
      to: "+19046851240",
      message: "I'm on my way!",
      jobId: 10,
    });

    expect(result.success).toBe(true);
    expect(sendSms).toHaveBeenCalledWith("+19046851240", "I'm on my way!");
  });

  it("sendToClient works without jobId", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.messaging.sendToClient({
      to: "+19046851240",
      message: "Job complete!",
    });
    expect(result.success).toBe(true);
  });
});
