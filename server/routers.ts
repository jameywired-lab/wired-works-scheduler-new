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
  listUsers,
  replaceJobAssignments,
  unassignCrewFromJob,
  updateClient,
  updateClientAddress,
  updateCrewMember,
  updateCrewNote,
  updateJob,
  updateUserRole,
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
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

// ─── Role helpers ─────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Clients Router ───────────────────────────────────────────────────────────
const clientsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "crew") throw new TRPCError({ code: "FORBIDDEN" });
    return listClients();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "crew") throw new TRPCError({ code: "FORBIDDEN" });
      const client = await getClientById(input.id);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });
      return client;
    }),

  create: adminProcedure
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
      await createClient(input);
      return { success: true };
    }),

  update: adminProcedure
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
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteClient(input.id);
      return { success: true };
    }),
});

// ─── Client Addresses Router ─────────────────────────────────────────────────
const clientAddressesRouter = router({
  getByClient: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "crew") throw new TRPCError({ code: "FORBIDDEN" });
      return getClientAddresses(input.clientId);
    }),

  create: adminProcedure
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

  update: adminProcedure
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

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteClientAddress(input.id);
      return { success: true };
    }),
});

// ─── Crew Router ──────────────────────────────────────────────────────────────
const crewRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return listCrewMembers(input?.activeOnly ?? false);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const member = await getCrewMemberById(input.id);
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      return member;
    }),

  create: adminProcedure
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

  update: adminProcedure
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

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCrewMember(input.id);
      return { success: true };
    }),
});

// ─── Jobs Router ──────────────────────────────────────────────────────────────
const jobsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "crew") {
      const allCrew = await listCrewMembers();
      const crewMember = allCrew.find((c) => c.userId === ctx.user.id);
      if (!crewMember) return [];
      return listJobsForCrew(crewMember.id);
    }
    return listJobs();
  }),

  listByDateRange: protectedProcedure
    .input(z.object({ startMs: z.number(), endMs: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "crew") {
        const allCrew = await listCrewMembers();
        const crewMember = allCrew.find((c) => c.userId === ctx.user.id);
        if (!crewMember) return [];
        const crewJobs = await listJobsForCrew(crewMember.id);
        return crewJobs.filter(
          (j) => j.scheduledStart >= input.startMs && j.scheduledStart <= input.endMs
        );
      }
      return listJobsByDateRange(input.startMs, input.endMs);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const job = await getJobById(input.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role === "crew") {
        const allCrew = await listCrewMembers();
        const crewMember = allCrew.find((c) => c.userId === ctx.user.id);
        if (!crewMember) throw new TRPCError({ code: "FORBIDDEN" });
        const assignments = await getJobAssignments(input.id);
        const isAssigned = assignments.some((a) => a.crewMemberId === crewMember.id);
        if (!isAssigned) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const assignments = await getJobAssignments(input.id);
      const client = await getClientById(job.clientId);
      return { ...job, assignments, client };
    }),

  create: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        scheduledStart: z.number(),
        scheduledEnd: z.number(),
        address: z.string().optional(),
        ownerInstructions: z.string().optional(),
        crewMemberIds: z.array(z.number()).optional(),
        sendBookingSms: z.boolean().optional().default(true),
        syncToGoogleCalendar: z.boolean().optional().default(true),
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

      // Google Calendar sync
      if (syncToGoogleCalendar && newJob) {
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
        const dateStr = startDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
        const timeStr = startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        const body = `Hi ${client.name}! Your appointment has been confirmed for ${dateStr} at ${timeStr}. We look forward to seeing you! Reply STOP to opt out.`;
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

  update: adminProcedure
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
        crewMemberIds: z.array(z.number()).optional(),
        sendReviewSms: z.boolean().optional(),
        syncToGoogleCalendar: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, crewMemberIds, sendReviewSms, syncToGoogleCalendar, ...jobData } = input;
      await updateJob(id, jobData);

      if (crewMemberIds !== undefined) {
        await replaceJobAssignments(id, crewMemberIds);
      }

      const job = await getJobById(id);

      // Google Calendar sync
      if (syncToGoogleCalendar && job) {
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

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const job = await getJobById(input.id);
      if (job?.googleCalendarEventId) {
        await deleteCalendarEvent(ctx.user.id, job.googleCalendarEventId);
      }
      await deleteJob(input.id);
      return { success: true };
    }),

  getAssignments: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => getJobAssignments(input.jobId)),

  assign: adminProcedure
    .input(z.object({ jobId: z.number(), crewMemberId: z.number() }))
    .mutation(async ({ input }) => {
      await assignCrewToJob(input);
      return { success: true };
    }),

  unassign: adminProcedure
    .input(z.object({ jobId: z.number(), crewMemberId: z.number() }))
    .mutation(async ({ input }) => {
      await unassignCrewFromJob(input.jobId, input.crewMemberId);
      return { success: true };
    }),

  sendReminderSms: adminProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const job = await getJobById(input.jobId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      const client = await getClientById(job.clientId);
      if (!client?.phone)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Client has no phone number" });

      const startDate = new Date(job.scheduledStart);
      const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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

  getSmsLog: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "crew") throw new TRPCError({ code: "FORBIDDEN" });
      return getSmsLogByJob(input.jobId);
    }),
});

