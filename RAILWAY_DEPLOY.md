# Railway Deployment Guide — Wired Works Scheduler

This guide walks you through deploying the Wired Works Scheduler to Railway from your GitHub repository. Once set up, every future code change pushed to GitHub will automatically redeploy in about 2 minutes.

---

## Prerequisites

- A [Railway account](https://railway.app) (free to sign up)
- Your GitHub repo: `jameywired-lab/wired-works-scheduler-new`
- Your OpenPhone API key and phone number
- Your Google OAuth credentials (if you use Google Calendar sync)

---

## Step 1 — Create a New Railway Project

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project**.
3. Select **Deploy from GitHub repo**.
4. Connect your GitHub account if prompted, then select `jameywired-lab/wired-works-scheduler-new`.
5. Railway will detect the `Dockerfile` automatically and start building.

---

## Step 2 — Add a MySQL Database

1. Inside your Railway project, click **+ New Service**.
2. Select **Database → MySQL**.
3. Railway creates a MySQL instance and automatically injects `MYSQL_URL` into your environment.
4. Click on the MySQL service, go to **Variables**, and copy the `MYSQL_URL` value.
5. Go to your **app service → Variables** and add:
   ```
   DATABASE_URL = <paste the MYSQL_URL value here>
   ```

---

## Step 3 — Run the Database Migration

After the first deploy, you need to create all the tables. Railway provides a one-time console for this.

1. In your Railway project, click on your **app service**.
2. Click **Settings → Deploy → Run Command** (or use the Railway CLI).
3. Alternatively, use the MySQL service's built-in query editor:
   - Click the MySQL service → **Data** tab → **Query**.
   - Copy the entire contents of `railway-db-schema.sql` from your repo and paste it into the query editor.
   - Click **Run** — this creates all tables in one shot.

---

## Step 4 — Set Environment Variables

In your Railway **app service → Variables**, add each of the following:

### Required — App Will Not Start Without These

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | From Railway MySQL service (Step 2) |
| `JWT_SECRET` | Random secret for session cookies | Generate: `openssl rand -hex 32` |
| `NODE_ENV` | Must be set to `production` | Type: `production` |
| `PORT` | Railway sets this automatically | Leave blank — Railway injects it |

### Required — SMS (OpenPhone)

| Variable | Description | Where to get it |
|---|---|---|
| `OPENPHONE_API_KEY` | Your OpenPhone API key | OpenPhone dashboard → Integrations |
| `OPENPHONE_FROM_NUMBER` | Your OpenPhone phone number | E.164 format, e.g. `+17275551234` |

### Required — Google Calendar Sync

| Variable | Description | Where to get it |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console |

### Optional — Manus Auth (if keeping Manus login)

| Variable | Description |
|---|---|
| `VITE_APP_ID` | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Manus OAuth server URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL |
| `OWNER_OPEN_ID` | Your Manus user ID |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API URL |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API key |

### Optional — Webhooks

| Variable | Description |
|---|---|
| `WEBHOOK_SECRET` | Secret for validating incoming webhooks |
| `RESEND_API_KEY` | Resend email API key (if using email features) |

### Frontend Variables (must be set at build time)

| Variable | Description |
|---|---|
| `VITE_APP_ID` | Same as server-side `VITE_APP_ID` |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus frontend API key |
| `VITE_FRONTEND_FORGE_API_URL` | Manus frontend API URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL |

> **Note:** `VITE_*` variables are baked into the frontend at build time. If you change them, you must trigger a redeploy.

---

## Step 5 — Set Your Domain

1. In Railway, go to your app service → **Settings → Networking**.
2. Click **Generate Domain** to get a free `*.railway.app` URL.
3. Or click **Custom Domain** to use your own domain (e.g. `app.wiredworks.com`).

---

## Step 6 — Update OpenPhone Webhook URL

Once your Railway app is live, update your OpenPhone webhook to point to your new URL:

```
https://your-app.railway.app/api/openphone/webhook
```

---

## Ongoing Deployments (How to Push Updates)

Every time you make changes through Manus:

1. Manus builds and tests the change.
2. Manus pushes the updated code to `jameywired-lab/wired-works-scheduler-new` on GitHub.
3. Railway detects the new commit and automatically rebuilds and redeploys (~2 minutes).
4. Your live app is updated — no action needed on your end.

You can monitor deploy status in the Railway dashboard under your project's **Deployments** tab.

---

## Rollback

If a deployment causes issues:

1. Go to Railway → your app service → **Deployments** tab.
2. Find the last working deployment.
3. Click the three-dot menu → **Rollback to this deploy**.

Railway instantly switches back to the previous version.

---

## Estimated Monthly Cost on Railway

| Service | Cost |
|---|---|
| App server (Hobby plan) | ~$5/month |
| MySQL database | ~$5–$10/month depending on data size |
| **Total** | **~$10–$15/month** |

Railway's Hobby plan includes $5 of free credit per month, so your first month may be partially or fully covered.
