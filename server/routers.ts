import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  assignCrewToJob,
  createClient,
  createClientAddress,
  createCrewMember,
  createCrewNote,
  createJob,
  createSmsLog,
  deleteClient,
  deleteClientAddress,
  deleteCrewMember,
  deleteCrewNote,
  deleteJob,
  getClientAddresses,
  getClientById,
  getCrewMemberById,
  getCrewNotesByJob,
  getDashboardData,
  getJobAssignments,
  getJobById,
  getSmsLogByJob,
  listClients,
  listCrewMembers,
  listJobs,
  listJobsByDateRange,
  listJobsForCrew,
  createManualUser,
  deleteUser,
  listUsers,
  setUserPassword,
  replaceJobAssignments,
  unassignCrewFromJob,
  updateClient,
  updateClientAddress,
  updateCrewMember,
  updateCrewNote,
  updateJob,
  updateUserRole,
  getProjectCredentials,
  upsertProjectCredential,
  seedProjectCredentials,
  getClientCredentials,
  upsertClientCredential,
  seedClientCredentials,
  createFollowUp,
  getCrewNotesByClient,
  getJobPhotosByClient,
  listSmsTemplates,
  upsertSmsTemplate,
  getSmsTemplate,
  listClientNotes,
  createClientNote,
  deleteClientNote,
  listClientPhotos,
  createClientPhoto,
  deleteClientPhoto,
} from "./db";
import { sendSms } from "./sms";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  deleteToken,
  exchangeCodeForTokens,
  getGoogleAuthUrl,
  getStoredToken,
  jobToCalendarEvent,
  saveToken,
  updateCalendarEvent,
} from "./googleCalendar";
import { importRouter } from "./routers/import";
import { projectsRouter, followUpsRouter } from "./routers/projectsFollowups";
import { jobPhotosRouter, messagingRouter } from "./routers/jobPhotosMessaging";
import { crewTasksRouter, crewPermissionsRouter } from "./routers/crewTasksPermissions";
import { notificationsRouter } from "./routers/notifications";
import {
  addTagToClient,
  createTag,
  deleteTag,
  getClientsByTag,
  getTagsForClient,
  listTags,
  removeTagFromClient,
  getJobDocuments,
  createJobDocument,
  deleteJobDocument,
  savePhotoAnnotation,
} from "./db";
import { storagePut } from "./storage";
import { autoTagClient } from "./autoTag";
import { logActivity, listActivityLog, undoActivity } from "./activityLog";
import { getTagById } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { emailCampaigns, emailCampaignRecipients, clientCommunications } from "../drizzle/schema";
import { eq as eqC, desc as descC, and as andC, isNull } from "drizzle-orm";

// All procedures use publicProcedure — the app is accessible without login.
// Role-based checks are soft: they only apply when a user IS logged in.
const p = publicProcedure;

