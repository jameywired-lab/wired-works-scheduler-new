/**
 * POST /api/webhooks/proposal-accepted
 * GET  /api/webhooks/proposal-accepted/info   ← returns field schema for Zapier setup
 *
 * Accepts BOTH Portal.io native fields AND the original generic field names so
 * either a direct Zapier mapping or a manual call works.
 *
 * Portal.io fields (from Zapier test data):
 *   name          → project title
 *   number        → proposal/order number (appended to description)
 *   total         → proposal dollar total
 *   status        → order status (we accept any; Zapier filter should pre-screen)
 *   createdDate   → project start date
 *   modifiedDate  → informational
 *   partCount     → informational
 *   orderSuppliers → array of supplier objects; first entry may have client info
 *
 * Generic fallback fields (for manual / custom Zapier mapping):
 *   clientName, clientEmail, clientPhone, clientAddress
 *   projectTitle, projectDescription, proposalTotal, proposalUrl
 *
 * Auth: optional WEBHOOK_SECRET checked via x-webhook-secret header or body.secret
 */

import type { Request, Response } from "express";
import { getDb, seedProjectCredentials } from "./db";
import { clients, projects, followUps } from "../drizzle/schema";
import { eq, or } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// ── In-memory log of last 10 webhook calls (for the info page) ────────────────
interface WebhookLogEntry {
  receivedAt: string;
  status: "ok" | "error" | "rejected";
  projectTitle?: string;
  clientName?: string;
  message: string;
}
const webhookLog: WebhookLogEntry[] = [];
function logCall(entry: WebhookLogEntry) {
  webhookLog.unshift(entry);
  if (webhookLog.length > 10) webhookLog.pop();
}

