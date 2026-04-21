import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  closeJob,
  createCrewNote,
  createFollowUp,
  createMilestone,
  createProject,
  createReminder,
  deleteFollowUp,
  deleteMilestone,
  deleteProject,
  deleteReminder,
  getDueReminders,
  getFollowUpById,
  getMilestonesByProject,
  getJobById,
  getProjectById,
  getRemindersByProject,
  listFollowUps,
  getRevenueReport,
  listProjects,
  listProjectsByClient,
  recalcMilestoneWeights,
  swapMilestoneSortOrder,
  updateFollowUp,
  updateJob,
  updateMilestone,
  updateProject,
  updateReminder,
} from "../db";
import { publicProcedure, router } from "../_core/trpc";
import { logActivity } from "../activityLog";

const p = publicProcedure;

// ─── Milestone Stage Templates ────────────────────────────────────────────────
type ProjectType = "new_construction" | "commercial" | "retrofit";

const STAGE_TEMPLATES: Record<ProjectType, { title: string; weight: number }[]> = {
  new_construction: [
    { title: "Prewire", weight: 15 },
    { title: "Client Walk-Through to Verify Locations", weight: 10 },
    { title: "Trim Parts Ordered", weight: 10 },
    { title: "Client Credentials Collected", weight: 10 },
    { title: "Trim Complete", weight: 35 },
    { title: "Final", weight: 20 },
  ],
  commercial: [
    { title: "Prewire", weight: 15 },
    { title: "Client Walk-Through to Verify Locations", weight: 10 },
    { title: "Trim Parts Ordered", weight: 10 },
    { title: "Client Credentials Collected", weight: 10 },
    { title: "Trim Complete", weight: 35 },
    { title: "Final", weight: 20 },
  ],
  retrofit: [
    { title: "Parts Ordered", weight: 5 },
    { title: "Client Credentials Collected", weight: 5 },
    { title: "Gear Programmed", weight: 20 },
    { title: "Install", weight: 60 },
    { title: "Final Walk-Through", weight: 10 },
  ],
};

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
        projectType: z.enum(["new_construction", "commercial", "retrofit"]).optional(),
        startDate: z.number().optional(),
        dueDate: z.number().optional(),
        projectValue: z.number().nullable().optional(),
        jobTotal: z.number().nullable().optional(),
        leadSource: z.string().nullable().optional(),
        referralName: z.string().nullable().optional(),
        leadSourceOther: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { projectValue, jobTotal, ...rest } = input;
      await createProject({ ...rest, projectValue: projectValue != null ? String(projectValue) : null, jobTotal: jobTotal != null ? String(jobTotal) : null });
      const all = await listProjects();
      const newId = all[0]?.id;
      // Auto-seed milestone stages for the chosen project type
      if (newId && input.projectType && STAGE_TEMPLATES[input.projectType]) {
        const stages = STAGE_TEMPLATES[input.projectType];
        for (let i = 0; i < stages.length; i++) {
          await createMilestone({
            projectId: newId,
            title: stages[i].title,
            weight: stages[i].weight,
            isComplete: false,
            sortOrder: i,
          });
        }
      }
      return { success: true, projectId: newId };
    }),

  update: p
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        clientId: z.number().nullable().optional(),
        status: z.enum(["active", "on_hold", "completed", "cancelled"]).optional(),
        projectType: z.enum(["new_construction", "commercial", "retrofit"]).nullable().optional(),
        startDate: z.number().nullable().optional(),
        dueDate: z.number().nullable().optional(),
        projectValue: z.number().nullable().optional(),
        jobTotal: z.number().nullable().optional(),
        leadSource: z.string().nullable().optional(),
        referralName: z.string().nullable().optional(),
        leadSourceOther: z.string().nullable().optional(),
        completedAt: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, projectValue, jobTotal, ...rest } = input;
      // When marking completed, auto-set completedAt if not provided
      const completedAt = rest.completedAt ?? (rest.status === "completed" ? Date.now() : undefined);
      await updateProject(id, {
        ...rest,
        projectValue: projectValue != null ? String(projectValue) : null,
        jobTotal: jobTotal != null ? String(jobTotal) : null,
        completedAt: completedAt ?? null,
      });
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
      // Append at end: sortOrder = current count
      const existing = await getMilestonesByProject(input.projectId);
      await createMilestone({ ...input, isComplete: false, sortOrder: existing.length, weight: 0 });
      // Redistribute weights evenly
      await recalcMilestoneWeights(input.projectId);
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
    .input(z.object({ id: z.number(), projectId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteMilestone(input.id);
      // Redistribute weights evenly after deletion
      await recalcMilestoneWeights(input.projectId);
      return { success: true };
    }),

  reorderMilestone: p
    .input(
      z.object({
        projectId: z.number(),
        id: z.number(),
        direction: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ input }) => {
      const all = await getMilestonesByProject(input.projectId);
      const idx = all.findIndex((m) => m.id === input.id);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND" });
      const swapIdx = input.direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= all.length) return { success: true };
      await swapMilestoneSortOrder(all[idx].id, all[swapIdx].id);
      return { success: true };
    }),

  recalcWeights: p
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      await recalcMilestoneWeights(input.projectId);
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

  revenueReport: p.query(async () => getRevenueReport()),

  listByClient: p
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => listProjectsByClient(input.clientId)),
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
      if (input.isFollowedUp) {
        const fu = await getFollowUpById(input.id);
        if (fu) {
          await logActivity({ action: 'complete', entityType: 'followUp', entityId: input.id, entityLabel: fu.contactName ?? `Follow-up #${input.id}`, snapshot: fu as Record<string, unknown> }).catch(() => {});
        }
      }
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
      const fuToDelete = await getFollowUpById(input.id);
      if (fuToDelete) {
        await logActivity({ action: 'delete', entityType: 'followUp', entityId: input.id, entityLabel: fuToDelete.contactName ?? `Follow-up #${input.id}`, snapshot: fuToDelete as Record<string, unknown> }).catch(() => {});
      }
      await deleteFollowUp(input.id);
      return { success: true };
    }),

  // ── Close-out: complete a service/sales job and auto-create follow-up ────────
  closeOut: p
    .input(
      z.object({
        jobId: z.number(),
        closeoutNotes: z.string().min(1, "Notes are required"),
        closeoutOutcome: z.enum(["client_happy_bill", "client_issue_urgent", "proposal_needed", "bill_service_call"]),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        clientId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { jobId, closeoutNotes, closeoutOutcome, contactName, phone, clientId } = input;
      const now = Date.now();

      // 1. Mark job as completed with close-out data
      await closeJob(jobId, { closeoutNotes, closeoutOutcome, closedAt: now });

      // 2. Determine follow-up type and note based on outcome
      let followUpNote = closeoutNotes;
      let followUpType: "closeout" | "proposal" = "closeout";
      let isUrgent = false;

      if (closeoutOutcome === "client_issue_urgent") {
        followUpNote = `⚠️ URGENT — Issue with client. Notes: ${closeoutNotes}`;
        isUrgent = true;
      } else if (closeoutOutcome === "proposal_needed") {
        followUpNote = `Proposal needed. Notes: ${closeoutNotes}`;
        followUpType = "proposal";
      } else if (closeoutOutcome === "bill_service_call") {
        followUpNote = `Bill out service call. Notes: ${closeoutNotes}`;
      } else if (closeoutOutcome === "client_happy_bill") {
        followUpNote = `Client happy — ready for billing. Notes: ${closeoutNotes}`;
      }

      // 3. Auto-log close-out notes as a crew field note on the job
      await createCrewNote({
        jobId,
        content: `[Close-Out] ${closeoutNotes}`,
        authorName: contactName ?? "Tech",
      });

      // 4. Create the follow-up
      await createFollowUp({
        contactName: contactName ?? undefined,
        phone: phone ?? undefined,
        type: followUpType,
        note: followUpNote,
        isFollowedUp: false,
        contactedAt: now,
        linkedJobId: jobId,
        clientId: clientId ?? undefined,
        proposalStatus: followUpType === "proposal" ? "none" : "none",
        isUrgent,
        urgentAt: isUrgent ? now : undefined,
      });

      return { success: true };
    }),

  // ── Mark a follow-up task as complete (removes from active list) ─────────────
  completeTask: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateFollowUp(input.id, { isFollowedUp: true });
      return { success: true };
    }),

  // ── Send proposal — sets proposalStatus=pending and records sent time ────────
  sendProposal: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const now = Date.now();
      await updateFollowUp(input.id, {
        proposalStatus: "pending",
        proposalSentAt: now,
        type: "proposal",
      });
      return { success: true };
    }),

  // ── Mark follow-up as urgent (called by a scheduled check or manually) ───────
  markUrgent: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateFollowUp(input.id, { isUrgent: true, urgentAt: Date.now() });
      return { success: true };
    }),

  // ── Resolve proposal outcome ─────────────────────────────────────────────────
  resolveProposal: p
    .input(
      z.object({
        id: z.number(),
        outcome: z.enum(["accepted", "declined", "not_ready"]),
        // For accepted: project details
        projectTitle: z.string().optional(),
        projectDescription: z.string().optional(),
        projectClientId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, outcome } = input;
      const followUp = await getFollowUpById(id);
      if (!followUp) throw new TRPCError({ code: "NOT_FOUND" });

      if (outcome === "accepted") {
        // Create a project linked to the client
        await createProject({
          title: input.projectTitle ?? (followUp.contactName ? `Project — ${followUp.contactName}` : "New Project"),
          description: input.projectDescription ?? followUp.note ?? undefined,
          clientId: input.projectClientId ?? followUp.clientId ?? undefined,
          status: "active",
          startDate: Date.now(),
        });
        // Remove follow-up (accepted — done)
        await deleteFollowUp(id);
      } else if (outcome === "declined") {
        // Remove follow-up (declined — done)
        await deleteFollowUp(id);
      } else {
        // not_ready — remove from active list (mark as followed up) so it leaves the Follow-Up section
        await updateFollowUp(id, {
          proposalStatus: "not_ready",
          isUrgent: false,
          isFollowedUp: true,
        });
      }

      return { success: true, outcome };
    }),

  // ── Snooze follow-up until tomorrow ─────────────────────────────────────────────────────
  remindTomorrow: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      await updateFollowUp(input.id, { remindAt: tomorrow });
      return { success: true };
    }),

  // ── Mark client as contacted — pins to top of list ───────────────────────────────
  markClientContacted: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateFollowUp(input.id, { clientContacted: true });
      return { success: true };
    }),
});
