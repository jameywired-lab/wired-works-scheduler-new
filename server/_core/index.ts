import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerLocalAuthRoutes } from "./localAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleOpenPhoneWebhook } from "../openphoneWebhook";
import { handleProposalAcceptedWebhook, handleWebhookInfo } from "../proposalAcceptedWebhook";
import { runMigrations } from "../migrate";
import { seedAdminUser } from "../seedAdmin";
import { runDailyBackup } from "../backup";

async function startServer() {
  // Run DB migrations before accepting any traffic — safe to re-run on every boot
  await runMigrations();
  // Seed the admin user if ADMIN_EMAIL + ADMIN_PASSWORD env vars are set
  await seedAdminUser();

  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Simple health check — Railway uses this to confirm the app is up
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, v: "webhook-fix" });
  });

  // Local username/password auth routes (/api/auth/login, /api/auth/logout)
  registerLocalAuthRoutes(app);
  // OpenPhone inbound webhook — auto-creates follow-ups for inbound SMS and missed calls/voicemails
  app.post("/api/openphone/webhook", handleOpenPhoneWebhook);
  // Portal.io → Zapier → Wired Works: auto-create project when proposal is accepted
  app.get("/api/webhooks/proposal-accepted/info", handleWebhookInfo);
  app.post("/api/webhooks/proposal-accepted", handleProposalAcceptedWebhook);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Railway injects PORT automatically (usually 8080). Never hardcode the port.
  const port = parseInt(process.env.PORT || "8080");

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Schedule daily backup at 2:00 AM UTC
  const scheduleBackup = () => {
    const now = new Date();
    const next2am = new Date();
    next2am.setUTCHours(2, 0, 0, 0);
    if (next2am <= now) next2am.setUTCDate(next2am.getUTCDate() + 1);
    const msUntilNext = next2am.getTime() - now.getTime();
    setTimeout(async () => {
      try { await runDailyBackup(); } catch (e) { console.error('[backup] Failed:', e); }
      setInterval(async () => {
        try { await runDailyBackup(); } catch (e) { console.error('[backup] Failed:', e); }
      }, 24 * 60 * 60 * 1000);
    }, msUntilNext);
    console.log(`[backup] Next backup scheduled in ${Math.round(msUntilNext / 3600000)}h`);
  };
  scheduleBackup();
}

startServer().catch(console.error);