// ─── Clients Router ───────────────────────────────────────────────────────────
const clientsRouter = router({
  list: p.query(async () => listClients()),

  getById: p
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const client = await getClientById(input.id);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });
      return client;
    }),

  create: p
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await createClient(input);
      const newId = (result as any).insertId as number;
      if (newId) {
        await autoTagClient(newId, input).catch(() => {});
      }
      return { success: true };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateClient(id, data);
      // Re-evaluate neighborhood tags when address fields change
      const addressFields = ["addressLine1", "city", "state", "zip"];
      if (addressFields.some(f => f in data)) {
        const updated = await getClientById(id);
        if (updated) await autoTagClient(id, updated, true).catch(() => {});
      }
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const clientToDelete = await getClientById(input.id);
      if (clientToDelete) {
        await logActivity({ action: 'delete', entityType: 'client', entityId: input.id, entityLabel: clientToDelete.name, snapshot: clientToDelete as Record<string, unknown> }).catch(() => {});
      }
      await deleteClient(input.id);
      return { success: true };
    }),

  importCsv: p
    .input(
      z.object({
        rows: z.array(
          z.object({
            name: z.string().min(1),
            phone: z.string().optional(),
            email: z.string().optional(),
            addressLine1: z.string().optional(),
            addressLine2: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            zip: z.string().optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      let imported = 0;
      let skipped = 0;
      for (const row of input.rows) {
        try {
          if (!row.name.trim()) { skipped++; continue; }
          const csvData = {
            name: row.name.trim(),
            phone: row.phone?.trim() || undefined,
            email: row.email?.trim() || undefined,
            addressLine1: row.addressLine1?.trim() || undefined,
            addressLine2: row.addressLine2?.trim() || undefined,
            city: row.city?.trim() || undefined,
            state: row.state?.trim() || undefined,
            zip: row.zip?.trim() || undefined,
            notes: row.notes?.trim() || undefined,
          };
          const csvResult = await createClient(csvData);
          const csvNewId = (csvResult as any).insertId as number;
          if (csvNewId) await autoTagClient(csvNewId, csvData).catch(() => {});
          imported++;
        } catch {
          skipped++;
        }
      }
      return { imported, skipped };
    }),
});

// ─── Client Addresses Router ─────────────────────────────────────────────────
const clientAddressesRouter = router({
  getByClient: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => getClientAddresses(input.clientId)),

  create: p
    .input(
      z.object({
        clientId: z.number(),
        label: z.string().default("Home"),
        addressLine1: z.string().min(1),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        isPrimary: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      await createClientAddress(input);
      return { success: true };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        clientId: z.number(),
        label: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, clientId, ...data } = input;
      await updateClientAddress(id, clientId, data);
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteClientAddress(input.id);
      return { success: true };
    }),
});

// ─── Crew Router ──────────────────────────────────────────────────────────────
const crewRouter = router({
  list: p
    .input(z.object({ activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => listCrewMembers(input?.activeOnly ?? false)),

  getById: p
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const member = await getCrewMemberById(input.id);
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      return member;
    }),

  create: p
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        role: z.string().optional(),
        userId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createCrewMember({ ...input, isActive: true });
      return { success: true };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        role: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateCrewMember(id, data);
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const memberToDelete = await getCrewMemberById(input.id);
      if (memberToDelete) {
        await logActivity({ action: 'delete', entityType: 'crewMember', entityId: input.id, entityLabel: memberToDelete.name, snapshot: memberToDelete as Record<string, unknown> }).catch(() => {});
      }
      await deleteCrewMember(input.id);
      return { success: true };
    }),
});

