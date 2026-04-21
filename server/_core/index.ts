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
    res.json({ ok: true, v: "9129d3d" });
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
}

startServer().catch(console.error);
