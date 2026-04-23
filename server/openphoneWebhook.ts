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
import { createFollowUp, getClientByPhone, getDb, createNotification, createCallLog, createInboundSmsLog } from "./db";
import { clientCommunications, followUps } from "../drizzle/schema";
import { and, eq, isNull, or } from "drizzle-orm";

// ─── Type stubs for OpenPhone webhook payloads ────────────────────────────────

interface OpenPhoneFrom {
  name?: string;
  phoneNumber?: string;
}

interface OpenPhoneMessageObject {
  from?: string;           // E.164 phone number
  to?: string | string[];  // E.164 phone number (string in v3, array in older versions)
  body?: string;           // SMS body text
  direction?: string;      // "incoming" | "outgoing"
  media?: { url: string }[];
  phoneNumberId?: string;
  conversationId?: string;
  userId?: string;
}

interface OpenPhoneCallObject {
  from?: string;           // E.164 phone number
  to?: string | string[];  // E.164 phone number (string in v3, array in older versions)
  direction?: string;      // "incoming" | "outgoing"
  status?: string;         // "missed" | "completed" | "voicemail" etc.
  voicemailUrl?: string;
  transcription?: string;  // Voicemail transcription if available
  duration?: number;       // seconds
  phoneNumberId?: string;
  conversationId?: string;
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
    console.log(`[Webhook] Received event type: ${payload?.type}`);
    console.log(`[Webhook] Payload: ${JSON.stringify(payload?.data?.object)}`);
    if (!payload?.type || !payload?.data?.object) return;

    const { type, data } = payload;
    const obj = data.object;

    const rawPhone = obj.from ?? "";
    const phone = normalisePhone(rawPhone);
    const isInbound = !obj.direction || obj.direction === "incoming";

    // Try to match against an existing client
    const matchedClient = phone ? await getClientByPhone(phone) : undefined;
    // Try to get contact name from matched client, then participants (older API), then undefined
    const participantName = data.participants?.find(p => p.phoneNumber === rawPhone)?.name
      ?? data.participants?.find(p => normalisePhone(p.phoneNumber ?? '') === phone)?.name
      ?? undefined;
    const contactName = matchedClient?.name ?? participantName ?? undefined;

    const now = Date.now();

    if (type === "message.received") {
      // ── SMS (inbound or outbound) ─────────────────────────────────────────
      const body = obj.body?.trim() || "(no message body)";

      // Always log to inboundSmsLog for the Communications page (all directions)
      await createInboundSmsLog({
        fromNumber: phone || rawPhone,
        toNumber: Array.isArray(obj.to) ? (obj.to[0] ?? "") : (obj.to ?? ""),
        direction: isInbound ? "inbound" : "outbound",
        body,
        clientId: matchedClient?.id ?? undefined,
        contactName: contactName ?? undefined,
      });

      // Only create follow-ups and client communications for inbound messages
      if (!isInbound) return;

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

      // Check for an existing active (non-completed) text follow-up from this phone number
      const db = await getDb();
      let grouped = false;
      if (db && phone) {
        const existing = await db
          .select()
          .from(followUps)
          .where(
            and(
              eq(followUps.type, "text"),
              eq(followUps.isFollowedUp, false),
              or(
                eq(followUps.phone, phone),
                matchedClient?.id ? eq(followUps.clientId, matchedClient.id) : isNull(followUps.clientId)
              )
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const ex = existing[0];
          // Parse existing messages array
          let msgs: { body: string; receivedAt: number }[] = [];
          try { msgs = ex.messages ? JSON.parse(ex.messages) : []; } catch { msgs = []; }
          // If no messages yet, seed with the original note
          if (msgs.length === 0 && ex.note) {
            const origBody = ex.note.replace(/^📱 Inbound SMS: /, "");
            msgs = [{ body: origBody, receivedAt: ex.contactedAt ?? ex.createdAt.getTime() }];
          }
          msgs.push({ body, receivedAt: now });

          await db
            .update(followUps)
            .set({
              note: `📱 Inbound SMS (${msgs.length} messages): ${body}`,
              messageCount: msgs.length,
              messages: JSON.stringify(msgs),
              contactedAt: now, // update to latest message time
            })
            .where(eq(followUps.id, ex.id));

          console.log(`[Webhook] Inbound SMS from ${phone} → grouped into follow-up #${ex.id} (${msgs.length} messages)`);
          // Create a notification for the new message
          await createNotification({
            title: `New text from ${contactName ?? phone}`,
            body: body.length > 120 ? body.slice(0, 117) + "..." : body,
            type: "inbound_sms",
            relatedId: ex.id,
            relatedType: "followUp",
          });
          grouped = true;
        }
      }

      if (!grouped) {
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
        console.log(`[Webhook] Inbound SMS from ${phone} → new follow-up created`);
        // Create a notification for the new inbound text
        await createNotification({
          title: `New text from ${contactName ?? phone}`,
          body: body.length > 120 ? body.slice(0, 117) + "..." : body,
          type: "inbound_sms",
          relatedType: "followUp",
        });
      }
    } else if (type === "call.completed") {
      // ── Missed call or voicemail ─────────────────────────────────────────────
      const status = obj.status ?? "";
      // Always log to callLog for the Communications page (all completed calls)
      const callStatus: "completed" | "missed" | "voicemail" | "no-answer" | "busy" | "failed" =
        obj.voicemailUrl ? "voicemail" :
        status === "missed" ? "missed" :
        status === "completed" ? "completed" :
        status === "no-answer" ? "no-answer" :
        status === "busy" ? "busy" :
        status === "failed" ? "failed" : "completed";

      await createCallLog({
        fromNumber: phone || rawPhone,
        toNumber: Array.isArray(obj.to) ? (obj.to[0] ?? "") : (obj.to ?? ""),
        direction: isInbound ? "inbound" : "outbound",
        status: callStatus,
        duration: obj.duration ?? undefined,
        recordingUrl: obj.voicemailUrl ?? undefined,
        transcription: obj.transcription ?? undefined,
        clientId: matchedClient?.id ?? undefined,
        contactName: contactName ?? undefined,
      });

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
      // Create a notification for the missed call / voicemail
      await createNotification({
        title: `${obj.voicemailUrl ? "Voicemail" : "Missed call"} from ${contactName ?? phone}`,
        body: note,
        type: "inbound_call",
        relatedType: "followUp",
      });
    }
  } catch (err) {
    console.error("[Webhook] OpenPhone handler error:", err);
  }
}