// ─── Crew Notes Router ────────────────────────────────────────────────────────
const crewNotesRouter = router({
  getByJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => getCrewNotesByJob(input.jobId)),

  create: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        content: z.string().min(1),
        credentials: z.string().optional(),
        authorName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorName = input.authorName ?? ctx.user.name ?? "Crew Member";
      let crewMemberId: number | undefined;
      if (ctx.user.role === "crew") {
        const allCrew = await listCrewMembers();
        const member = allCrew.find((c) => c.userId === ctx.user.id);
        crewMemberId = member?.id;
      }
      await createCrewNote({ ...input, authorName, crewMemberId });
      return { success: true };
    }),

  update: protectedProcedure
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

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCrewNote(input.id);
      return { success: true };
    }),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────
const dashboardRouter = router({
  getData: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "crew") {
      const allCrew = await listCrewMembers();
      const crewMember = allCrew.find((c) => c.userId === ctx.user.id);
      if (!crewMember)
        return { todayJobs: [], upcomingJobs: [], recentJobs: [], totalClients: 0, totalCrew: 0 };
      const crewJobs = await listJobsForCrew(crewMember.id);
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      return {
        todayJobs: crewJobs.filter(
          (j) =>
            j.scheduledStart >= todayStart.getTime() && j.scheduledStart <= todayEnd.getTime()
        ),
        upcomingJobs: crewJobs
          .filter((j) => j.scheduledStart >= now && j.status !== "cancelled")
          .slice(0, 10),
        recentJobs: crewJobs.slice(0, 5),
        totalClients: 0,
        totalCrew: 0,
      };
    }
    return getDashboardData();
  }),
});

// ─── Google Calendar Router ───────────────────────────────────────────────────
const googleCalendarRouter = router({
  getAuthUrl: protectedProcedure
    .input(z.object({ redirectUri: z.string() }))
    .query(({ ctx, input }) => {
      const url = getGoogleAuthUrl(input.redirectUri, String(ctx.user.id));
      return { url };
    }),

  callback: protectedProcedure
    .input(z.object({ code: z.string(), redirectUri: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tokens = await exchangeCodeForTokens(input.code, input.redirectUri);
      if (!tokens) throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to exchange code" });
      await saveToken(ctx.user.id, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
      return { success: true };
    }),

  status: protectedProcedure.query(async ({ ctx }) => {
    const token = await getStoredToken(ctx.user.id);
    return {
      connected: !!token,
      calendarId: token?.calendarId ?? null,
      expiresAt: token?.expiresAt ?? null,
    };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteToken(ctx.user.id);
    return { success: true };
  }),

  updateCalendarId: protectedProcedure
    .input(z.object({ calendarId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const token = await getStoredToken(ctx.user.id);
      if (!token) throw new TRPCError({ code: "NOT_FOUND", message: "Google Calendar not connected" });
      await saveToken(
        ctx.user.id,
        token.accessToken,
        token.refreshToken ?? null,
        token.expiresAt,
        input.calendarId
      );
      return { success: true };
    }),
});

// ─── Users/Admin Router ───────────────────────────────────────────────────────
const usersRouter = router({
  list: adminProcedure.query(async () => listUsers()),
  updateRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "crew"]) }))
    .mutation(async ({ input }) => {
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
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
});

export type AppRouter = typeof appRouter;
