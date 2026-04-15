import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import {
  createJobPhoto,
  deleteJobPhoto,
  getJobPhotos,
  getJobPhotosByClient,
  createSmsLog,
} from "../db";
import { storagePut } from "../storage";
import { sendSms } from "../sms";

const p = publicProcedure;

// ─── Job Photos Router ────────────────────────────────────────────────────────
export const jobPhotosRouter = router({
  getByJob: p
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => getJobPhotos(input.jobId)),

  // Upload a photo: client sends base64-encoded data + metadata
  upload: p
    .input(
      z.object({
        jobId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string(), // base64-encoded file content
        sizeBytes: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const ext = input.filename.split(".").pop() ?? "jpg";
      const key = `job-photos/${input.jobId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await createJobPhoto({
        jobId: input.jobId,
        s3Key: key,
        s3Url: url,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes ?? buffer.length,
        uploadedByUserId: ctx.user?.id ?? null,
      });
      return { success: true, url };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteJobPhoto(input.id);
      return { success: true };
    }),

  listByClient: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => getJobPhotosByClient(input.clientId)),
});

// ─── SMS Messaging Router ─────────────────────────────────────────────────────
export const messagingRouter = router({
  sendToClient: p
    .input(
      z.object({
        to: z.string().min(7), // client phone number
        message: z.string().min(1),
        jobId: z.number().optional(), // for logging
      })
    )
    .mutation(async ({ input }) => {
      const result = await sendSms(input.to, input.message);
      if (input.jobId) {
        await createSmsLog({
          jobId: input.jobId,
          toPhone: input.to,
          body: input.message,
          messageType: "booking", // closest available type for custom messages
          status: result.success ? "sent" : "failed",
        });
      }
      return result;
    }),
});