// ─── Jobs Router ──────────────────────────────────────────────────────────────
const jobsRouter = router({
  list: p.query(async () => listJobs()),

  listByDateRange: p
    .input(z.object({ startMs: z.number(), endMs: z.number() }))
    .query(async ({ input }) => listJobsByDateRange(input.startMs, input.endMs)),

  getById: p
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const job = await getJobById(input.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const assignments = await getJobAssignments(input.id);
      const client = await getClientById(job.clientId);
      return { ...job, assignments, client };
    }),

  create: p
    .input(
      z.object({
        clientId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        scheduledStart: z.number(),
        scheduledEnd: z.number(),
        address: z.string().optional(),
        ownerInstructions: z.string().optional(),
        jobType: z.enum(["service_call", "project_job", "sales_call"]).optional().default("service_call"),
        crewMemberIds: z.array(z.number()).optional(),
        sendBookingSms: z.boolean().optional().default(true),
        syncToGoogleCalendar: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { crewMemberIds, sendBookingSms, syncToGoogleCalendar, ...jobData } = input;
      await createJob({ ...jobData, status: "scheduled" });

      const allJobs = await listJobs();
      const newJob = allJobs[0];

      if (crewMemberIds && crewMemberIds.length > 0 && newJob) {
        await replaceJobAssignments(newJob.id, crewMemberIds);
      }

      const client = await getClientById(input.clientId);

      // Google Calendar sync (only if user is logged in)
      if (syncToGoogleCalendar && newJob && ctx.user) {
        const calEvent = jobToCalendarEvent({
          title: newJob.title,
          description: newJob.description,
          address: newJob.address,
          scheduledStart: newJob.scheduledStart,
          scheduledEnd: newJob.scheduledEnd,
          clientName: client?.name,
        });
        const eventId = await createCalendarEvent(ctx.user.id, calEvent);
        if (eventId) {
          await updateJob(newJob.id, { googleCalendarEventId: eventId });
        }
      }

      // Send booking SMS
      if (sendBookingSms && newJob && client?.phone) {
        const startDate = new Date(input.scheduledStart);
        const tzOptions = { timeZone: "America/New_York" } as const;
        const dateStr = startDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          ...tzOptions,
        });
        const timeStr = startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          ...tzOptions,
        });
        // Load template from DB (falls back to default if not customised)
        const templateBody = await getSmsTemplate("booking_confirmation");
        const clientFirstName = client.name.split(" ")[0];
        const body = templateBody
          .replace(/\{clientName\}/g, clientFirstName)
          .replace(/\{fullName\}/g, client.name)
          .replace(/\{jobTitle\}/g, newJob.title)
          .replace(/\{date\}/g, dateStr)
          .replace(/\{time\}/g, timeStr);
        const result = await sendSms(client.phone, body);
        await createSmsLog({
          jobId: newJob.id,
          clientId: client.id,
          toPhone: client.phone,
          messageType: "booking",
          body,
          status: result.success ? "sent" : "failed",
        });
        if (result.success) {
          await updateJob(newJob.id, { bookingSmsSent: true });
        }
      }

      return { success: true, jobId: newJob?.id };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        clientId: z.number().optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
        scheduledStart: z.number().optional(),
        scheduledEnd: z.number().optional(),
        address: z.string().optional(),
        ownerInstructions: z.string().optional(),
        jobType: z.enum(["service_call", "project_job", "sales_call"]).optional(),
        crewMemberIds: z.array(z.number()).optional(),
        sendReviewSms: z.boolean().optional(),
        syncToGoogleCalendar: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, crewMemberIds, sendReviewSms, syncToGoogleCalendar, ...jobData } = input;
      await updateJob(id, jobData);

      if (crewMemberIds !== undefined) {
        await replaceJobAssignments(id, crewMemberIds);
      }

      const job = await getJobById(id);

      // Google Calendar sync (only if user is logged in)
      if (syncToGoogleCalendar && job && ctx.user) {
        const client = job.clientId ? await getClientById(job.clientId) : undefined;
        const calEvent = jobToCalendarEvent({
          title: job.title,
          description: job.description,
          address: job.address,
          scheduledStart: job.scheduledStart,
          scheduledEnd: job.scheduledEnd,
          clientName: client?.name,
        });
        if (job.googleCalendarEventId) {
          await updateCalendarEvent(ctx.user.id, job.googleCalendarEventId, calEvent);
        } else {
          const eventId = await createCalendarEvent(ctx.user.id, calEvent);
          if (eventId) await updateJob(id, { googleCalendarEventId: eventId });
        }
      }

      // Send review SMS when job is completed
      if (sendReviewSms && input.status === "completed" && job) {
        const client = await getClientById(job.clientId);
        if (client?.phone && !job.reviewSmsSent) {
          const body = `Hi ${client.name}! Thank you for choosing us. We'd love to hear your feedback! Please leave us a review: https://g.page/r/review. Reply STOP to opt out.`;
          const result = await sendSms(client.phone, body);
          await createSmsLog({
            jobId: id,
            clientId: client.id,
            toPhone: client.phone,
            messageType: "review",
            body,
            status: result.success ? "sent" : "failed",
          });
          if (result.success) await updateJob(id, { reviewSmsSent: true });
        }
      }

      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const job = await getJobById(input.id);
      if (job?.googleCalendarEventId && ctx.user) {
        await deleteCalendarEvent(ctx.user.id, job.googleCalendarEventId);
      }
      if (job) {
        await logActivity({ action: 'delete', entityType: 'job', entityId: input.id, entityLabel: job.title ?? `Job #${input.id}`, snapshot: job as Record<string, unknown> }).catch(() => {});
      }
      await deleteJob(input.id);
      return { success: true };
    }),

  getAssignments: p
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => getJobAssignments(input.jobId)),

  assign: p
    .input(z.object({ jobId: z.number(), crewMemberId: z.number() }))
    .mutation(async ({ input }) => {
      await assignCrewToJob(input);
      return { success: true };
    }),

  unassign: p
    .input(z.object({ jobId: z.number(), crewMemberId: z.number() }))
    .mutation(async ({ input }) => {
      await unassignCrewFromJob(input.jobId, input.crewMemberId);
      return { success: true };
    }),

  sendReminderSms: p
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const job = await getJobById(input.jobId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const client = await getClientById(job.clientId);
      if (!client?.phone)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Client has no phone number" });

      const startDate = new Date(job.scheduledStart);
      const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      const body = `Hi ${client.name}! Just a reminder that your appointment is in 1 hour at ${timeStr}. See you soon! Reply STOP to opt out.`;
      const result = await sendSms(client.phone, body);
      await createSmsLog({
        jobId: job.id,
        clientId: client.id,
        toPhone: client.phone,
        messageType: "reminder",
        body,
        status: result.success ? "sent" : "failed",
      });
      if (result.success) await updateJob(job.id, { reminderSmsSent: true });
      return { success: result.success };
    }),

  getSmsLog: p
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => getSmsLogByJob(input.jobId)),
});

