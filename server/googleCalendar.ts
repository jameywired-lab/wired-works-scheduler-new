/**
 * Google Calendar helper — uses the Google Calendar REST API with OAuth2.
 * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.
 * Each user stores their own access/refresh tokens in the googleTokens table.
 */

import { eq } from "drizzle-orm";
import { googleTokens } from "../drizzle/schema";
import { getDb } from "./db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
}

// ─── Token Management ─────────────────────────────────────────────────────────

export async function getStoredToken(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function saveToken(
  userId: number,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: number,
  calendarId = "primary"
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(googleTokens)
    .values({ userId, accessToken, refreshToken: refreshToken ?? null, expiresAt, calendarId })
    .onDuplicateKeyUpdate({
      set: { accessToken, refreshToken: refreshToken ?? null, expiresAt, calendarId },
    });
}

export async function deleteToken(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number } | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !data.access_token) {
      console.error("[GCal] Token refresh failed:", data.error);
      return null;
    }
    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
  } catch (err) {
    console.error("[GCal] Token refresh exception:", err);
    return null;
  }
}

async function getValidAccessToken(userId: number): Promise<string | null> {
  const token = await getStoredToken(userId);
  if (!token) return null;

  // Token still valid (with 60s buffer)
  if (token.expiresAt > Date.now() + 60_000) {
    return token.accessToken;
  }

  // Refresh if we have a refresh token
  if (token.refreshToken) {
    const refreshed = await refreshAccessToken(token.refreshToken);
    if (refreshed) {
      await saveToken(userId, refreshed.accessToken, token.refreshToken, refreshed.expiresAt, token.calendarId ?? "primary");
      return refreshed.accessToken;
    }
  }

  return null;
}

// ─── Calendar API Calls ───────────────────────────────────────────────────────

export async function createCalendarEvent(
  userId: number,
  event: GoogleCalendarEvent
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    console.warn("[GCal] No valid token for user", userId);
    return null;
  }
  const token = await getStoredToken(userId);
  const calendarId = encodeURIComponent(token?.calendarId ?? "primary");

  try {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    const data = (await res.json()) as { id?: string; error?: unknown };
    if (!res.ok) {
      console.error("[GCal] Create event failed:", data.error);
      return null;
    }
    return data.id ?? null;
  } catch (err) {
    console.error("[GCal] Create event exception:", err);
    return null;
  }
}

export async function updateCalendarEvent(
  userId: number,
  eventId: string,
  event: GoogleCalendarEvent
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return false;
  const token = await getStoredToken(userId);
  const calendarId = encodeURIComponent(token?.calendarId ?? "primary");

  try {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${eventId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    return res.ok;
  } catch (err) {
    console.error("[GCal] Update event exception:", err);
    return false;
  }
}

export async function deleteCalendarEvent(
  userId: number,
  eventId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return false;
  const token = await getStoredToken(userId);
  const calendarId = encodeURIComponent(token?.calendarId ?? "primary");

  try {
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.error("[GCal] Delete event exception:", err);
    return false;
  }
}

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

export function getGoogleAuthUrl(redirectUri: string, state: string): string | null {
  if (!GOOGLE_CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !data.access_token) {
      console.error("[GCal] Code exchange failed:", data.error);
      return null;
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? "",
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
  } catch (err) {
    console.error("[GCal] Code exchange exception:", err);
    return null;
  }
}

// ─── Job → Calendar Event Conversion ─────────────────────────────────────────

export function jobToCalendarEvent(job: {
  title: string;
  description?: string | null;
  address?: string | null;
  scheduledStart: number;
  scheduledEnd: number;
  clientName?: string;
}): GoogleCalendarEvent {
  return {
    summary: job.clientName ? `${job.title} — ${job.clientName}` : job.title,
    description: job.description ?? undefined,
    location: job.address ?? undefined,
    start: { dateTime: new Date(job.scheduledStart).toISOString() },
    end: { dateTime: new Date(job.scheduledEnd).toISOString() },
  };
}
