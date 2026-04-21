/**
 * seedAdmin.ts
 * Runs once on startup if ADMIN_EMAIL and ADMIN_PASSWORD are set in env.
 * Creates or updates the admin user with a hashed password so the app
 * is usable on first deploy without any manual DB steps.
 *
 * Also ensures the passwordHash column exists (in case the DB was created
 * before this column was added to the schema).
 */
import { createPool } from "mysql2/promise";
import { hashPassword } from "./_core/localAuth";
import { getUserByEmail, upsertUser, setUserPassword } from "./db";

/** Ensure the passwordHash column exists on the users table */
async function ensurePasswordHashColumn() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  const pool = createPool({ uri: dbUrl });
  try {
    // This is a no-op if the column already exists (MySQL 8.0+)
    await pool.query(
      "ALTER TABLE `users` ADD IF NOT EXISTS `passwordHash` varchar(255)"
    );
    console.log("[seedAdmin] passwordHash column ensured");
  } catch (err) {
    // If it fails for any reason, log but don't crash — the column may already exist
    const e = err as { code?: string; message?: string };
    console.warn("[seedAdmin] Could not ensure passwordHash column:", e.code, e.message);
  } finally {
    await pool.end();
  }
}

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return; // Nothing to do

  // Ensure the column exists before any drizzle query touches it
  await ensurePasswordHashColumn();

  try {
    let user = await getUserByEmail(email);
    if (!user) {
      // Create the admin user
      const openId = `admin-${Date.now()}`;
      await upsertUser({
        openId,
        name: process.env.ADMIN_NAME || "Admin",
        email,
        loginMethod: "local",
        role: "admin",
        lastSignedIn: new Date(),
      });
      user = await getUserByEmail(email);
    }
    if (!user) return;
    // Always update the password hash (allows password rotation via env var)
    const hash = await hashPassword(password);
    await setUserPassword(user.openId, hash);
    console.log(`[seedAdmin] Admin user ready: ${email}`);
  } catch (err) {
    console.error("[seedAdmin] Failed to seed admin user:", err);
  }
}