// ─── Crew Notes Router ────────────────────────────────────────────────────────
const crewNotesRouter = router({
  getByJob: p
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => getCrewNotesByJob(input.jobId)),

  create: p
    .input(
      z.object({
        jobId: z.number(),
        content: z.string().min(1),
        credentials: z.string().optional(),
        authorName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorName = input.authorName ?? ctx.user?.name ?? "Crew Member";
      await createCrewNote({ ...input, authorName });
      return { success: true };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        content: z.string().min(1).optional(),
        credentials: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateCrewNote(id, data);
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCrewNote(input.id);
      return { success: true };
    }),

  getByClient: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => getCrewNotesByClient(input.clientId)),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────
const dashboardRouter = router({
  getData: p.query(async () => getDashboardData()),
});

// ─── Google Calendar Router ───────────────────────────────────────────────────
const googleCalendarRouter = router({
  getAuthUrl: p
    .input(z.object({ redirectUri: z.string() }))
    .query(({ ctx, input }) => {
      const userId = ctx.user?.id ?? 0;
      const url = getGoogleAuthUrl(input.redirectUri, String(userId));
      return { url };
    }),

  callback: p
    .input(z.object({ code: z.string(), redirectUri: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be signed in to connect Google Calendar" });
      const tokens = await exchangeCodeForTokens(input.code, input.redirectUri);
      if (!tokens) throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to exchange code" });
      await saveToken(ctx.user.id, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
      return { success: true };
    }),

  status: p.query(async ({ ctx }) => {
    if (!ctx.user) return { connected: false, calendarId: null, expiresAt: null };
    const token = await getStoredToken(ctx.user.id);
    return {
      connected: !!token,
      calendarId: token?.calendarId ?? null,
      expiresAt: token?.expiresAt ?? null,
    };
  }),

  disconnect: p.mutation(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    await deleteToken(ctx.user.id);
    return { success: true };
  }),

  updateCalendarId: p
    .input(z.object({ calendarId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const token = await getStoredToken(ctx.user.id);
      if (!token) throw new TRPCError({ code: "NOT_FOUND", message: "Google Calendar not connected" });
      await saveToken(ctx.user.id, token.accessToken, token.refreshToken ?? null, token.expiresAt, input.calendarId);
      return { success: true };
    }),
});

// ─── Users/Admin Router ───────────────────────────────────────────────────────
const usersRouter = router({
  list: p.query(async () => listUsers()),
  create: p
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email().optional().or(z.literal("")),
      role: z.enum(["user", "admin", "crew"]).default("user"),
      password: z.string().min(6).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await createManualUser({
        name: input.name,
        email: input.email || undefined,
        role: input.role,
      });
      if (input.password) {
        const bcrypt = await import("bcryptjs");
        const hash = await bcrypt.hash(input.password, 10);
        await setUserPassword(result.openId, hash);
      }
      return { success: true, openId: result.openId };
    }),
  setPassword: p
    .input(z.object({ openId: z.string(), newPassword: z.string().min(6) }))
    .mutation(async ({ input }) => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(input.newPassword, 10);
      await setUserPassword(input.openId, hash);
      return { success: true };
    }),
  updateRole: p
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "crew"]) }))
    .mutation(async ({ input }) => {
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),
  delete: p
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteUser(input.userId);
      return { success: true };
    }),
});;

// ─── Tags Router ────────────────────────────────────────────────────────────
const tagsRouter = router({
  list: p.query(async () => listTags()),

  create: p
    .input(z.object({ name: z.string().min(1).max(64), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      await createTag({ name: input.name.trim(), color: input.color ?? "#6366f1" });
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const tagToDelete = await getTagById(input.id);
      if (tagToDelete) {
        await logActivity({ action: 'delete', entityType: 'tag', entityId: input.id, entityLabel: tagToDelete.name, snapshot: tagToDelete as Record<string, unknown> }).catch(() => {});
      }
      await deleteTag(input.id);
      return { success: true };
    }),

  getForClient: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => getTagsForClient(input.clientId)),

  addToClient: p
    .input(z.object({ clientId: z.number(), tagId: z.number() }))
    .mutation(async ({ input }) => {
      await addTagToClient(input);
      return { success: true };
    }),

  removeFromClient: p
    .input(z.object({ clientId: z.number(), tagId: z.number() }))
    .mutation(async ({ input }) => {
      await removeTagFromClient(input.clientId, input.tagId);
      return { success: true };
    }),

  getClientsByTag: p
    .input(z.object({ tagId: z.number() }))
    .query(async ({ input }) => getClientsByTag(input.tagId)),
});