// ── GET /info ─────────────────────────────────────────────────────────────────
export function handleWebhookInfo(_req: Request, res: Response) {
  return res.json({
    endpoint: "POST /api/webhooks/proposal-accepted",
    description: "Called by Zapier when a Portal.io proposal is accepted. Auto-creates a project and credentials checklist.",
    authentication: {
      method: "Header",
      header: "x-webhook-secret",
      note: "Set the same value as WEBHOOK_SECRET in your app environment. Omit header if WEBHOOK_SECRET is not set.",
    },
    portalIoFields: {
      name: "Order/proposal name → used as project title",
      number: "Order number → appended to project description",
      total: "Proposal dollar total → shown in project description",
      status: "Order status (filter to 'accepted' in Zapier before calling this webhook)",
      createdDate: "ISO date string → used as project start date",
      orderSuppliers: "Array of supplier objects (optional, used to extract client info if present)",
    },
    optionalOverrideFields: {
      clientName: "Override client name (if not derivable from orderSuppliers)",
      clientEmail: "Client email for matching/creating client record",
      clientPhone: "Client phone for matching/creating client record",
      clientAddress: "Client address",
      projectTitle: "Override project title (defaults to 'name')",
      projectDescription: "Additional description text",
      proposalUrl: "Link to the proposal PDF",
    },
    recentCalls: webhookLog,
  });
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function handleProposalAcceptedWebhook(req: Request, res: Response) {
  const receivedAt = new Date().toISOString();

  try {
    // ── Secret validation ──────────────────────────────────────────────────────
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const incoming =
        (req.headers["x-webhook-secret"] as string | undefined) ??
        (req.body?.secret as string | undefined) ??
        "";
      if (incoming !== webhookSecret) {
        logCall({ receivedAt, status: "rejected", message: "Invalid webhook secret" });
        return res.status(401).json({ error: "Invalid webhook secret" });
      }
    }

    const body = req.body ?? {};

    // ── Map Portal.io fields → internal fields ─────────────────────────────────
    // Portal.io sends: name, number, total, status, createdDate, orderSuppliers
    // We also accept the original generic field names as overrides.

    // Extract client info from orderSuppliers[0] if present
    let supplierClientName: string | undefined;
    let supplierClientEmail: string | undefined;
    let supplierClientPhone: string | undefined;
    if (Array.isArray(body.orderSuppliers) && body.orderSuppliers.length > 0) {
      const s = body.orderSuppliers[0] as Record<string, unknown>;
      supplierClientName = (s.name ?? s.supplierName ?? s.contactName ?? "") as string || undefined;
      supplierClientEmail = (s.email ?? s.contactEmail ?? "") as string || undefined;
      supplierClientPhone = (s.phone ?? s.contactPhone ?? "") as string || undefined;
    }

    // Resolve final values (generic overrides take priority over Portal.io fields)
    const clientName: string =
      (body.clientName as string) ||
      supplierClientName ||
      (body.name as string) ||
      "Unknown Client";

    const clientEmail: string | undefined =
      (body.clientEmail as string) || supplierClientEmail || undefined;

    const clientPhone: string | undefined =
      (body.clientPhone as string) || supplierClientPhone || undefined;

    const clientAddress: string | undefined =
      (body.clientAddress as string) || undefined;

    const projectTitle: string =
      (body.projectTitle as string) ||
      (body.name as string) ||
      `${clientName} — Accepted Proposal`;

    // Build description from available fields
    const descParts: string[] = [];
    if (body.projectDescription) descParts.push(body.projectDescription as string);
    if (body.total ?? body.proposalTotal) {
      const total = (body.total ?? body.proposalTotal) as string;
      descParts.push(`Proposal Total: ${total}`);
    }
    if (body.number) descParts.push(`Proposal #: ${body.number}`);
    if (body.proposalUrl) descParts.push(`Proposal PDF: ${body.proposalUrl}`);
    if (body.status) descParts.push(`Portal.io Status: ${body.status}`);
    const projectDescription = descParts.join("\n") || null;

    // Parse start date from createdDate if provided
    let startDate = Date.now();
    if (body.createdDate) {
      const parsed = Date.parse(body.createdDate as string);
      if (!isNaN(parsed)) startDate = parsed;
    }

    // ── DB operations ──────────────────────────────────────────────────────────
    const db = await getDb();
    if (!db) {
      logCall({ receivedAt, status: "error", projectTitle, clientName, message: "Database unavailable" });
      return res.status(503).json({ error: "Database unavailable" });
    }

    // Find or create client
    let clientId: number | null = null;
    if (clientEmail || clientPhone) {
      const conditions: ReturnType<typeof eq>[] = [];
      if (clientEmail) conditions.push(eq(clients.email, clientEmail));
      if (clientPhone) conditions.push(eq(clients.phone, clientPhone));
      const existing = await db
        .select()
        .from(clients)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .limit(1);
      if (existing.length > 0) clientId = existing[0].id;
    }

    if (!clientId) {
      const [result] = await db.insert(clients).values({
        name: clientName,
        email: clientEmail ?? null,
        phone: clientPhone ?? null,
        addressLine1: clientAddress ?? null,
      });
      clientId = (result as any).insertId as number;
    }

    // Create project
    const [projectResult] = await db.insert(projects).values({
      clientId,
      title: projectTitle,
      description: projectDescription,
      status: "active",
      startDate,
    });
    const projectId = (projectResult as any).insertId as number;

    // Seed credentials checklist
    await seedProjectCredentials(projectId);

    // Create credentials follow-up
    await db.insert(followUps).values({
      type: "manual",
      title: `Collect client credentials for: ${projectTitle}`,
      notes: `New project created from accepted Portal.io proposal.\n\nPlease collect Wi-Fi, Sonos, Ring, and other access credentials from ${clientName}.`,
      clientId,
      isFollowedUp: false,
      isUrgent: false,
      proposalStatus: "none",
    } as any);

    // Notify owner
    await notifyOwner({
      title: `New Project: ${projectTitle}`,
      content: `Portal.io proposal accepted by ${clientName}. Project "${projectTitle}" has been created.${body.total ? ` Total: ${body.total}` : ""}`,
    });

    logCall({ receivedAt, status: "ok", projectTitle, clientName, message: `Project #${projectId} created` });

    return res.status(200).json({
      success: true,
      projectId,
      clientId,
      message: `Project "${projectTitle}" created for ${clientName}`,
    });
  } catch (err) {
    console.error("[ProposalWebhook] Error:", err);
    logCall({ receivedAt, status: "error", message: String(err) });
    return res.status(500).json({ error: "Internal server error" });
  }
}
