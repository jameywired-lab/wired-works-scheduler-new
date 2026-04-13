import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createFollowUp,
  createMilestone,
  createProject,
  createReminder,
  deleteFollowUp,
  deleteMilestone,
  deleteProject,
  deleteReminder,
  getDueReminders,
  getMilestonesByProject,
  getProjectById,
  getRemindersByProject,
  listFollowUps,
  listProjects,
  updateFollowUp,
  updateMilestone,
  updateProject,
  updateReminder,
} from "../db";
import { publicProcedure, router } from "../_core/trpc";

const p = publicProcedure;

// ─── Projects Router ──────────────────────────────────────────────────────────
export const projectsRouter = router({
  list: p.query(async () => {
    const all = await listProjects();
    return all;
  }),

  getById: p
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const milestones = await getMilestonesByProject(input.id);
      const reminders = await getRemindersByProject(input.id);
      return { ...project, milestones, reminders };
    }),

  create: p
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        clientId: z.number().optional(),
        status: z.enum(["active", "on_hold", "completed", "cancelled"]).optional().default("active"),
        startDate: z.number().optional(),
        dueDate: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createProject(input);
      const all = await listProjects();
      return { success: true, projectId: all[0]?.id };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        clientId: z.number().nullable().optional(),
        status: z.enum(["active", "on_hold", "completed", "cancelled"]).optional(),
        startDate: z.number().nullable().optional(),
        dueDate: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateProject(id, data);
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteProject(input.id);
      return { success: true };
    }),

  // ── Milestones ──────────────────────────────────────────────────────────────
  getMilestones: p
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getMilestonesByProject(input.projectId)),

  addMilestone: p
    .input(
      z.object({
        projectId: z.number(),
        title: z.string().min(1),
        dueDate: z.number().optional(),
        sortOrder: z.number().optional().default(0),
      })
    )
    .mutation(async ({ input }) => {
      await createMilestone({ ...input, isComplete: false });
      return { success: true };
    }),

  toggleMilestone: p
    .input(z.object({ id: z.number(), isComplete: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateMilestone(input.id, { isComplete: input.isComplete });
      return { success: true };
    }),

  updateMilestone: p
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        dueDate: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateMilestone(id, data);
      return { success: true };
    }),

  deleteMilestone: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteMilestone(input.id);
      return { success: true };
    }),

  // ── Reminders ───────────────────────────────────────────────────────────────
  getReminders: p
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getRemindersByProject(input.projectId)),

  getDueReminders: p.query(async () => getDueReminders(Date.now())),

  addReminder: p
    .input(
      z.object({
        projectId: z.number(),
        message: z.string().min(1),
        remindAt: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await createReminder({ ...input, isDismissed: false });
      return { success: true };
    }),

  dismissReminder: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateReminder(input.id, { isDismissed: true });
      return { success: true };
    }),

  deleteReminder: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteReminder(input.id);
      return { success: true };
    }),
});

// ─── Follow-Ups Router ────────────────────────────────────────────────────────
export const followUpsRouter = router({
  list: p
    .input(
      z.object({
        startMs: z.number().optional(),
        endMs: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => listFollowUps(input ?? {})),

  create: p
    .input(
      z.object({
        contactName: z.string().optional(),
        phone: z.string().optional(),
        type: z.enum(["call", "text", "manual"]).optional().default("manual"),
        note: z.string().optional(),
        contactedAt: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createFollowUp({ ...input, isFollowedUp: false });
      return { success: true };
    }),

  toggle: p
    .input(z.object({ id: z.number(), isFollowedUp: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateFollowUp(input.id, { isFollowedUp: input.isFollowedUp });
      return { success: true };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        note: z.string().optional(),
        type: z.enum(["call", "text", "manual"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateFollowUp(id, data);
      return { success: true };
    }),

  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteFollowUp(input.id);
      return { success: true };
    }),
});