// ─── Job Documents Router ─────────────────────────────────────────────────────────
const jobDocumentsRouter = router({
  list: p
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => getJobDocuments(input.jobId)),

  upload: p
    .input(
      z.object({
        jobId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number().optional(),
        base64: z.string(), // data:mime;base64,... or raw base64
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Strip data URL prefix if present
      const base64Data = input.base64.includes(",") ? input.base64.split(",")[1] : input.base64;
      const buffer = Buffer.from(base64Data, "base64");
      const suffix = Math.random().toString(36).slice(2, 8);
      const ext = input.filename.split(".").pop() ?? "bin";
      const key = `job-${input.jobId}/docs/${suffix}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await createJobDocument({
        jobId: input.jobId,
        s3Key: key,
        s3Url: url,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes ?? buffer.byteLength,
        uploadedByUserId: ctx.user?.id ?? null,
      });
      return { success: true, url };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteJobDocument(input.id);
      // S3 object is left in place (no delete API available); DB record is removed
      return { success: true };
    }),

  saveAnnotation: p
    .input(
      z.object({
        photoId: z.number(),
        jobId: z.number(),
        base64: z.string(), // annotated image as base64 PNG
      })
    )
    .mutation(async ({ input }) => {
      const base64Data = input.base64.includes(",") ? input.base64.split(",")[1] : input.base64;
      const buffer = Buffer.from(base64Data, "base64");
      const suffix = Math.random().toString(36).slice(2, 8);
      const key = `job-${input.jobId}/photos/annotated-${input.photoId}-${suffix}.png`;
      const { url } = await storagePut(key, buffer, "image/png");
      await savePhotoAnnotation(input.photoId, key, url);
      return { success: true, url };
    }),
});

// ─── Project Credentials Router ────────────────────────────────────────────
const projectCredentialsRouter = router({
  list: p
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getProjectCredentials(input.projectId)),

  seed: p
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      await seedProjectCredentials(input.projectId);
      return { success: true };
    }),

  upsert: p
    .input(
      z.object({
        projectId: z.number(),
        key: z.string(),
        label: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await upsertProjectCredential(input.projectId, input.key, input.label, input.value);
      return { success: true };
    }),

  // Add a brand-new custom credential row
  add: p
    .input(z.object({ projectId: z.number(), label: z.string().min(1), value: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await db.insert(projectCredentials).values({ projectId: input.projectId, key, label: input.label, value: input.value });
      return { success: true };
    }),

  // Delete a credential permanently
  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(projectCredentials).where(eq(projectCredentials.id, input.id));
      return { success: true };
    }),

  // Update label of a credential
  updateLabel: p
    .input(z.object({ id: z.number(), label: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(projectCredentials).set({ label: input.label }).where(eq(projectCredentials.id, input.id));
      return { success: true };
    }),
});

// ─── Client Credentials Router ───────────────────────────────────────────────────────
import { projectCredentials } from "../drizzle/schema";
import { eq } from "drizzle-orm";
const clientCredentialsRouter = router({
  list: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => getClientCredentials(input.clientId)),

  seed: p
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      await seedClientCredentials(input.clientId);
      return { success: true };
    }),

  upsert: p
    .input(
      z.object({
        clientId: z.number(),
        key: z.string(),
        label: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await upsertClientCredential(input.clientId, input.key, input.label, input.value);
      return { success: true };
    }),

  // Add a brand-new custom credential row (generates a unique key)
  add: p
    .input(
      z.object({
        clientId: z.number(),
        label: z.string().min(1),
        value: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await upsertClientCredential(input.clientId, key, input.label, input.value);
      return { success: true };
    }),

  // Delete a credential by id
  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(projectCredentials).where(eq(projectCredentials.id, input.id));
      return { success: true };
    }),
});

// ─── Inventory Router ───────────────────────────────────────────────────────
import { getDb } from "./db";
import { vanInventoryItems, partsRequests } from "../drizzle/schema";
import { asc, desc as descOp, eq as eqOp, sql as sqlExpr } from "drizzle-orm";

const inventoryRouter = router({
  listItems: p.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(vanInventoryItems).orderBy(asc(vanInventoryItems.sortOrder));
  }),

  createItem: p
    .input(z.object({ name: z.string().min(1), targetQty: z.number().int().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Place new item at the end
      const [maxRow] = await db.select({ maxSort: sqlExpr<number>`MAX(sortOrder)` }).from(vanInventoryItems);
      const nextSort = (maxRow?.maxSort ?? -1) + 1;
      await db.insert(vanInventoryItems).values({
        name: input.name,
        targetQty: input.targetQty,
        currentQty: 0,
        sortOrder: nextSort,
      });
      return { success: true };
    }),

  updateItem: p
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), targetQty: z.number().int().min(1).optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.targetQty !== undefined) updates.targetQty = input.targetQty;
      if (Object.keys(updates).length === 0) return { success: true };
      await db.update(vanInventoryItems).set(updates).where(eqOp(vanInventoryItems.id, input.id));
      return { success: true };
    }),

  deleteItem: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(vanInventoryItems).where(eqOp(vanInventoryItems.id, input.id));
      return { success: true };
    }),

  updateCurrentQty: p
    .input(z.object({ id: z.number(), currentQty: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(vanInventoryItems).set({ currentQty: input.currentQty }).where(eqOp(vanInventoryItems.id, input.id));
      return { success: true };
    }),

  sendReport: p.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const items = await db.select().from(vanInventoryItems).orderBy(asc(vanInventoryItems.sortOrder));
    const shortages = items.filter((i: typeof items[number]) => i.currentQty < i.targetQty);
    if (shortages.length === 0) {
      const result = await sendSms("9043336466", "✅ Van Inventory Report: All items are fully stocked! No shortages.");
      // Create a single follow-up confirming the van is fully stocked
      await createFollowUp({
        contactName: "Van Inventory",
        type: "inventory",
        note: "✅ Inventory completed — van is fully stocked. No shortages.",
        isFollowedUp: false,
        proposalStatus: "none",
        isUrgent: false,
        clientContacted: false,
      });
      return { success: result.success, shortages: 0 };
    }
    const lines = shortages.map((i: typeof items[number]) => `• ${i.name}: need ${i.targetQty - i.currentQty} (have ${i.currentQty}, target ${i.targetQty})`);
    const body = `🚐 Van Inventory Report\n\nItems needed:\n${lines.join("\n")}\n\nTotal items short: ${shortages.length}`;
    const result = await sendSms("9043336466", body);
    // Create one follow-up per shortage item so each can be checked off individually
    for (const item of shortages) {
      const needed = item.targetQty - item.currentQty;
      await createFollowUp({
        contactName: "Van Inventory",
        type: "inventory",
        note: `Restock: ${item.name} — need ${needed} (have ${item.currentQty}, target ${item.targetQty})`,
        isFollowedUp: false,
        proposalStatus: "none",
        isUrgent: false,
        clientContacted: false,
      });
    }
    return { success: result.success, shortages: shortages.length };
  }),

  listRequests: p.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(partsRequests).orderBy(descOp(partsRequests.createdAt)).limit(50);
  }),

  requestPart: p
    .input(z.object({ requestedBy: z.string().default("Crew"), partDescription: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(partsRequests).values({ requestedBy: input.requestedBy, partDescription: input.partDescription, smsSent: false });
      const body = `🔧 Parts Request from ${input.requestedBy}:\n${input.partDescription}`;
      const result = await sendSms("9043336466", body);
      if (result.success) {
        const rows = await db.select().from(partsRequests).orderBy(descOp(partsRequests.createdAt)).limit(1);
        if (rows[0]) {
          await db.update(partsRequests).set({ smsSent: true }).where(eqOp(partsRequests.id, rows[0].id));
        }
      }
      // Auto-create a follow-up so the request can be tracked and checked off
      await createFollowUp({
        contactName: input.requestedBy || "Crew",
        type: "inventory",
        note: `🔧 Parts Request: ${input.partDescription}`,
        isFollowedUp: false,
        proposalStatus: "none",
        isUrgent: false,
        clientContacted: false,
      });
      return { success: true, smsSent: result.success };
    }),

  resetAll: p.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Set currentQty = targetQty for every item (fully restocked)
    await db.execute(sqlExpr`UPDATE vanInventoryItems SET currentQty = targetQty`);
    return { success: true };
  }),
});

// ─── Marketing Router ────────────────────────────────────────────────────────
const marketingRouter = router({
  // List all campaigns (newest first)
  listCampaigns: p.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(emailCampaigns).orderBy(descC(emailCampaigns.createdAt)).limit(50);
  }),

  // Get recipients for a campaign
  getCampaignRecipients: p
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(emailCampaignRecipients)
        .where(eqC(emailCampaignRecipients.campaignId, input.campaignId))
        .orderBy(descC(emailCampaignRecipients.sentAt));
    }),

  // Preview recipients before sending (returns matching clients)
  previewAudience: p
    .input(z.object({ tagId: z.number().nullable() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { clients, clientTags } = await import("../drizzle/schema");
      if (input.tagId === null) {
        // All clients
        return db.select({ id: clients.id, name: clients.name, email: clients.email })
          .from(clients);
      }
      // Clients with the specific tag
      return db.select({ id: clients.id, name: clients.name, email: clients.email })
        .from(clients)
        .innerJoin(clientTags, eqC(clientTags.clientId, clients.id))
        .where(eqC(clientTags.tagId, input.tagId));
    }),

  // Send a campaign (email provider not yet connected — saves draft and marks as pending)
  sendCampaign: p
    .input(z.object({
      subject: z.string().min(1),
      body: z.string().min(1),
      tagId: z.number().nullable(),
      tagName: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { clients, clientTags } = await import("../drizzle/schema");

      // Get audience
      let audience: { id: number; name: string; email: string | null }[] = [];
      if (input.tagId === null) {
        audience = await db.select({ id: clients.id, name: clients.name, email: clients.email })
          .from(clients);
      } else {
        audience = await db.select({ id: clients.id, name: clients.name, email: clients.email })
          .from(clients)
          .innerJoin(clientTags, eqC(clientTags.clientId, clients.id))
          .where(eqC(clientTags.tagId, input.tagId));
      }
      const withEmail = audience.filter(c => c.email && c.email.trim() !== "");

      // Create campaign record
      const [result] = await db.insert(emailCampaigns).values({
        subject: input.subject,
        body: input.body,
        tagFilter: input.tagName ?? null,
        recipientCount: withEmail.length,
        sentAt: new Date(),
      });
      const campaignId = (result as any).insertId as number;

      // Create recipient rows
      if (withEmail.length > 0) {
        await db.insert(emailCampaignRecipients).values(
          withEmail.map(c => ({
            campaignId,
            clientId: c.id,
            email: c.email!,
            clientName: c.name,
            status: "pending" as const,
          }))
        );
      }

      // TODO: When email provider is connected, iterate recipients and send here.
      // Example with Resend:
      // import { Resend } from 'resend';
      // const resend = new Resend(process.env.RESEND_API_KEY);
      // for (const r of withEmail) {
      //   await resend.emails.send({ from: 'you@yourdomain.com', to: r.email!, subject: input.subject, html: input.body });
      //   await db.update(emailCampaignRecipients).set({ status: 'sent', sentAt: new Date() }).where(...);
      // }

      return { success: true, campaignId, recipientCount: withEmail.length, pendingEmail: true };
    }),
});

// ─── Communications Router ────────────────────────────────────────────────────
const communicationsRouter = router({
  list: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(clientCommunications)
        .where(eqC(clientCommunications.clientId, input.clientId))
        .orderBy(descC(clientCommunications.createdAt))
        .limit(100);
    }),

  addNote: p
    .input(z.object({
      clientId: z.number(),
      channel: z.enum(["sms", "email", "call", "note"]),
      direction: z.enum(["inbound", "outbound"]).default("outbound"),
      subject: z.string().optional(),
      body: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(clientCommunications).values({
        clientId: input.clientId,
        channel: input.channel,
        direction: input.direction,
        subject: input.subject ?? null,
        body: input.body,
      });
      // Auto-create a follow-up for inbound communications
      if (input.direction === "inbound") {
        const { clients } = await import("../drizzle/schema");
        const [client] = await db.select({ name: clients.name })
          .from(clients).where(eqC(clients.id, input.clientId)).limit(1);
        await createFollowUp({
          contactName: client?.name ?? "Client",
          type: "manual",
          note: `📨 Inbound ${input.channel} from ${client?.name ?? "client"}: ${input.body.slice(0, 100)}`,
          isFollowedUp: false,
          proposalStatus: "none",
          isUrgent: false,
          clientContacted: false,
        });
      }
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(clientCommunications).where(eqC(clientCommunications.id, input.id));
      return { success: true };
    }),

  // Send an outbound SMS reply via OpenPhone and log it
  sendSms: p
    .input(z.object({
      to: z.string().min(7),                       // recipient phone number
      body: z.string().min(1),                     // message text
      clientId: z.number().optional(),             // if known, log against client
      mediaUrls: z.array(z.string().url()).optional(), // MMS attachments
    }))
    .mutation(async ({ input }) => {
      const result = await sendSms(input.to, input.body, input.mediaUrls);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "Failed to send SMS" });
      }
      // Log as outbound communication if we have a clientId
      if (input.clientId) {
        const db = await getDb();
        if (db) {
          const mediaNote = input.mediaUrls && input.mediaUrls.length > 0
            ? `\n[Media: ${input.mediaUrls.join(", ")}]`
            : "";
          await db.insert(clientCommunications).values({
            clientId: input.clientId,
            direction: "outbound",
            channel: "sms",
            body: input.body + mediaNote,
            toAddress: input.to,
          });
        }
      }
      return { success: true, messageId: result.messageId };
    }),

  // Upload a media file for MMS attachment and return a public URL
  uploadMedia: p
    .input(z.object({
      fileBase64: z.string(),   // base64-encoded file content
      mimeType: z.string(),     // e.g. "image/jpeg"
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      const suffix = Date.now().toString(36);
      const key = `sms-media/${suffix}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
});// ─── SMS Templates Router ───────────────────────────────────────────────────────────────────────────────
const smsTemplatesRouter = router({
  list: p.query(async () => listSmsTemplates()),
  save: p
    .input(z.object({ key: z.string().min(1), body: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await upsertSmsTemplate(input.key, input.body);
      return { success: true };
    }),
});

// ─── Project Notes Router ────────────────────────────────────────────
import {
  listProjectNotes,
  createProjectNote,
  deleteProjectNote,
  listProjectPhotos,
  createProjectPhoto,
  deleteProjectPhoto,
} from "./db";
const projectNotesRouter = router({
  list: p
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => listProjectNotes(input.projectId)),
  create: p
    .input(z.object({ projectId: z.number(), body: z.string().min(1), authorName: z.string().optional() }))
    .mutation(async ({ input }) => {
      await createProjectNote(input);
      return { success: true };
    }),
  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteProjectNote(input.id);
      return { success: true };
    }),
});

