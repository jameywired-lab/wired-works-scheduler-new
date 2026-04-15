/**
 * OpenPhone Webhook Handler
 *
 * Handles inbound events from OpenPhone and auto-creates follow-ups:
 *   - message.received  → inbound SMS/MMS → follow-up type "text"
 *   - call.completed    → missed call or voicemail → follow-up type "call"
 *
 * Register this at POST /api/openphone/webhook in the Express server.
 *
 * OpenPhone sends events as JSON with the shape:
 *   { type: string, data: { object: { ... } } }
 *
 * Docs: https://www.openphone.com/docs/api-reference/webhooks
 */

import type { Request, Response } from "express";
import { createFollowUp, getClientByPhone, getDb } from "./db";
import { clientCommunications } from "../drizzle/schema";

// ─── Type stubs for OpenPhone webhook payloads ────────────────────────────────

interface OpenPhoneFrom {
  name?: string;
  phoneNumber?: string;
}

interface OpenPhoneMessageObject {
  from?: string;           // E.164 phone number
  body?: string;           // SMS body text
  direction?: string;      // "incoming" | "outgoing"
  media?: { url: string }[];
}

interface OpenPhoneCallObject {
  from?: string;           // E.164 phone number
  direction?: string;      // "incoming" | "outgoing"
  status?: string;         // "missed" | "completed" | "voicemail" etc.
  voicemailUrl?: string;
  transcription?: string;  // Voicemail transcription if available
  duration?: number;       // seconds
}

interface OpenPhoneParticipant {
  name?: string;
  phoneNumber?: string;
}

interface OpenPhoneWebhookPayload {
  type: string;
  data: {
    object: OpenPhoneMessageObject & OpenPhoneCallObject;
    participants?: OpenPhoneParticipant[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalisePhone(raw: string | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleOpenPhoneWebhook(req: Request, res: Response) {
  // Acknowledge immediately — OpenPhone expects a 2xx within a few seconds
  res.status(200).json({ received: true });

  try {
    const payload = req.body as OpenPhoneWebhookPayload;
    if (!payload?.type || !payload?.data?.object) return;

    const { type, data } = payload;
    const obj = data.object;

    // Only process inbound events
    if (obj.direction && obj.direction !== "incoming") return;

    const rawPhone = obj.from ?? "";
    const phone = normalisePhone(rawPhone);

    // Try to match against an existing client
    const matchedClient = phone ? await getClientByPhone(phone) : undefined;
    const contactName = matchedClient?.name ?? data.participants?.find(p => p.phoneNumber === rawPhone)?.name ?? undefined;

    const now = Date.now();

    if (type === "message.received") {
      // ── Inbound SMS ──────────────────────────────────────────────────────────
      const body = obj.body?.trim() || "(no message body)";

      // Log to client communications if we have a matched client
      if (matchedClient?.id) {
        const db = await getDb();
        if (db) {
          await db.insert(clientCommunications).values({
            clientId: matchedClient.id,
            direction: "inbound",
            channel: "sms",
            body,
            fromAddress: phone || undefined,
          });
        }
      }

      await createFollowUp({
        contactName: contactName ?? (phone || "Unknown"),
        phone: phone || undefined,
        type: "text",
        note: `📱 Inbound SMS: ${body}`,
        isFollowedUp: false,
        contactedAt: now,
        clientId: matchedClient?.id ?? undefined,
        proposalStatus: "none",
        isUrgent: false,
        clientContacted: false,
      });
      console.log(`[Webhook] Inbound SMS from ${phone} → follow-up + comm log created`);
    } else if (type === "call.completed") {
      // ── Missed call or voicemail ─────────────────────────────────────────────
      const status = obj.status ?? "";
      // Only create follow-up for missed calls or voicemails
      if (status !== "missed" && status !== "voicemail" && !obj.voicemailUrl) return;

      let note = "📞 Missed call";
      if (obj.voicemailUrl) {
        note = "📞 Voicemail received";
        if (obj.transcription) {
          note += `: "${obj.transcription}"`;
        }
      }

      await createFollowUp({
        contactName: contactName ?? undefined,
        phone: phone || undefined,
        type: "call",
        note,
        isFollowedUp: false,
        contactedAt: now,
        clientId: matchedClient?.id ?? undefined,
        proposalStatus: "none",
        isUrgent: false,
        clientContacted: false,
      });
      console.log(`[Webhook] Inbound ${status} from ${phone} → follow-up created`);
    }
  } catch (err) {
    console.error("[Webhook] OpenPhone handler error:", err);
  }
}
