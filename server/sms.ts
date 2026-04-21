/**
 * SMS helper — uses the OpenPhone (Quo) REST API.
 * Requires OPENPHONE_API_KEY and OPENPHONE_FROM_NUMBER environment variables.
 *
 * The API sends messages from your OpenPhone number to the recipient.
 * If credentials are not configured, SMS calls are silently skipped so the
 * rest of the app continues to function normally.
 *
 * OpenPhone API docs: https://www.quo.com/docs/mdx/api-reference/send-your-first-message
 * Endpoint: POST https://api.openphone.com/v1/messages
 * Auth header: Authorization: <api-key>  (no "Bearer" prefix)
 */

const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
const OPENPHONE_FROM_NUMBER = process.env.OPENPHONE_FROM_NUMBER;

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Normalise a phone number to E.164 format (+1XXXXXXXXXX).
 * Handles common US formats: (904) 685-1240, 9046851240, 904-685-1240, etc.
 */
function toE164(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, "");
  // US number: 10 digits → prepend +1
  if (digits.length === 10) return `+1${digits}`;
  // Already has country code: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already in E.164 or international — return as-is with + prefix
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export async function sendSms(to: string, body: string, mediaUrls?: string[]): Promise<SmsResult> {
  if (!OPENPHONE_API_KEY || !OPENPHONE_FROM_NUMBER) {
    console.warn("[SMS] OpenPhone credentials not configured — skipping SMS to", to);
    return { success: false, error: "OpenPhone credentials not configured" };
  }

  const toFormatted = toE164(to);
  const fromFormatted = toE164(OPENPHONE_FROM_NUMBER);

  try {
    const response = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": OPENPHONE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: body,
        from: fromFormatted,
        to: [toFormatted],
        ...(mediaUrls && mediaUrls.length > 0 ? { mediaUrls } : {}),
      }),
    });

    // OpenPhone returns 202 Accepted on success
    if (response.status === 202 || response.ok) {
      let messageId: string | undefined;
      try {
        const data = (await response.json()) as { data?: { id?: string } };
        messageId = data?.data?.id;
      } catch {
        // 202 with no body is fine
      }
      console.log(`[SMS] Sent via OpenPhone to ${toFormatted}${messageId ? ` — ID: ${messageId}` : ""}`);
      return { success: true, messageId };
    }

    // Parse error response
    let errMsg = `HTTP ${response.status}`;
    try {
      const errData = (await response.json()) as { message?: string; error?: string };
      errMsg = errData.message ?? errData.error ?? errMsg;
    } catch {
      // ignore parse error
    }
    console.error(`[SMS] OpenPhone failed to send to ${toFormatted}:`, errMsg);
    return { success: false, error: errMsg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SMS] OpenPhone exception:", message);
    return { success: false, error: message };
  }
}

// ─── Convenience message templates ───────────────────────────────────────────

export function bookingConfirmationMessage(clientName: string, jobTitle: string, date: string, time: string): string {
  return `Hi ${clientName}! Your appointment for "${jobTitle}" has been confirmed for ${date} at ${time}. We look forward to seeing you! — Wired Works`;
}

export function reminderMessage(clientName: string, jobTitle: string, time: string): string {
  return `Hi ${clientName}, just a reminder that your "${jobTitle}" appointment is coming up in about 1 hour at ${time}. See you soon! — Wired Works`;
}

export function reviewRequestMessage(clientName: string, jobTitle: string): string {
  return `Hi ${clientName}, thank you for choosing Wired Works for your "${jobTitle}" service! We'd love to hear your feedback. Please leave us a review — it means the world to us. Thank you!`;
}