// ─── Project Photos Router ────────────────────────────────────────────
const projectPhotosRouter = router({
  list: p
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => listProjectPhotos(input.projectId)),
  upload: p
    .input(z.object({
      projectId: z.number(),
      filename: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number().optional(),
      base64: z.string(), // base64-encoded file data
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.base64, "base64");
      const key = `project-photos/${input.projectId}/${Date.now()}-${input.filename}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await createProjectPhoto({
        projectId: input.projectId,
        s3Key: key,
        s3Url: url,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.uploadedBy,
      });
      return { success: true, url };
    }),
  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteProjectPhoto(input.id);
      return { success: true };
    }),
});

// ─── Activity Log Router ─────────────────────────────────────────────────────
const activityLogRouter = router({
  list: p.query(async () => listActivityLog()),
  undo: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => undoActivity(input.id)),
});

// ─── Client Notes Router ────────────────────────────────────────────────────────────────────────────────────────
const clientNotesRouter = router({
  list: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => listClientNotes(input.clientId)),

  create: p
    .input(z.object({
      clientId: z.number(),
      authorName: z.string().min(1),
      body: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await createClientNote(input);
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteClientNote(input.id);
      return { success: true };
    }),
});

// ─── Client Photos Router ───────────────────────────────────────────────────────────────────────────────────────
const clientPhotosRouter = router({
  list: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => listClientPhotos(input.clientId)),

  upload: p
    .input(z.object({
      clientId: z.number(),
      uploadedBy: z.string().min(1),
      filename: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number().optional(),
      dataBase64: z.string(), // base64-encoded file content
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import('./storage');
      const buf = Buffer.from(input.dataBase64, 'base64');
      const suffix = Date.now().toString(36);
      const ext = input.filename.split('.').pop() ?? 'jpg';
      const key = `client-${input.clientId}/photos/${suffix}.${ext}`;
      const { url } = await storagePut(key, buf, input.mimeType);
      await createClientPhoto({
        clientId: input.clientId,
        s3Key: key,
        s3Url: url,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.uploadedBy,
      });
      return { success: true, url };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteClientPhoto(input.id);
      return { success: true };
    }),
});

// ─── App Router ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const appRouter = router({
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  clients: clientsRouter,
  clientAddresses: clientAddressesRouter,
  crew: crewRouter,
  jobs: jobsRouter,
  crewNotes: crewNotesRouter,
  dashboard: dashboardRouter,
  googleCalendar: googleCalendarRouter,
  users: usersRouter,
  import: importRouter,
  projects: projectsRouter,
  followUps: followUpsRouter,
  jobPhotos: jobPhotosRouter,
  messaging: messagingRouter,
  tags: tagsRouter,
  jobDocuments: jobDocumentsRouter,
  projectCredentials: projectCredentialsRouter,
  clientCredentials: clientCredentialsRouter,
  inventory: inventoryRouter,
  marketing: marketingRouter,
  communications: communicationsRouter,
  smsTemplates: smsTemplatesRouter,
  projectNotes: projectNotesRouter,
  projectPhotos: projectPhotosRouter,
  system: systemRouter,
  activityLog: activityLogRouter,
  clientNotes: clientNotesRouter,
   clientPhotos: clientPhotosRouter,
  crewTasks: crewTasksRouter,
  crewPermissions: crewPermissionsRouter,
  notifications: notificationsRouter,
});
export type AppRouter = typeof appRouter;
