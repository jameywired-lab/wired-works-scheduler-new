/**
 * Crew Tasks & Permissions Router
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import {
  listCrewTasksForMember,
  listAllCrewTasks,
  createCrewTask,
  completeCrewTask,
  deleteCrewTask,
  getCrewPermissions,
  upsertCrewPermissions,
  getCrewMemberByUserId,
  listCrewMembers,
  getDb,
} from "../db";
import { crewTasks, crewMembers, crewPermissions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const p = publicProcedure;

export const crewTasksRouter = router({
  // Resolve the crew member record for the currently logged-in user
  getMyCrewMember: p
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const member = await getCrewMemberByUserId(input.userId);
      return member ?? null;
    }),

  // Admin: list all tasks (with crew member name joined)
  listAll: p.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: crewTasks.id,
        assignedToCrewMemberId: crewTasks.assignedToCrewMemberId,
        crewMemberName: crewMembers.name,
        title: crewTasks.title,
        description: crewTasks.description,
        dueDate: crewTasks.dueDate,
        isComplete: crewTasks.isComplete,
        completedAt: crewTasks.completedAt,
        createdBy: crewTasks.createdBy,
        createdAt: crewTasks.createdAt,
      })
      .from(crewTasks)
      .leftJoin(crewMembers, eq(crewTasks.assignedToCrewMemberId, crewMembers.id))
      .orderBy(crewTasks.createdAt);
    return rows;
  }),

  // Crew: list my incomplete tasks
  listForMember: p
    .input(z.object({ crewMemberId: z.number() }))
    .query(async ({ input }) => listCrewTasksForMember(input.crewMemberId)),

  // Admin: create a task for a crew member
  create: p
    .input(z.object({
      assignedToCrewMemberId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      dueDate: z.number().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await createCrewTask(input);
      return { success: true };
    }),

  // Mark a task complete
  complete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await completeCrewTask(input.id);
      return { success: true };
    }),

  // Admin: delete a task
  delete: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCrewTask(input.id);
      return { success: true };
    }),
});

export const crewPermissionsRouter = router({
  // Get permissions for a specific crew member
  get: p
    .input(z.object({ crewMemberId: z.number() }))
    .query(async ({ input }) => {
      const perms = await getCrewPermissions(input.crewMemberId);
      return perms ?? {
        crewMemberId: input.crewMemberId,
        canViewCalendar: true,
        canViewClients: true,
        canCloseOutJobs: true,
        canAddNotes: true,
        canAddPhotos: true,
        canViewProjects: true,
        canViewVanInventory: true,
      };
    }),

  // Update permissions for a crew member
  upsert: p
    .input(z.object({
      crewMemberId: z.number(),
      canViewCalendar: z.boolean().optional(),
      canViewClients: z.boolean().optional(),
      canCloseOutJobs: z.boolean().optional(),
      canAddNotes: z.boolean().optional(),
      canAddPhotos: z.boolean().optional(),
      canViewProjects: z.boolean().optional(),
      canViewVanInventory: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { crewMemberId, ...perms } = input;
      await upsertCrewPermissions(crewMemberId, perms);
      return { success: true };
    }),

  // Get permissions for the currently logged-in crew member
  getForUser: p
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const member = await getCrewMemberByUserId(input.userId);
      if (!member) return null;
      const perms = await getCrewPermissions(member.id);
      return perms ?? {
        crewMemberId: member.id,
        canViewCalendar: true,
        canViewClients: true,
        canCloseOutJobs: true,
        canAddNotes: true,
        canAddPhotos: true,
        canViewProjects: true,
        canViewVanInventory: true,
      };
    }),

  // Get all crew members with their permissions (for admin panel)
  listAll: p.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const members = await listCrewMembers();
    const permRows = await db.select().from(crewPermissions);
    const permMap = new Map(permRows.map((pr) => [pr.crewMemberId, pr]));
    return members.map((m) => ({
      ...m,
      permissions: permMap.get(m.id) ?? {
        canViewCalendar: true,
        canViewClients: true,
        canCloseOutJobs: true,
        canAddNotes: true,
        canAddPhotos: true,
        canViewProjects: true,
        canViewVanInventory: true,
      },
    }));
  }),
});
