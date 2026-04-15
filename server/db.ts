import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Client,
  ClientAddress,
  CrewMember,
  CrewNote,
  InsertClient,
  InsertClientAddress,
  InsertCrewMember,
  InsertCrewNote,
  InsertFollowUp,
  InsertJob,
  InsertJobAssignment,
  InsertProject,
  InsertProjectMilestone,
  InsertProjectReminder,
  InsertSmsLog,
  InsertJobPhoto,
  InsertUser,
  Job,
  JobPhoto,
  clientAddresses,
  clientTags,
  clients,
  crewMembers,
  crewNotes,
  followUps,
  jobAssignments,
  jobPhotos,
  jobs,
  projectMilestones,
  projectReminders,
  projects,
  smsLog,
  tags,
  users,
  InsertTag,
  InsertClientTag,
  Tag,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "crew") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function createManualUser(data: { name: string; email?: string; role: "user" | "admin" | "crew" }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Generate a unique synthetic openId for manually-created users
  const openId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email ?? null,
    loginMethod: "manual",
    role: data.role,
    lastSignedIn: new Date(),
  });
  return { openId };
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(users).where(eq(users.id, userId));
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export async function listClients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).orderBy(clients.name);
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function createClient(data: Omit<InsertClient, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(clients).values(data);
  return result[0];
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(clients).set(data).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(clients).where(eq(clients.id, id));
}

// ─── Crew Members ─────────────────────────────────────────────────────────────
export async function listCrewMembers(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(crewMembers).where(eq(crewMembers.isActive, true)).orderBy(crewMembers.name);
  }
  return db.select().from(crewMembers).orderBy(crewMembers.name);
}

export async function getCrewMemberById(id: number): Promise<CrewMember | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(crewMembers).where(eq(crewMembers.id, id)).limit(1);
  return result[0];
}

export async function createCrewMember(data: Omit<InsertCrewMember, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(crewMembers).values(data);
  return result[0];
}

export async function updateCrewMember(id: number, data: Partial<InsertCrewMember>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(crewMembers).set(data).where(eq(crewMembers.id, id));
}

export async function deleteCrewMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(crewMembers).set({ isActive: false }).where(eq(crewMembers.id, id));
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export async function listJobs() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: jobs.id,
      clientId: jobs.clientId,
      title: jobs.title,
      description: jobs.description,
      status: jobs.status,
      scheduledStart: jobs.scheduledStart,
      scheduledEnd: jobs.scheduledEnd,
      address: jobs.address,
      ownerInstructions: jobs.ownerInstructions,
      googleCalendarEventId: jobs.googleCalendarEventId,
      jobType: jobs.jobType,
      bookingSmsSent: jobs.bookingSmsSent,
      reminderSmsSent: jobs.reminderSmsSent,
      reviewSmsSent: jobs.reviewSmsSent,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .orderBy(desc(jobs.scheduledStart));
  return rows;
}

export async function listJobsByDateRange(startMs: number, endMs: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(jobs)
    .where(and(gte(jobs.scheduledStart, startMs), lte(jobs.scheduledStart, endMs)))
    .orderBy(jobs.scheduledStart);
}

