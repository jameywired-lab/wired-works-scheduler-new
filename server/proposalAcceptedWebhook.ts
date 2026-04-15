/**
 * POST /api/webhooks/proposal-accepted
 *
 * Called by Zapier when Portal.io fires a "proposal accepted" event.
 * Zapier maps Portal.io proposal fields to this JSON body.
 *
 * Expected body (all fields optional except clientName):
 * {
 *   secret: string,           // must match WEBHOOK_SECRET env var
 *   clientName: string,
 *   clientEmail?: string,
 *   clientPhone?: string,
 *   clientAddress?: string,   // full address string
 *   projectTitle?: string,
 *   projectDescription?: string,
 *   proposalTotal?: string,   // e.g. "$4,500"
 *   proposalUrl?: string,
 * }
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { clients, projects, followUps } from "../drizzle/schema";
import { eq, or } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { seedProjectCredentials } from "./db";

export async function handleProposalAcceptedWebhook(req: Request, res: Response) {
  try {
    // ── Secret validation ────────────────────────────────────────────────────
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const incoming =
        (req.headers["x-webhook-secret"] as string) ?? req.body?.secret ?? "";
      if (incoming !== webhookSecret) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }
    }

    const {
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      projectTitle,
      projectDescription,
      proposalTotal,
      proposalUrl,
    } = req.body ?? {};

    if (!clientName) {
      return res.status(400).json({ error: "clientName is required" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Database unavailable" });
    }

    // ── Find or create client ────────────────────────────────────────────────
    let clientId: number | null = null;

    // Try to match by email or phone first
    if (clientEmail || clientPhone) {
      const conditions = [];
      if (clientEmail) conditions.push(eq(clients.email, clientEmail));
      if (clientPhone) conditions.push(eq(clients.phone, clientPhone));
      const existing = await db
        .select()
        .from(clients)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .limit(1);
      if (existing.length > 0) {
        clientId = existing[0].id;
      }
    }

    if (!clientId) {
      // Create a new client record
      const [result] = await db.insert(clients).values({
        name: clientName,
        email: clientEmail ?? null,
        phone: clientPhone ?? null,
        addressLine1: clientAddress ?? null,
      });
      clientId = (result as any).insertId as number;
    }

    // ── Create project ───────────────────────────────────────────────────────
    const title = projectTitle ?? `${clientName} — Accepted Proposal`;
    let desc = projectDescription ?? "";
    if (proposalTotal) desc = `Proposal Total: ${proposalTotal}\n\n${desc}`.trim();
    if (proposalUrl) desc = `${desc}\n\nProposal PDF: ${proposalUrl}`.trim();

    const [projectResult] = await db.insert(projects).values({
      clientId,
      title,
      description: desc || null,
      status: "active",
      startDate: Date.now(),
    });
    const projectId = (projectResult as any).insertId as number;

    // ── Seed credentials checklist ───────────────────────────────────────────
    await seedProjectCredentials(projectId);

    // ── Create credentials follow-up ─────────────────────────────────────────
    await db.insert(followUps).values({
      type: "manual",
      title: `Collect client credentials for: ${title}`,
      notes: `New project created from accepted Portal.io proposal.\n\nPlease collect Wi-Fi, Sonos, Ring, and other access credentials from ${clientName}.`,
      clientId,
      isFollowedUp: false,
      isUrgent: false,
      proposalStatus: "none",
    } as any);

    // ── Notify owner ─────────────────────────────────────────────────────────
    await notifyOwner({
      title: `New Project Created: ${title}`,
      content: `Portal.io proposal accepted by ${clientName}. Project "${title}" has been created and a credentials checklist follow-up has been added.${proposalTotal ? ` Proposal total: ${proposalTotal}.` : ""}`,
    });

    return res.status(200).json({
      success: true,
      projectId,
      clientId,
      message: `Project "${title}" created for ${clientName}`,
    });
  } catch (err) {
    console.error("[ProposalWebhook] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
