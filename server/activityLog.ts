import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getDb } from "./db";
import {
  activityLog,
  clients,
  jobs,
  followUps,
  crewMembers,
  tags,
  clientTags,
  InsertClient,
  InsertJob,
  InsertFollowUp,
  InsertCrewMember,
  InsertTag,
  InsertClientTag,
} from "../drizzle/schema";

export type EntityType = "client" | "job" | "followUp" | "crewMember" | "tag" | "clientTag";

/** Log an action before it happens (pass the full row snapshot) */
export async function logActivity({
  action,
  entityType,
  entityId,
  entityLabel,
  snapshot,
}: {
  action: "delete" | "complete" | "update";
  entityType: EntityType;
  entityId: number;
  entityLabel: string;
  snapshot: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values({
    action,
    entityType,
    entityId,
    entityLabel,
    snapshotJson: JSON.stringify(snapshot),
  });
}

/** List recent activity log entries (last 30 days, not yet undone) */
export async function listActivityLog() {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(activityLog)
    .where(and(isNull(activityLog.undoneAt), gte(activityLog.performedAt, cutoff)))
    .orderBy(desc(activityLog.performedAt))
    .limit(200);
}

/** Undo an activity log entry by restoring the snapshot */
export async function undoActivity(logId: number): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "Database unavailable" };
  const [entry] = await db.select().from(activityLog).where(eq(activityLog.id, logId));
  if (!entry) return { success: false, message: "Log entry not found" };
  if (entry.undoneAt) return { success: false, message: "Already undone" };

  let snapshot: Record<string, unknown>;
  try {
    snapshot = JSON.parse(entry.snapshotJson);
  } catch {
    return { success: false, message: "Invalid snapshot data" };
  }

  try {
    if (entry.action === "delete") {
      await restoreDeleted(db, entry.entityType as EntityType, snapshot);
    } else if (entry.action === "complete") {
      await restoreCompleted(db, entry.entityType as EntityType, entry.entityId, snapshot);
    }

    // Mark as undone
    await db
      .update(activityLog)
      .set({ undoneAt: new Date() })
      .where(eq(activityLog.id, logId));

    return { success: true, message: `Restored: ${entry.entityLabel}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Restore failed: ${msg}` };
  }
}

type DbType = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function restoreDeleted(db: DbType, entityType: EntityType, snapshot: Record<string, unknown>) {
  // Strip auto-generated / immutable fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = snapshot;

  switch (entityType) {
    case "client":
      await db.insert(clients).values(rest as InsertClient);
      break;
    case "job":
      await db.insert(jobs).values(rest as InsertJob);
      break;
    case "followUp":
      await db.insert(followUps).values(rest as InsertFollowUp);
      break;
    case "crewMember":
      await db.insert(crewMembers).values(rest as InsertCrewMember);
      break;
    case "tag":
      await db.insert(tags).values(rest as InsertTag);
      break;
    case "clientTag":
      await db.insert(clientTags).values(rest as InsertClientTag);
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

async function restoreCompleted(db: DbType, entityType: EntityType, entityId: number, snapshot: Record<string, unknown>) {
  switch (entityType) {
    case "followUp":
      await db
        .update(followUps)
        .set({ isFollowedUp: false, contactedAt: null })
        .where(eq(followUps.id, entityId));
      break;
    case "job": {
      const status = snapshot.status as "scheduled" | "in_progress" | "completed" | "cancelled";
      await db.update(jobs).set({ status }).where(eq(jobs.id, entityId));
      break;
    }
    default:
      throw new Error(`Cannot undo complete for entity type: ${entityType}`);
  }
}
