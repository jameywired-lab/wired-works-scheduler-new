import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Users (auth) ────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "crew"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Clients ─────────────────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  addressLine1: varchar("addressLine1", { length: 255 }),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  zip: varchar("zip", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Crew Members ─────────────────────────────────────────────────────────────
export const crewMembers = mysqlTable("crewMembers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  role: varchar("role", { length: 128 }).default("Technician"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertCrewMember = typeof crewMembers.$inferInsert;

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId")
    .notNull()
    .references(() => clients.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", [
    "scheduled",
    "in_progress",
    "completed",
    "cancelled",
  ])
    .default("scheduled")
    .notNull(),
  scheduledStart: bigint("scheduledStart", { mode: "number" }).notNull(), // UTC ms
  scheduledEnd: bigint("scheduledEnd", { mode: "number" }).notNull(),     // UTC ms
  address: varchar("address", { length: 512 }),
  ownerInstructions: text("ownerInstructions"),
  googleCalendarEventId: varchar("googleCalendarEventId", { length: 255 }),
  // SMS tracking
  bookingSmsSent: boolean("bookingSmsSent").default(false).notNull(),
  reminderSmsSent: boolean("reminderSmsSent").default(false).notNull(),
  reviewSmsSent: boolean("reviewSmsSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ─── Job Assignments (crew → job) ─────────────────────────────────────────────
export const jobAssignments = mysqlTable("jobAssignments", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId")
    .notNull()
    .references(() => jobs.id),
  crewMemberId: int("crewMemberId")
    .notNull()
    .references(() => crewMembers.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobAssignment = typeof jobAssignments.$inferSelect;
export type InsertJobAssignment = typeof jobAssignments.$inferInsert;

// ─── Crew Notes (field notes from crew after job) ─────────────────────────────
export const crewNotes = mysqlTable("crewNotes", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId")
    .notNull()
    .references(() => jobs.id),
  crewMemberId: int("crewMemberId").references(() => crewMembers.id),
  authorName: varchar("authorName", { length: 255 }),
  content: text("content").notNull(),
  // Sensitive: client credentials or access codes
  credentials: text("credentials"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrewNote = typeof crewNotes.$inferSelect;
export type InsertCrewNote = typeof crewNotes.$inferInsert;

// ─── SMS Log ──────────────────────────────────────────────────────────────────
export const smsLog = mysqlTable("smsLog", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").references(() => jobs.id),
  clientId: int("clientId").references(() => clients.id),
  toPhone: varchar("toPhone", { length: 32 }).notNull(),
  messageType: mysqlEnum("messageType", ["booking", "reminder", "review"]).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 64 }).default("sent"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type SmsLog = typeof smsLog.$inferSelect;
export type InsertSmsLog = typeof smsLog.$inferInsert;

// ─── Google Tokens ────────────────────────────────────────────────────────────
export const googleTokens = mysqlTable("googleTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  calendarId: varchar("calendarId", { length: 255 }).default("primary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleToken = typeof googleTokens.$inferSelect;
export type InsertGoogleToken = typeof googleTokens.$inferInsert;

// ─── Client Addresses ────────────────────────────────────────────────────────
export const clientAddresses = mysqlTable("clientAddresses", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id),
  label: varchar("label", { length: 64 }).notNull().default("Home"), // Home, Business, Vacation, Other, or custom
  addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
  addressLine2: varchar("addressLine2", { length: 255 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 64 }),
  zip: varchar("zip", { length: 20 }),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientAddress = typeof clientAddresses.$inferSelect;
export type InsertClientAddress = typeof clientAddresses.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "on_hold", "completed", "cancelled"]).default("active").notNull(),
  startDate: bigint("startDate", { mode: "number" }), // UTC ms
  dueDate: bigint("dueDate", { mode: "number" }),     // UTC ms
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Project Milestones ───────────────────────────────────────────────────────
export const projectMilestones = mysqlTable("projectMilestones", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  title: varchar("title", { length: 255 }).notNull(),
  isComplete: boolean("isComplete").default(false).notNull(),
  dueDate: bigint("dueDate", { mode: "number" }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type InsertProjectMilestone = typeof projectMilestones.$inferInsert;

// ─── Project Reminders ────────────────────────────────────────────────────────
export const projectReminders = mysqlTable("projectReminders", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  message: text("message").notNull(),
  remindAt: bigint("remindAt", { mode: "number" }).notNull(), // UTC ms
  isDismissed: boolean("isDismissed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectReminder = typeof projectReminders.$inferSelect;
export type InsertProjectReminder = typeof projectReminders.$inferInsert;

// ─── Follow-Ups ───────────────────────────────────────────────────────────────
export const followUps = mysqlTable("followUps", {
  id: int("id").autoincrement().primaryKey(),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  type: mysqlEnum("type", ["call", "text", "manual"]).default("manual").notNull(),
  note: text("note"),
  isFollowedUp: boolean("isFollowedUp").default(false).notNull(),
  contactedAt: bigint("contactedAt", { mode: "number" }), // UTC ms — when the call/text came in
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;
