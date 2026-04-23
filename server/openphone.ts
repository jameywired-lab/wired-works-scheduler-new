/**
 * OpenPhone API helpers
 * Docs: https://developers.openphone.com/docs/api/contacts
 */

const OPENPHONE_API_KEY = process.env.OPENPHONE_API_KEY;
const BASE_URL = "https://api.openphone.com/v1";

/**
 * Create a contact in OpenPhone.
 * Silently no-ops if the API key is not configured.
 * Returns the created contact ID or null on failure.
 */
export async function syncContactToOpenPhone(contact: {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
}): Promise<string | null> {
  if (!OPENPHONE_API_KEY) {
    console.warn("[OpenPhone] OPENPHONE_API_KEY not set — skipping contact sync");
    return null;
  }

  // OpenPhone requires at least a phone number to create a contact
  if (!contact.phone) {
    return null;
  }

  // Normalize phone number to E.164 format if possible
  const rawPhone = contact.phone.replace(/\D/g, "");
  const e164Phone = rawPhone.startsWith("1") && rawPhone.length === 11
    ? `+${rawPhone}`
    : rawPhone.length === 10
    ? `+1${rawPhone}`
    : contact.phone;

  // Split name into first/last
  const nameParts = contact.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? contact.name;
  const lastName = nameParts.slice(1).join(" ") || undefined;

  try {
    const body: Record<string, unknown> = {
      firstName,
      ...(lastName ? { lastName } : {}),
      phoneNumbers: [{ number: e164Phone }],
      ...(contact.email ? { emails: [{ email: contact.email }] } : {}),
      ...(contact.company ? { company: contact.company } : {}),
    };

    const res = await fetch(`${BASE_URL}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: OPENPHONE_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[OpenPhone] Failed to create contact (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json() as { data?: { id?: string } };
    const contactId = data?.data?.id ?? null;
    if (contactId) {
      console.log(`[OpenPhone] Contact created: ${contactId} for ${contact.name}`);
    }
    return contactId ?? null;
  } catch (err) {
    console.warn("[OpenPhone] Error syncing contact:", err);
    return null;
  }
}
