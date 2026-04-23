import {
  boolean,
  decimal,
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
  passwordHash: varchar("passwordHash", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
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
  jobType: mysqlEnum("jobType", ["service_call", "project_job", "sales_call"]).default("service_call").notNull(),
  // Close-out fields
  closeoutNotes: text("closeoutNotes"),
  closeoutOutcome: mysqlEnum("closeoutOutcome", [
    "client_happy_bill",
    "client_issue_urgent",
    "proposal_needed",
    "bill_service_call",
  ]),
  closedAt: bigint("closedAt", { mode: "number" }), // UTC ms
  // Billing fields
  invoicedAt: bigint("invoicedAt", { mode: "number" }), // UTC ms — when invoice was sent
  paidAt: bigint("paidAt", { mode: "number" }),         // UTC ms — when payment was received
  invoiceAmount: int("invoiceAmount"),                   // cents (e.g. 15000 = $150.00)
  invoiceNotes: text("invoiceNotes"),
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
  visitStartedAt: bigint("visitStartedAt", { mode: "number" }),   // UTC ms
  visitCompletedAt: bigint("visitCompletedAt", { mode: "number" }), // UTC ms
  visitNotes: text("visitNotes"),
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
  projectType: mysqlEnum("projectType", ["new_construction", "commercial", "retrofit"]),
   startDate: bigint("startDate", { mode: "number" }), // UTC ms
  dueDate: bigint("dueDate", { mode: "number" }),     // UTC ms
  projectValue: decimal("projectValue", { precision: 12, scale: 2 }),  // $ value of the project
  jobTotal: decimal("jobTotal", { precision: 12, scale: 2 }),           // $ total of the job (what was billed)
  completedAt: bigint("completedAt", { mode: "number" }),              // UTC ms when marked completed
  leadSource: varchar("leadSource", { length: 64 }),                   // how they heard of us
  referralName: varchar("referralName", { length: 255 }),              // who referred them (if leadSource = referral)
  leadSourceOther: varchar("leadSourceOther", { length: 255 }),        // free-text for other/unknown lead
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
  weight: int("weight").default(0).notNull(), // percentage points this stage contributes
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
  type: mysqlEnum("type", ["call", "text", "manual", "closeout", "proposal", "inventory"]).default("manual").notNull(),
  note: text("note"),
  isFollowedUp: boolean("isFollowedUp").default(false).notNull(),
  contactedAt: bigint("contactedAt", { mode: "number" }), // UTC ms — when the call/text came in
  // Proposal tracking
  linkedJobId: int("linkedJobId").references(() => jobs.id),
  clientId: int("clientId").references(() => clients.id),
  email: varchar("email", { length: 320 }),
  proposalStatus: mysqlEnum("proposalStatus", ["none", "pending", "accepted", "declined", "not_ready"]).default("none").notNull(),
  proposalSentAt: bigint("proposalSentAt", { mode: "number" }), // UTC ms — when proposal was sent
  isUrgent: boolean("isUrgent").default(false).notNull(),
  urgentAt: bigint("urgentAt", { mode: "number" }), // UTC ms — when it became urgent
  remindAt: bigint("remindAt", { mode: "number" }), // UTC ms — snooze until this time
  nextStepsNote: text("nextStepsNote"), // admin notes on what to do next
  clientContacted: boolean("clientContacted").default(false).notNull(), // pinned to top when true
  messageCount: int("messageCount").default(1).notNull(), // number of grouped inbound texts
  messages: text("messages"), // JSON array of { body, receivedAt } for grouped texts
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;

// ─── Job Photos ───────────────────────────────────────────────────────────────
export const jobPhotos = mysqlTable("jobPhotos", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: text("s3Url").notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 64 }),
  sizeBytes: int("sizeBytes"),
  uploadedByUserId: int("uploadedByUserId"), // nullable — crew member user id
  // Annotation: stores S3 URL of the annotated version (null = no annotation yet)
  annotatedS3Key: varchar("annotatedS3Key", { length: 512 }),
  annotatedS3Url: text("annotatedS3Url"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobPhoto = typeof jobPhotos.$inferSelect;
export type InsertJobPhoto = typeof jobPhotos.$inferInsert;

// ─── Job Documents ────────────────────────────────────────────────────────────
export const jobDocuments = mysqlTable("jobDocuments", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: text("s3Url").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).default("application/octet-stream").notNull(),
  sizeBytes: int("sizeBytes"),
  uploadedByUserId: int("uploadedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobDocument = typeof jobDocuments.$inferSelect;
export type InsertJobDocument = typeof jobDocuments.$inferInsert;

// ─── Tags ─────────────────────────────────────────────────────────────────────
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  color: varchar("color", { length: 32 }).default("#6366f1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// ─── Client Tags (join) ───────────────────────────────────────────────────────
export const clientTags = mysqlTable("clientTags", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id),
  tagId: int("tagId").notNull().references(() => tags.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientTag = typeof clientTags.$inferSelect;
export type InsertClientTag = typeof clientTags.$inferInsert;

// ─── Project Credentials ─────────────────────────────────────────────────────
export const projectCredentials = mysqlTable("projectCredentials", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").references(() => projects.id),  // nullable — credentials now live on client
  clientId: int("clientId").references(() => clients.id),     // primary owner of this credential
  key: varchar("key", { length: 128 }).notNull(),   // e.g. "wifi_ssid", "sonos_login"
  label: varchar("label", { length: 255 }).notNull(), // e.g. "Wi-Fi SSID"
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProjectCredential = typeof projectCredentials.$inferSelect;
export type InsertProjectCredential = typeof projectCredentials.$inferInsert;

// ─── Van Inventory ────────────────────────────────────────────────────────────
export const vanInventoryItems = mysqlTable("vanInventoryItems", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  targetQty: int("targetQty").default(1).notNull(),
  currentQty: int("currentQty").default(0).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type VanInventoryItem = typeof vanInventoryItems.$inferSelect;
export type InsertVanInventoryItem = typeof vanInventoryItems.$inferInsert;

// ─── Parts Requests ───────────────────────────────────────────────────────────
export const partsRequests = mysqlTable("partsRequests", {
  id: int("id").autoincrement().primaryKey(),
  requestedBy: varchar("requestedBy", { length: 255 }).notNull().default("Crew"),
  partDescription: text("partDescription").notNull(),
  smsSent: boolean("smsSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PartsRequest = typeof partsRequests.$inferSelect;
export type InsertPartsRequest = typeof partsRequests.$inferInsert;

// ─── Email Campaigns ─────────────────────────────────────────────────────────────────────────────────────
export const emailCampaigns = mysqlTable("emailCampaigns", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  tagFilter: varchar("tagFilter", { length: 50 }), // null = all clients
  recipientCount: int("recipientCount").default(0).notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = typeof emailCampaigns.$inferInsert;

export const emailCampaignRecipients = mysqlTable("emailCampaignRecipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => emailCampaigns.id),
  clientId: int("clientId").references(() => clients.id),
  email: varchar("email", { length: 255 }).notNull(),
  clientName: varchar("clientName", { length: 255 }),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
});
export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;

// ─── Client Communications ────────────────────────────────────────────────────
export const clientCommunications = mysqlTable("clientCommunications", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull().default("inbound"),
  channel: mysqlEnum("channel", ["sms", "email", "call", "note"]).notNull().default("note"),
  subject: varchar("subject", { length: 255 }),
  body: text("body"),
  fromAddress: varchar("fromAddress", { length: 255 }), // phone or email
  toAddress: varchar("toAddress", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientCommunication = typeof clientCommunications.$inferSelect;
export type InsertClientCommunication = typeof clientCommunications.$inferInsert;

// ─── SMS Templates ────────────────────────────────────────────────────────────
export const smsTemplates = mysqlTable("smsTemplates", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  body: text("body").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = typeof smsTemplates.$inferInsert;

// ─── Project Notes ────────────────────────────────────────────────────────────
export const projectNotes = mysqlTable("projectNotes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  authorName: varchar("authorName", { length: 255 }).default("Admin"),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProjectNote = typeof projectNotes.$inferSelect;
export type InsertProjectNote = typeof projectNotes.$inferInsert;

// ─── Project Photos ───────────────────────────────────────────────────────────
export const projectPhotos = mysqlTable("projectPhotos", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().references(() => projects.id),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: text("s3Url").notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 64 }),
  sizeBytes: int("sizeBytes"),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProjectPhoto = typeof projectPhotos.$inferSelect;
export type InsertProjectPhoto = typeof projectPhotos.$inferInsert;
// ─── Client Notes ─────────────────────────────────────────────────────────────────────────────────────────
export const clientNotes = mysqlTable("clientNotes", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  authorName: varchar("authorName", { length: 255 }).notNull().default("Admin"),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientNote = typeof clientNotes.$inferSelect;
export type InsertClientNote = typeof clientNotes.$inferInsert;

// ─── Client Photos ───────────────────────────────────────────────────────────────────────────────────────
export const clientPhotos = mysqlTable("clientPhotos", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  s3Url: text("s3Url").notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 64 }),
  sizeBytes: int("sizeBytes"),
  uploadedBy: varchar("uploadedBy", { length: 255 }).notNull().default("Admin"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientPhoto = typeof clientPhotos.$inferSelect;
export type InsertClientPhoto = typeof clientPhotos.$inferInsert;

// ─── Activity Log (undo/restore) ─────────────────────────────────────────────────
export const activityLog = mysqlTable("activityLog", {
  id: int("id").autoincrement().primaryKey(),
  action: mysqlEnum("action", ["delete", "complete", "update"]).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(), // "client" | "job" | "followUp" | "crewMember" | "tag" | "clientTag"
  entityId: int("entityId").notNull(),
  entityLabel: varchar("entityLabel", { length: 512 }), // human-readable name for display
  snapshotJson: text("snapshotJson").notNull(), // full JSON of the row before the action
  performedAt: timestamp("performedAt").defaultNow().notNull(),
  undoneAt: timestamp("undoneAt"), // null = not undone yet
});
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type InsertActivityLogEntry = typeof activityLog.$inferInsert;

// ─── Crew Tasks (owner-assigned errands/tasks for crew) ───────────────────────
export const crewTasks = mysqlTable("crewTasks", {
  id: int("id").autoincrement().primaryKey(),
  assignedToCrewMemberId: int("assignedToCrewMemberId").notNull().references(() => crewMembers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: bigint("dueDate", { mode: "number" }),
  isComplete: boolean("isComplete").default(false).notNull(),
  completedAt: bigint("completedAt", { mode: "number" }),
  createdBy: varchar("createdBy", { length: 255 }).default("Admin"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrewTask = typeof crewTasks.$inferSelect;
export type InsertCrewTask = typeof crewTasks.$inferInsert;

// ─── Crew Permissions (per-crew feature access toggles) ───────────────────────
export const crewPermissions = mysqlTable("crewPermissions", {
  id: int("id").autoincrement().primaryKey(),
  crewMemberId: int("crewMemberId").notNull().unique().references(() => crewMembers.id, { onDelete: "cascade" }),
  canViewCalendar: boolean("canViewCalendar").default(true).notNull(),
  canViewClients: boolean("canViewClients").default(true).notNull(),
  canCloseOutJobs: boolean("canCloseOutJobs").default(true).notNull(),
  canAddNotes: boolean("canAddNotes").default(true).notNull(),
  canAddPhotos: boolean("canAddPhotos").default(true).notNull(),
  canViewProjects: boolean("canViewProjects").default(true).notNull(),
  canViewVanInventory: boolean("canViewVanInventory").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CrewPermission = typeof crewPermissions.$inferSelect;
export type InsertCrewPermission = typeof crewPermissions.$inferInsert;

// ─── App Notifications (in-app bell notifications) ────────────────────────────
export const appNotifications = mysqlTable("appNotifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  type: mysqlEnum("type", ["inbound_sms", "inbound_call", "task_complete", "job_update", "general"]).default("general").notNull(),
  relatedId: int("relatedId"),          // e.g. followUp id, job id
  relatedType: varchar("relatedType", { length: 64 }), // "followUp" | "job" | "crewTask"
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AppNotification = typeof appNotifications.$inferSelect;
export type InsertAppNotification = typeof appNotifications.$inferInsert;

// ─── Call Log ─────────────────────────────────────────────────────────────────
export const callLog = mysqlTable("callLog", {
  id: int("id").autoincrement().primaryKey(),
  openPhoneCallId: varchar("openPhoneCallId", { length: 255 }),
  from: varchar("from", { length: 50 }).notNull(),
  to: varchar("to", { length: 50 }).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull().default("inbound"),
  status: mysqlEnum("status", ["completed", "missed", "voicemail", "no-answer", "busy", "failed"]).notNull().default("completed"),
  duration: int("duration"), // seconds
  recordingUrl: text("recordingUrl"),
  transcription: text("transcription"),
  clientId: int("clientId").references(() => clients.id),
  contactName: varchar("contactName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CallLog = typeof callLog.$inferSelect;
export type InsertCallLog = typeof callLog.$inferInsert;

// ─── Inbound SMS Log ─────────────────────────────────────────────────────────
export const inboundSmsLog = mysqlTable("inboundSmsLog", {
  id: int("id").autoincrement().primaryKey(),
  openPhoneMessageId: varchar("openPhoneMessageId", { length: 255 }),
  from: varchar("from", { length: 50 }).notNull(),
  to: varchar("to", { length: 50 }).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull().default("inbound"),
  body: text("body").notNull(),
  clientId: int("clientId").references(() => clients.id),
  contactName: varchar("contactName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InboundSmsLog = typeof inboundSmsLog.$inferSelect;
export type InsertInboundSmsLog = typeof inboundSmsLog.$inferInsert;

// ─── Parts Catalog ────────────────────────────────────────────────────────────
export const parts = mysqlTable("parts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Part = typeof parts.$inferSelect;
export type InsertPart = typeof parts.$inferInsert;

// ─── Job Parts Sold ───────────────────────────────────────────────────────────
export const jobParts = mysqlTable("jobParts", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  partId: int("partId").notNull().references(() => parts.id),
  crewMemberId: int("crewMemberId").references(() => users.id),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  soldAt: timestamp("soldAt").defaultNow().notNull(),
  notes: text("notes"),
});
export type JobPart = typeof jobParts.$inferSelect;
export type InsertJobPart = typeof jobParts.$inferInsert;
