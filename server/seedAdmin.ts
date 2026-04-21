/**
 * seedAdmin.ts
 * Runs once on startup if ADMIN_EMAIL and ADMIN_PASSWORD are set in env.
 * Creates or updates the admin user with a hashed password so the app
 * is usable on first deploy without any manual DB steps.
 */
import { hashPassword } from "./_core/localAuth";
import { getUserByEmail, upsertUser, setUserPassword } from "./db";

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return; // Nothing to do

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