export async function listJobsForCrew(crewMemberId: number) {
  const db = await getDb();
  if (!db) return [];
  const assignments = await db
    .select({ jobId: jobAssignments.jobId })
    .from(jobAssignments)
    .where(eq(jobAssignments.crewMemberId, crewMemberId));
  const jobIds = assignments.map((a) => a.jobId);
  if (jobIds.length === 0) return [];
  return db
    .select()
    .from(jobs)
    .where(sql`${jobs.id} IN (${sql.join(jobIds.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(jobs.scheduledStart);
}

export async function getJobById(id: number): Promise<Job | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result[0];
}

export async function createJob(data: Omit<InsertJob, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(jobs).values(data);
  return result[0];
}

export async function updateJob(id: number, data: Partial<InsertJob>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(jobs).set(data).where(eq(jobs.id, id));
}

export async function deleteJob(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(jobs).where(eq(jobs.id, id));
}

// ─── Job Assignments ──────────────────────────────────────────────────────────
export async function getJobAssignments(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: jobAssignments.id,
      jobId: jobAssignments.jobId,
      crewMemberId: jobAssignments.crewMemberId,
      createdAt: jobAssignments.createdAt,
      crewMemberName: crewMembers.name,
    })
    .from(jobAssignments)
    .leftJoin(crewMembers, eq(jobAssignments.crewMemberId, crewMembers.id))
    .where(eq(jobAssignments.jobId, jobId));
  return rows;
}

export async function assignCrewToJob(data: InsertJobAssignment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Avoid duplicate assignments
  const existing = await db
    .select()
    .from(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, data.jobId),
        eq(jobAssignments.crewMemberId, data.crewMemberId)
      )
    )
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(jobAssignments).values(data);
}

export async function unassignCrewFromJob(jobId: number, crewMemberId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(jobAssignments)
    .where(
      and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.crewMemberId, crewMemberId)
      )
    );
}

export async function replaceJobAssignments(jobId: number, crewMemberIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(jobAssignments).where(eq(jobAssignments.jobId, jobId));
  if (crewMemberIds.length > 0) {
    await db.insert(jobAssignments).values(
      crewMemberIds.map((crewMemberId) => ({ jobId, crewMemberId }))
    );
  }
}

// ─── Crew Notes ───────────────────────────────────────────────────────────────
export async function getCrewNotesByJob(jobId: number): Promise<CrewNote[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(crewNotes)
    .where(eq(crewNotes.jobId, jobId))
    .orderBy(desc(crewNotes.createdAt));
}

export async function createCrewNote(data: Omit<InsertCrewNote, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(crewNotes).values(data);
  return result[0];
}

export async function updateCrewNote(id: number, data: Partial<InsertCrewNote>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(crewNotes).set(data).where(eq(crewNotes.id, id));
}

export async function deleteCrewNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(crewNotes).where(eq(crewNotes.id, id));
}

// ─── SMS Log ──────────────────────────────────────────────────────────────────
export async function createSmsLog(data: Omit<InsertSmsLog, "id" | "sentAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(smsLog).values(data);
}

export async function getSmsLogByJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsLog).where(eq(smsLog.jobId, jobId)).orderBy(desc(smsLog.sentAt));
}

// ─── Client Addresses ────────────────────────────────────────────────────────
export async function getClientAddresses(clientId: number): Promise<ClientAddress[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clientAddresses)
    .where(eq(clientAddresses.clientId, clientId))
    .orderBy(desc(clientAddresses.isPrimary), clientAddresses.label);
}

export async function createClientAddress(
  data: Omit<InsertClientAddress, "id" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // If this is being set as primary, unset all others for this client first
  if (data.isPrimary) {
    await db
      .update(clientAddresses)
      .set({ isPrimary: false })
      .where(eq(clientAddresses.clientId, data.clientId));
  }
  const result = await db.insert(clientAddresses).values(data);
  return result[0];
}

export async function updateClientAddress(
  id: number,
  clientId: number,
  data: Partial<InsertClientAddress>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (data.isPrimary) {
    await db
      .update(clientAddresses)
      .set({ isPrimary: false })
      .where(eq(clientAddresses.clientId, clientId));
  }
  await db.update(clientAddresses).set(data).where(eq(clientAddresses.id, id));
}

export async function deleteClientAddress(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(clientAddresses).where(eq(clientAddresses.id, id));
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboardData() {
  const db = await getDb();
  if (!db) return { todayJobs: [], upcomingJobs: [], recentJobs: [], totalClients: 0, totalCrew: 0 };

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [todayJobs, upcomingJobs, recentJobs, clientCount, crewCount] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(
        and(
          gte(jobs.scheduledStart, todayStart.getTime()),
          lte(jobs.scheduledStart, todayEnd.getTime())
        )
      )
      .orderBy(jobs.scheduledStart),
    db
      .select()
      .from(jobs)
      .where(
        and(
          gte(jobs.scheduledStart, now),
          sql`${jobs.status} != 'cancelled'`
        )
      )
      .orderBy(jobs.scheduledStart)
      .limit(10),
    db.select().from(jobs).orderBy(desc(jobs.updatedAt)).limit(5),
    db.select({ count: sql<number>`count(*)` }).from(clients),
    db.select({ count: sql<number>`count(*)` }).from(crewMembers).where(eq(crewMembers.isActive, true)),
  ]);

  return {
    todayJobs,
    upcomingJobs,
    recentJobs,
    totalClients: clientCount[0]?.count ?? 0,
    totalCrew: crewCount[0]?.count ?? 0,
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function listProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projects).values(data);
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;
  // milestones and reminders cascade-delete via FK
  await db.delete(projects).where(eq(projects.id, id));
}

// ─── Project Milestones ───────────────────────────────────────────────────────
export async function getMilestonesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, projectId))
    .orderBy(projectMilestones.sortOrder, projectMilestones.createdAt);
}

export async function createMilestone(data: InsertProjectMilestone) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projectMilestones).values(data);
}

export async function updateMilestone(id: number, data: Partial<InsertProjectMilestone>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectMilestones).set(data).where(eq(projectMilestones.id, id));
}

export async function deleteMilestone(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectMilestones).where(eq(projectMilestones.id, id));
}

// ─── Project Reminders ────────────────────────────────────────────────────────
export async function getRemindersByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectReminders)
    .where(eq(projectReminders.projectId, projectId))
    .orderBy(projectReminders.remindAt);
}

export async function getDueReminders(nowMs: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectReminders)
    .where(
      and(
        lte(projectReminders.remindAt, nowMs),
        eq(projectReminders.isDismissed, false)
      )
    )
    .orderBy(projectReminders.remindAt);
}

export async function createReminder(data: InsertProjectReminder) {
  const db = await getDb();
  if (!db) return;
  await db.insert(projectReminders).values(data);
}

export async function updateReminder(id: number, data: Partial<InsertProjectReminder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectReminders).set(data).where(eq(projectReminders.id, id));
}

export async function deleteReminder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectReminders).where(eq(projectReminders.id, id));
}

// ─── Follow-Ups ───────────────────────────────────────────────────────────────
export async function listFollowUps(opts?: { startMs?: number; endMs?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.startMs !== undefined) conditions.push(gte(followUps.createdAt, new Date(opts.startMs)));
  if (opts?.endMs !== undefined) conditions.push(lte(followUps.createdAt, new Date(opts.endMs)));
  const query = db.select().from(followUps);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(followUps.createdAt));
  }
  return query.orderBy(desc(followUps.createdAt));
}

export async function createFollowUp(data: InsertFollowUp) {
  const db = await getDb();
  if (!db) return;
  await db.insert(followUps).values(data);
}

export async function updateFollowUp(id: number, data: Partial<InsertFollowUp>) {
  const db = await getDb();
  if (!db) return;
  await db.update(followUps).set(data).where(eq(followUps.id, id));
}

export async function deleteFollowUp(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(followUps).where(eq(followUps.id, id));
}

// ─── Job Photos ───────────────────────────────────────────────────────────────
export async function getJobPhotos(jobId: number): Promise<JobPhoto[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobPhotos).where(eq(jobPhotos.jobId, jobId)).orderBy(jobPhotos.createdAt);
}

export async function createJobPhoto(data: Omit<InsertJobPhoto, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(jobPhotos).values(data);
  return result[0];
}

export async function deleteJobPhoto(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(jobPhotos).where(eq(jobPhotos.id, id));
}

// ─── Tags ─────────────────────────────────────────────────────────────────────
export async function listTags(): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).orderBy(tags.name);
}

export async function createTag(data: Omit<InsertTag, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(tags).values(data);
  return result[0];
}

export async function deleteTag(id: number) {
  const db = await getDb();
  if (!db) return;
  // Remove all clientTag associations first
  await db.delete(clientTags).where(eq(clientTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
}

// ─── Client Tags ──────────────────────────────────────────────────────────────
export async function getTagsForClient(clientId: number): Promise<Tag[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ tag: tags })
    .from(clientTags)
    .innerJoin(tags, eq(clientTags.tagId, tags.id))
    .where(eq(clientTags.clientId, clientId));
  return rows.map((r) => r.tag);
}

export async function addTagToClient(data: Omit<InsertClientTag, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Avoid duplicates
  const existing = await db
    .select()
    .from(clientTags)
    .where(and(eq(clientTags.clientId, data.clientId), eq(clientTags.tagId, data.tagId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(clientTags).values(data);
}

export async function removeTagFromClient(clientId: number, tagId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(clientTags)
    .where(and(eq(clientTags.clientId, clientId), eq(clientTags.tagId, tagId)));
}

export async function getClientsByTag(tagId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ client: clients })
    .from(clientTags)
    .innerJoin(clients, eq(clientTags.clientId, clients.id))
    .where(eq(clientTags.tagId, tagId));
  return rows.map((r) => r.client);
}

// ─── Job Close-Out ────────────────────────────────────────────────────────────
export async function closeJob(
  id: number,
  data: {
    closeoutNotes: string;
    closeoutOutcome: "client_happy_bill" | "client_issue_urgent" | "proposal_needed" | "bill_service_call";
    closedAt: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(jobs)
    .set({ ...data, status: "completed" })
    .where(eq(jobs.id, id));
}

export async function getFollowUpById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
  return rows[0];
}

export async function getClientByPhone(phone: string): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  // Normalise to digits only for comparison
  const digits = phone.replace(/\D/g, "");
  const all = await db.select().from(clients).orderBy(clients.name);
  return all.find((c) => c.phone && c.phone.replace(/\D/g, "").endsWith(digits.slice(-10)));
}
